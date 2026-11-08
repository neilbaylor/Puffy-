import { CHARACTERS } from '../wt-battle/src/data/characters';
import { drawCharacter } from '../wt-battle/src/gfx/draw';
import { STYLES, type Pt } from '../wt-battle/src/gfx/handdrawn';
import { PLOP_COLOURS } from '../wt-battle/src/gfx/plops';
import { PARK, TEAM, drawBallparkBack, drawBallparkFront, drawBaseball, drawBaseballPlop, drawBat, drawLineDrive, parkSpots, type BaseballRole } from '../wt-battle/src/gfx/baseball';

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
  drawBallparkBack(ctx, FW, [3, 2]);
  ctx.translate(0, PARK.BACK_UP);
  // the ground (poo dirt)
  { const gg = ctx.createLinearGradient(0, 0, 0, 160); gg.addColorStop(0, '#9a6638'); gg.addColorStop(1, '#5e3a1e'); ctx.fillStyle = gg; ctx.fillRect(-20, 0, W + 40, 160); }
  ctx.translate(0, -PARK.FRONT_UP);
  drawBallparkFront(ctx, FW);
  ctx.translate(0, PARK.FRONT_UP);
  // the players, standing on the ground line (y = 0)
  const sp = parkSpots(FW);
  let ci = 0;
  // (small Plops at 0.68 the size of the medium ones, like in the levels)
  const plop = (x: number, role: BaseballRole, flip = false, kind: 'small' | 'medium' = 'small') => { const k = 0.8 * (kind === 'small' ? 0.68 : 1); const body = PLOP_COLOURS[ci++ % PLOP_COLOURS.length]; at(ctx, flip ? x + 48 * k : x - 48 * k, -100 * k, k, () => drawBaseballPlop(ctx, role, kind, 7 + x, body), flip); };
  plop(sp.mound.x, 'pitch-throw');
  plop(sp.home.x + 4, 'bat-swing', true, 'medium');
  plop(sp.home.x + 60, 'catcher', true);
  plop(sp.second.x - 30, 'fielder');
  plop(PARK.END + 300, 'fielder', false, 'medium');
  plop(PARK.END + 520, 'fielder-throw');
  plop(sp.first.x - 95, 'runner', true);
  plop(sp.home.x + 100, 'on-deck', true);
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
  const sox: [BaseballRole, string, boolean][] = [['pitch-windup', 'pitcher: wind-up', false], ['pitch-throw', 'pitcher: throw!', false], ['catcher', 'catcher', true], ['fielder', 'fielder', false], ['fielder-throw', 'fielder: throws it in', false]];
  const swat: [BaseballRole, string, boolean][] = [['bat-stance', 'batter: stance', true], ['bat-swing', 'batter: CRACK!', true], ['on-deck', 'on deck', true], ['runner', 'runner', false]];
  const ctx = sheet('players', 1240, 760);
  label(ctx, 'Plops vs Poos: two teams, every player its own colour, small and medium', 620, 40, 26);
  let ci = 0;
  ([[TEAM.plops.name + ' (blue caps): fielding', sox, 330], [TEAM.poos.name + ' (red caps): batting', swat, 690]] as const).forEach(([title, list, base]) => {
    label(ctx, title, 620, base - 236, 22, '#5a3a22');
    list.forEach(([role, t, flip], i) => {
      const x = 130 + i * 245;
      const kind = role === 'bat-swing' || role === 'bat-stance' || role === 'fielder' ? 'medium' : 'small';
      const k = 1.7 * (kind === 'small' ? 0.68 : 1);
      const body = PLOP_COLOURS[ci++ % PLOP_COLOURS.length];
      at(ctx, flip ? x + 48 * k : x - 48 * k, base - 100 * k, k, () => drawBaseballPlop(ctx, role, kind, 30 + i, body), flip);
      label(ctx, t + (role === 'bat-swing' || role === 'bat-stance' || role === 'fielder' ? ' (medium)' : ''), x, base + 30, 17);
    });
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
