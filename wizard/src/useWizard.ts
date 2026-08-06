import { useState } from "react";
import { BCPItem, BCPStorefront, Fulfillment, Settlement } from "../../src/descriptor";

interface ItemDraft extends BCPItem {}

const EMPTY_ITEM: ItemDraft = {
  id: "",
  title: "",
  price_sats: 0,
  fulfillment: "digital",
};

export interface WizardState {
  merchant: string;
  name: string;
  description: string;
  items: ItemDraft[];
  settlement: Settlement;
  relays: string[];
}

export const initial: WizardState = {
  merchant: "",
  name: "",
  description: "",
  items: [{ ...EMPTY_ITEM }],
  settlement: { method: "bolt11_template", node_or_lnaddress: "" },
  relays: ["wss://relay.damus.io"],
};

export function useWizard() {
  const [state, setState] = useState<WizardState>(initial);
  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setState((s) => ({
      ...s,
      items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));

  const addItem = () => setState((s) => ({ ...s, items: [...s.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i: number) =>
    setState((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));

  return { state, update, setItem, addItem, removeItem };
}

/** Build a signable descriptor (without sig) from wizard state. */
export function toSignable(state: WizardState): Omit<BCPStorefront, "sig"> {
  return {
    version: 1,
    merchant: state.merchant,
    name: state.name,
    description: state.description || undefined,
    items: state.items.filter((i) => i.id && i.title).map((i) => ({ ...i })),
    settlement: state.settlement,
    relays: state.relays.filter(Boolean),
    updated_at: new Date().toISOString(),
  };
}
