// Type declarations for elliptic — loaded at runtime via CDN (not bundled).
// Bundled path: unused. CDN: https://esm.sh/elliptic@6.5.7
declare module 'elliptic' {
  export class ec {
    constructor(curve: string);
    keyFromPublic(pub: string | Uint8Array, enc?: string): ECKeyPair;
  }
  interface ECKeyPair {
    verify(msg: string | Uint8Array, sig: string | { r: string; s: string } | Uint8Array, enc?: string): boolean;
  }
}

// Allow TypeScript to resolve the CDN URL import without errors.
declare module 'https://esm.sh/elliptic@6.5.7' {
  export { ec } from 'elliptic';
  const _default: { ec: typeof import('elliptic').ec };
  export default _default;
}
