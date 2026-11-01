/**
 * World concept sketches. Each function paints one 1280×560 scene slice
 * using the same placeholder heroes as the game.
 */
import { CHARACTERS } from '../data/characters';
import { drawCharacter, ellipse, rng, roundRect, type Ctx, type Pose } from '../gfx/draw';

export const W = 1280;
export const H = 560;
const T = 40; // sketch tile size
const OUT = '#2a1e2e';
const GROUND_Y = 440;

// ───────────────────────────── shared bits ──

function sky(ctx: Ctx, stops: string[]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function cloud(ctx: Ctx, x: number, y: number, s: number, fill = '#fff', shade = '#d6ecfb') {
  const lumps = [
    [-30, 6, 20],
    [-10, -6, 26],
    [16, -2, 22],
    [36, 8, 16],
  ];
  for (const [lx, ly, r] of lumps) ellipse(ctx, x + lx * s, y + ly * s + 4, r * s, r * s, shade);
  for (const [lx, ly, r] of lumps) ellipse(ctx, x + lx * s, y + ly * s, r * s, r * s, fill);
}

function hero(ctx: Ctx, i: number, x: number, feetY: number, pose: Pose = 'idle0', flip = false, scale = 1.25) {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(flip ? -scale : scale, scale);
  drawCharacter(ctx, -26, -54, CHARACTERS[i], pose);
  ctx.restore();
}

function rocketShot(ctx: Ctx, x0: number, y: number, x1: number) {
  // smoke trail
  for (let x = x0; x < x1 - 20; x += 14) ellipse(ctx, x, y + Math.sin(x) * 2, 4 + (x - x0) * 0.02, 4 + (x - x0) * 0.02, '#ffffffaa');
  roundRect(ctx, x1 - 22, y - 5, 26, 10, 4, OUT);
  roundRect(ctx, x1 - 21, y - 4, 22, 8, 3, '#e9edf3');
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y - 4);
  ctx.quadraticCurveTo(x1 + 12, y, x1 + 2, y + 4);
  ctx.fill();
}

function boom(ctx: Ctx, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.35, '#ffd23f');
  g.addColorStop(0.7, '#ff7a2e');
  g.addColorStop(1, '#ff5a3c00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffffcc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
  ctx.stroke();
  const rr = rng(Math.round(x));
  for (let i = 0; i < 10; i++) {
    const a = rr() * Math.PI * 2;
    const d = r * (0.9 + rr() * 0.6);
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 4, '#ffe14d');
  }
}

/** Generic enemy blob with angry eyes. */
function baddie(ctx: Ctx, x: number, feetY: number, body: string, dark: string, kind: 'shell' | 'spiky' | 'fly' | 'blob' = 'shell') {
  const cx = x;
  const cy = feetY - 20;
  if (kind === 'fly') {
    for (const s of [-1, 1]) ellipse(ctx, cx + s * 14, cy - 14, 13, 7, '#e9f6ff');
  }
  if (kind === 'spiky') {
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = '#eef2f7';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + i * 8 - 5, cy - 8);
      ctx.lineTo(cx + i * 8, cy - 30 + Math.abs(i) * 4);
      ctx.lineTo(cx + i * 8 + 5, cy - 8);
      ctx.fill();
      ctx.stroke();
    }
  }
  ellipse(ctx, cx - 10, feetY - 4, 7, 4.5, OUT);
  ellipse(ctx, cx + 10, feetY - 4, 7, 4.5, OUT);
  ellipse(ctx, cx, cy, 23, 20, OUT);
  ellipse(ctx, cx, cy, 20, 17, body);
  ellipse(ctx, cx - 6, cy - 8, 7, 4, '#ffffff55');
  ctx.fillStyle = dark;
  ctx.fillRect(cx - 20, cy + 4, 40, 4);
  for (const s of [-1, 1]) {
    const ex = cx - 6 + s * 6;
    ellipse(ctx, ex, cy - 2, 4.5, 5.5, OUT);
    ellipse(ctx, ex, cy - 2, 3.5, 4.5, '#fff');
    ellipse(ctx, ex - 1.2, cy - 1, 1.8, 2.6, OUT);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ex - 5, cy - 10 + (s < 0 ? -1 : 2));
    ctx.lineTo(ex + 5, cy - 10 + (s < 0 ? 2 : -1));
    ctx.stroke();
  }
}

