/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Metanet.page SDK Provider                                              ║
 * ║  Docs: https://www.metanet.page/developers                              ║
 * ║                                                                          ║
 * ║  ENVIRONMENT: Sandboxed iframe inside metanet.page / metanet.ninja      ║
 * ║                                                                          ║
 * ║  HOW IT WORKS                                                            ║
 * ║  ─────────────────────────────────────────────────────────────────────  ║
 * ║  1. All platform communication is via postMessage.                       ║
 * ║     SEND:    window.parent.postMessage({ command: "ninja-app-command",  ║
 * ║                detail: { type: "...", ...params } }, "*")               ║
 * ║     RECEIVE: window.addEventListener("message", handler)                ║
 * ║                                                                          ║
 * ║  2. Every response from the platform has shape:                          ║
 * ║     { type: "<cmd>-response", payload: {...},                           ║
 * ║       signature: "<DER hex>", command: "ninja-app-command" }            ║
 * ║                                                                          ║
 * ║  3. SIGNATURE VERIFICATION (secp256k1 / SHA-256)                        ║
 * ║     - Platform signs: SHA256(JSON.stringify(payload))                   ║
 * ║     - Using the wallet public key captured in connection-response        ║
 * ║     - Signature is DER-encoded, publicKey is uncompressed/compressed hex ║
 * ║     - connection-response is special: it may also sign the full outer   ║
 * ║       message (minus signature/command) because icIdentityPackage and   ║
 * ║       genericUseSeed sit at the top level alongside payload.            ║
 * ║     - We try multiple candidates and accept the first that verifies.    ║
 * ║     - verification failure is NEVER fatal; origin validation is the     ║
 * ║       primary security boundary. signatureValid:false just means we     ║
 * ║       couldn't verify (e.g. placeholder/dummy sig on first connection). ║
 * ║                                                                          ║
 * ║  4. UNIFIED RESPONSE FLOW (same path for every command)                 ║
 * ║     raw message → origin check → type route → sig verify →             ║
 * ║     dispatchToCallbacks({ ...data, signatureValid })                    ║
 * ║     Pages subscribe via onCommand(cb) / unsubscribe via offCommand(cb)  ║
 * ║     and filter by data.type inside their own handler.                   ║
 * ║                                                                          ║
 * ║  5. QUANTUM-SAFE SEED                                                    ║
 * ║     genericUseSeed (hex, from connection-response) is imported once as  ║
 * ║     non-extractable HKDF CryptoKey. Derived keys use versioned info:    ║
 * ║     "metanet:v1:<purpose>" → bump version prefix to migrate to PQC.    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import {
  DelegationChain,
  DelegationIdentity,
  Ed25519KeyIdentity,
} from "@dfinity/identity";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Trusted origins ───────────────────────────────────────────────────────────
const TRUSTED_ORIGINS = [
  "https://www.metanet.page",
  "https://www.metanet.ninja",
];

// ─── HKDF salt (app-level, prevents cross-app key reuse) ──────────────────────
const HKDF_SALT = new TextEncoder().encode("metanet-caffeine-sdk-v1");

// ─── hex helper (needed before verify functions) ──────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const padded = clean.length % 2 === 0 ? clean : `0${clean}`;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = Number.parseInt(padded.substring(i, i + 2), 16);
  }
  return bytes;
}

// ─── secp256k1 signature verification ─────────────────────────────────────────
// Platform signing contract:
//   hash  = SHA256(JSON.stringify(candidate_payload))
//   sig   = secp256k1 DER-encoded signature over hash
//   pubkey = wallet.publicKeyHex from connection-response
//
// elliptic is loaded lazily from CDN (not bundled — not in package.json).
// We try candidates in order; the first that passes verification wins.
// Never throws — all failures return false gracefully.

// Lazy singleton: load elliptic once from CDN, cache the EC instance.
let _ecCurve: {
  keyFromPublic: (
    pub: string,
    enc: string,
  ) => { verify: (hash: string, sig: string) => boolean };
} | null = null;
async function getEcCurve() {
  if (_ecCurve) return _ecCurve;
  try {
    // @ts-ignore
    const mod = await import(
      /* @vite-ignore */ "https://esm.sh/elliptic@6.5.7"
    );
    const EC = mod.default?.ec ?? mod.ec;
    _ecCurve = new EC("secp256k1");
  } catch {
    _ecCurve = null;
  }
  return _ecCurve;
}

