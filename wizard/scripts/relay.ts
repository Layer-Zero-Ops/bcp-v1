/**
 * Minimal Nostr relay (test harness) — speaks the subset of the Nostr protocol
 * the BCP reference client needs: accept EVENT, answer REQ with stored events
 * + EOSE. In-memory, no persistence. Used to prove the publish->discover loop
 * deterministically without depending on flaky public relays.
 *
 * Run: tsx scripts/relay.ts  (or node --import tsx)
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.RELAY_PORT ?? 3337);
const store: any[] = [];

const wss = new WebSocketServer({ port: PORT });
console.log(`BCP test relay listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  let subs = new Map<string, any>();
  ws.on("message", (data) => {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    const [type, ...rest] = msg;
    if (type === "EVENT") {
      const ev = rest[0];
      store.push(ev);
      console.log("RECV EVENT", ev.id, "kind", ev.kind);
      ws.send(JSON.stringify(["OK", ev.id, true, "accepted"]));
    } else if (type === "REQ") {
      const subId = rest[0];
      const filter = rest[1] ?? {};
      console.log("REQ", JSON.stringify(filter), "store size", store.length);
      const matched = store.filter(
        (ev) =>
          (!filter.kinds || filter.kinds.includes(ev.kind)) &&
          (!filter.authors || filter.authors.includes(ev.pubkey)) &&
          (!filter.ids || filter.ids.includes(ev.id)),
      );
      console.log("  matched", matched.length);
      for (const ev of matched) ws.send(JSON.stringify(["EVENT", subId, ev]));
      ws.send(JSON.stringify(["EOSE", subId]));
    } else if (type === "CLOSE") {
      subs.delete(rest[0]);
    }
  });
});