function qBlock(ctx: Ctx, x: number, y: number, gold = '#ffc533', dark = '#c7861a', glyph = '?') {
  roundRect(ctx, x, y, T, T, 5, OUT);
  roundRect(ctx, x + 2, y + 2, T - 4, T - 4, 4, gold);
  ctx.fillStyle = '#ffffff66';
  ctx.fillRect(x + 4, y + 4, T - 8, 3);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 4, y + T - 7, T - 8, 3);
  ctx.font = '900 26px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = dark;
  ctx.fillText(glyph, x + T / 2 + 1, y + T / 2 + 2);
  ctx.fillStyle = '#fff8dc';
  ctx.fillText(glyph, x + T / 2, y + T / 2);
}

function coin(ctx: Ctx, x: number, y: number) {
  ellipse(ctx, x, y, 10, 13, OUT);
  ellipse(ctx, x, y, 8, 11, '#ffc533');
  ellipse(ctx, x, y, 4, 7, '#c7861a');
  ellipse(ctx, x - 3, y - 5, 2, 3, '#fff3b0');
}

function coinArc(ctx: Ctx, x0: number, y: number, n: number, rise = 40) {
  for (let i = 0; i < n; i++) coin(ctx, x0 + i * 34, y - Math.sin((i / (n - 1)) * Math.PI) * rise);
}

/** Lay ground segments [x0, x1) using a per-tile painter. */
function groundRun(_ctx: Ctx, x0: number, x1: number, top: number, paint: (x: number, y: number, isTop: boolean, edge: -1 | 0 | 1) => void) {
  for (let x = x0; x < x1; x += T)
    for (let y = top; y < H; y += T) paint(x, y, y === top, x === x0 ? -1 : x + T >= x1 ? 1 : 0);
}

function mountains(ctx: Ctx, baseY: number, color: string, seed: number, minH: number, maxH: number, cap?: string) {
  const r = rng(seed);
  for (let x = -60; x < W + 120; x += 120 + r() * 90) {
    const h = minH + r() * (maxH - minH);
    const w = 120 + r() * 80;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w, baseY);
    ctx.quadraticCurveTo(x - w * 0.15, baseY - h - 10, x, baseY - h);
    ctx.quadraticCurveTo(x + w * 0.15, baseY - h - 10, x + w, baseY);
    ctx.fill();
    if (cap) {
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.moveTo(x - 30, baseY - h + 32);
      ctx.quadraticCurveTo(x - 6, baseY - h - 6, x, baseY - h);
      ctx.quadraticCurveTo(x + 6, baseY - h - 6, x + 30, baseY - h + 32);
      ctx.lineTo(x + 12, baseY - h + 24);
      ctx.lineTo(x, baseY - h + 34);
      ctx.lineTo(x - 12, baseY - h + 24);
      ctx.fill();
    }
  }
  ctx.fillRect(0, baseY - 1, W, H - baseY);
}

// ───────────────────────────── 1. Sunny Hills ──

