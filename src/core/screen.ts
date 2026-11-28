/**
 * A phone-sized screen (its short side under 700 CSS px: the same line main.ts draws between phones
 * and big tablets). Some drawing savings only paid off measurably there, in full mode (perf round G12:
 * the terrain chunks in pieces and the background cut behind what's solid in front — on tablets and in
 * light mode they measured no better), so they're only used there.
 */
export const phoneScreen = () => Math.min(window.innerWidth, window.innerHeight) < 700;
