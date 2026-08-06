/**
 * BCP Lightning settlement (reference client) — REAL LNURL-pay.
 *
 * BCP never runs a node or touches sats. The merchant publishes a Lightning
 * Address (e.g. "shop@lnbits.local") in their descriptor. This module:
 *   1. resolves that address to an LNURL-pay endpoint,
 *   2. fetches a real BOLT11 invoice for the item's price,
 *   3. exposes a poll() so a client can detect when it's actually settled.
 *
 * We bind to Lightning — we do not rebuild it. The node is the merchant's.
 */

export interface LnInvoice {
  /** Real BOLT11 string from the merchant's backend. */
  payment_request: string;
  /** Millisatoshi — what the merchant's node is actually charging. */
  amount_msat: number;
  /** Opaque payment hash; used to poll settlement. */
  payment_hash: string;
  description: string;
  /** Short-lived. After this the invoice is unusable. */
  expires_at: number;
  /** LNURL-pay callback URL (for building the settlement verify endpoint). */
  callback?: string;
}

export interface LnUrlPayMeta {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  tag: "payRequest";
}

/** Resolve a Lightning Address (user@host) to its LNURL-pay metadata. */
export async function resolveLightningAddress(addr: string): Promise<LnUrlPayMeta> {
  const [user, host] = addr.split("@");
  if (!user || !host) throw new Error(`Not a Lightning Address: ${addr}`);
  // LUD-16: host/.well-known/lnurlp/user. Preserve scheme: use http for
  // localhost/testing, https otherwise.
  const scheme = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const res = await fetch(`${scheme}://${host}/.well-known/lnurlp/${user}`);
  if (!res.ok) throw new Error(`LN address lookup failed (${res.status}) for ${addr}`);
  const meta = (await res.json()) as LnUrlPayMeta;
  if (meta.tag !== "payRequest") throw new Error("Endpoint is not an LNURL-pay endpoint");
  return meta;
}

/** Fetch a real BOLT11 for `amountSats` from the merchant's backend. */
export async function fetchInvoice(addr: string, amountSats: number): Promise<LnInvoice> {
  const meta = await resolveLightningAddress(addr);
  if (amountSats * 1000 < meta.minSendable || amountSats * 1000 > meta.maxSendable) {
    throw new Error(`Amount ${amountSats} sats outside merchant range`);
  }
  const cb = new URL(meta.callback);
  cb.searchParams.set("amount", String(amountSats * 1000));
  const res = await fetch(cb.toString());
  if (!res.ok) throw new Error(`Invoice fetch failed (${res.status})`);
  const inv = await res.json();
  // LNBits LNURL callback returns { pr, payment_hash?, ... }. Some versions omit
  // payment_hash; recover it from the BOLT11 (52-hex payment hash after "1p").
  const pr: string = inv.pr;
  const paymentHash = inv.payment_hash ?? decodeBolt11PaymentHash(pr);
  return {
    payment_request: pr,
    amount_msat: inv.amount ?? amountSats * 1000,
    payment_hash: paymentHash,
    description: meta.metadata,
    expires_at: inv.expires_at ?? 0,
    callback: meta.callback,
  };
}

import { decode } from "light-bolt11-decoder";

/** Extract the 256-bit payment hash (52 hex chars) from a BOLT11 string. */
function decodeBolt11PaymentHash(bolt11: string): string {
  const decoded = decode(bolt11) as any;
  const section = decoded.sections.find((s: any) => s.name === "payment_hash");
  if (!section) throw new Error("Could not decode payment hash from invoice");
  return section.value as string;
}

/**
 * Poll whether an invoice is settled. LNBits exposes settlement at
 * `/api/v1/payments/{payment_hash}`; we pass the full verify URL so this stays
 * backend-agnostic. Returns the preimage (proof of payment) when settled.
 */
export async function checkSettled(
  verifyUrl: string,
): Promise<{ settled: boolean; preimage?: string }> {
  try {
    const res = await fetch(verifyUrl);
    if (!res.ok) return { settled: false };
    const body = await res.json();
    if (body.paid || body.settled) return { settled: true, preimage: body.preimage };
    return { settled: false };
  } catch {
    return { settled: false };
  }
}