function sunnyHills(ctx: Ctx) {
  sky(ctx, ['#3fb4ff', '#8fd6ff', '#c4f0ff']);
  cloud(ctx, 200, 90, 1.3);
  cloud(ctx, 760, 70, 1.1);
  cloud(ctx, 1100, 130, 0.9);
  mountains(ctx, 380, '#a6c8f0', 3, 120, 200, '#f4f9ff');
  // checker hills
  const r = rng(9);
  for (let x = -40; x < W + 100; x += 170 + r() * 80) {
    const hw = 110 + r() * 70;
    const hy = 250 + r() * 70;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - hw, H);
    ctx.bezierCurveTo(x - hw, hy - 30, x + hw, hy - 30, x + hw, H);
    ctx.fillStyle = '#3fbf4a';
    ctx.fill();
    ctx.clip();
    for (let yy = hy + 20; yy < H; yy += 30)
      for (let xx = x - hw; xx < x + hw; xx += 30) if (Math.round((xx - x + hw) / 30 + (yy - hy) / 30) % 2) {
        ctx.fillStyle = '#2e9e3c';
        ctx.fillRect(xx, yy, 30, 15);
      }
    ctx.restore();
  }
  const paint = (x: number, y: number, top: boolean, edge: number) => {
    ctx.fillStyle = (Math.floor(x / 20) + Math.floor(y / 20)) % 2 ? '#b06a32' : '#d28a45';
    ctx.fillRect(x, y, T, T);
    if (edge) {
      ctx.fillStyle = '#7a4320';
      ctx.fillRect(edge < 0 ? x : x + T - 4, y, 4, T);
    }
    if (top) {
      ctx.fillStyle = '#2f9a2a';
      ctx.fillRect(x, y, T, 15);
      ctx.fillStyle = '#5fd23c';
      ctx.fillRect(x, y, T, 11);
      ctx.fillStyle = '#a8f06a';
      ctx.fillRect(x, y, T, 3);
    }
  };
  groundRun(ctx, 0, 520, GROUND_Y, paint);
  groundRun(ctx, 640, 1280, GROUND_Y, paint);
  groundRun(ctx, 880, 1000, GROUND_Y - 80, paint);
  // palm
  for (let i = 0; i < 9; i++) ellipse(ctx, 300 + Math.sin(i * 0.35) * 8, GROUND_Y - 6 - i * 16, 9, 8, i % 2 ? '#b0773f' : '#c98b4b');
  for (const a of [-2.7, -2.1, -1.4, -0.9, -0.35, 0.3]) {
    ctx.save();
    ctx.translate(300 + Math.sin(8 * 0.35) * 8, GROUND_Y - 134);
    ctx.rotate(a);
    ellipse(ctx, 26, 0, 30, 9, '#5fd23c');
    ctx.restore();
  }
  [440, 480, 520].forEach((x, i) => (i === 1 ? qBlock(ctx, x, 280) : brick(ctx, x, 280)));
  qBlock(ctx, 760, 200);
  coinArc(ctx, 535, 380, 4, 60);
  baddie(ctx, 780, GROUND_Y, '#d1495b', '#8e2a3a');
  baddie(ctx, 1150, GROUND_Y, '#3db06a', '#237a45', 'spiky');
  hero(ctx, 0, 140, GROUND_Y, 'walk1');
  hero(ctx, 1, 590, 320, 'jump');
  hero(ctx, 2, 940, GROUND_Y - 80, 'idle0');
  rocketShot(ctx, 975, GROUND_Y - 103, 1100);
  boom(ctx, 1130, GROUND_Y - 30, 44);
}

function brick(ctx: Ctx, x: number, y: number, a = '#e0703a', d = '#9b3d17') {
  ctx.fillStyle = OUT;
  ctx.fillRect(x, y, T, T);
  ctx.fillStyle = d;
  ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
  for (let r = 0; r < 4; r++) {
    const off = r % 2 ? 10 : 0;
    for (let bx = -20; bx < T; bx += 20) {
      const x0 = Math.max(1, bx + off + 1);
      const x1 = Math.min(T - 1, bx + off + 19);
      if (x1 > x0) {
        ctx.fillStyle = a;
        ctx.fillRect(x + x0, y + r * 10 + 1, x1 - x0, 8);
      }
    }
  }
}

// ───────────────────────────── 2. Dune Canyon ──

