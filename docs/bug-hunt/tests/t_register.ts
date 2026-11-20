import { createServer } from 'node:http';
// "Create player" tapped twice quickly (or two people picking the same name at once): two registers race.
process.env.DB_PATH = '/tmp/hunt/register-test.db';
const { createUserApi } = await import('/workspace/Puffy-/server/users');
const api = await createUserApi();
const srv = createServer(async (req, res) => { if (!(await api(req, res))) res.writeHead(404).end(); });
await new Promise<void>((r) => srv.listen(18961, r));
const reg = () => fetch('http://127.0.0.1:18961/api/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': String(Math.random()) }, body: JSON.stringify({ name: 'bob', password: 'pass1' }) }).then(async (r) => `${r.status} ${JSON.stringify(await r.json())}`.slice(0, 60));
console.log((await Promise.all([reg(), reg()])).join('\n'));
srv.close();
