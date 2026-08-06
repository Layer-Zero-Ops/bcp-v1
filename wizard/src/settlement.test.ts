import { describe, it, expect } from "vitest";
import { fetchInvoice, checkSettled } from "./lightning";

/**
 * Real settlement loop against a LIVE LNBits (FakeWallet) node on 127.0.0.1:5000.
 *
 * This is the honest end-to-end proof: a real BOLT11 invoice is fetched from the
 * merchant's LNURL-pay backend, paid through the node, and settlement is detected
 * by polling — no fake strings, no mocks. The FakeWallet backend means the ledger
 * is simulated (no real sats), but every protocol step is real Lightning.
 *
 * The test is self-funding: it creates a fresh customer wallet and funds it by
 * having the (pre-credited) merchant wallet pay a customer invoice. No manual
 * DB edits required — fully reproducible as long as LNBits is running with the
 * merchant wallet credited (curl the faucet once, see README).
 */
const LN_ADDRESS = process.env.BCP_LN_ADDRESS ?? "ashamedbuzzard3@127.0.0.1:5000";
const MERCHANT_ADMINKEY = process.env.BCP_LN_ADMINKEY ?? "3e7e01359eb94cd98cf02d501f4c94b7";
const NODE = "http://127.0.0.1:5000";

async function api(path: string, opts: RequestInit = {}) {
  return fetch(`${NODE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
}

describe("BCP settlement — real LNURL-pay loop", () => {
  it("fetches a real invoice, pays it, and detects settlement", async () => {
    // 0. Self-fund: create a fresh customer wallet, then have the merchant
    //    wallet pay a customer invoice so the customer has sats to spend.
    const cust = await (await api("/api/v1/account", {
      method: "POST",
      body: JSON.stringify({ name: "BCP Test Customer" }),
    })).json();
    const custKey: string = cust.adminkey;
    const custInv = await (await api("/api/v1/payments", {
      method: "POST",
      headers: { "X-Api-Key": custKey },
      body: JSON.stringify({ out: false, amount: 30000, memo: "fund-customer" }),
    })).json();
    const fund = await (await api("/api/v1/payments", {
      method: "POST",
      headers: { "X-Api-Key": MERCHANT_ADMINKEY },
      body: JSON.stringify({ bolt11: custInv.payment_request }),
    })).json();
    expect(fund.paid ?? fund.status === "success", "customer funding should succeed").toBe(true);

    // 1. Buyer fetches a REAL BOLT11 from the merchant's backend (LNURL-pay).
    const inv = await fetchInvoice(LN_ADDRESS, 21000);
    expect(inv.payment_request.startsWith("lnbc")).toBe(true);
    expect(inv.amount_msat).toBe(21000 * 1000);
    expect(inv.payment_hash).toMatch(/^[0-9a-f]{64}$/);

    // 2. The funded customer wallet pays the invoice through the node.
    const payRes = await api("/api/v1/payments", {
      method: "POST",
      headers: { "X-Api-Key": custKey },
      body: JSON.stringify({ bolt11: inv.payment_request }),
    });
    expect(payRes.ok, "payment should succeed").toBe(true);
    const payBody = await payRes.json();
    expect(payBody.payment_hash).toBe(inv.payment_hash);

    // 3. Settlement is detected by polling the merchant's payment record.
    let settled = false;
    for (let i = 0; i < 10 && !settled; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await checkSettled(`${NODE}/api/v1/payments/${inv.payment_hash}`);
      settled = res.settled;
    }
    expect(settled, "invoice should be detected as settled").toBe(true);
  }, 30000);
});
