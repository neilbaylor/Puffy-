import { createServer } from 'node:http';
import WebSocket from 'ws';
import { attachBattle } from '/workspace/Puffy-/server/battle';
import { unpackPlayer } from '/workspace/Puffy-/src/shared/battle/protocol';
// Two players battle. Player A holds RIGHT for 5 s, then reloads the page (same tab: same token, so the
// server gives A its place back) and the battle scene starts over, counting its inputs from 1 again.
// A now holds LEFT. Does A move?
const srv = createServer();
attachBattle(srv);
await new Promise<void>((r) => srv.listen(18950, r));
const url = 'ws://127.0.0.1:18950/battle?room=t';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Conn = { ws: WebSocket; id?: string; x?: number; phase?: string };
const join = (token: string, name: string) =>
  new Promise<Conn>((res) => {
    const c: Conn = { ws: new WebSocket(url) };
    c.ws.on('open', () => c.ws.send(JSON.stringify({ t: 'hello', name, hero: 'puffy', token })));
    c.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.t === 'welcome') { c.id = m.id; res(c); }
      if (m.t === 'room') c.phase = m.room.phase;
      if (m.t === 'snap') { const p = m.p.map(unpackPlayer).find((q: any) => q.id === c.id); if (p) c.x = Math.round(p.x); }
    });
  });
let a = await join('tokA', 'A');
const b = await join('tokB', 'B');
while (a.phase !== 'battle') await sleep(50);
let seq = 0;
const hold = async (c: Conn, btn: number, ms: number) => { const end = Date.now() + ms; while (Date.now() < end) { c.ws.send(JSON.stringify({ t: 'in', s: ++seq, b: btn })); await sleep(33); } };
await sleep(500);
const x0 = a.x;
await hold(a, 2, 5000); // RIGHT
const x1 = a.x;
console.log(`A held right for 5 s: x ${x0} -> ${x1} (sent ${seq} inputs)`);
a.ws.close();
await sleep(300);
a = await join('tokA', 'A'); // the page reloaded: same token, the scene starts again
seq = 0; // (BattleScene.create: this.seq = 0)
await sleep(300);
const x2 = a.x;
await hold(a, 1, 3000); // LEFT
console.log(`after rejoining, A held left for 3 s: x ${x2} -> ${a.x}`);
a.ws.close(); b.ws.close(); srv.close();
process.exit(0);
