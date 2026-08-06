import { useState } from "react";
import { initBcpCrypto } from "./crypto";
import { useWizard, toSignable } from "./useWizard";
import { signNostr, verify } from "../../src/sign";
import { publishStorefront, generateMerchantKey } from "./publish";
import { BCPStorefront, Fulfillment, Settlement } from "../../src/descriptor";

initBcpCrypto();

type Phase = "edit" | "signed" | "published" | "error";

function WizardApp() {
  const { state, update, setItem, addItem, removeItem } = useWizard();
  const [skHex, setSkHex] = useState("");
  const [store, setStore] = useState<BCPStorefront | null>(null);
  const [phase, setPhase] = useState<Phase>("edit");
  const [msg, setMsg] = useState("");

  const onGenerateKey = () => {
    const { skHex, npub } = generateMerchantKey();
    setSkHex(skHex);
    update({ merchant: npub });
    setMsg(`Generated merchant key. npub: ${npub} — SAVE your secret key separately.`);
  };

  const onSign = () => {
    try {
      if (!skHex) throw new Error("No merchant secret key. Generate or paste one.");
      const signed = signNostr(toSignable(state), skHex);
      if (!verify(signed)) throw new Error("Self-verify failed");
      setStore(signed);
      setPhase("signed");
      setMsg("Descriptor signed & self-verified. Ready to publish.");
    } catch (e) {
      setPhase("error");
      setMsg(String(e));
    }
  };

  const onPublish = async () => {
    if (!store) return;
    try {
      const res = await publishStorefront(store, skHex);
      setPhase("published");
      setMsg(
        `Published to ${res.relaysPublished.length} relay(s). Event: ${res.eventId.slice(0, 16)}…`,
      );
    } catch (e) {
      setPhase("error");
      setMsg(String(e));
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", fontFamily: "system-ui", padding: 24 }}>
      <h1>Bitcoin Commerce Protocol — Store Setup</h1>
      <p style={{ color: "#b91c1c" }}>
        Open wizard. Fork it, run your own. LZS is one of many doors in — never the only one.
      </p>

      <Section title="1. Merchant identity">
        <label>
          Secret key (hex, kept local){" "}
          <button onClick={onGenerateKey}>Generate new</button>
        </label>
        <input
          style={{ width: "100%" }}
          value={skHex}
          onChange={(e) => setSkHex(e.target.value)}
          placeholder="paste or generate"
        />
        <input
          style={{ width: "100%", marginTop: 8 }}
          value={state.merchant}
          onChange={(e) => update({ merchant: e.target.value })}
          placeholder="npub (merchant public key)"
        />
      </Section>

      <Section title="2. Store">
        <input
          style={{ width: "100%" }}
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Store name"
        />
        <textarea
          style={{ width: "100%", marginTop: 8 }}
          value={state.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Description"
        />
      </Section>

      <Section title="3. Items (priced in sats)">
        {state.items.map((it, i) => (
          <div key={i} style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}>
            <input
              style={{ width: "30%" }}
              value={it.id}
              onChange={(e) => setItem(i, { id: e.target.value })}
              placeholder="id"
            />{" "}
            <input
              style={{ width: "40%" }}
              value={it.title}
              onChange={(e) => setItem(i, { title: e.target.value })}
              placeholder="title"
            />{" "}
            <input
              style={{ width: "20%" }}
              type="number"
              value={it.price_sats}
              onChange={(e) => setItem(i, { price_sats: Number(e.target.value) })}
              placeholder="sats"
            />
            <select
              value={it.fulfillment}
              onChange={(e) => setItem(i, { fulfillment: e.target.value as Fulfillment })}
            >
              <option value="digital">digital</option>
              <option value="physical">physical</option>
              <option value="service">service</option>
            </select>{" "}
            <button onClick={() => removeItem(i)}>x</button>
          </div>
        ))}
        <button onClick={addItem}>+ add item</button>
      </Section>

      <Section title="4. Settlement (Lightning)">
        <select
          value={state.settlement.method}
          onChange={(e) =>
            update({
              settlement:
                e.target.value === "bolt12"
                  ? { method: "bolt12", offer: "" }
                  : e.target.value === "l402"
                    ? { method: "l402", endpoint: "" }
                    : { method: "bolt11_template", node_or_lnaddress: "" },
            })
          }
        >
          <option value="bolt11_template">BOLT11 (per order)</option>
          <option value="bolt12">BOLT12 offer</option>
          <option value="l402">L402 paywall</option>
        </select>
        <SettlementDetail s={state.settlement} onChange={(s) => update({ settlement: s })} />
      </Section>

      <Section title="5. Relays (discovery)">
        <textarea
          style={{ width: "100%" }}
          value={state.relays.join("\n")}
          onChange={(e) => update({ relays: e.target.value.split("\n").map((r) => r.trim()) })}
          placeholder="one relay wss:// per line"
          rows={3}
        />
        <small>Discovery is a client concern. Pick relays you trust; no canonical index exists.</small>
      </Section>

      <div style={{ marginTop: 16 }}>
        <button onClick={onSign} disabled={phase === "signed"}>
          Sign descriptor
        </button>{" "}
        <button onClick={onPublish} disabled={!store}>
          Publish to relays
        </button>
      </div>

      {msg && (
        <p style={{ marginTop: 16, background: "#f5f5f5", padding: 12 }}>{msg}</p>
      )}
      {store && (
        <pre style={{ marginTop: 16, background: "#111", color: "#0f0", padding: 12, overflow: "auto" }}>
          {JSON.stringify(store, null, 2)}
        </pre>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function SettlementDetail({
  s,
  onChange,
}: {
  s: Settlement;
  onChange: (s: Settlement) => void;
}) {
  if (s.method === "bolt11_template")
    return (
      <input
        style={{ width: "100%", marginTop: 8 }}
        value={s.node_or_lnaddress}
        onChange={(e) => onChange({ method: "bolt11_template", node_or_lnaddress: e.target.value })}
        placeholder="node pubkey or Lightning Address"
      />
    );
  if (s.method === "bolt12")
    return (
      <input
        style={{ width: "100%", marginTop: 8 }}
        value={s.offer}
        onChange={(e) => onChange({ method: "bolt12", offer: e.target.value })}
        placeholder="lno1... BOLT12 offer"
      />
    );
  return (
    <input
      style={{ width: "100%", marginTop: 8 }}
      value={s.endpoint}
      onChange={(e) => onChange({ method: "l402", endpoint: e.target.value })}
      placeholder="https://paywalled-resource"
    />
  );
}

import Marketplace from "./Marketplace";

export default function App() {
  const [view, setView] = useState<"wizard" | "marketplace">("wizard");
  return (
    <div>
      <nav style={{ maxWidth: 820, margin: "0 auto", padding: "12px 24px 0", display: "flex", gap: 12 }}>
        <button onClick={() => setView("wizard")} style={{ fontWeight: view === "wizard" ? "bold" : "normal" }}>
          Open a Store
        </button>
        <button onClick={() => setView("marketplace")} style={{ fontWeight: view === "marketplace" ? "bold" : "normal" }}>
          Browse Stores
        </button>
      </nav>
      {view === "wizard" ? <WizardApp /> : <Marketplace />}
    </div>
  );
}
