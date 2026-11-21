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