async function verifySecp256k1(
  candidate: unknown,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const ec = await getEcCurve();
    if (!ec) return false;
    const msgBytes = new TextEncoder().encode(JSON.stringify(candidate));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBytes);
    const msgHashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const key = ec.keyFromPublic(publicKeyHex, "hex");
    return key.verify(msgHashHex, signatureHex);
  } catch {
    return false;
  }
}

// Try multiple candidate payloads; returns true on the first match.
async function tryVerify(
  candidates: unknown[],
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  for (const candidate of candidates) {
    if (await verifySecp256k1(candidate, signatureHex, publicKeyHex))
      return true;
  }
  return false;
}

// Build candidates for any response message.
// Priority order matches known platform signing behaviour:
//   1. payload only (most responses)
//   2. { type, payload } — type + payload
//   3. full outer message minus signature/command/signatureValid
function buildCandidates(data: Record<string, unknown>): unknown[] {
  const candidates: unknown[] = [];

  if (data.payload !== undefined) candidates.push(data.payload);

  if (data.type !== undefined && data.payload !== undefined) {
    candidates.push({ type: data.type, payload: data.payload });
  }

  // Full outer message stripped of meta fields
  const full: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k !== "signature" && k !== "command" && k !== "signatureValid") {
      full[k] = v;
    }
  }
  candidates.push(full);

  return candidates;
}

// ─── TypeScript command detail types ──────────────────────────────────────────
export type ConnectionDetail = { type: "connection"; navbg?: string };
export type OpenLinkDetail = { type: "open-link"; url: string; ref?: string };
export type WriteClipboardDetail = { type: "write-clipboard"; text: string };
export type PayDetailBSV = {
  type: "pay";
  ref: string;
  recipients: Array<{
    address?: string;
    value?: number; // satoshis
    fiatValue?: number;
    currency?: string;
    note?: string;
    reason?: string;
  }>;
};
export type PayDetailICP = {
  type: "pay";
  ref: string;
  token: { protocol: "ICP"; specification: { ledgerId: string } };
  recipients: [{ address: string; value: number; note?: string }];
};
export type PayDetailKDA = {
  type: "pay";
  ref: string;
  token: { protocol: "KDA"; specification: { chainId?: string } };
  recipients: [{ address: string; value: number; note?: string }];
};
export type GeolocationDetail = { type: "geolocation"; ref?: string };
export type TokenHistoryDetailBSV = {
  type: "token-history";
  offset: number;
  limit: number;
  ref?: string;
};
export type TokenHistoryDetailICP = {
  type: "token-history";
  offset: number;
  limit: number;
  ref?: string;
  token: { protocol: "ICP"; specification: { indexCanisterId: string } };
};
export type FullTransactionDetail = {
  type: "full-transaction";
  txid: string;
  ref?: string;
};
export type CreatePostDetail = {
  type: "create-post";
  params: {
    headline: string;
    nftDescription: string;
    previewAsset?: { type: "image" | "video"; file: File; preview: string };
    extraContents?: Array<{
      type: string;
      file?: File;
      contentData?: string;
      preview?: string;
    }>;
    appQuery?: Record<string, unknown>;
    appEmbed?: {
      url: string;
      type?: "video" | "audio" | "shop" | "game";
      shape?: "square" | "landscape";
    };
  };
};
export type AuthoriseSwapDetail = {
  type: "authorise-swap";
  contractTx: string;
  value: number;
};
export type SwapBuyDetail = {
  type: "swap-buy";
  swapHex: string;
  contractTx: string;
  value: number;
};
export type QRScanDetail = { type: "qr-scan"; ref?: string };
export type QRScanStopDetail = { type: "qr-scan-stop" };

// ─── Connection response types ─────────────────────────────────────────────────
export interface WalletInfo {
  address: string;
  publicKeyHex: string;
  rootPrincipal: string;
}

