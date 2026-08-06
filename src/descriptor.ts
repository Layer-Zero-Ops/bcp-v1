/**
 * Bitcoin Commerce Protocol (BCP) — v1 descriptor types
 *
 * A storefront is a single, merchant-signed document. The document IS the store.
 * No server, no registry, no platform. The hash of this document is the store's
 * immutable address.
 *
 * Design rules (Satoshi-shaped):
 *  - No new identity system. We reuse Lightning Address / npub.
 *  - No money path through the protocol. Settlement binds to Lightning only.
 *  - No canonical index. Discovery is a client concern, not a protocol one.
 */

/** BCP semantic version. Bumped only on breaking descriptor changes. */
export const BCP_VERSION = 1 as const;

/**
 * Fulfillment kind. Decides what a buyer receives after settlement.
 * The protocol does not enforce fulfillment — that is a merchant/buyer trust
 * matter, optionally attested by the reputation pointer.
 */
export type Fulfillment = "digital" | "physical" | "service";

/**
 * A single sellable unit. Prices are ALWAYS whole satoshis (never BTC floats,
 * never fiat — fiat is a display concern only, resolved at invoice time).
 */
export interface BCPItem {
  /** Stable per-store item id (merchant-chosen, e.g. "sku-001"). */
  id: string;
  title: string;
  description?: string;
  /** Whole satoshis. MUST be an integer >= 0. */
  price_sats: number;
  fulfillment: Fulfillment;
  /** Arbitrary merchant metadata (image url, shipping weight, etc.). Ignored by the protocol. */
  meta?: Record<string, unknown>;
}

/**
 * Settlement binding. We reuse Lightning — we do NOT build rails.
 *  - "bolt12": a reusable BOLT12 offer string embedded in the descriptor.
 *  - "bolt11_template": a BOLT11 invoice is generated per-order at checkout.
 *  - "l402": an L402 (HTTP 402) challenge endpoint for paywalled digital goods.
 */
export type Settlement =
  | { method: "bolt12"; offer: string }
  | { method: "bolt11_template"; node_or_lnaddress: string }
  | { method: "l402"; endpoint: string };

/**
 * The signed storefront descriptor — the entire protocol core.
 */
export interface BCPStorefront {
  version: typeof BCP_VERSION;
  /**
   * Merchant identity. Reuse an existing decentralized identity:
   *  - Lightning Address (user@domain)  OR
   *  - Nostr npub (for Nostr-native discovery + signed reputation)
   * The merchant key that signs this descriptor MUST control this identity.
   */
  merchant: string;
  name: string;
  description?: string;
  items: BCPItem[];
  settlement: Settlement;
  /**
   * Where this descriptor is published. A "marketplace" is just a client
   * that reads these relays. No canonical list. Spam/ranking = client concern.
   */
  relays: string[];
  /**
   * OPTIONAL pointer to signed past-trade proofs (e.g. Nostr kind for reviews,
   * or a hash of a reputation log). The protocol never interprets it — clients may.
   */
  reputation?: string;
  /** ISO-8601 timestamp of last signed update. */
  updated_at: string;
  /** Merchant signature over the canonical serialization (see sign.ts). */
  sig: string;
}

/**
 * Canonical serialization for signing: stable, key-sorted JSON excluding `sig`.
 * Determinism is load-bearing — signing and verifying MUST produce identical bytes.
 */
export function canonicalize(store: Omit<BCPStorefront, "sig">): string {
  const ordered = sortDeep(store as unknown as Record<string, unknown>);
  return JSON.stringify(ordered);
}

/**
 * Canonical serialization INCLUDING sig — used for the Nostr event content so a
 * reader can verify the descriptor without trusting the relay. Same determinism.
 */
export function canonicalizeSigned(store: BCPStorefront): string {
  const ordered = sortDeep(store as unknown as Record<string, unknown>);
  return JSON.stringify(ordered);
}

function sortDeep<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sortDeep(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      out[k] = v.map((e) =>
        e && typeof e === "object" ? sortDeep(e as Record<string, unknown>) : e,
      );
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