function duneCanyon(ctx: Ctx) {
  sky(ctx, ['#ff9e5e', '#ffc48a', '#ffe7b8']);
  ellipse(ctx, 980, 150, 90, 90, '#fff1c1');
  ellipse(ctx, 980, 150, 70, 70, '#fffaf0');
  // far mesas
  const mesa = (x: number, w: number, h: number, base: number, c: string, stripe: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + 18, base - h);
    ctx.lineTo(x + w - 18, base - h);
    ctx.lineTo(x + w, base);
    ctx.fill();
    ctx.fillStyle = stripe;
    for (let k = 1; k < 4; k++) ctx.fillRect(x + 10, base - h + k * (h / 4), w - 20, 6);
  };
  mesa(40, 260, 170, 400, '#e8a172', '#d98c5d');
  mesa(480, 200, 220, 400, '#e8a172', '#d98c5d');
  mesa(820, 300, 140, 400, '#e8a172', '#d98c5d');
  // rock arch
  ctx.fillStyle = '#c9714a';
  ctx.beginPath();
  ctx.moveTo(300, 420);
  ctx.lineTo(320, 260);
  ctx.quadraticCurveTo(420, 200, 520, 260);
  ctx.lineTo(540, 420);
  ctx.lineTo(500, 420);
  ctx.quadraticCurveTo(420, 270, 340, 420);
  ctx.fill();
  ctx.fillStyle = '#e9b48a';
  ctx.fillRect(0, 400, W, H);
  // dunes
  for (const [x, w] of [[100, 300], [600, 380], [1100, 300]]) ellipse(ctx, x, 420, w, 50, '#f2c48e');
  const paint = (x: number, y: number, top: boolean, edge: number) => {
    const band = Math.floor((y - GROUND_Y) / 20) % 3;
    ctx.fillStyle = ['#d9824e', '#c56b3c', '#e3955f'][band];
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#00000014';
    ctx.fillRect(x + ((x * 7) % 30), y + 12, 6, 3);
    if (edge) {
      ctx.fillStyle = '#8f4626';
      ctx.fillRect(edge < 0 ? x : x + T - 4, y, 4, T);
    }
    if (top) {
      ctx.fillStyle = '#f7d29a';
      ctx.fillRect(x, y, T, 12);
      ctx.fillStyle = '#e8b878';
      for (let k = 0; k < 2; k++) ctx.fillRect(x + 6 + k * 18, y + 5, 10, 2);
    }
  };
  groundRun(ctx, 0, 400, GROUND_Y, paint);
  // quicksand pit
  ctx.fillStyle = '#c99a5a';
  ctx.fillRect(400, GROUND_Y + 14, 200, H);
  for (let k = 0; k < 6; k++) ellipse(ctx, 430 + k * 30, GROUND_Y + 22 + (k % 2) * 6, 10, 3, '#b0844a');
  groundRun(ctx, 600, 1280, GROUND_Y, paint);
  groundRun(ctx, 1000, 1160, GROUND_Y - 80, paint);
  // cactus
  const cactus = (x: number, base: number, h: number) => {
    roundRect(ctx, x - 11, base - h, 22, h, 11, OUT);
    roundRect(ctx, x - 8, base - h + 3, 16, h - 3, 8, '#4caf50');
    roundRect(ctx, x - 30, base - h * 0.65, 14, h * 0.35, 7, OUT);
    roundRect(ctx, x - 28, base - h * 0.63, 10, h * 0.33, 5, '#4caf50');
    roundRect(ctx, x - 22, base - h * 0.4, 16, 10, 4, '#4caf50');
    ellipse(ctx, x, base - h - 2, 5, 5, '#ff6fa3');
  };
  cactus(180, GROUND_Y, 90);
  cactus(1220, GROUND_Y, 70);
  // sandstone blocks
  for (const x of [680, 720, 760]) qBlock(ctx, x, 280, '#ffb36b', '#b0602c', x === 720 ? '?' : '◆');
  coinArc(ctx, 440, 360, 5, 70);
  // tumbleweed
  ctx.strokeStyle = '#8f6a3a';
  ctx.lineWidth = 3;
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    ctx.arc(880, GROUND_Y - 22, 20 - k * 2, k, k + 4);
    ctx.stroke();
  }
  baddie(ctx, 1080, GROUND_Y - 80, '#c9a227', '#7a5c10', 'spiky');
  baddie(ctx, 960, 200, '#9b5de5', '#5d2e94', 'fly');
  hero(ctx, 1, 120, GROUND_Y, 'walk2');
  hero(ctx, 0, 520, 330, 'jump');
  hero(ctx, 2, 760, GROUND_Y, 'idle0');
  rocketShot(ctx, 790, GROUND_Y - 25, 870);
}

