import { createServer } from 'node:http';
// One account, two devices. The tablet signed in this morning (it got rootbeer 30, level 3 from the
// account). Since then the phone found more root beer and beat Part 3, and saved: rootbeer 100, level 4.
// Now the tablet finishes a level and saves what it has (rootbeer 35, level 3). What does the account keep?
// (A third device signing in after that gets whatever the account has.)
process.env.DB_PATH = '/tmp/hunt/progress-test.db';
const { createUserApi } = await import('/workspace/Puffy-/server/users');
const api = await createUserApi();
const srv = createServer(async (req, res) => { if (!(await api(req, res))) res.writeHead(404).end(); });
await new Promise<void>((r) => srv.listen(18960, r));
const call = (method: string, path: string, body?: unknown, token?: string) =>
  fetch('http://127.0.0.1:18960' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': String(Math.random()), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const { token } = await call('POST', '/api/register', { name: 'amy' + Date.now() % 100000, password: 'pass1' });
await call('PUT', '/api/progress', { rootbeer: 30, nuggies: 5, kills: 10, level: 3, spent: 0 }, token);
await call('PUT', '/api/progress', { rootbeer: 100, nuggies: 50, kills: 80, level: 4, spent: 20, items: 'party' }, token); // the phone
await call('PUT', '/api/progress', { rootbeer: 35, nuggies: 9, kills: 15, level: 3, spent: 0 }, token); // the tablet, later
const { user } = await call('GET', '/api/me', undefined, token);
console.log('account after both saves:', JSON.stringify({ rootbeer: user.rootbeer, nuggies: user.nuggies, kills: user.kills, level: user.level, spent: user.spent, items: user.items }));
console.log('(expected the bigger of each, as the counters only go up: rootbeer 100, nuggies 50, kills 80, level 4, spent 20)');
srv.close();
