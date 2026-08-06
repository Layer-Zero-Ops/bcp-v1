/**
 * BCP signing — merchant proves control of the storefront.
 *
 * We use the SAME key the merchant already owns (Nostr npub or Lightning Address
 * backend). No new key ceremony. Signature is over the canonical serialization.
 *
 * For Nostr-native merchants we use Schnorr (nostr-tools style). For Lightning
 * Address merchants, the signing authority is their LN wallet backend — the
 * descriptor is signed there and the sig is attached. The protocol only verifies.
 */

import { BCPStorefront, canonicalize } from "./descriptor";

export type SignableStore = Omit<BCPStorefront, "sig">;

/**
 * Sign with a Nostr-style schnorr secret key (hex, 32 bytes).
 * Returns the sig hex. In the reference client this delegates to nostr-tools'
 * `getSignature` / `@noble/curves secp256k1.schnorr.sign`.
 */
export function signNostr(plain: SignableStore, skHex: string): BCPStorefront {
  const msg = canonicalize(plain);
  // Reference implementation uses @noble/curves schnorr over sha256(msg).
  const sig = schnorrSign(msg, skHex);
  return { ...plain, sig };
}

/**
 * Verify any descriptor. Throws on tamper, wrong version, or identity/sig mismatch.
 * The protocol NEVER holds a key — it only checks math.
 */
export function verify(store: BCPStorefront): boolean {
  if (store.version !== 1) throw new Error(`Unsupported BCP version ${store.version}`);
  const { sig, ...plain } = store;
  const msg = canonicalize(plain);
  return schnorrVerify(msg, sig, store.merchant);
}

// --- crypto boundary: injected so the protocol core stays crypto-agnostic ---
// In the reference client these resolve to @noble/curves + @noble/hashes.
let schnorrSign: (msg: string, skHex: string) => string = () => {
  throw new Error("schnorrSign not injected");
};
let schnorrVerify: (msg: string, sig: string, merchant: string) => boolean = () => {
  throw new Error("schnorrVerify not injected");
};

export function injectCrypto(impl: {
  sign: (msg: string, skHex: string) => string;
  verify: (msg: string, sig: string, npub: string) => boolean;
}): void {
  schnorrSign = impl.sign;
  schnorrVerify = impl.verify;
}
