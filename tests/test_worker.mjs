// node tests/test_worker.mjs
// The Worker serves the daily data from the repository and falls back to the deployed copy.
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const bundled = JSON.stringify({ generated: '2026-10-18T17:26:31Z', hackathons: [{ id: 1 }] });
const env = { ASSETS: { fetch: async (req) => new Response(new URL(req.url).pathname === '/data/hackathons.json' ? bundled : 'asset') } };
const get = (path) => worker.fetch(new Request('https://winnable.example' + path), env);

// fresh repository data wins
globalThis.fetch = async () => new Response(JSON.stringify({ generated: '2026-10-28T05:40:00Z', hackathons: [{ id: 2 }] }));
let r = await get('/data/hackathons.json');
assert.equal((await r.json()).generated, '2026-10-28T05:40:00Z');
assert.match(r.headers.get('content-type'), /application\/json/);

// private repository (404), broken JSON, or a network error: the deployed copy
for (const remote of [async () => new Response('Not Found', { status: 404 }), async () => new Response('{"generated":'), async () => { throw new Error('offline'); }]) {
  globalThis.fetch = remote;
  r = await get('/data/hackathons.json');
  assert.equal((await r.json()).generated, '2026-10-18T17:26:31Z');
}

// older repository data never replaces newer deployed data
globalThis.fetch = async () => new Response(JSON.stringify({ generated: '2026-10-01T00:00:00Z', hackathons: [] }));
r = await get('/data/hackathons.json');
assert.equal((await r.json()).generated, '2026-10-18T17:26:31Z');

// everything else is a static asset
r = await get('/site/');
assert.equal(await r.text(), 'asset');

console.log('worker tests: all passed');
