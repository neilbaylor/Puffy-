import Phaser from 'phaser';

/**
 * Real-feeling confetti. Every piece is a little bit of paper with its own
 * physics: it's thrown out fast, air drag slows it hard, gravity pulls it to
 * a gentle terminal fall, and it flutters side to side while flipping over
 * in 3D (the back face is a shade darker). Mixed in: curly streamers that
 * twist as they fall, round sequins and glinting glitter.
 */

type Kind = 'paper' | 'sequin' | 'streamer' | 'glitter';

interface Piece {
  img: Phaser.GameObjects.Image;
  kind: Kind;
  vx: number;
  vy: number;
  drag: number;
  g: number;
  flip: number; // flip speed (rad/s)
  flipPh: number;
  rotV: number; // spin (deg/s)
  flutter: number;
  flutterW: number;
  ph: number;
  front: number;
  back: number;
  sx: number;
  sy: number;
  life: number;
  age: number;
  /** Where it comes to rest (on a floor seen in perspective), if any. */
  landY: number;
  landed: boolean;
}

const COLORS = [0xffd23f, 0xff5a6e, 0x2fd0c0, 0x7a5cff, 0xff8fb3, 0x4db5ff, 0x8fe36a, 0xffffff, 0xff9a3c];

const shade = (c: number, k: number) => {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

/** Make the little white textures the pieces are tinted from (once per game). */
export function makeConfettiTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('cf-paper')) return;
  const mk = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    scene.textures.addImage(key, c as unknown as HTMLImageElement);
  };
  mk('cf-paper', 12, 18, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(1, 1, 10, 16, 2);
    ctx.fill();
  });
  mk('cf-sequin', 14, 14, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, 7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(7, 7, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  mk('cf-streamer', 12, 54, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 3; y <= 51; y += 1) ctx.lineTo(6 + Math.sin(y * 0.32) * 3.6, y);
    ctx.stroke();
  });
  mk('cf-glitter', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(7.3, 0, 1.4, 16);
    ctx.fillRect(0, 7.3, 16, 1.4);
  });
}

export interface BurstOpts {
  /** Throw speed (px/s) for the fastest pieces. */
  power?: number;
  /** Centre direction (radians, 0 = right, -PI/2 = up) and spread either side. */
  angle?: number;
  spread?: number;
  /** Extra upward kick for everything. */
  lift?: number;
  /** Mix: share of streamers / sequins / glitter (the rest is paper). */
  streamers?: number;
  sequins?: number;
  glitter?: number;
  colors?: number[];
  /** Size multiplier. */
  scale?: number;
}