// ───────────────────────────── 3. Frosty Peaks ──

function frostyPeaks(ctx: Ctx) {
  sky(ctx, ['#1b2a5c', '#3d5aa8', '#9fc7f0']);
  // aurora
  for (const [c, y, a] of [['#5cffc888', 110, 0], ['#7a8cff66', 150, 1.5]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 26;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.006 + a) * 30);
    ctx.stroke();
  }
  const r = rng(4);
  for (let i = 0; i < 70; i++) ellipse(ctx, r() * W, r() * 200, 1.4, 1.4, '#ffffffcc');
  mountains(ctx, 380, '#a9bfe6', 12, 150, 240, '#ffffff');
  mountains(ctx, 420, '#d7e6fa', 22, 60, 120);
  // pines
  const pine = (x: number, base: number, s: number) => {
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(x - 5 * s, base - 16 * s, 10 * s, 16 * s);
    for (let k = 0; k < 3; k++) {
      const w = (44 - k * 10) * s;
      const y = base - 16 * s - k * 26 * s;
      ctx.fillStyle = '#1f6b52';
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x, y - 44 * s);
      ctx.lineTo(x + w, y);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.45, y - 26 * s);
      ctx.lineTo(x, y - 44 * s);
      ctx.lineTo(x + w * 0.45, y - 26 * s);
      ctx.fill();
    }
  };
  pine(90, GROUND_Y, 1.1);
  pine(1210, GROUND_Y, 1.3);
  const paint = (x: number, y: number, top: boolean, edge: number) => {
    ctx.fillStyle = '#7fb2e6';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#a9d0f5';
    ctx.fillRect(x + 3, y + 3, T - 10, T - 10);
    ctx.fillStyle = '#ffffff88';
    ctx.fillRect(x + 6, y + 6, 10, 3);
    ctx.fillStyle = '#5a8dc4';
    ctx.fillRect(x, y + T - 3, T, 3);
    if (edge) {
      ctx.fillStyle = '#4a77a8';
      ctx.fillRect(edge < 0 ? x : x + T - 3, y, 3, T);
    }
    if (top) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 4, T, 14);
      ellipse(ctx, x + 10, y + 10, 8, 5, '#ffffff');
      ellipse(ctx, x + 30, y + 9, 7, 4, '#ffffff');
      // icicles
      ctx.fillStyle = '#d6f0ff';
      if (edge) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 12);
        ctx.lineTo(x + 12, y + 28);
        ctx.lineTo(x + 16, y + 12);
        ctx.fill();
      }
    }
  };
  groundRun(ctx, 0, 440, GROUND_Y, paint);
  groundRun(ctx, 600, 1280, GROUND_Y, paint);
  groundRun(ctx, 720, 840, GROUND_Y - 120, paint);
  // ice slide floor shine
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(900, GROUND_Y + 2, 300, 3);
  // floating ice platforms
  for (const [x, y] of [[470, 340], [540, 290]]) {
    roundRect(ctx, x, y, 80, 18, 8, OUT);
    roundRect(ctx, x + 2, y + 2, 76, 14, 6, '#d6f0ff');
  }
  // crystals
  for (const [x, c] of [[1000, '#9be7ff'], [1030, '#c9a8ff']] as const) {
    ctx.fillStyle = OUT;
    ctx.beginPath();
    ctx.moveTo(x - 12, GROUND_Y);
    ctx.lineTo(x, GROUND_Y - 50);
    ctx.lineTo(x + 12, GROUND_Y);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 8, GROUND_Y - 2);
    ctx.lineTo(x, GROUND_Y - 44);
    ctx.lineTo(x + 8, GROUND_Y - 2);
    ctx.fill();
  }
  coinArc(ctx, 470, 270, 4, 50);
  baddie(ctx, 340, GROUND_Y, '#e9f2ff', '#8aa8d0');
  baddie(ctx, 1120, GROUND_Y, '#5ad1e8', '#2a7f99', 'spiky');
  hero(ctx, 2, 200, GROUND_Y, 'walk0');
  rocketShot(ctx, 236, GROUND_Y - 25, 300);
  boom(ctx, 330, GROUND_Y - 22, 38);
  hero(ctx, 1, 560, 290, 'idle1');
  hero(ctx, 0, 900, GROUND_Y, 'walk2');
}

