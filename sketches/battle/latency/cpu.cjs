// Server cost: R rooms of 4 bots each, straight at the server; its CPU (from /proc) and what it sends.
// node cpu.cjs <port> <rooms> [seconds] <server pid>
const fs = require('fs');
const { bot } = require('./bot.cjs');
const [PORT, ROOMS, SECS = 30, pid] = process.argv.slice(2).map(Number);
const cpu = () => {
  const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return (Number(f[11]) + Number(f[12])) * 10; // ms (100 Hz clock ticks)
};
(async () => {
  const bots = [];
  for (let r = 0; r < ROOMS; r++) {
    const room = 'cpu' + r + '-' + Math.floor(Math.random() * 1e6);
    for (let i = 0; i < 4; i++) bots.push(bot(`ws://localhost:${PORT}/battle?room=${room}`, `B${r}_${i}`, { start: i === 0 }));
  }
  const t0 = Date.now();
  while (bots.some((b) => b.phase !== 'battle') && Date.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 8000)); // (things going on in the arena)
  const c0 = cpu();
  const b0 = bots.reduce((t, b) => t + b.bytes, 0);
  const s0 = Date.now();
  await new Promise((r) => setTimeout(r, SECS * 1000));
  const ms = cpu() - c0;
  const secs = (Date.now() - s0) / 1000;
  const bytes = bots.reduce((t, b) => t + b.bytes, 0) - b0;
  const rss = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]);
  console.log(`port ${PORT}: ${ROOMS} room(s) × 4 players — server CPU ${(ms / secs / 10).toFixed(2)}% of a core (${(ms / secs / ROOMS).toFixed(1)} ms per second per room); sends ${(bytes / secs / bots.length / 1024).toFixed(1)} KB/s to each player (${(bytes / secs / 1024).toFixed(0)} KB/s in all); RSS ${(rss / 1024).toFixed(0)} MB`);
  for (const b of bots) b.leave();
  setTimeout(() => process.exit(0), 300);
})();
