/**
 * BCP settlement — we BIND to Lightning, we do not build rails.
 *
 * The protocol's only job here: turn "buy item X" into a payable Lightning
 * request and confirm it was paid. Sats move merchant<->customer. The protocol
 * never custodies, relays, or sees the money. That separation is load-bearing:
 * it is what keeps the steward (LZS) off the money path and out of the throat.
 */

import { BCPItem, BCPStorefront } from "./descriptor";

export interface Invoice {
  /** BOLT11 string, or an L402 challenge, or a BOLT12 invoice derived from the offer. */
  payment_request: string;
  amount_sats: number;
  /** Opaque order id the merchant/client agree on for fulfillment tracking. */
  order_id: string;
}

/**
 * Generate a payment request for one item. Pure mapping — no network, no keys.
 * The actual invoice creation happens at the merchant's Lightning backend
 * (LND/CLN/LNbits), referenced by the descriptor.settlement binding.
 */
export function makeInvoice(store: BCPStorefront, item: BCPItem): Invoice {
  switch (store.settlement.method) {
    case "bolt11_template": {
      // Merchant backend mints a BOLT11 for item.price_sats at this node/LN-address.
      return {
        payment_request: `lightning:${store.settlement.node_or_lnaddress}?amount=${item.price_sats}&memo=${item.id}`,
        amount_sats: item.price_sats,
        order_id: `${store.merchant}:${item.id}:${Date.now()}`,
      };
    }
    case "bolt12": {
      // BOLT12 offer already encodes price; the client derives the invoice from it.
      return {
        payment_request: store.settlement.offer,
        amount_sats: item.price_sats,
        order_id: `${store.merchant}:${item.id}:${Date.now()}`,
      };
    }
    case "l402": {
      // L402: client fetches the protected resource, gets a 402 + challenge,
      // pays the invoice, retries with the preimage macaroon.
      return {
        payment_request: `l402:${store.settlement.endpoint}`,
        amount_sats: item.price_sats,
        order_id: `${store.merchant}:${item.id}:${Date.now()}`,
      };
    }
  }
}

/**
 * Confirm settlement. In practice the merchant (or a watchtower client) checks
 * the Lightning invoice is settled and emits a signed fulfillment proof. The
 * protocol defines the shape; it does not perform the check.
 */
export interface FulfillmentProof {
  order_id: string;
  /** Merchant signature over order_id + preimage hash. */
  sig: string;
  paid_at: string;
}

export function verifyFulfillment(_store: BCPStorefront, _proof: FulfillmentProof): boolean {
  // Reference client verifies the merchant sig against the descriptor.merchant key.
  return true; // placeholder — wired in reference client
}
