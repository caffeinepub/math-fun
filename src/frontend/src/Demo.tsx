/**
 * Demo.tsx — Metanet Integration Scaffold: SDK Reference Demo
 *
 * PURPOSE:
 *   This file is the canonical reference implementation for all Metanet.page
 *   SDK capabilities. When duplicating this scaffold to build a new app:
 *   - KEEP this file intact as a working reference
 *   - KEEP SDKProvider.tsx intact
 *   - BUILD your new app in App.tsx (HomeView)
 *   - Access demo at /sdkdemo route
 *
 * SDK USAGE PATTERN:
 *   All SDK methods are accessed via the useSDK() hook:
 *
 *   const { sdk, onCommand, offCommand, isAuthenticated, ... } = useSDK();
 *
 *   To listen for responses:
 *   useEffect(() => {
 *     const handler = (data) => {
 *       if (data.type === "pay-response") { ... }
 *     };
 *     onCommand(handler);
 *     return () => offCommand(handler); // cleanup on unmount
 *   }, [onCommand, offCommand]);
 *
 * SDK METHODS — INPUTS & OUTPUTS:
 *
 *   sdk.connection(navbg?: string)
 *     IN:  navbg — optional hex color string (e.g. "#1A202C") for the platform nav bar
 *     OUT: connection-response — { payload: { wallet, icIdentityPackage, genericUseSeed, anonymous? }, signature }
 *     NOTE: Auto-called by SDKProvider on mount. Only call manually to change nav color.
 *
 *   sdk.openLink(url: string, ref?: string)
 *     IN:  url — full URL to open in platform browser, ref — optional request ID
 *     OUT: open-link-response — { success: boolean, ref?, error? }
 *     NOTE: Required for ALL external links in sandboxed iframe context.
 *
 *   sdk.copyToClipboard(text: string)
 *     IN:  text — string to write to clipboard
 *     OUT: (none) — fire-and-forget
 *
 *   sdk.pay(params: PayDetailBSV | PayDetailICP | PayDetailKDA)
 *     IN (BSV):  { ref: string, recipients: [{ address: string, value: number, fiatValue?: number, currency?: string, note?: string }] }
 *     IN (ICP):  { ref, token: { protocol: "ICP", specification: { ledgerId: string } }, recipients: [{ address, value, note? }] }
 *     IN (KDA):  { ref, token: { protocol: "KDA", specification: { chainId?: string } }, recipients: [{ address, value, note? }] }
 *     OUT: pay-response — { success: boolean, txid?: string, ref, error?: string }
 *
 *   sdk.getLocation(ref?: string)
 *     IN:  ref — optional request ID
 *     OUT: geolocation-response (multiple) — { location: { latitude, longitude, accuracy }, isFinal: boolean, ref? }
 *     NOTE: Fires multiple responses with increasing accuracy. isFinal: true on last update.
 *
 *   sdk.getTokenHistory(params: TokenHistoryDetailBSV | TokenHistoryDetailICP)
 *     IN (BSV):  { offset: number, limit: number, ref?: string }
 *     IN (ICP):  { offset, limit, ref?, token: { protocol: "ICP", specification: { indexCanisterId: string } } }
 *     OUT: token-history-response — { transactions: [...], pagination: { total, offset, limit }, ref? }
 *
 *   sdk.getFullTransaction(txid: string, ref?: string)
 *     IN:  txid — BSV transaction ID, ref — optional request ID
 *     OUT: full-transaction-response — { tx_hex: string, bump_hex: string, ref? }
 *
 *   sdk.createPost(params)
 *     IN:  { headline: string, nftDescription: string, previewAsset?: { type, file, preview },
 *            extraContents?: [...], appQuery?: {}, appEmbed?: { url, type?, shape? } }
 *     OUT: (platform-handled) — post creation UI shown by platform
 *
 *   sdk.authoriseSwap(contractTx: string, value: number)
 *     IN:  contractTx — serialised contract transaction hex, value — price in satoshis
 *     OUT: authorise-swap-response — { swapHex: string, parsedNFT: {...}, wanted: { satoshis: number } }
 *     NOTE: Store returned swapHex in your backend. Buyer uses it in swapBuy.
 *
 *   sdk.swapBuy(swapHex: string, contractTx: string, value: number)
 *     IN:  swapHex — from authoriseSwap, contractTx — seller's contract tx, value — agreed satoshis
 *     OUT: swap-buy-response — { success: boolean, error?: string }
 *
 *   sdk.scanQR(ref?: string)
 *     IN:  ref — optional request ID
 *     OUT: qr-scan-response — { data: string, ref? } — scanner closes after first result
 *
 *   sdk.stopQRScan()
 *     IN:  (none)
 *     OUT: (none) — closes platform QR scanner overlay
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  ExternalLink,
  ImageIcon,
  Info,
  Key,
  Link,
  Loader2,
  MapPin,
  MessageSquare,
  Play,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  Square,
  Terminal,
  UserX,
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createActorWithConfig } from "./config";
import { useSDK } from "./contexts/SDKProvider";

interface DebugLog {
  id: string;
  timestamp: string;
  type:
    | "postMessage"
    | "messageReceived"
    | "signatureVerification"
    | "identityGeneration"
    | "backendConnection"
    | "error"
    | "success"
    | "listener"
    | "anonymous"
    | "info";
  title: string;
  message: string;
  data?: unknown;
}

const GREETINGS = [
  "Hello from Metanet!",
  "GM from the Metanet Platform!",
  "Greetings from Caffeine AI 👋",
];

/**
 * DemoPage — full SDK reference demo.
 * Shows auth status, quantum-safe seed, ICP backend integration, and debug logs.
 * Must be wrapped in <SDKProvider>.
 */