export class Confetti {
  private pieces: Piece[] = [];
  /** Slow-motion factor (1 = normal). */
  timeScale = 1;
  private readonly max = 3600;

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
    /** Bottom of the world (pieces below it are recycled). */
    private floorY: () => number,
    /** Optional floor band [near-horizon y, front y]: pieces settle somewhere on it. */
    private floorBand?: [number, number],
  ) {
    makeConfettiTextures(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
      this.pieces = [];
    });
  }

  get count() {
    return this.pieces.length;
  }

  private spawn(x: number, y: number, vx: number, vy: number, o: BurstOpts) {
    if (this.pieces.length >= this.max) {
      const old = this.pieces.shift()!;
      old.img.destroy();
    }
    const r = Math.random();
    const sh = o.streamers ?? 0.08;
    const sq = o.sequins ?? 0.12;
    const gl = o.glitter ?? 0.08;
    const kind: Kind = r < sh ? 'streamer' : r < sh + sq ? 'sequin' : r < sh + sq + gl ? 'glitter' : 'paper';
    const cols = o.colors ?? COLORS;
    const col = cols[Math.floor(Math.random() * cols.length)];
    const k = (o.scale ?? 1) * (0.75 + Math.random() * 0.5);
    const img = this.scene.add.image(x, y, `cf-${kind}`).setDepth(this.depth).setAngle(Math.random() * 360);
    const sx = (kind === 'streamer' ? 0.55 : kind === 'glitter' ? 0.9 : 0.62) * k;
    const sy = sx;
    img.setScale(sx, sy).setTint(col);
    if (kind === 'glitter') img.setBlendMode(Phaser.BlendModes.ADD);
    this.pieces.push({
      img,
      kind,
      vx,
      vy,
      // paper catches the air; sequins and glitter fall a little faster
      drag: kind === 'paper' ? 2.6 + Math.random() * 1.6 : kind === 'streamer' ? 2.2 + Math.random() : 1.6 + Math.random(),
      g: kind === 'streamer' ? 520 : 640 + Math.random() * 160,
      flip: (kind === 'sequin' ? 6 : 8) + Math.random() * 10,
      flipPh: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * (kind === 'streamer' ? 260 : 540),
      flutter: (kind === 'paper' ? 50 : kind === 'streamer' ? 34 : 18) * (0.5 + Math.random()),
      flutterW: 3 + Math.random() * 4,
      ph: Math.random() * Math.PI * 2,
      front: col,
      back: shade(col, 0.62),
      sx,
      sy,
      life: 7 + Math.random() * 4,
      age: 0,
      landY: this.floorBand ? this.floorBand[0] + Math.pow(Math.random(), 0.8) * (this.floorBand[1] - this.floorBand[0]) : Infinity,
      landed: false,
    });
  }

  /**
   * An explosion of confetti from (x, y). The blast is split into a few
   * random jets (each with its own direction and strength) plus a general
   * spray, and speeds are very uneven — so no two explosions look alike.
   */
  burst(x: number, y: number, n: number, o: BurstOpts = {}) {
    const power = o.power ?? 900;
    const angle = o.angle ?? -Math.PI / 2;
    const spread = o.spread ?? Math.PI;
    const jets = Array.from({ length: 2 + Math.floor(Math.random() * 5) }, () => ({
      a: angle + (Math.random() * 2 - 1) * spread,
      k: 0.7 + Math.random() * 0.7,
      w: 0.12 + Math.random() * 0.3,
    }));
    for (let i = 0; i < n; i++) {
      let a: number;
      let pk = 1;
      if (Math.random() < 0.55) {
        // part of a jet
        const j = jets[Math.floor(Math.random() * jets.length)];
        a = j.a + (Math.random() * 2 - 1) * j.w;
        pk = j.k;
      } else a = angle + (Math.random() * 2 - 1) * spread;
      // most pieces slow, a few REALLY fast: feels like a real blast
      const r = Math.random();
      const sp = power * pk * (0.12 + 0.88 * Math.pow(r, 0.55)) * (r > 0.97 ? 1.5 : 1);
      this.spawn(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18, Math.cos(a) * sp, Math.sin(a) * sp - (o.lift ?? 0), o);
    }
  }

  /** A pop of confetti in mid-air somewhere: a flash and a random-coloured burst. */
  pop(x: number, y: number, n: number, power = 900) {
    const palettes = [
      [0xffd23f, 0xffffff, 0xff5a6e],
      [0x2fd0c0, 0xffffff, 0x4db5ff],
      [0xff8fb3, 0xffd23f, 0x7a5cff],
      [0x8fe36a, 0xffffff, 0xffd23f],
      COLORS,
    ];
    const flash = this.scene.add.image(x, y, 'cf-glitter').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 0.1).setScale(1);
    this.scene.tweens.add({ targets: flash, scale: 9, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    this.burst(x, y, n, { power: power * (0.75 + Math.random() * 0.5), spread: Math.PI, glitter: 0.2, streamers: 0.1, colors: palettes[Math.floor(Math.random() * palettes.length)] });
  }

  /** A fountain: keeps spraying confetti up from (x, y) for a while. */
  fountain(x: number, y: number, perSecond: number, ms: number, o: BurstOpts = {}) {
    return this.scene.time.addEvent({
      delay: 40,
      repeat: Math.floor(ms / 40),
      callback: () => this.burst(x, y, Math.round((perSecond / 25) * (0.6 + Math.random() * 0.8)), { power: 1500, spread: 0.55, angle: -Math.PI / 2, streamers: 0.16, ...o }),
    });
  }

  /** A confetti cannon: a tight cone fired from (x, y). */
  cannon(x: number, y: number, angle: number, n: number, o: BurstOpts = {}) {
    this.burst(x, y, n, { power: 1500, spread: 0.22, streamers: 0.14, ...o, angle });
  }

  /** Confetti drifting down from above the view for a while. */
  rain(view: Phaser.Geom.Rectangle, perSecond: number, ms: number, o: BurstOpts = {}) {
    const ev = this.scene.time.addEvent({
      delay: 50,
      repeat: Math.floor(ms / 50),
      callback: () => {
        const n = Math.round((perSecond / 20) * (0.5 + Math.random()));
        for (let i = 0; i < n; i++) this.spawn(view.x + Math.random() * view.width, view.y - 20 - Math.random() * 40, (Math.random() - 0.5) * 60, 40 + Math.random() * 60, o);
      },
    });
    return ev;
  }

  private update(_t: number, deltaMs: number) {
    if (!this.pieces.length) return;
    const dt = Math.min(deltaMs / 1000, 1 / 20) * this.timeScale;
    const floor = this.floorY();
    this.pieces = this.pieces.filter((p) => {
      p.age += dt;
      if (p.landed) {
        const fade = p.life - p.age;
        if (fade < 1) p.img.setAlpha(Math.max(0, fade));
        if (fade <= 0) {
          p.img.destroy();
          return false;
        }
        return true;
      }
      if (p.vy > 0 && p.img.y >= p.landY && p.age > 0.25) {
        // comes to rest lying flat on the floor
        p.landed = true;
        p.life = p.age + 3 + Math.random() * 3;
        p.img.setScale(p.sx, p.sy * 0.45).setAlpha(p.kind === 'glitter' ? 0.6 : 1).setTint(Math.random() < 0.5 ? p.front : p.back);
        p.img.setDepth(this.depth - 0.5);
        return true;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      // side-to-side flutter grows as the piece slows down
      const slow = 1 - Math.min(1, Math.hypot(p.vx, p.vy) / 500);
      const fl = Math.sin(p.age * p.flutterW + p.ph) * p.flutter * (0.3 + 0.7 * slow);
      const img = p.img;
      img.x += (p.vx + fl) * dt;
      img.y += p.vy * dt;
      img.angle += p.rotV * dt * (0.4 + 0.6 * slow) + fl * 0.02;
      if (p.kind === 'glitter') {
        img.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(p.age * 9 + p.ph)));
      } else {
        // flipping over in 3D: squash one axis through zero, darker on the back
        const c = Math.cos(p.age * p.flip + p.flipPh);
        img.setScale(p.sx * (p.kind === 'streamer' ? 1 : Math.max(0.08, Math.abs(c))), p.sy);
        img.setTint(c >= 0 ? p.front : p.back);
      }
      const fade = p.life - p.age;
      if (fade < 1) img.setAlpha(Math.max(0, fade));
      if (fade <= 0 || img.y > floor + 40) {
        img.destroy();
        return false;
      }
      return true;
    });
  }
}
