// Device A beats the last level (5) and syncs; device B signs in fresh and restores.
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) };
(globalThis as any).sessionStorage = (globalThis as any).localStorage;
(globalThis as any).window = globalThis as any;
(globalThis as any).addEventListener = () => {};
(globalThis as any).location = { search: '' };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
let serverUser: any = { name: 'amy', rootbeer: 0, nuggies: 0, kills: 0, level: 1, spent: 0, items: '', wear: '' };
(globalThis as any).fetch = async (path: string, init: any) => {
  const body = init.body ? JSON.parse(init.body) : {};
  if (path === '/api/progress') serverUser = { ...serverUser, ...body };
  return { ok: true, status: 200, json: async () => ({ token: 'tok_aaaaaaaaaaaaaaaaaaaaaaaa', user: serverUser }) };
};
const { progress } = await import('/workspace/Puffy-/src/level/levels');
const { account } = await import('/workspace/Puffy-/src/core/account');
// device A: has beaten every built level (Part 5, the last one)
progress.markBeaten(5);
await account.signIn('amy', 'secret', false);
console.log('device A beaten =', progress.beaten, '| level stored on server =', serverUser.level);
// device B: fresh storage, signs in with the same account
store.clear();
await account.signIn('amy', 'secret', false);
console.log('device B beaten after sign-in =', progress.beaten, '(expected 5)');