export interface AppPageSchema {
  protocolId: string;
  symbol: string;
  properties: {
    username: string;
    profile?: Record<string, unknown>;
    pubkey: string;
    signature: string;
    [key: string]: unknown;
  };
}

export interface ConnectionPayload {
  appId: string;
  timestamp: number;
  anonymous?: boolean;
  wallet?: WalletInfo;
  icDelegation?: unknown;
  appPageSchema?: AppPageSchema;
}

export interface IcIdentityPackage {
  delegation: unknown;
  privateKey: string;
}

// ─── Callback type ─────────────────────────────────────────────────────────────
export type CommandCallback = (
  data: Record<string, unknown> & { signatureValid?: boolean },
) => void;

// ─── SDK context type ──────────────────────────────────────────────────────────
export interface SDKContextType {
  /** Low-level: send any command to the parent platform */
  sendCommand: (detail: Record<string, unknown>) => void;
  /** Subscribe to all incoming platform responses. Filter by data.type in cb. */
  onCommand: (callback: CommandCallback) => void;
  /** Unsubscribe. Always call in useEffect cleanup to prevent leaks. */
  offCommand: (callback: CommandCallback) => void;
  isConnecting: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  walletAddress: string | null;
  publicKeyHex: string | null;
  rootPrincipal: string | null;
  icIdentity: DelegationIdentity | null;
  appPageSchema: AppPageSchema | null;
  connectionError: string | null;
  retryConnection: () => void;
  hasSeed: boolean;
  deriveSeedKey: (purpose: string) => Promise<Uint8Array>;
  sdk: {
    /**
     * connection — authenticate / re-authenticate with the platform.
     * @param navbg optional hex color for the platform nav bar (e.g. "#1A202C")
     * Response: connection-response
     *   payload.wallet.address     — BSV address
     *   payload.wallet.publicKeyHex — secp256k1 pubkey used for all sig checks
     *   payload.wallet.rootPrincipal — ICP principal
     *   icIdentityPackage           — Ed25519 delegation for ICP calls
     *   genericUseSeed              — 32-byte hex seed (stored as non-extractable HKDF key)
     *   payload.anonymous           — true if user not logged in
     */
    connection: (navbg?: string) => void;

    /**
     * openLink — open a URL in the platform browser (required inside iframe).
     * @param url full URL to open
     * @param ref optional correlation ID
     * Response: open-link-response → payload.success, payload.error?
     */
    openLink: (url: string, ref?: string) => void;

    /**
     * copyToClipboard — write text to the system clipboard via the platform.
     * @param text text to copy
     * No response expected.
     */
    copyToClipboard: (text: string) => void;

    /**
     * pay — trigger a payment. Pass PayDetailBSV | PayDetailICP | PayDetailKDA.
     *
     * BSV: recipients[].value = satoshis (integer)
     *      recipients[].fiatValue + currency = alternative to satoshis
     * ICP: token.specification.ledgerId = ICRC-1 ledger canister ID
     * KDA: token.specification.chainId = Kadena chain ID
     *
     * Response: pay-response
     *   payload.ref         — echoes your ref
     *   payload.success     — boolean
     *   payload.txid        — transaction ID (null on failure)
     *   payload.message     — human-readable status
     *   payload.responseCode — "OK_SUCCESS" | "ERR_ABORTED" | "ERR_*"
     */
    pay: (params: PayDetailBSV | PayDetailICP | PayDetailKDA) => void;

    /**
     * getLocation — request GPS coordinates.
     * May fire multiple times with increasing accuracy. isFinal:true = last update.
     * Response: geolocation-response
     *   payload.location.latitude, .longitude, .accuracy
     *   payload.isFinal — true on last update
     */
    getLocation: (ref?: string) => void;

    /**
     * getTokenHistory — paginated transaction history.
     * BSV default; pass token for ICP/ICRC-1.
     * Response: token-history-response → payload.transactions[], payload.pagination
     */
    getTokenHistory: (
      params: TokenHistoryDetailBSV | TokenHistoryDetailICP,
    ) => void;

    /**
     * getFullTransaction — raw tx hex + SPV proof by txid.
     * Response: full-transaction-response → payload.tx_hex, payload.bump_hex
     */
    getFullTransaction: (txid: string, ref?: string) => void;

    /**
     * createPost — create a Metanet post (NFT + media).
     * previewAsset must follow the fetch→blob→dataURL→File pipeline (see Demo.tsx).
     * Response: create-post-response → payload.success, payload.error?
     */
    createPost: (params: CreatePostDetail["params"]) => void;

    /**
     * authoriseSwap — list an NFT for sale.
     * @param contractTx raw tx hex of the NFT contract
     * @param value value in satoshis
     * Response: authorise-swap-response → payload.swapHex (store in backend)
     */
    authoriseSwap: (contractTx: string, value: number) => void;

    /**
     * swapBuy — purchase an NFT using a swapHex from the seller.
     * @param swapHex from authorise-swap-response
     * @param contractTx raw contract tx
     * @param value value in satoshis
     * Response: swap-buy-response → payload.success, payload.error?
     */
    swapBuy: (swapHex: string, contractTx: string, value: number) => void;

    /**
     * scanQR — open the platform QR code scanner.
     * Response: qr-scan-response → payload.data (scanned string)
     */
    scanQR: (ref?: string) => void;

    /**
     * stopQRScan — close the QR scanner programmatically.
     * No response expected.
     */
    stopQRScan: () => void;
  };
}

