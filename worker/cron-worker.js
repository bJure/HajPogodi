/**
 * Cloudflare Worker cron - besplatna alternativa GitHub Actionsu.
 *
 * Koristi ovo ako je repozitorij PRIVATAN: tamo se svako pokretanje Actions
 * workflowa naplacuje kao cijela minuta, pa raspored svakih 5 minuta probije
 * besplatnih 2.000 minuta mjesecno. Cloudflare Worker cron trigger nema takvo
 * ogranicenje.
 *
 * Postavljanje:
 *   1. npm create cloudflare@latest hajpogodi-cron -- --type=hello-world
 *   2. zamijeni src/index.js ovom datotekom, a wrangler.toml sadrzajem ispod
 *   3. npx wrangler secret put CRON_SECRET
 *   4. npx wrangler deploy
 *
 * wrangler.toml:
 *   name = "hajpogodi-cron"
 *   main = "src/index.js"
 *   compatibility_date = "2026-01-01"
 *
 *   [triggers]
 *   crons = ["0 6 * * *", "*&#47;5 * * * *"]
 *
 *   [vars]
 *   APP_URL = "https://hajpogodi.vercel.app"
 */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },

  // Rucno okidanje iz preglednika radi provjere da je Worker ziv.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/tick') {
      return new Response('hajpogodi-cron', { status: 200 });
    }
    const result = await tick(env);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  },
};

async function tick(env) {
  if (!env.APP_URL || !env.CRON_SECRET) {
    return { ok: false, error: 'APP_URL ili CRON_SECRET nisu postavljeni' };
  }

  try {
    const response = await fetch(`${env.APP_URL}/api/cron/tick`, {
      method: 'POST',
      headers: { 'x-cron-secret': env.CRON_SECRET },
    });

    const body = await response.text();
    console.log(`cron tick: HTTP ${response.status} ${body}`);
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    console.error('cron tick nije uspio', error);
    return { ok: false, error: String(error) };
  }
}
