import { CHARACTERS } from '../wt-battle/src/data/characters';
import { drawCharacter } from '../wt-battle/src/gfx/draw';
import { STYLES, type Pt } from '../wt-battle/src/gfx/handdrawn';
import { PARK, drawBallparkBack, drawBallparkFront, drawBaseball, drawBaseballPlop, drawBat, drawLineDrive, parkSpots, type BaseballRole } from '../wt-battle/src/gfx/baseball';

const ST = STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';
type C = CanvasRenderingContext2D;
const at = (ctx: C, x: number, y: number, s: number, fn: () => void, flip = false) => { ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s); fn(); ctx.restore(); };
const label = (ctx: C, t: string, x: number, y: number, size = 20, color = '#3a2418') => { ctx.font = `${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); };
const sheet = (name: string, w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.dataset.sheet = name; document.body.appendChild(c); const ctx = c.getContext('2d')!; ctx.fillStyle = '#fbf3e4'; ctx.fillRect(0, 0, w, h); return ctx; };

// 1) the ballpark, players in position, you walking in from the left
{
  const FW = 1120; // field length
  const S = 1.0;
  const W = FW + PARK.END * 2;
  const ctx = sheet('park', W * S + 40, 560);
  ctx.save(); ctx.translate(20, 0); ctx.scale(S, S);
  const ground = 400;
  // smoggy sky
  const g = ctx.createLinearGradient(0, 0, 0, ground);
  g.addColorStop(0, '#e2c486'); g.addColorStop(1, '#c79a5e');
  ctx.fillStyle = g; ctx.fillRect(-20, 0, W + 40, ground);
  // a far canyon wall (we're at the bottom of the drop)
  ST.shape(ctx, [[-20, ground - 120], [140, ground - 220], [360, ground - 170], [600, ground - 240], [860, ground - 180], [1100, ground - 250], [W + 20, ground - 190], [W + 20, ground], [-20, ground]], { base: '#a8794a', shade: '#7a5230', light: '#c99a68' }, 9, { lw: 1 });
  ctx.translate(0, ground - PARK.BACK_UP);
  drawBallparkBack(ctx, FW, [3, 0]);
  ctx.translate(0, PARK.BACK_UP);
  // the ground (poo dirt)
  { const gg = ctx.createLinearGradient(0, 0, 0, 160); gg.addColorStop(0, '#9a6638'); gg.addColorStop(1, '#5e3a1e'); ctx.fillStyle = gg; ctx.fillRect(-20, 0, W + 40, 160); }
  ctx.translate(0, -PARK.FRONT_UP);
  drawBallparkFront(ctx, FW);
  ctx.translate(0, PARK.FRONT_UP);
  // the players, standing on the ground line (y = 0)
  const sp = parkSpots(FW);
  const plop = (x: number, role: BaseballRole, flip = false, k = 0.68) => at(ctx, flip ? x + 48 * k : x - 48 * k, -100 * k, k, () => drawBaseballPlop(ctx, role, 'medium', 7 + x), flip);
  plop(sp.mound.x, 'pitch-throw');
  plop(sp.home.x + 4, 'bat-swing', true);
  plop(sp.home.x + 52, 'catcher', true);
  plop(sp.second.x - 30, 'fielder');
  plop(PARK.END + 300, 'fielder');
  plop(PARK.END + 520, 'fielder-throw');
  // you, walking in from the left
  const hero = CHARACTERS[0];
  at(ctx, PARK.END + 90 - 28, -54, 1, () => drawCharacter(ctx, 0, 0, hero, 'walk2'));
  // the line drive, coming your way
  drawLineDrive(ctx, PARK.END + 220, -34, 5.5, -1);
  ctx.fillStyle = '#ff5a3c'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('CRACK!', sp.home.x - 40, -80);
  ctx.restore();
  label(ctx, 'Plop Park: the ballpark at the bottom of the first drop (you come in through the outfield)', ctx.canvas.width / 2, 540, 22, '#3a2418');
}
// 2) the players
{
  const roles: [BaseballRole, string, boolean][] = [
    ['pitch-windup', 'pitcher: wind-up', false], ['pitch-throw', 'pitcher: throw!', false], ['bat-stance', 'batter: stance', true], ['bat-swing', 'batter: CRACK!', true],
    ['catcher', 'catcher', true], ['fielder', 'fielder', false], ['fielder-throw', 'fielder: throws it in', false],
  ];
  const ctx = sheet('players', 1600, 380);
  label(ctx, 'The Plops playing baseball', 800, 40, 28);
  roles.forEach(([role, t, flip], i) => {
    const x = 120 + i * 225;
    const k = 1.9;
    at(ctx, flip ? x + 48 * k : x - 48 * k, 320 - 100 * k, k, () => drawBaseballPlop(ctx, role, 'medium', 30 + i), flip);
    label(ctx, t, x, 360, 18);
  });
}
// 3) the ball, the bat
{
  const ctx = sheet('gear', 900, 220);
  label(ctx, 'The ball, a line drive, the bat', 450, 36, 24);
  drawBaseball(ctx, 110, 120, 34, 0.3);
  drawLineDrive(ctx, 480, 120, 22, -1);
  at(ctx, 640, 130, 4, () => drawBat(ctx, 50, 5));
  void ([] as Pt[]);
}
