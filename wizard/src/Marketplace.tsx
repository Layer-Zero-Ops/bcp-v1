import { useEffect, useState } from "react";
import { discoverStores, DiscoveredStore } from "./discover";
import { fetchInvoice, checkSettled, LnInvoice } from "./lightning";
import { BCPItem, BCPStorefront } from "../../src/descriptor";

// Discovery reads the SAME relays the wizard publishes to. For the local demo
// we point at the in-repo test relay; a real client would use public relays.
const DEFAULT_RELAYS = [process.env.RELAY_URL ?? "ws://localhost:3337"];

interface PendingOrder {
  store: BCPStorefront["merchant"];
  item: string;
  invoice: LnInvoice;
  verifyUrl: string;
  settled: boolean;
}

export default function Marketplace() {
  const [stores, setStores] = useState<DiscoveredStore[]>([]);
  const [status, setStatus] = useState("connecting…");
  const [order, setOrder] = useState<PendingOrder | null>(null);

  const refresh = async () => {
    setStatus("scanning relays…");
    try {
      const found = await discoverStores(DEFAULT_RELAYS);
      setStores(found);
      setStatus(found.length ? `${found.length} store(s) found` : "no stores yet — publish one");
    } catch (e) {
      setStatus("relay error: " + String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const buy = async (store: BCPStorefront, item: BCPItem) => {
    setStatus("fetching invoice from merchant…");
    try {
      // The storefront must carry a Lightning Address to settle via LNURL-pay.
      const lnAddress =
        store.settlement.method === "bolt11_template"
          ? store.settlement.node_or_lnaddress
          : undefined;
      if (!lnAddress || !lnAddress.includes("@")) {
        throw new Error("Store has no Lightning Address for settlement");
      }
      const invoice = await fetchInvoice(lnAddress, item.price_sats);
      // LNBits settlement endpoint: GET /api/v1/payments/{payment_hash}
      const callbackOrigin = (invoice as any).callback
        ? new URL((invoice as any).callback).origin
        : `http://127.0.0.1:5000`;
      const verifyUrl = `${callbackOrigin}/api/v1/payments/${invoice.payment_hash}`;
      setOrder({
        store: store.merchant,
        item: item.id,
        invoice,
        verifyUrl,
        settled: false,
      });
      setStatus("invoice ready — pay it, then we detect settlement");
      pollSettled(verifyUrl);
    } catch (e) {
      setStatus("invoice error: " + String(e));
    }
  };

  const pollSettled = async (verifyUrl: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await checkSettled(verifyUrl);
      if (res.settled) {
        setOrder((o) => (o ? { ...o, settled: true } : o));
        setStatus("SETTLED ✅ — fulfillment can now proceed");
        return;
      }
    }
    setStatus("invoice expired or not paid");
  };

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", fontFamily: "system-ui", padding: 24 }}>
      <h1>BCP Marketplace</h1>
      <p style={{ color: "#555" }}>
        Reads storefront events from relays. No login, no platform. Invoices come
        straight from the merchant's own Lightning backend (LNURL-pay).
      </p>
      <button onClick={refresh}>Rescan relays</button> <span>{status}</span>

      {stores.map(({ store }) => (
        <section key={store.merchant} style={{ border: "1px solid #ddd", padding: 16, margin: "16px 0" }}>
          <h2>{store.name}</h2>
          <small>{store.merchant}</small>
          <p>{store.description}</p>
          <ul>
            {store.items.map((it) => (
              <li key={it.id}>
                {it.title} — {it.price_sats.toLocaleString()} sats{" "}
                <button onClick={() => buy(store, it)}>Buy (real invoice)</button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {order && (
        <div style={{ background: "#111", color: order.settled ? "#0f0" : "#0f0", padding: 12, marginTop: 16, wordBreak: "break-all" }}>
          <strong>{order.settled ? "SETTLED ✅" : "Lightning invoice (pay this):"}</strong>
          <br />
          {order.invoice.payment_request}
        </div>
      )}
    </main>
  );
}
