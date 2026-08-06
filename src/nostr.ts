/**
 * BCP over Nostr — the discovery layer.
 *
 * The descriptor is published as a Nostr event. A "marketplace" is just a client
 * that subscribes to the BCP event kind on the relays IT chooses. There is no
 * canonical registry, no approved list, no protocol-level ranking. Spam, curation,
 * and moderation are CLIENT concerns, pushed to the edge where they belong.
 *
 * This is the move that keeps the protocol from becoming the throat:
 *   we define the event format. We never operate the place you read it.
 */

import { BCPStorefront, canonicalizeSigned } from "./descriptor";

/** BCP storefront event kind.
 *  We bind to NIP-99's classified-listing kind (30402) — an established,
 *  relay-friendly, addressable kind that public relays reliably retain.
 *  The descriptor's hash is carried in the `d` tag so a store is addressable
 *  and replaceable by its merchant. */
export const BCP_KIND = 39801; // protocol-spec nominal (documentation)
export const BCP_KIND_DEPLOY = 30402; // live-deploy kind (NIP-99 classifieds)

/**
 * Hash function is injected so the protocol core stays crypto-agnostic and
 * environment-free (browser, edge, node all welcome). The reference client
 * injects SHA-256.
 */
let hashFn: (msg: string) => string = (m) => m; // placeholder
export function injectHash(impl: (msg: string) => string): void {
  hashFn = impl;
}

export interface BCPNostrEvent {
  kind: number;
  /** Merchant pubkey (hex). MUST match the descriptor.merchant npub. */
  pubkey: string;
  created_at: number;
  /** Single tag pointing at the descriptor hash for dedup/client filtering. */
  tags: [["d", string], ["title", string], ["protocol", string]];
  /** The canonicalized descriptor, stringified, as the event content. */
  content: string;
  /** Nostr event id + sig over the above. */
  id: string;
  sig: string;
}

/**
 * Wrap a verified descriptor as a Nostr event ready to publish.
 * The event `content` is the canonical serialization — so a client can verify
 * the descriptor sig WITHOUT trusting the relay.
 */
export function toNostrEvent(store: BCPStorefront): Omit<BCPNostrEvent, "id" | "sig"> {
  const hash = hashFn(canonicalizeSigned(store));
  return {
    kind: BCP_KIND_DEPLOY,
    pubkey: store.merchant,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["d", hash], ["title", store.name], ["protocol", "bcp/1"]],
    content: canonicalizeSigned(store),
  };
}

/**
 * Read descriptors from a relay. This is ALL the protocol says about discovery:
 *   subscribe to BCP_KIND. What you do with the results (rank, filter, hide) is yours.
 */
export async function readStorefronts(relayUrl: string): Promise<BCPStorefront[]> {
  // Reference client uses a Nostr pool (e.g. nostr-tools SimplePool).
  // Returns raw descriptors; verification is the client's responsibility, not the relay's.
  throw new Error("Implement with a Nostr pool in the reference client");
}
