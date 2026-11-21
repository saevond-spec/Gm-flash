# ClawScout Independent

Independent, read-only ClawHunt webhook and supervised AI proposal draft page. This does not import any Star or Hermes project or credentials. No autonomous bidding, customer-file downloads, payments, customer deployments or scheduled jobs.

## Deploy with Cloudflare Workers Git integration

- Repo: saevond-spec/Gm-flash; Worker name: gm-flash (matches wrangler.jsonc).
- Root path: /; build command: blank; deploy command: npx wrangler deploy.
- Deploy only into a **separate Cloudflare account** that has never hosted Star and uses its own scoped build token. No Star keys or shared service bindings.
- Visit the Worker URL ending in /health to confirm deployed:true and ai_bound:true.
- Enter the Worker's public HTTPS URL ending in /cph-webhook in ClawHunt's New agent form.
- After ClawHunt issues a webhook secret, set it as the Cloudflare Worker **secret** CPH_WEBHOOK_SECRET. Before it is configured, webhook requests are acknowledged but not trusted or processed.
- For AI drafts, generate a different 32+ character Worker **secret** CONTROL_TOKEN; enter it only into the Worker's own page. The AI binding is declared in wrangler.jsonc.

This is a **scaffold**. The ClawHunt capability probes for file_transfer and visual_observation will not pass: those capabilities are not implemented. The webhook currently only acknowledges authenticated non-probe events; check ClawHunt's dashboard for order assignments. Do not bid on work unless the required delivery capabilities are independently tested. No tokens or customer content belong in this public repository.

## ClawHunt API integration (private credentials, iPhone-friendly)

The browser dashboard now supports connection checks, browsing open jobs and an operator-confirmed bid. No automatic bidding is enabled. Official API: GET /api/v1/me, GET /api/v1/problems, POST /api/v1/problems/{problem_id}/bid. Prices sent as **whole cents**.

1. In ClawHunt > Dashboard > Developer > Agent API keys, create a **new key for your independent ClawScout agent**, with Browse and Bid scopes. If ClawScout is not listed yet, create/claim it first. Do not reuse Sprite/Star keys, or the exposed #1853 quick-start key.
2. In Cloudflare > Workers & Pages > gm-flash > Settings > Variables and Secrets, add an **encrypted Secret** named `CPH_API_KEY` containing the new `cph_` key. Never put a key in source code, this public repository, a screenshot or chat.
3. Add a second separate, random 32+ character encrypted Secret named `CONTROL_TOKEN` (not the same as the ClawHunt key). Store its value in your password manager; you enter it into the gm-flash Worker dashboard to authenticate private API actions.
4. In ClawHunt > My Agents > Edit, set webhook URL: `https://gm-flash.saevond.workers.dev/cph-webhook`. Get ClawHunt's `webhook_secret` from agent settings and configure it as the encrypted Cloudflare Secret `CPH_WEBHOOK_SECRET`.
5. Open `https://gm-flash.saevond.workers.dev/health`: inspect only non-sensitive booleans `operator_configured`, `clawhunt_api_key_configured`, `signed_webhooks`. Then open the Worker root page and tap **Verify ClawHunt connection**; confirmed `admission_status: approved` verifies live access. The public health endpoint does **not** authenticate an agent on its own.
6. Browse funded tasks and only bid on work the agent can actually deliver. Each bid requires operator confirmation. The Worker currently has no delivery engine and cannot accept customer files or produce verified paid deliverables by itself.

**Isolation limitation**: This Worker is in the Cloudflare account that also has Star scripts; it has no direct Star binding. True account isolation requires moving it to a different account. No Star source, keys, customer data or Worker routes should be connected.

