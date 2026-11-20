import { createServer } from 'node:http';
import { attachBattle } from '/workspace/Puffy-/server/battle';
// BattleUI.open() run twice for one room (Enter pressed twice / held in the room-code box, or "Let's go"
// tapped twice before the game's art is ready: each press queues another open()) makes two BattleNets
// from the same tab, so the same rejoin token. What do they do to each other?
const store = new Map<string, string>();
(globalThis as any).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
(globalThis as any).window = globalThis;
const { BattleNet } = await import('/workspace/Puffy-/src/net/battleNet');
const srv = createServer();
attachBattle(srv);
await new Promise<void>((r) => srv.listen(18970, r));
const url = 'ws://127.0.0.1:18970/battle?room=t';
const log: Record<string, string[]> = { first: [], second: [] };
let people = 0;
const make = (k: 'first' | 'second') => {
  const n = new BattleNet(url, 'Amy', 'puffy');
  n.onStatus = (s) => log[k].push(s);
  n.onRoom = (r) => (people = r.players.length);
  return n;
};
const a = make('first');
const b = make('second');
await new Promise((r) => setTimeout(r, 6000));
console.log('first  BattleNet status changes in 6 s:', log.first.length, log.first.slice(0, 8).join(' '), '…');
console.log('second BattleNet status changes in 6 s:', log.second.length, log.second.slice(0, 8).join(' '), '…');
console.log('players the room shows:', people);
a.close(); b.close(); srv.close();
process.exit(0);