const SDKContext = createContext<SDKContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function SDKProvider({ children }: { children: ReactNode }) {
  const callbacksRef = useRef<Set<CommandCallback>>(new Set());
  const initiatorPublicKeyRef = useRef<string | null>(null);

  // Connection state
  const [isConnecting, setIsConnecting] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);
  const [rootPrincipal, setRootPrincipal] = useState<string | null>(null);
  const [icIdentity, setIcIdentity] = useState<DelegationIdentity | null>(null);
  const [appPageSchema, setAppPageSchema] = useState<AppPageSchema | null>(
    null,
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // QUANTUM-SAFE SEED
  // Raw hex → non-extractable HKDF CryptoKey immediately. Never stored anywhere else.
  // Derived keys: HKDF-SHA512, info="metanet:v1:<purpose>"
  // Migrate to PQC: bump version prefix to "metanet:v2:<purpose>" — same seed, new path.
  const seedKeyRef = useRef<CryptoKey | null>(null);
  const [hasSeed, setHasSeed] = useState(false);

  const importSeed = useCallback(async (seedHex: string): Promise<void> => {
    const rawBytes = hexToBytes(seedHex);
    const bytes = rawBytes.buffer.slice(
      rawBytes.byteOffset,
      rawBytes.byteOffset + rawBytes.byteLength,
    ) as ArrayBuffer;
    seedKeyRef.current = await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HKDF" },
      false, // non-extractable: can never be read back
      ["deriveBits"],
    );
    setHasSeed(true);
  }, []);

  const deriveSeedKey = useCallback(
    async (purpose: string): Promise<Uint8Array> => {
      if (!seedKeyRef.current)
        throw new Error("No seed available. Authenticate first.");
      const info = new TextEncoder().encode(`metanet:v1:${purpose}`);
      const bits = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-512", salt: HKDF_SALT, info },
        seedKeyRef.current,
        256,
      );
      return new Uint8Array(bits);
    },
    [],
  );

  // Core send
  const sendCommandFn = useCallback((detail: Record<string, unknown>) => {
    window.parent.postMessage({ command: "ninja-app-command", detail }, "*");
  }, []);

  // Callback management
  const onCommand = useCallback((callback: CommandCallback) => {
    callbacksRef.current.add(callback);
  }, []);

  const offCommand = useCallback((callback: CommandCallback) => {
    callbacksRef.current.delete(callback);
  }, []);

  const dispatchToCallbacks = useCallback(
    (data: Record<string, unknown> & { signatureValid?: boolean }) => {
      for (const cb of callbacksRef.current) {
        try {
          cb(data);
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  // ─── UNIFIED SIGNATURE VERIFICATION ──────────────────────────────────────
  // Used for ALL response types after publicKey is known from connection.
  // Returns boolean (never throws).
  const verifyResponseSignature = useCallback(
    async (
      data: Record<string, unknown>,
      publicKey: string,
    ): Promise<boolean> => {
      const sig = data.signature as string | undefined;
      if (!sig || !publicKey) return false;
      const candidates = buildCandidates(data);
      return tryVerify(candidates, sig, publicKey);
    },
    [],
  );

  // ─── UNIFIED MESSAGE HANDLER ──────────────────────────────────────────────
  //
  // Every incoming platform message follows the same path:
  //   1. Origin check
  //   2. Extract data
  //   3. Route on type
  //      a. connection-response: set auth state, extract identity/seed
  //      b. everything else: verify sig, dispatch
  //   4. Dispatch to all registered onCommand callbacks
  //
  // connection-response is the only special case because it:
  //   - contains the publicKey used for all future verification
  //   - contains icIdentityPackage and genericUseSeed
  //   - may have anonymous:true (stop retrying, show login prompt)
  //
  // For ALL other response types the flow is identical:
  //   verify sig with stored publicKey → dispatch
  //
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const isValidOrigin =
        TRUSTED_ORIGINS.includes(event.origin) ||
        event.origin === window.location.origin;
      if (!isValidOrigin) return;

      const raw = event.data;
      if (!raw) return;

      const data = (raw.detail ?? raw) as Record<string, unknown>;
      if (!data.type) return;

      const type = data.type as string;

      // ── connection-response ────────────────────────────────────────────────
      if (type === "connection-response") {
        const payload = data.payload as ConnectionPayload | undefined;
        const walletPubKey = payload?.wallet?.publicKeyHex;

        // Verify signature if we have a public key
        const sigValid = walletPubKey
          ? await verifyResponseSignature(data, walletPubKey)
          : false;

        // Anonymous user — stop retrying, prompt to log in
        if (payload?.anonymous === true) {
          resolvedRef.current = true;
          stopInterval();
          setIsConnecting(false);
          setIsAnonymous(true);
          dispatchToCallbacks({ ...data, signatureValid: false });
          return;
        }

        // Already authenticated — just dispatch (e.g. demo re-connect button)
        if (resolvedRef.current) {
          dispatchToCallbacks({ ...data, signatureValid: sigValid });
          return;
        }

        // Store public key for all future response verification
        if (walletPubKey) initiatorPublicKeyRef.current = walletPubKey;

        // Build ICP DelegationIdentity from icIdentityPackage
        const pkg = data.icIdentityPackage as IcIdentityPackage | undefined;
        if (!pkg?.delegation || !pkg?.privateKey) {
          resolvedRef.current = true;
          stopInterval();
          setIsConnecting(false);
          setConnectionError(
            "Identity package missing delegation or privateKey.",
          );
          dispatchToCallbacks({ ...data, signatureValid: sigValid });
          return;
        }

        try {
          const privateKeyBytes = hexToBytes(pkg.privateKey);
          const innerIdentity =
            Ed25519KeyIdentity.fromSecretKey(privateKeyBytes);
          const delegationChain = DelegationChain.fromJSON(
            pkg.delegation as Parameters<typeof DelegationChain.fromJSON>[0],
          );
          const delegationIdentity = DelegationIdentity.fromDelegation(
            innerIdentity,
            delegationChain,
          );

          const seedHex = data.genericUseSeed as string | undefined;
          if (seedHex) await importSeed(seedHex);

          resolvedRef.current = true;
          stopInterval();
          setIsConnecting(false);
          setIsAuthenticated(true);
          setIcIdentity(delegationIdentity);
          setWalletAddress(payload?.wallet?.address ?? null);
          setPublicKeyHex(walletPubKey ?? null);
          setRootPrincipal(payload?.wallet?.rootPrincipal ?? null);
          if (payload?.appPageSchema)
            setAppPageSchema(payload.appPageSchema as AppPageSchema);

          dispatchToCallbacks({ ...data, signatureValid: sigValid });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Identity construction failed";
          resolvedRef.current = true;
          stopInterval();
          setIsConnecting(false);
          setConnectionError(msg);
          dispatchToCallbacks({ ...data, signatureValid: sigValid });
        }
      } else {
        // ── ALL OTHER RESPONSES — unified path ──────────────────────────────
        // Verify signature using the public key captured at connection time.
        // signatureValid:false means either no key yet or sig didn't match.
        // This never blocks processing — errors are surfaced in the UI only.
        const storedPubKey = initiatorPublicKeyRef.current;
        const sigValid = storedPubKey
          ? await verifyResponseSignature(data, storedPubKey)
          : false;
        dispatchToCallbacks({ ...data, signatureValid: sigValid });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [stopInterval, importSeed, dispatchToCallbacks, verifyResponseSignature]);

  // Connection lifecycle
  const startInterval = useCallback(() => {
    stopInterval();
    resolvedRef.current = false;
    setIsConnecting(true);
    const send = () => sendCommandFn({ type: "connection" });
    send();
    intervalRef.current = setInterval(send, 1000);
  }, [sendCommandFn, stopInterval]);

  const retryConnection = useCallback(() => {
    setIsAuthenticated(false);
    setIsAnonymous(false);
    setWalletAddress(null);
    setPublicKeyHex(null);
    setRootPrincipal(null);
    setIcIdentity(null);
    setAppPageSchema(null);
    setConnectionError(null);
    setHasSeed(false);
    seedKeyRef.current = null;
    initiatorPublicKeyRef.current = null;
    startInterval();
  }, [startInterval]);

  // Start on mount
  useEffect(() => {
    startInterval();
    return stopInterval;
  }, [startInterval, stopInterval]);

  // Global external link interceptor (all <a> clicks inside iframe go via SDK)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as Element).closest(
        "a",
      ) as HTMLAnchorElement | null;
      if (!link?.href) return;
      try {
        const linkOrigin = new URL(link.href).origin;
        if (linkOrigin !== window.location.origin) {
          e.preventDefault();
          sendCommandFn({ type: "open-link", url: link.href });
        }
      } catch {
        /* ignore malformed URLs */
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [sendCommandFn]);

  // Typed SDK command wrappers
  const sdk: SDKContextType["sdk"] = {
    connection: (navbg?: string) =>
      sendCommandFn({ type: "connection", ...(navbg ? { navbg } : {}) }),
    openLink: (url: string, ref?: string) =>
      sendCommandFn({ type: "open-link", url, ...(ref ? { ref } : {}) }),
    copyToClipboard: (text: string) =>
      sendCommandFn({ type: "write-clipboard", text }),
    pay: (params: PayDetailBSV | PayDetailICP | PayDetailKDA) =>
      sendCommandFn(params as unknown as Record<string, unknown>),
    getLocation: (ref?: string) =>
      sendCommandFn({ type: "geolocation", ...(ref ? { ref } : {}) }),
    getTokenHistory: (params: TokenHistoryDetailBSV | TokenHistoryDetailICP) =>
      sendCommandFn(params as unknown as Record<string, unknown>),
    getFullTransaction: (txid: string, ref?: string) =>
      sendCommandFn({
        type: "full-transaction",
        txid,
        ...(ref ? { ref } : {}),
      }),
    createPost: (params: CreatePostDetail["params"]) =>
      sendCommandFn({
        type: "create-post",
        params: params as unknown as Record<string, unknown>,
      }),
    authoriseSwap: (contractTx: string, value: number) =>
      sendCommandFn({ type: "authorise-swap", contractTx, value }),
    swapBuy: (swapHex: string, contractTx: string, value: number) =>
      sendCommandFn({ type: "swap-buy", swapHex, contractTx, value }),
    scanQR: (ref?: string) =>
      sendCommandFn({ type: "qr-scan", ...(ref ? { ref } : {}) }),
    stopQRScan: () => sendCommandFn({ type: "qr-scan-stop" }),
  };

  const value: SDKContextType = {
    sendCommand: sendCommandFn,
    onCommand,
    offCommand,
    isConnecting,
    isAuthenticated,
    isAnonymous,
    walletAddress,
    publicKeyHex,
    rootPrincipal,
    icIdentity,
    appPageSchema,
    connectionError,
    retryConnection,
    hasSeed,
    deriveSeedKey,
    sdk,
  };

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}

export function useSDK(): SDKContextType {
  const ctx = useContext(SDKContext);
  if (!ctx) throw new Error("useSDK must be used within an SDKProvider");
  return ctx;
}
