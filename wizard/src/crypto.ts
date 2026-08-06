/**
 * BCP crypto adapter — wires the protocol core (src/../src/*) to real crypto.
 *
 * This is the ONLY place that touches keys. The store wizard injects these
 * implementations so the protocol core stays crypto-agnostic and reusable.
 *
 * We use Nostr-style schnorr (secp256k1) so a merchant's npub IS their store key.
 * A Lightning-Address merchant would instead sign via their wallet backend and
 * supply the sig here — same interface, different authority.
 */
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { injectCrypto } from "../../src/sign";
import { injectHash } from "../../src/nostr";

export function initBcpCrypto(): void {
  injectCrypto({
    sign: (msg: string, skHex: string) => {
      const sig = schnorr.sign(sha256(msg), skHex);
      return bytesToHex(sig);
    },
    verify: (msg: string, sig: string, npub: string) => {
      try {
        // npub is hex pubkey here (nostr-tools converts npub<->hex at the edge)
        return schnorr.verify(sig, sha256(msg), npub);
      } catch {
        return false;
      }
    },
  });

  injectHash((msg: string) => bytesToHex(sha256(msg)));
}
