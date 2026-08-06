/**
 * BCP publish — turns a signed descriptor into a Nostr event and broadcasts it.
 *
 * This is the ONLY network code in the wizard. The protocol itself defines the
 * event format (src/nostr.ts); this module performs the actual relay publish.
 *
 * Note: discovery is a CLIENT concern. This wizard publishes to the relays the
 * MERCHANT chose in their descriptor. No canonical relay, no approved list.
 */
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools/pure";
import { WebSocket } from "ws";
import { BCPStorefront } from "../../src/descriptor";
import { toNostrEvent, BCP_KIND_DEPLOY } from "../../src/nostr";

export interface PublishResult {
  eventId: string;
  relaysPublished: string[];
  relaysFailed: string[];
}

/**
 * Deterministically publish one event to one relay:
 * open WS -> wait for open -> send EVENT -> await the relay's OK.
 * Resolves only when the relay confirms acceptance. (SimplePool.publish is
 * optimistic and resolves before the relay sees the event; we need certainty
 * for the publish->discover round-trip to be testable.)
 */
function publishToRelay(relayUrl: string, ev: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const done = (fn: () => void) => {
      // give the relay a tick to forward, then close
      setTimeout(() => {
        try {
          ws.close();
        } catch {}
        fn();
      }, 200);
    };
    ws.on("open", () => ws.send(JSON.stringify(["EVENT", ev])));
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === "OK" && msg[1] === ev.id && msg[2] === true) done(resolve);
        else if (msg[0] === "OK" && msg[2] === false) done(() => reject(new Error(msg[3] ?? "rejected")));
      } catch {}
    });
    ws.on("error", (e) => done(() => reject(e)));
    // safety timeout
    setTimeout(() => done(() => reject(new Error("timeout"))), 8000);
  });
}

/**
 * Publish a signed storefront to its declared relays.
 * `skHex` must be the merchant key that controls descriptor.merchant.
 */
export async function publishStorefront(
  store: BCPStorefront,
  skHex: string,
): Promise<PublishResult> {
  const sk = hexToBytes(skHex);
  const pub = getPublicKey(sk);
  if (pub !== store.merchant) {
    throw new Error("Signing key does not match descriptor.merchant");
  }

  const ev = finalizeEvent(toNostrEvent(store) as never, sk);
  if (ev.kind !== BCP_KIND_DEPLOY) throw new Error("Event kind mismatch");

  const relays = store.relays;
  const results = await Promise.allSettled(relays.map((r) => publishToRelay(r, ev)));

  const relaysPublished = relays.filter((_, i) => results[i].status === "fulfilled");
  const relaysFailed = relays.filter((_, i) => results[i].status === "rejected");

  return { eventId: ev.id, relaysPublished, relaysFailed };
}

export function generateMerchantKey(): { skHex: string; npub: string } {
  const sk = generateSecretKey();
  const hex = bytesToHex(sk);
  return { skHex: hex, npub: getPublicKey(sk) };
}

// --- helpers (nostr-tools uses Uint8Array; protocol core uses hex strings) ---
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