// ───────────────────────────── 4. Cloud Kingdom ──

function cloudKingdom(ctx: Ctx) {
  sky(ctx, ['#7a6cf0', '#f29bd0', '#ffd6a8']);
  // distant castle
  ctx.fillStyle = '#c9b2f0';
  const cx = 1000;
  ctx.fillRect(cx - 70, 170, 140, 110);
  for (const tx of [cx - 80, cx + 50]) {
    ctx.fillRect(tx, 130, 30, 150);
    ctx.beginPath();
    ctx.moveTo(tx - 6, 130);
    ctx.lineTo(tx + 15, 90);
    ctx.lineTo(tx + 36, 130);
    ctx.fill();
  }
  ctx.fillRect(cx - 20, 110, 40, 70);
  ctx.beginPath();
  ctx.moveTo(cx - 26, 110);
  ctx.lineTo(cx, 60);
  ctx.lineTo(cx + 26, 110);
  ctx.fill();
  cloud(ctx, cx, 290, 3, '#fbe9ff', '#e6c9f5');
  // cloud sea
  for (let x = -40; x < W + 80; x += 90) cloud(ctx, x, 470 + Math.sin(x) * 10, 1.6, '#ffffff', '#f3d9f0');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 500, W, 60);
  // floating islands
  const island = (x: number, y: number, w: number) => {
    ctx.fillStyle = '#8a5a3b';
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x + w, y + 20);
    ctx.lineTo(x + w * 0.65, y + 90);
    ctx.lineTo(x + w * 0.5, y + 120);
    ctx.lineTo(x + w * 0.35, y + 90);
    ctx.fill();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * k) / 4, y + 30);
      ctx.quadraticCurveTo(x + (w * k) / 4 + 8, y + 70, x + (w * k) / 4 - 4, y + 100);
      ctx.stroke();
    }
    roundRect(ctx, x - 4, y - 2, w + 8, 26, 12, OUT);
    roundRect(ctx, x - 2, y, w + 4, 22, 10, '#7ee06a');
    ctx.fillStyle = '#b8f59a';
    ctx.fillRect(x + 6, y + 3, w - 12, 4);
  };
  island(40, 380, 300);
  island(720, 300, 240);
  island(1080, 400, 200);
  // cloud platforms (one crumbling)
  const cplat = (x: number, y: number, crumbling = false) => {
    cloud(ctx, x, y, 0.9, crumbling ? '#ffe4f3' : '#ffffff', '#e9c8ea');
    if (crumbling)
      for (let k = 0; k < 5; k++) ellipse(ctx, x - 30 + k * 16, y + 30 + (k % 2) * 10, 5, 5, '#ffe4f3');
  };
  cplat(450, 330);
  cplat(590, 270, true);
  // wind streaks
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 3;
  for (const [x, y] of [[420, 180], [520, 210], [380, 230]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 60, y - 14, x + 120, y);
    ctx.stroke();
  }
  qBlock(ctx, 820, 170);
  coinArc(ctx, 420, 240, 6, 60);
  baddie(ctx, 900, 300, '#ff8fb8', '#c24a7a', 'fly');
  baddie(ctx, 1150, 400, '#ffd166', '#b08a2c');
  hero(ctx, 0, 140, 380, 'idle0');
  hero(ctx, 2, 250, 380, 'walk1');
  hero(ctx, 1, 590, 210, 'jump');
}

