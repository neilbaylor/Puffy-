import type Phaser from 'phaser';

interface NetPoint {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  /** Where this knot sits when the net hangs still (it gently springs back here). */
  hx: number;
  hy: number;
  hz: number;
  pin: boolean;
}

const ROWS = 6;
const N = 18;

/**
 * The basketball net as a little physics simulation: a 3D mesh of cords
 * hanging from the rim (x right, y down, z toward the camera, all relative to
 * the rim centre). The ball pushes through it, a clank on the rim jiggles it,
 * and it sways back into shape. Drawn as two layers so the back strands sit
 * behind the ball and the front strands in front of it.
 */
export class NetSim {
  private pts: NetPoint[] = [];
  private links: [number, number, number][] = [];
  private drawLinks: [number, number, number][] = [];
  private tails: number[] = [];

  constructor(
    private readonly R: number,
    private readonly ry: number,
    depth = 46,
    /** Cord colours, alternating strand by strand (one colour = a plain white net). */
    private readonly colors: number[] = [0xfbfbf8],
  ) {
    const bottomR = R * 0.5;
    const idx = (k: number, i: number) => k * N + (((i % N) + N) % N);
    for (let k = 0; k <= ROWS; k++) {
      const t = k / ROWS;
      const r = R + (bottomR - R) * Math.pow(t, 0.8);
      for (let i = 0; i < N; i++) {
        const a = ((i + (k % 2) * 0.5) / N) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = depth * t;
        this.pts.push({ x, y, z, px: x, py: y, pz: z, hx: x, hy: y, hz: z, pin: k === 0 });
      }
    }
    const dist = (a: number, b: number) => {
      const p = this.pts[a];
      const q = this.pts[b];
      return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    };
    for (let k = 0; k < ROWS; k++)
      for (let i = 0; i < N; i++) {
        // the diamond weave
        for (const j of k % 2 ? [i, i + 1] : [i - 1, i]) {
          const a = idx(k, i);
          const b = idx(k + 1, j);
          this.links.push([a, b, dist(a, b)]);
          this.drawLinks.push([a, b, i]);
        }
        // hidden ring links keep each row round
        const a = idx(k + 1, i);
        const b = idx(k + 1, i + 1);
        this.links.push([a, b, dist(a, b)]);
      }
    for (let i = 0; i < N; i += 2) this.tails.push(idx(ROWS, i));
  }

  /** A clank: the top of the net jumps. */
  impulse(k = 1) {
    for (const p of this.pts) {
      if (p.pin) continue;
      const near = 1 - p.hy / 60;
      p.px -= (Math.random() - 0.5) * 3 * k * near;
      p.py += (1 + Math.random()) * 2.2 * k * near;
      p.pz -= (Math.random() - 0.5) * 3 * k * near;
    }
  }

  /** Advance the simulation. `ball` (relative to the rim centre) pushes the cords aside. */
  step(dt: number, ball: { x: number; y: number; r: number; vy: number } | null) {
    const steps = 2;
    const h = Math.min(dt, 1 / 30) / steps;
    for (let s = 0; s < steps; s++) {
      for (const p of this.pts) {
        if (p.pin) continue;
        const vx = (p.x - p.px) * 0.975;
        const vy = (p.y - p.py) * 0.975;
        const vz = (p.z - p.pz) * 0.975;
        p.px = p.x;
        p.py = p.y;
        p.pz = p.z;
        p.x += vx;
        p.y += vy + 260 * h * h;
        p.z += vz;
        // shape memory: a soft spring back to how the net hangs
        p.x += (p.hx - p.x) * 0.035;
        p.y += (p.hy - p.y) * 0.035;
        p.z += (p.hz - p.z) * 0.035;
      }
      for (let it = 0; it < 5; it++) {
        for (const [a, b, rest] of this.links) {
          const p = this.pts[a];
          const q = this.pts[b];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dz = q.z - p.z;
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          // cords pull tight but barely push back when squashed
          const diff = d > rest ? (d - rest) / d : ((d - rest) / d) * 0.15;
          const wp = p.pin ? 0 : q.pin ? 1 : 0.5;
          const wq = q.pin ? 0 : p.pin ? 1 : 0.5;
          p.x += dx * diff * wp;
          p.y += dy * diff * wp;
          p.z += dz * diff * wp;
          q.x -= dx * diff * wq;
          q.y -= dy * diff * wq;
          q.z -= dz * diff * wq;
        }
        if (ball) {
          const rr = ball.r + 1.2;
          for (const p of this.pts) {
            if (p.pin) continue;
            const dx = p.x - ball.x;
            const dy = p.y - ball.y;
            const dz = p.z;
            const d = Math.hypot(dx, dy, dz);
            if (d < rr && d > 1e-4) {
              const k = rr / d;
              p.x = ball.x + dx * k;
              p.y = ball.y + dy * k + Math.max(0, ball.vy) * h * 0.25; // the ball drags the cords down
              p.z = dz * k;
            }
          }
        }
      }
    }
  }

  /** Draw the back strands into `back` and the front strands into `front`, at rim centre (ox, oy). */
  draw(back: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics, ox: number, oy: number) {
    const sx = (p: NetPoint) => ox + p.x;
    const sy = (p: NetPoint) => oy + p.y + p.z * (this.ry / this.R);
    back.clear();
    front.clear();
    const fronts: [NetPoint, NetPoint, number, number][] = [];
    const shade = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
    for (const [a, b, i] of this.drawLinks) {
      const p = this.pts[a];
      const q = this.pts[b];
      const col = this.colors[Math.floor(i / 2) % this.colors.length];
      if (p.z + q.z < 0) {
        back.lineStyle(1.1, shade(col, 0.62), 0.7);
        back.lineBetween(sx(p), sy(p), sx(q), sy(q));
      } else fronts.push([p, q, (p.hy + q.hy) / 2, col]);
    }
    front.lineStyle(2.4, 0x3e3850, 0.4);
    for (const [p, q] of fronts) front.lineBetween(sx(p) + 0.5, sy(p) + 0.6, sx(q) + 0.5, sy(q) + 0.6);
    for (const [p, q, d, col] of fronts) {
      front.lineStyle(1.5, shade(col, 1 - (d / 50) * 0.14), 1);
      front.lineBetween(sx(p), sy(p), sx(q), sy(q));
    }
    for (const i of this.tails) {
      const p = this.pts[i];
      const g = p.z >= 0 ? front : back;
      g.lineStyle(1.2, 0xe8e5ee, p.z >= 0 ? 1 : 0.6);
      g.lineBetween(sx(p), sy(p), sx(p) + (p.x - p.px) * 2, sy(p) + 5);
    }
  }
}
