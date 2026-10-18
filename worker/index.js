// Cloudflare Worker in front of the static board. The daily GitHub Action commits fresh data
// to the repository; this serves that file, so the live board stays current without a redeploy.
// If the repository is private or unreachable, or its copy is broken or older, the data file
// deployed with the site is served instead.

const REPO_DATA = 'https://raw.githubusercontent.com/Gluflex/winnable/main/data/hackathons.json';
const DATA_PATH = '/data/hackathons.json';

async function remoteData() {
  try {
    const r = await fetch(REPO_DATA, { cf: { cacheTtl: 900, cacheEverything: true } });
    if (!r.ok) return null;
    const data = JSON.parse(await r.text());
    return data && data.generated && Array.isArray(data.hackathons) ? data : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== DATA_PATH) return env.ASSETS.fetch(request);
    const [remote, deployed] = await Promise.all([remoteData(), env.ASSETS.fetch(request)]);
    if (!remote) return deployed;
    let deployedAt = '';
    try { deployedAt = (await deployed.clone().json()).generated || ''; } catch { /* unreadable: prefer remote */ }
    if (deployedAt && remote.generated < deployedAt) return deployed;
    return new Response(JSON.stringify(remote), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' },
    });
  },
};