// ───────────────────────────── 5. Magma Works ──

function magmaWorks(ctx: Ctx) {
  sky(ctx, ['#1a0f1f', '#4a1730', '#a8322a']);
  // volcano
  ctx.fillStyle = '#2e1a24';
  ctx.beginPath();
  ctx.moveTo(620, 420);
  ctx.lineTo(820, 140);
  ctx.lineTo(900, 140);
  ctx.lineTo(1120, 420);
  ctx.fill();
  const glow = ctx.createRadialGradient(860, 130, 5, 860, 130, 120);
  glow.addColorStop(0, '#ffd23fcc');
  glow.addColorStop(1, '#ff5a3c00');
  ctx.fillStyle = glow;
  ctx.fillRect(700, 0, 320, 260);
  for (const [x, y, rr] of [[850, 90, 8], [890, 60, 6], [830, 40, 5]] as const) ellipse(ctx, x, y, rr, rr, '#ff9a2e');
  // smokestacks
  for (const x of [120, 230]) {
    ctx.fillStyle = '#3a2a3a';
    ctx.fillRect(x, 200, 40, 220);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(x, 220, 40, 6);
    for (let k = 0; k < 4; k++) ellipse(ctx, x + 20 + k * 14, 180 - k * 30, 18 + k * 6, 14 + k * 5, '#5a4a5a88');
  }
  ctx.fillStyle = '#2a1520';
  ctx.fillRect(0, 410, W, H);
  // metal floor
  const paint = (x: number, y: number, top: boolean, edge: number) => {
    ctx.fillStyle = '#4a4f63';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#5d6379';
    ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    for (const [rx, ry] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]]) ellipse(ctx, x + rx, y + ry, 2, 2, '#2a2e3d');
    if (edge) {
      ctx.fillStyle = '#2a2e3d';
      ctx.fillRect(edge < 0 ? x : x + T - 4, y, 4, T);
    }
    if (top) {
      ctx.fillStyle = '#ffc533';
      ctx.fillRect(x, y, T, 8);
      ctx.fillStyle = OUT;
      for (let k = 0; k < T; k += 10) {
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + 5, y);
        ctx.lineTo(x + k, y + 8);
        ctx.fill();
      }
    }
  };
  groundRun(ctx, 0, 400, GROUND_Y, paint);
  groundRun(ctx, 680, 1280, GROUND_Y, paint);
  // lava pool
  const lava = ctx.createLinearGradient(0, GROUND_Y + 10, 0, H);
  lava.addColorStop(0, '#ffd23f');
  lava.addColorStop(0.3, '#ff7a2e');
  lava.addColorStop(1, '#c4231c');
  ctx.fillStyle = lava;
  ctx.fillRect(400, GROUND_Y + 16, 280, H);
  for (let k = 0; k < 6; k++) ellipse(ctx, 420 + k * 48, GROUND_Y + 18, 14, 6, '#ffe14d');
  // girder platforms + chains
  const girder = (x: number, y: number, w: number) => {
    ctx.strokeStyle = '#8a8fa3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, 0);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x + w - 10, 0);
    ctx.lineTo(x + w - 10, y);
    ctx.stroke();
    roundRect(ctx, x, y, w, 20, 3, OUT);
    ctx.fillStyle = '#d2603a';
    ctx.fillRect(x + 2, y + 2, w - 4, 16);
    ctx.strokeStyle = '#8f3a20';
    ctx.lineWidth = 2;
    for (let k = x + 4; k < x + w - 14; k += 16) {
      ctx.beginPath();
      ctx.moveTo(k, y + 18);
      ctx.lineTo(k + 8, y + 2);
      ctx.lineTo(k + 16, y + 18);
      ctx.stroke();
    }
  };
  girder(440, 340, 120);
  girder(580, 270, 100);
  // conveyor
  roundRect(ctx, 820, GROUND_Y - 60, 240, 24, 12, OUT);
  roundRect(ctx, 822, GROUND_Y - 58, 236, 20, 10, '#3a3f52');
  for (let k = 0; k < 7; k++) ellipse(ctx, 840 + k * 34, GROUND_Y - 48, 7, 7, '#8a8fa3');
  ctx.fillStyle = '#ffc533';
  ctx.font = '900 18px "Lilita One", sans-serif';
  ctx.fillText('»  »  »', 900, GROUND_Y - 72);
  coinArc(ctx, 450, 250, 5, 40);
  baddie(ctx, 1000, GROUND_Y - 60, '#ff5a3c', '#8e2a1a', 'spiky');
  baddie(ctx, 1180, GROUND_Y, '#8a8fa3', '#3a3f52');
  hero(ctx, 2, 140, GROUND_Y, 'idle1');
  hero(ctx, 0, 500, 340, 'walk3');
  hero(ctx, 1, 780, GROUND_Y, 'walk1');
  rocketShot(ctx, 812, GROUND_Y - 25, 940);
  boom(ctx, 975, GROUND_Y - 80, 48);
}

