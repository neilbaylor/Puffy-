// A stand-in for Phaser under node: just enough for the game's modules to load (nothing is drawn).
// Any class or namespace not listed is made up on first use (an empty class, or a namespace of them).
const ns = (base: Record<string, any> = {}): any => new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z]/.test(k) ? (t[k] = new Proxy(class {}, { get: (c: any, j) => (j in c ? c[j] : (c[j] = ns())) })) : undefined) });
const P: any = ns({
  Math: { Clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), Between: (a: number, b: number) => a, RadToDeg: (r: number) => (r * 180) / Math.PI, Easing: ns() },
  Physics: ns({ Arcade: ns({ Sprite: class {}, Image: class {} }) }),
  GameObjects: ns({ Image: class {}, Sprite: class {} }),
  Scenes: { Events: { UPDATE: 'update', SHUTDOWN: 'shutdown', PRE_RENDER: 'prerender', POST_UPDATE: 'postupdate', PRE_UPDATE: 'preupdate' } },
  Scene: class {},
  BlendModes: {},
});
export default P;