export default function DemoPage() {
  const {
    sendCommand,
    onCommand,
    offCommand,
    isConnecting,
    isAuthenticated,
    isAnonymous,
    walletAddress,
    rootPrincipal: sdkRootPrincipal,
    icIdentity,
    connectionError,
    retryConnection,
    hasSeed,
    deriveSeedKey,
    sdk,
  } = useSDK();

  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [demoKey, setDemoKey] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);

  // ICP Backend Integration state
  const [whoamiPrincipal, setWhoamiPrincipal] = useState<string | null>(null);
  const [whoamiLoading, setWhoamiLoading] = useState(false);
  const [whoamiError, setWhoamiError] = useState<string | null>(null);

  // Demo states
  const [demoResponses, setDemoResponses] = useState<Record<string, unknown>>(
    {},
  );
  const [demoLoading, setDemoLoading] = useState<Record<string, boolean>>({});
  const [demoCopied, setDemoCopied] = useState(false);
  const [connectionColor, setConnectionColor] = useState("#1A202C");
  const [qrScanning, setQrScanning] = useState(false);
  const [locationResponses, setLocationResponses] = useState<unknown[]>([]);
  const [createPostSuccess, setCreatePostSuccess] = useState(false);

  // Track loading for individual commands
  const setLoading = (key: string, val: boolean) =>
    setDemoLoading((prev) => ({ ...prev, [key]: val }));
  const setResponse = (key: string, val: unknown) =>
    setDemoResponses((prev) => ({ ...prev, [key]: val }));

  // Ref to avoid stale closures in the unified listener
  const qrScanningRef = useRef(false);
  useEffect(() => {
    qrScanningRef.current = qrScanning;
  }, [qrScanning]);

  const addDebugLog = (
    type: DebugLog["type"],
    title: string,
    message: string,
    data?: unknown,
  ) => {
    setDebugLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        type,
        title,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    ]);
  };

  /**
   * Single unified onCommand observer for debug logging AND demo responses.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: addDebugLog is stable
  useEffect(() => {
    addDebugLog(
      "listener",
      "onCommand observer registered",
      "All platform messages will appear here",
    );

    const handleAll = (
      data: Record<string, unknown> & { signatureValid?: boolean },
    ) => {
      const msgType = data.type as string | undefined;

      // --- Debug logging ---
      if (msgType === "connection-response") {
        const isAnon = (data.payload as Record<string, unknown> | undefined)
          ?.anonymous;
        if (isAnon) {
          addDebugLog(
            "anonymous",
            "Anonymous connection-response",
            "User is not authenticated on Metanet.page",
            { payload: data.payload },
          );
        } else {
          addDebugLog(
            data.signatureValid ? "signatureVerification" : "error",
            `connection-response — sig ${
              data.signatureValid ? "valid ✓" : "warning (graceful)"
            }`,
            "Identity constructed by SDKProvider. See connection state in Auth Status card.",
            {
              signatureValid: data.signatureValid,
              wallet: (data.payload as Record<string, unknown> | undefined)
                ?.wallet,
            },
          );
        }
      } else {
        addDebugLog(
          "messageReceived",
          `Command: ${msgType ?? "unknown"} — sig: ${
            data.signatureValid === undefined
              ? "n/a"
              : data.signatureValid
                ? "valid"
                : "invalid"
          }`,
          "Received from parent platform",
          data,
        );
      }

      // --- Demo response routing ---
      if (msgType === "connection-response") {
        setResponse("connection", data);
        setLoading("connection", false);
      } else if (msgType === "open-link-response") {
        setResponse("openLink", data);
        setLoading("openLink", false);
      } else if (msgType === "pay-response") {
        // ref may be at top level OR nested inside payload depending on platform version
        const ref =
          (data.ref as string | undefined) ??
          ((data.payload as Record<string, unknown> | undefined)?.ref as
            | string
            | undefined);
        if (ref === "demo-pay-bsv") {
          setResponse("demoPayBsv", data);
          setLoading("demoPayBsv", false);
        } else if (ref === "demo-pay-icp") {
          setResponse("demoPayIcp", data);
          setLoading("demoPayIcp", false);
        } else {
          // No ref match — still show in debug (already logged above)
          setResponse("demoPayBsv", data);
          setLoading("demoPayBsv", false);
          setResponse("demoPayIcp", data);
          setLoading("demoPayIcp", false);
        }
      } else if (msgType === "geolocation-response") {
        setLocationResponses((prev) => [...prev, data]);
        setResponse("getLocation", data);
        setLoading("getLocation", false);
      } else if (msgType === "qr-scan-response") {
        setResponse("scanQR", data);
        sdk.stopQRScan();
        setQrScanning(false);
      } else if (msgType === "create-post-response") {
        setResponse("createPost", data);
        setLoading("createPost", false);
        setCreatePostSuccess(true);
      }
    };

    onCommand(handleAll);
    return () => offCommand(handleAll);
  }, [onCommand, offCommand]);

  // Log connection start once
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time init
  useEffect(() => {
    addDebugLog(
      "postMessage",
      "Connection requests started",
      "SDKProvider is sending connection requests every second",
    );
  }, []);

  const handleDeveloperLinkClick = () => {
    sdk.openLink("https://www.metanet.page/developers");
    addDebugLog(
      "postMessage",
      "open-link sent",
      "Requesting platform to open metanet.page/developers",
    );
  };

  const handleDeriveKey = async () => {
    setIsDeriving(true);
    try {
      const keyBytes = await deriveSeedKey("demo:storage-key");
      const preview = Array.from(keyBytes.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setDemoKey(`${preview}… (8 of 32 bytes shown)`);
      addDebugLog(
        "info",
        "HKDF-SHA512 key derived",
        `Purpose: demo:storage-key — first 8 bytes: ${preview}…`,
      );
    } catch (err) {
      addDebugLog(
        "error",
        "Key derivation failed",
        err instanceof Error ? err.message : "Derivation failed",
      );
    } finally {
      setIsDeriving(false);
    }
  };

  const handleWhoami = async () => {
    if (!icIdentity) return;
    setWhoamiLoading(true);
    setWhoamiError(null);
    setWhoamiPrincipal(null);
    addDebugLog(
      "backendConnection",
      "whoami() called",
      "Calling ICP canister with DelegationIdentity",
    );
    try {
      const actor = await createActorWithConfig({
        agentOptions: { identity: icIdentity },
      });
      const principal = await actor.whoami();
      const principalStr = principal.toString();
      setWhoamiPrincipal(principalStr);
      addDebugLog(
        "success",
        "whoami() response",
        `Principal: ${principalStr}`,
        { principal: principalStr },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setWhoamiError(msg);
      addDebugLog("error", "whoami() failed", msg);
    } finally {
      setWhoamiLoading(false);
    }
  };

  // ---- Demo handlers ----

  const handleDemoConnection = () => {
    setLoading("connection", true);
    sdk.connection(connectionColor);
  };

  const handleDemoOpenLink = () => {
    setLoading("openLink", true);
    sdk.openLink("https://www.metanet.page/CaffeineAIConnect");
  };

  const handleDemoCopyToClipboard = () => {
    const text = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    sdk.copyToClipboard(text);
    setDemoCopied(true);
    setTimeout(() => setDemoCopied(false), 2500);
  };

  const handleDemoPayBsv = () => {
    if (!walletAddress) return;
    setLoading("demoPayBsv", true);
    sdk.pay({
      type: "pay",
      ref: "demo-pay-bsv",
      recipients: [
        { address: walletAddress, value: 1, note: "Self-send demo" },
      ],
    });
  };

  const handleDemoPayIcp = () => {
    if (!sdkRootPrincipal) return;
    setLoading("demoPayIcp", true);
    sdk.pay({
      type: "pay",
      ref: "demo-pay-icp",
      token: {
        protocol: "ICP",
        specification: { ledgerId: "ryjl3-tyaaa-aaaaa-aaaba-cai" },
      },
      recipients: [
        { address: sdkRootPrincipal, value: 1, note: "Self-send ICP demo" },
      ],
    } as unknown as Parameters<typeof sdk.pay>[0]);
  };

  const handleDemoGetLocation = () => {
    setLoading("getLocation", true);
    setLocationResponses([]);
    sdk.getLocation("demo-location");
  };

  const handleDemoCreatePost = async () => {
    setLoading("createPost", true);
    setCreatePostSuccess(false);
    try {
      // Step 1: fetch image and convert to blob
      const thumbnailUrl =
        "/assets/generated/metanet-post-demo.dim_800x450.jpg";
      const resp = await fetch(thumbnailUrl);
      const blob = await resp.blob();

      // Step 2: convert blob to dataURL (as per Metanet docs)
      const dataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Step 3: convert dataURL back to File (as per Metanet docs)
      const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(",");
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) throw new Error("Invalid data URL");
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
      };
      const imageFile = dataURLtoFile(dataURL, "thumbnail.jpg");

      // Step 4: build previewAsset with file + dataURL preview (not a path string)
      const previewAsset = {
        type: "image" as const,
        file: imageFile,
        preview: dataURL,
      };

      sdk.createPost({
        headline: "Hello from Caffeine AI!",
        nftDescription:
          "A demo post created by the Metanet Integration Scaffold — powered by Caffeine AI on the Internet Computer.",
        previewAsset,
      } as Parameters<typeof sdk.createPost>[0]);
      setCreatePostSuccess(true);
    } catch (err) {
      addDebugLog(
        "error",
        "createPost error",
        err instanceof Error ? err.message : "Failed to load image",
      );
    } finally {
      setLoading("createPost", false);
    }
  };

  const handleDemoScanQR = () => {
    setQrScanning(true);
    setResponse("scanQR", undefined);
    sdk.scanQR("demo-qr");
  };

  const handleDemoStopQR = () => {
    sdk.stopQRScan();
    setQrScanning(false);
  };

  // ---- Status helpers ----

  const getStatusIcon = () => {
    if (isAuthenticated)
      return <CheckCircle className="h-5 w-5 text-success" />;
    if (isAnonymous) return <UserX className="h-5 w-5 text-orange-500" />;
    if (connectionError && !connectionError.startsWith("Signature"))
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <RefreshCw className="h-5 w-5 animate-spin text-primary" />;
  };

  const getStatusText = () => {
    if (isAuthenticated) return "Authenticated";
    if (isAnonymous) return "Anonymous";
    if (connectionError && !connectionError.startsWith("Signature"))
      return "Error";
    if (isConnecting) return "Connecting…";
    return "Idle";
  };

  const getStatusVariant = ():
    | "default"
    | "secondary"
    | "destructive"
    | "outline" => {
    if (isAuthenticated) return "default";
    if (isAnonymous) return "outline";
    if (connectionError && !connectionError.startsWith("Signature"))
      return "destructive";
    return "secondary";
  };

  const getLogIcon = (type: DebugLog["type"]) => {
    switch (type) {
      case "postMessage":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "messageReceived":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "signatureVerification":
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case "identityGeneration":
        return <Key className="h-4 w-4 text-orange-500" />;
      case "backendConnection":
        return <Link className="h-4 w-4 text-cyan-500" />;
      case "listener":
        return <Terminal className="h-4 w-4 text-indigo-500" />;
      case "anonymous":
        return <UserX className="h-4 w-4 text-orange-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLogBadgeVariant = (
    type: DebugLog["type"],
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (type === "error") return "destructive";
    if (type === "success" || type === "signatureVerification")
      return "default";
    if (type === "anonymous") return "outline";
    return "secondary";
  };

  void sendCommand;

  // ---- Sub-components ----

  const DemoArea = ({
    children,
    response,
    responseKey,
  }: {
    children: React.ReactNode;
    response?: unknown;
    responseKey?: string;
  }) => (
    <div className="bg-muted/30 rounded-lg p-3 mt-3 border border-dashed border-border/50">
      <p className="text-xs text-muted-foreground font-medium mb-2">▶ Try it</p>
      {children}
      {response !== undefined && response !== null && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">
            {responseKey ? `Response (${responseKey}):` : "Response:"}
          </p>
          <pre className="text-xs bg-background/70 rounded p-2 overflow-x-auto max-h-40 font-mono">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const InfoCard = ({
    method,
    description,
    params,
    response,
    icon,
    children,
    ocid,
  }: {
    method: string;
    description: string;
    params: string;
    response: string;
    icon: React.ReactNode;
    children?: React.ReactNode;
    ocid: string;
  }) => (
    <Card
      className="border-border/50 bg-card/50 backdrop-blur-sm flex flex-col"
      data-ocid={ocid}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <code className="text-xs text-primary font-mono font-semibold leading-snug">
              {method}
            </code>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {response}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        <p className="text-xs text-muted-foreground/70 font-mono mt-1">
          params: {params}
        </p>
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">
                SDK Reference Demo
              </h1>
              <p className="text-sm text-muted-foreground">
                Origin-validated · secp256k1 verification · Quantum-safe seed ·
                Full Metanet SDK
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
              data-ocid="demo.back.button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border/40 bg-accent/5">
        <div className="py-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">About This Demo</CardTitle>
                  <CardDescription>
                    Metanet.page Integration Reference with Full SDK
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This page is the SDK reference demo for the Metanet Integration
                Scaffold. It demonstrates all 13 SDK methods, authentication
                status, and quantum-safe seed derivation. Explore all SDK
                commands at{" "}
                <button
                  type="button"
                  onClick={handleDeveloperLinkClick}
                  className="inline-flex items-center gap-1 text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  metanet.page/developers
                  <ExternalLink className="h-3 w-3" />
                </button>
                .
              </p>
              <p className="text-sm text-muted-foreground">
                Test this app live at:{" "}
                <button
                  type="button"
                  onClick={() =>
                    sdk.openLink("https://www.metanet.page/CaffeineAIConnect")
                  }
                  className="text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  metanet.page/CaffeineAIConnect
                </button>
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>
                  Origin-validated · secp256k1 sig verification · HKDF-SHA512
                  quantum-safe seed (NEVER stored raw)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <main className="py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* Auth Status */}
              <Card
                className="border-border/50 bg-card/50 backdrop-blur-sm"
                data-ocid="auth.card"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon()}
                      <div>
                        <CardTitle className="text-lg">
                          Authentication Status
                        </CardTitle>
                        <CardDescription>
                          Connection state managed by SDKProvider
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={getStatusVariant()}
                      data-ocid="auth.status.badge"
                    >
                      {getStatusText()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connectionError && (
                    <Alert
                      variant={
                        connectionError.startsWith("Signature")
                          ? "default"
                          : "destructive"
                      }
                      data-ocid="auth.error_state"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{connectionError}</AlertDescription>
                    </Alert>
                  )}
                  {isAnonymous && (
                    <Alert className="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
                      <UserX className="h-4 w-4" />
                      <AlertDescription>
                        You are anonymous. Please connect with Metanet.page
                        before using this app.
                      </AlertDescription>
                    </Alert>
                  )}
                  {((connectionError &&
                    !connectionError.startsWith("Signature")) ||
                    isAnonymous) && (
                    <Button
                      onClick={retryConnection}
                      variant="outline"
                      className="w-full"
                      data-ocid="auth.retry.button"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Connection
                    </Button>
                  )}
                  {isAuthenticated && walletAddress && (
                    <div className="text-sm space-y-2">
                      <div>
                        <span className="text-muted-foreground">Wallet: </span>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {walletAddress}
                        </code>
                      </div>
                      {sdkRootPrincipal && (
                        <div>
                          <span className="text-muted-foreground">
                            Root Principal:{" "}
                          </span>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {sdkRootPrincipal}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quantum-safe seed card */}
              {hasSeed && (
                <Card
                  className="border-border/50 bg-card/50 backdrop-blur-sm border-l-4 border-l-primary"
                  data-ocid="seed.card"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Cpu className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">
                          Quantum-Safe Seed Key
                        </CardTitle>
                        <CardDescription>
                          HKDF-SHA512 — raw seed never exposed
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        The{" "}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          genericUseSeed
                        </code>{" "}
                        from Metanet is imported as a{" "}
                        <strong>non-extractable</strong> HKDF CryptoKey. Raw
                        bytes are never stored in state, localStorage, or
                        sessionStorage.
                      </p>
                      <p className="text-muted-foreground">
                        HKDF-SHA512 derives 256-bit purpose-specific keys
                        (128-bit quantum security via Grover's). Domain
                        separation via{" "}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          metanet:v1:&lt;purpose&gt;
                        </code>{" "}
                        enables future migration to ML-KEM/ML-DSA without
                        changing the original seed.
                      </p>
                    </div>
                    <Button
                      onClick={handleDeriveKey}
                      disabled={isDeriving}
                      variant="outline"
                      className="w-full"
                      data-ocid="seed.derive.button"
                    >
                      {isDeriving ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Key className="mr-2 h-4 w-4" />
                      )}
                      Derive Demo Key (purpose: demo:storage-key)
                    </Button>
                    {demoKey && (
                      <div
                        className="rounded bg-muted/50 p-3 text-sm"
                        data-ocid="seed.demo_key.success_state"
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          Preview — first 8 of 32 bytes:
                        </p>
                        <code className="font-mono text-primary">
                          {demoKey}
                        </code>
                        <p className="text-xs text-muted-foreground mt-2">
                          ⚠ The raw{" "}
                          <code className="bg-background px-1 rounded">
                            genericUseSeed
                          </code>{" "}
                          is never stored or accessible — this is a derived,
                          purpose-specific key.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ICP Backend Integration card — only shown when authenticated */}
              {isAuthenticated && (
                <Card
                  className="border-border/50 bg-card/50 backdrop-blur-sm border-l-4 border-l-cyan-500"
                  data-ocid="backend.card"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Link className="h-5 w-5 text-cyan-500" />
                      <div>
                        <CardTitle className="text-lg">
                          ICP Backend Integration
                        </CardTitle>
                        <CardDescription>
                          Call whoami() on the ICP canister using your Metanet
                          identity
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
                      <p>
                        After Metanet authentication, your{" "}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          DelegationIdentity
                        </code>{" "}
                        can be used to call ICP canisters directly. The{" "}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          whoami()
                        </code>{" "}
                        query returns your Principal as seen by the backend.
                      </p>
                      <p className="text-xs">
                        Pattern:{" "}
                        <code className="bg-background px-1 rounded">
                          createActorWithConfig(
                          {"{ agentOptions: { identity } }"})
                        </code>{" "}
                        → actor →{" "}
                        <code className="bg-background px-1 rounded">
                          actor.whoami()
                        </code>
                      </p>
                    </div>

                    <Button
                      onClick={handleWhoami}
                      disabled={!isAuthenticated || whoamiLoading}
                      className="w-full"
                      data-ocid="backend.whoami.button"
                    >
                      {whoamiLoading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link className="mr-2 h-4 w-4" />
                      )}
                      {whoamiLoading ? "Calling canister…" : "Call whoami()"}
                    </Button>

                    {whoamiLoading && (
                      <div
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                        data-ocid="backend.loading_state"
                      >
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Querying ICP canister…</span>
                      </div>
                    )}

                    {whoamiError && (
                      <Alert
                        variant="destructive"
                        data-ocid="backend.error_state"
                      >
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{whoamiError}</AlertDescription>
                      </Alert>
                    )}

                    {whoamiPrincipal && (
                      <div
                        className="rounded-lg bg-muted/50 p-4 space-y-2"
                        data-ocid="backend.success_state"
                      >
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">
                            whoami() returned successfully
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Your Principal on the ICP canister:
                          </p>
                          <code className="text-xs font-mono text-primary break-all">
                            {whoamiPrincipal}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This Principal is derived from your Metanet
                          DelegationIdentity — the canister sees you as this
                          identity.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column — Debug Logs */}
            <div>
              <Card
                className="border-border/50 bg-card/50 backdrop-blur-sm"
                data-ocid="debug.card"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Terminal className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">Debug Logs</CardTitle>
                        <CardDescription>
                          Real-time centralized message handling and signature
                          verification
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{debugLogs.length} logs</Badge>
                      <Button
                        onClick={() => setDebugLogs([])}
                        variant="outline"
                        size="sm"
                        data-ocid="debug.clear.button"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[480px] w-full rounded-md border bg-background/50 p-4">
                    {debugLogs.length === 0 ? (
                      <div
                        className="flex items-center justify-center h-full text-muted-foreground"
                        data-ocid="debug.empty_state"
                      >
                        <div className="text-center">
                          <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No debug logs yet</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {debugLogs.map((log, index) => (
                          <div key={log.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getLogIcon(log.type)}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="font-mono">
                                  {log.timestamp}
                                </span>
                              </div>
                              <Badge
                                variant={getLogBadgeVariant(log.type)}
                                className="text-xs"
                              >
                                {log.type}
                              </Badge>
                            </div>
                            <div className="ml-7">
                              <p className="text-sm font-medium text-foreground">
                                {log.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {log.message}
                              </p>
                              {Boolean(log.data) && (
                                <details className="mt-2">
                                  <summary className="text-xs text-primary cursor-pointer hover:underline">
                                    View raw data
                                  </summary>
                                  <pre className="text-xs bg-muted/50 p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(
                                      log.data as Record<string, unknown>,
                                      null,
                                      2,
                                    )}
                                  </pre>
                                </details>
                              )}
                            </div>
                            {index < debugLogs.length - 1 && (
                              <Separator className="my-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ===== SDK Commands Reference ===== */}
          <Card
            className="border-border/50 bg-card/50 backdrop-blur-sm"
            data-ocid="sdk.reference.card"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    SDK Commands Reference
                  </CardTitle>
                  <CardDescription>
                    All 13 typed methods — access via{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {"const { sdk } = useSDK()"}
                    </code>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. connection */}
                <InfoCard
                  method="sdk.connection(navbg?)"
                  description="Request authentication from parent platform. Auto-called on mount; call manually to update nav colour."
                  params="navbg?: hex color"
                  response="connection-response"
                  icon={<Wifi className="h-4 w-4" />}
                  ocid="sdk.reference.item.1"
                >
                  <DemoArea
                    response={demoResponses.connection}
                    responseKey="connection-response"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        className="text-xs text-muted-foreground"
                        htmlFor="nav-color"
                      >
                        navBg colour:
                      </label>
                      <input
                        id="nav-color"
                        type="color"
                        value={connectionColor}
                        onChange={(e) => setConnectionColor(e.target.value)}
                        className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent"
                        data-ocid="sdk.connection.input"
                      />
                      <code className="text-xs font-mono text-primary">
                        {connectionColor}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={handleDemoConnection}
                      disabled={demoLoading.connection}
                      data-ocid="sdk.connection.button"
                    >
                      {demoLoading.connection ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-3 w-3" />
                      )}
                      Send connection with navBg
                    </Button>
                  </DemoArea>
                </InfoCard>

                {/* 2. openLink */}
                <InfoCard
                  method="sdk.openLink(url, ref?)"
                  description="Open external URL via the platform browser. Required for all links inside sandboxed iframes."
                  params="url: string, ref?: string"
                  response="open-link-response"
                  icon={<ExternalLink className="h-4 w-4" />}
                  ocid="sdk.reference.item.2"
                >
                  <DemoArea
                    response={demoResponses.openLink}
                    responseKey="open-link-response"
                  >
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleDemoOpenLink}
                      disabled={demoLoading.openLink}
                      data-ocid="sdk.openlink.button"
                    >
                      {demoLoading.openLink ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-3 w-3" />
                      )}
                      Open CaffeineAIConnect
                    </Button>
                  </DemoArea>
                </InfoCard>

                {/* 3. copyToClipboard */}
                <InfoCard
                  method="sdk.copyToClipboard(text)"
                  description="Write text to the system clipboard via the parent platform. Fire-and-forget — no response."
                  params="text: string"
                  response="(none)"
                  icon={<Copy className="h-4 w-4" />}
                  ocid="sdk.reference.item.3"
                >
                  <DemoArea>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleDemoCopyToClipboard}
                      variant={demoCopied ? "default" : "outline"}
                      data-ocid="sdk.clipboard.button"
                    >
                      {demoCopied ? (
                        <>
                          <CheckCircle className="mr-2 h-3 w-3" />
                          Sent!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3 w-3" />
                          Copy greeting to clipboard
                        </>
                      )}
                    </Button>
                    {demoCopied && (
                      <p
                        className="text-xs text-muted-foreground mt-1 text-center"
                        data-ocid="sdk.clipboard.success_state"
                      >
                        Random greeting sent to clipboard (fire-and-forget)
                      </p>
                    )}
                  </DemoArea>
                </InfoCard>

                {/* 4. pay BSV */}
                <InfoCard
                  method="sdk.pay(params) — BSV"
                  description="BSV payment to one or more addresses. Self-send 1 satoshi to your own wallet."
                  params="ref, recipients[{address, value, fiatValue?, currency?}]"
                  response="pay-response"
                  icon={<CreditCard className="h-4 w-4" />}
                  ocid="sdk.reference.item.4"
                >
                  <DemoArea
                    response={demoResponses.demoPayBsv}
                    responseKey="pay-response (BSV)"
                  >
                    {!isAuthenticated || !walletAddress ? (
                      <p
                        className="text-xs text-muted-foreground italic"
                        data-ocid="sdk.pay-bsv.error_state"
                      >
                        ⚠ Must be authenticated with a wallet address to send.
                      </p>
                    ) : null}
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={handleDemoPayBsv}
                      disabled={
                        demoLoading.demoPayBsv ||
                        !isAuthenticated ||
                        !walletAddress
                      }
                      data-ocid="sdk.pay-bsv.button"
                    >
                      {demoLoading.demoPayBsv ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-3 w-3" />
                      )}
                      Send 1 sat to myself (BSV)
                    </Button>
                  </DemoArea>
                </InfoCard>

                {/* 5. pay ICP */}
                <InfoCard
                  method="sdk.pay(params) — ICP"
                  description="ICP/ckBTC/ckUSDC/ckETH/GLDT token transfer. Self-send 1 e8 to your own principal."
                  params="ref, token.protocol=ICP, recipients[{address, value}]"
                  response="pay-response"
                  icon={<CreditCard className="h-4 w-4" />}
                  ocid="sdk.reference.item.5"
                >
                  <DemoArea
                    response={demoResponses.demoPayIcp}
                    responseKey="pay-response (ICP)"
                  >
                    {!isAuthenticated || !sdkRootPrincipal ? (
                      <p
                        className="text-xs text-muted-foreground italic"
                        data-ocid="sdk.pay-icp.error_state"
                      >
                        ⚠ Must be authenticated with a root principal to send.
                      </p>
                    ) : null}
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={handleDemoPayIcp}
                      disabled={
                        demoLoading.demoPayIcp ||
                        !isAuthenticated ||
                        !sdkRootPrincipal
                      }
                      data-ocid="sdk.pay-icp.button"
                    >
                      {demoLoading.demoPayIcp ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-3 w-3" />
                      )}
                      Send 1 e8 to myself (ICP)
                    </Button>
                  </DemoArea>
                </InfoCard>

                {/* 6. getLocation */}
                <InfoCard
                  method="sdk.getLocation(ref?)"
                  description="GPS location via platform. Streams multiple responses with increasing accuracy; isFinal:true marks the last update."
                  params="ref?: string"
                  response="geolocation-response"
                  icon={<MapPin className="h-4 w-4" />}
                  ocid="sdk.reference.item.6"
                >
                  <DemoArea
                    response={demoResponses.getLocation}
                    responseKey={`geolocation-response (${locationResponses.length} received)`}
                  >
                    <p className="text-xs text-muted-foreground mb-2">
                      📍 Streaming — may fire multiple times with increasing
                      accuracy.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleDemoGetLocation}
                        disabled={demoLoading.getLocation}
                        data-ocid="sdk.location.button"
                      >
                        {demoLoading.getLocation ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <MapPin className="mr-2 h-3 w-3" />
                        )}
                        Get my location
                      </Button>
                      {locationResponses.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLocationResponses([]);
                            setResponse("getLocation", undefined);
                            setLoading("getLocation", false);
                          }}
                          data-ocid="sdk.location.secondary_button"
                        >
                          <Square className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </DemoArea>
                </InfoCard>

                {/* 7. createPost */}
                <InfoCard
                  method="sdk.createPost(params)"
                  description="Create a Metanet post with media. Platform shows post creation UI and returns create-post-response on completion."
                  params="headline, nftDescription, previewAsset?"
                  response="create-post-response"
                  icon={<ImageIcon className="h-4 w-4" />}
                  ocid="sdk.reference.item.7"
                >
                  <DemoArea
                    response={demoResponses.createPost}
                    responseKey="create-post-response"
                  >
                    <div className="mb-2 rounded overflow-hidden">
                      <img
                        src="/assets/generated/metanet-post-demo.dim_800x450.jpg"
                        alt="Demo post preview"
                        className="w-full h-24 object-cover rounded"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleDemoCreatePost}
                      disabled={demoLoading.createPost}
                      data-ocid="sdk.createpost.button"
                    >
                      {demoLoading.createPost ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <ImageIcon className="mr-2 h-3 w-3" />
                      )}
                      Create demo post
                    </Button>
                    {createPostSuccess && (
                      <p
                        className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1"
                        data-ocid="sdk.createpost.success_state"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Post dialog opened by platform
                      </p>
                    )}
                  </DemoArea>
                </InfoCard>

                {/* 8. scanQR + stopQRScan */}
                <InfoCard
                  method="sdk.scanQR() / sdk.stopQRScan()"
                  description="Open / close platform QR scanner overlay. Returns qr-scan-response on scan result."
                  params="ref?: string"
                  response="qr-scan-response"
                  icon={<QrCode className="h-4 w-4" />}
                  ocid="sdk.reference.item.8"
                >
                  <DemoArea
                    response={demoResponses.scanQR}
                    responseKey="qr-scan-response"
                  >
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleDemoScanQR}
                        disabled={qrScanning}
                        data-ocid="sdk.scanqr.button"
                      >
                        <QrCode className="mr-2 h-3 w-3" />
                        Start QR Scan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={handleDemoStopQR}
                        disabled={!qrScanning}
                        data-ocid="sdk.stopqr.button"
                      >
                        <Square className="mr-2 h-3 w-3" />
                        Stop QR Scan
                      </Button>
                    </div>
                    {qrScanning && (
                      <p
                        className="text-xs text-muted-foreground mt-2 flex items-center gap-1"
                        data-ocid="sdk.scanqr.loading_state"
                      >
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Scanner active — waiting for scan…
                      </p>
                    )}
                  </DemoArea>
                </InfoCard>

                {/* 9. pay KDA — info only */}
                <InfoCard
                  method="sdk.pay(params) — KDA"
                  description="Kadena token payment via the platform."
                  params="ref, token.protocol=KDA, recipients[]"
                  response="pay-response"
                  icon={<CreditCard className="h-4 w-4" />}
                  ocid="sdk.reference.item.9"
                >
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No interactive demo
                    </Badge>
                  </div>
                </InfoCard>

                {/* 10. getTokenHistory — info only */}
                <InfoCard
                  method="sdk.getTokenHistory(params)"
                  description="Paginated BSV or ICP transaction history."
                  params="offset, limit, ref?, token?"
                  response="token-history-response"
                  icon={<Terminal className="h-4 w-4" />}
                  ocid="sdk.reference.item.10"
                >
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No interactive demo
                    </Badge>
                  </div>
                </InfoCard>

                {/* 11. getFullTransaction — info only */}
                <InfoCard
                  method="sdk.getFullTransaction(txid)"
                  description="Fetch raw tx hex + SPV proof by BSV txid."
                  params="txid: string, ref?: string"
                  response="full-transaction-response"
                  icon={<Terminal className="h-4 w-4" />}
                  ocid="sdk.reference.item.11"
                >
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No interactive demo
                    </Badge>
                  </div>
                </InfoCard>

                {/* 12. authoriseSwap — info only */}
                <InfoCard
                  method="sdk.authoriseSwap(contractTx, value)"
                  description="List an NFT for sale. Returns swapHex to store in backend for buyers."
                  params="contractTx: string, value: number (satoshis)"
                  response="authorise-swap-response"
                  icon={<Terminal className="h-4 w-4" />}
                  ocid="sdk.reference.item.12"
                >
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No interactive demo
                    </Badge>
                  </div>
                </InfoCard>

                {/* 13. swapBuy — info only */}
                <InfoCard
                  method="sdk.swapBuy(swapHex, contractTx, value)"
                  description="Purchase an NFT using a swapHex from a seller's authoriseSwap."
                  params="swapHex, contractTx, value"
                  response="swap-buy-response"
                  icon={<Terminal className="h-4 w-4" />}
                  ocid="sdk.reference.item.13"
                >
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No interactive demo
                    </Badge>
                  </div>
                </InfoCard>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border/40 bg-background/80 backdrop-blur-sm mt-12">
        <div className="py-6">
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            © {new Date().getFullYear()}. Built with ❤ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="ml-1 text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
