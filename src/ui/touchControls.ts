import { touchState } from '../input/touch';

/**
 * On-screen controls for phones and tablets.
 *
 *   Left thumb:  a stick that appears where you touch (bottom-left area).
 *                It stays put — it never slides after your thumb. Most of the
 *                circle walks; only the outer ring runs (you feel a buzz).
 *   Right thumb: JUMP (big) and FIRE. Near-misses still count: a tap lands on
 *                whichever button is closest.
 *
 * Sizes scale with the screen so they suit both phones and tablets.
 */
// Fractions of the stick radius. Walking covers a wide band (0.14 → 0.86);
// you only run when you push the knob out into the outer ring.
const WALK_AT = 0.14;
const RUN_AT = 0.86;

export class TouchControls {
  readonly root: HTMLDivElement;
  private zone: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private fireBtn: HTMLDivElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private radius = 56;
  private buttonPointers = new Map<number, { x: number; y: number }>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML = `
      <div class="touch-left">
        <div class="stick-ghost" aria-hidden="true"><span>move</span></div>
        <div class="stick-base"><div class="stick-run-ring"></div><div class="stick-knob"></div></div>
      </div>
      <div class="touch-right">
        <div class="tbtn tbtn-fire" aria-label="Fire"><span>FIRE</span></div>
        <div class="tbtn tbtn-jump" aria-label="Jump"><span>JUMP</span></div>
      </div>`;
    parent.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.zone = q('.touch-left');
    this.base = q('.stick-base');
    this.knob = q('.stick-knob');
    this.jumpBtn = q('.tbtn-jump');
    this.fireBtn = q('.tbtn-fire');

    const zone = this.zone;
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      zone.setPointerCapture(e.pointerId);
      this.stickId = e.pointerId;
      this.radius = this.base.getBoundingClientRect().width / 2 || 56;
      // keep the whole stick on screen
      const r = zone.getBoundingClientRect();
      const R = this.radius;
      this.origin = {
        x: Math.min(Math.max(e.clientX, r.left + R + 6), r.right - R - 6),
        y: Math.min(Math.max(e.clientY, r.top + R + 6), r.bottom - R - 6),
      };
      this.base.style.left = `${this.origin.x - r.left}px`;
      this.base.style.top = `${this.origin.y - r.top}px`;
      this.root.classList.add('stick-active');
      this.moveStick(e.clientX, e.clientY);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      touchState.left = touchState.right = touchState.run = false;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.root.classList.remove('stick-active', 'running');
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    const right = q<HTMLDivElement>('.touch-right');
    right.addEventListener('pointerdown', (e) => {
      right.setPointerCapture(e.pointerId);
      this.buttonPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.updateButtons(true);
      e.preventDefault();
    });
    right.addEventListener('pointermove', (e) => {
      if (!this.buttonPointers.has(e.pointerId)) return;
      this.buttonPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.updateButtons(false);
    });
    const endBtn = (e: PointerEvent) => {
      this.buttonPointers.delete(e.pointerId);
      this.updateButtons(false);
    };
    right.addEventListener('pointerup', endBtn);
    right.addEventListener('pointercancel', endBtn);

    // never let the page scroll/zoom from game touches
    this.root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.hide();
  }

  private moveStick(x: number, y: number) {
    const R = this.radius;
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    // the knob is clamped to the ring; the base itself never moves
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, R / len);
    this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    const fx = dx / R; // horizontal push as a fraction of the radius (can exceed 1)
    touchState.left = fx < -WALK_AT;
    touchState.right = fx > WALK_AT;
    const run = Math.abs(fx) >= RUN_AT;
    if (run && !touchState.run) navigator.vibrate?.(12);
    touchState.run = run;
    this.root.classList.toggle('running', run);
  }

  private updateButtons(pressed: boolean) {
    const centre = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    };
    const j = centre(this.jumpBtn);
    const f = centre(this.fireBtn);
    let jump = false;
    let fire = false;
    for (const p of this.buttonPointers.values()) {
      const dj = Math.hypot(p.x - j.x, p.y - j.y) / j.r;
      const df = Math.hypot(p.x - f.x, p.y - f.y) / f.r;
      if (Math.min(dj, df) > 2.1) continue; // generous: near-misses still press the closest button
      if (dj <= df) jump = true;
      else fire = true;
    }
    if (pressed && ((jump && !touchState.jump) || (fire && !touchState.fire))) navigator.vibrate?.(8);
    touchState.jump = jump;
    touchState.fire = fire;
    this.jumpBtn.classList.toggle('down', jump);
    this.fireBtn.classList.toggle('down', fire);
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
    this.reset();
  }

  reset() {
    this.stickId = null;
    this.buttonPointers.clear();
    touchState.left = touchState.right = touchState.run = touchState.jump = touchState.fire = false;
    this.root.classList.remove('stick-active', 'running');
    this.jumpBtn.classList.remove('down');
    this.fireBtn.classList.remove('down');
  }
}
