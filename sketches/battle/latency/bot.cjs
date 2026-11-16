// A headless battle player (no game, no drawing): joins a room and, once the battle's on, sends
// buttons every tick — running back and forth, jumping, firing now and then.
const WebSocket = require('ws');

function bot(url, name, opts = {}) {
  const ws = new WebSocket(url, { perMessageDeflate: false });
  const st = { name, id: null, phase: 'lobby', snaps: 0, bytes: 0, ws, closed: false, maxTick: 0 };
  let seq = 0;
  let timer = null;
  let dir = Math.random() < 0.5 ? 1 : -1;
  let next = 0;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name, hero: opts.hero || 'puffy', token: name + Math.random() })));
  ws.on('message', (d) => {
    st.bytes += d.length;
    const m = JSON.parse(d);
    if (m.t === 'welcome') st.id = m.id;
    if (m.t === 'room') {
      st.phase = m.room.phase;
      st.room = m.room;
      if (opts.start && m.room.phase === 'countdown' && m.room.timer > 4) ws.send(JSON.stringify({ t: 'start' }));
      if (m.room.phase === 'battle' && !timer) {
        seq = 0;
        const t0 = Date.now();
        timer = setInterval(() => {
          // (in step with the real clock, like a game: as many ticks as are due)
          const due = Math.floor((Date.now() - t0) / (1000 / 30));
          while (seq < due) {
            seq++;
            const t = seq / 30;
            if (t > next) {
              next = t + 0.5 + Math.random() * 1.2;
              if (Math.random() < 0.6) dir = -dir;
            }
            let b = dir > 0 ? 2 : 1;
            if (Math.random() < 0.3) b |= 16; // run
            if (seq % 40 < 6) b |= 4; // jump
            if (opts.fire !== false && seq % 25 < 2) b |= 8;
            ws.send(JSON.stringify({ t: 'in', s: seq, b }));
          }
        }, 8);
      }
      if (m.room.phase !== 'battle' && timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    if (m.t === 'snap') {
      st.snaps++;
      st.maxTick = m.k;
    }
  });
  ws.on('close', () => {
    st.closed = true;
    clearInterval(timer);
  });
  ws.on('error', () => {});
  st.leave = () => {
    try {
      ws.send(JSON.stringify({ t: 'leave' }));
    } catch {}
    clearInterval(timer);
    ws.close();
  };
  return st;
}
module.exports = { bot };
