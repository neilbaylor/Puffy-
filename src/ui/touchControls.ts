import { touchState } from '../input/touch';

/**
 * On-screen controls for phones (first draft — we'll tune this together):
 *   Left thumb:  floating stick. Drag a little = walk, drag far = run.
 *   Right thumb: JUMP (big) and FIRE buttons. You can slide between them.
 */
const DEAD_ZONE = 10;
const RUN_AT = 44;
const MAX_TRAVEL = 58;

export class TouchControls {
  readonly root: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private fireBtn: HTMLDivElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private buttonPointers = new Map<number, { x: number; y: number }>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML = `
      <div class="touch-left">
        <div class="stick-hint">drag to move<br><b>far</b> to run</div>
        <div class="stick-base"><div class="stick-run">RUN</div><div class="stick-knob"></div></div>
      </div>
      <div class="touch-right">
        <div class="tbtn tbtn-fire"><span>FIRE</span></div>
        <div class="tbtn tbtn-jump"><span>JUMP</span></div>
      </div>`;
    parent.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.stickBase = q('.stick-base');
    this.stickKnob = q('.stick-knob');
    this.jumpBtn = q('.tbtn-jump');
    this.fireBtn = q('.tbtn-fire');

    const left = q<HTMLDivElement>('.touch-left');
    left.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      left.setPointerCapture(e.pointerId);
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      const r = left.getBoundingClientRect();
      this.stickBase.style.left = `${e.clientX - r.left}px`;
      this.stickBase.style.top = `${e.clientY - r.top}px`;
      this.root.classList.add('stick-active');
      this.moveStick(e.clientX, e.clientY);
      e.preventDefault();
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      touchState.left = touchState.right = touchState.run = false;
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
      this.root.classList.remove('stick-active', 'running');
    };
    left.addEventListener('pointerup', endStick);
    left.addEventListener('pointercancel', endStick);

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
    let dx = x - this.stickOrigin.x;
    const dy = y - this.stickOrigin.y;
    // let the stick "follow" the thumb if it drags way past the edge
    if (Math.abs(dx) > MAX_TRAVEL + 30) {
      this.stickOrigin.x += dx - Math.sign(dx) * (MAX_TRAVEL + 30);
      dx = x - this.stickOrigin.x;
      const r = this.stickBase.parentElement!.getBoundingClientRect();
      this.stickBase.style.left = `${this.stickOrigin.x - r.left}px`;
    }
    const kx = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, dx));
    const ky = Math.max(-MAX_TRAVEL * 0.4, Math.min(MAX_TRAVEL * 0.4, dy * 0.4));
    this.stickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    touchState.left = dx < -DEAD_ZONE;
    touchState.right = dx > DEAD_ZONE;
    touchState.run = Math.abs(dx) >= RUN_AT;
    this.root.classList.toggle('running', touchState.run);
  }

  private updateButtons(pressed: boolean) {
    const hit = (el: HTMLElement, p: { x: number; y: number }) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return Math.hypot(p.x - cx, p.y - cy) < r.width * 0.68;
    };
    let jump = false;
    let fire = false;
    for (const p of this.buttonPointers.values()) {
      const j = hit(this.jumpBtn, p);
      const f = hit(this.fireBtn, p);
      if (j && f) {
        // between both: pick the closer one
        const dj = dist(this.jumpBtn, p);
        const df = dist(this.fireBtn, p);
        if (dj < df) jump = true;
        else fire = true;
      } else {
        jump ||= j;
        fire ||= f;
      }
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

function dist(el: HTMLElement, p: { x: number; y: number }) {
  const r = el.getBoundingClientRect();
  return Math.hypot(p.x - (r.left + r.width / 2), p.y - (r.top + r.height / 2));
}