export interface WorldDef {
  id: string;
  name: string;
  mood: string;
  palette: string[];
  mechanics: string[];
  enemies: string;
  draw: (ctx: Ctx) => void;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'sunny-hills',
    name: 'Sunny Hills',
    mood: 'Bright opening world. Green checker hills, palm trees, floating ? blocks.',
    palette: ['#3fb4ff', '#5fd23c', '#d28a45', '#ffc533', '#e0703a'],
    mechanics: ['Brick walls you blast through', 'Pits crossed on wooden platforms', 'Cannon turrets on stone blocks'],
    enemies: 'Beetles, spiky beetles, hoppers, bugs',
    draw: sunnyHills,
  },
  {
    id: 'dune-canyon',
    name: 'Dune Canyon',
    mood: 'Late-afternoon desert. Striped sandstone, rock arches, a huge low sun.',
    palette: ['#ff9e5e', '#f7d29a', '#d9824e', '#4caf50', '#8f4626'],
    mechanics: ['Quicksand slows you and pulls you down', 'Tumbleweeds roll through', 'Gems hidden in sandstone blocks'],
    enemies: 'Scorpion shells, vultures, sand-burrowers',
    draw: duneCanyon,
  },
  {
    id: 'frosty-peaks',
    name: 'Frosty Peaks',
    mood: 'Snowy night under the northern lights. Ice bricks, pines, crystals.',
    palette: ['#1b2a5c', '#5cffc8', '#a9d0f5', '#ffffff', '#1f6b52'],
    mechanics: ['Slippery ice floors (harder to stop)', 'Icicles that drop when you pass', 'Rockets shatter frozen walls'],
    enemies: 'Snow blobs, ice-spike shells, penguin sliders',
    draw: frostyPeaks,
  },
  {
    id: 'cloud-kingdom',
    name: 'Cloud Kingdom',
    mood: 'Sunset sky with floating islands over a sea of clouds. A castle in the distance.',
    palette: ['#7a6cf0', '#f29bd0', '#ffd6a8', '#7ee06a', '#8a5a3b'],
    mechanics: ['Cloud platforms that crumble', 'Wind gusts push you mid-jump', 'Falling means a long drop'],
    enemies: 'Winged puffs, balloon bombers, birds',
    draw: cloudKingdom,
  },
  {
    id: 'magma-works',
    name: 'Magma Works',
    mood: 'Volcano factory at night. Girders on chains, hazard stripes, lava below.',
    palette: ['#1a0f1f', '#a8322a', '#ff7a2e', '#ffc533', '#5d6379'],
    mechanics: ['Conveyor belts', 'Lava that rises and falls', 'Swinging girder platforms'],
    enemies: 'Robot walkers, fire-spike shells, lava jumpers',
    draw: magmaWorks,
  },
];
