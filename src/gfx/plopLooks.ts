/**
 * Plop Invasion's palettes: the ground ('poo') and the three looks the level
 * drifts through (registered by id so the theme system can find them).
 */
import { POO } from './plopworld';
import { PALETTES, type WorldPalette } from './world';

/** The ground of Plop Invasion (terrain, trees, clouds, props): one palette for the whole level. */
PALETTES.poo = {
  id: 'poo',
  name: 'Plop Invasion',
  blurb: 'Puff Ball Planet, taken over by the Plops: everything covered in poo.',
  sky: ['#c9b98a', '#e2d4a8', '#f3e7c8'],
  sun: '#fff1c0',
  far: { base: '#c4ab8c', shade: '#a88e70', light: '#e2cfb4' },
  farInk: '#8a7058',
  cloud: { base: '#efe3cf', shade: '#cdb79c', light: '#fff8ec' },
  hill: { base: '#a8724a', shade: '#7e4e2e', light: '#d4a07a' },
  hill2: { base: '#c49a74', shade: '#a27a56', light: '#e6c4a2' },
  near: { base: '#7e4a2c', shade: '#5a3019', light: '#b07a52' },
  // the marshmallow earth underneath, a bit grubby now
  soilTop: '#d9a98a',
  soilDeep: '#9a6a5a',
  strata: '#7a4c3e',
  grass: POO,
  rock: { base: '#ab9c90', shade: '#7f7066', light: '#dcd0c6' },
  // the puff trees are still pastel underneath their poo caps (muted)
  canopies: [
    { base: '#e8bf72', shade: '#bd8f42', light: '#f8e2ae' },
    { base: '#dfa8ae', shade: '#b5767e', light: '#f3d6da' },
    { base: '#adc99e', shade: '#7e9c70', light: '#d8eccc' },
  ],
  trunk: { base: '#9a6a4a', shade: '#6e4430', light: '#c8987a' },
  bramble: { base: '#5c3a4a', shade: '#3e2232', light: '#8a6070' },
  flowers: [], // (poo piles instead: LevelView)
  poo: true,
};

/** The looks Plop Invasion drifts through (like Part 1's four): murky noon, smoggy dusk, stinky haze. */
const look = (id: string, name: string, blurb: string, o: Partial<WorldPalette>): WorldPalette => ({ ...PALETTES.poo, id, name, blurb, ...o, poo: true });

PALETTES['p-muck'] = look('p-muck', 'Muck noon', 'A hazy yellow-brown sky over soft-serve poo mountains.', {});
PALETTES['p-dusk'] = look('p-dusk', 'Smoggy dusk', 'A purple-orange evening through the stink.', {
  sky: ['#6e5486', '#d6896a', '#f6c89a'],
  sun: '#ffd8a8',
  far: { base: '#a98aa0', shade: '#8a6c84', light: '#cdb2c4' },
  farInk: '#6c5068',
  cloud: { base: '#f0cfb8', shade: '#c99e8e', light: '#fff0e4' },
  hill: { base: '#93603e', shade: '#6a3e24', light: '#c08a62' },
  hill2: { base: '#b08070', shade: '#8e6052', light: '#d8ac9c' },
  near: { base: '#6e3e26', shade: '#4c2614', light: '#9e6a48' },
});
PALETTES['p-stink'] = look('p-stink', 'Stinky haze', 'A greenish haze hangs over everything. Pee-yew.', {
  sky: ['#93a874', '#c4cc94', '#ebe6c0'],
  sun: '#f6f4c8',
  far: { base: '#a8ad86', shade: '#8a906a', light: '#cfd2ae' },
  farInk: '#6e7452',
  cloud: { base: '#e6e6c8', shade: '#c0c29c', light: '#fbfbe8' },
  hill: { base: '#8e6a3e', shade: '#664824', light: '#bc9666' },
  hill2: { base: '#a89a6c', shade: '#867a50', light: '#d0c49a' },
  near: { base: '#6a4e2a', shade: '#463216', light: '#9a7c50' },
});

