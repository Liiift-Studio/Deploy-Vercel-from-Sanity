# deploy-vercel-from-sanity

**Trigger and monitor Vercel deployments directly from [Sanity Studio](https://www.sanity.io) — no context switching required.**

[![npm version](https://img.shields.io/npm/v/@liiift-studio/deploy-vercel-from-sanity)](https://www.npmjs.com/package/@liiift-studio/deploy-vercel-from-sanity)
[![Sanity v3/v4/v5](https://img.shields.io/badge/sanity-v3%20%7C%20v4%20%7C%20v5-f03e2f)](https://www.sanity.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

![Deploy with Vercel — Production and Preview targets with live status](./docs/screenshot.png)

---

## Features

- **One-click deploy** — trigger Production or Preview builds from inside Sanity Studio
- **Live status** with automatic polling — Queued → Building → Ready / Error
- **Build timer** showing elapsed time while a deploy is in progress
- **Cancel** in-progress deployments
- **Copy deployment URL** with one click
- **Inline error log viewer** — see build errors without leaving the studio
- **Deployment history** per target
- **"Open in Vercel"** link to your project dashboard
- **Multiple targets** — configure Production, Preview, and any number of custom environments
- **Shared API token** — set it once; all authenticated studio users with editor access or above can deploy
- **Responsive grid layout** — 2 columns on desktop, 1 on mobile

---

## Installation

```bash
npm install @liiift-studio/deploy-vercel-from-sanity
```

---

## Quick start

### 1. Add the plugin to your Sanity config

```ts
// sanity.config.ts
import { defineConfig } from 'sanity'
import { vercelDeploy } from '@liiift-studio/deploy-vercel-from-sanity'

export default defineConfig({
  // ...
  plugins: [
    vercelDeploy({ title: 'Deploy', name: 'vercel-deploy' }),
  ],
})
```

### 2. Connect your Vercel API token

Open the **Deploy** tab in Sanity Studio and enter a Vercel API token when prompted.

To create a token: **vercel.com → Settings → Tokens → Create → Full Account scope**.

The token is stored in a `config.vercelDeploy` document in your dataset and shared across all authenticated studio users.

### 3. Add a deploy target

Create one or more `vercel_deploy` documents — each represents an environment (Production, Preview, etc.).

**Via Sanity CLI:**

```bash
sanity documents create << 'EOF'
{
  "_type": "vercel_deploy",
  "_id": "vercel-deploy-production",
  "name": "Production",
  "url": "https://api.vercel.com/v1/integrations/deploy/YOUR_PROJECT_ID/YOUR_HOOK_ID"
}
EOF
```

**To get your deploy hook URL:** Vercel Dashboard → Project → Settings → Git → Deploy Hooks → Create Hook.

**Available fields on each `vercel_deploy` document:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✓ | Display label (e.g. "Production", "Preview") |
| `url` | `url` | ✓ | Vercel deploy hook URL |
| `teamId` | `string` | | Vercel team ID — required for team-owned projects |
| `disableDeleteAction` | `boolean` | | Hides the delete button for this target in the studio UI |

---

## Plugin options

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'vercel-deploy'` | Tool slug in the Studio sidebar |
| `title` | `string` | `'Deploy'` | Tool label in the Studio sidebar |
| `icon` | `ComponentType` | `RocketIcon` | Custom sidebar icon |

---

## Restrict access to editors and above

By default the Deploy tab is visible to all authenticated users. To hide it from viewers:

```ts
// sanity.config.ts
tools: (prev, { currentUser }) => {
  const canDeploy = currentUser?.roles?.some(r =>
    ['administrator', 'editor'].includes(r.name)
  )
  return canDeploy ? prev : prev.filter(t => t.name !== 'vercel-deploy')
},
```

---

## How it works

1. Deploy targets are stored as `vercel_deploy` documents in your Sanity dataset.
2. The plugin fetches the last 10 deployments for each target from the Vercel API, filtered to those triggered by that hook.
3. While a deployment is active (Queued / Initializing / Building), it polls every 5 seconds.
4. Clicking **Deploy** POSTs to the hook URL — Vercel queues a new build.
5. If a deploy fails, clicking **Show error details** fetches the last 30 build log lines from the Vercel API inline.

---

## Security

**API token storage** — The Vercel API token is stored in a `config.vercelDeploy` Sanity document, readable by all authenticated studio users. Audit who has access to your Sanity project at sanity.io → Project → Members. If your studio includes untrusted editors, consider a server-side proxy that holds the token and exposes only a scoped deploy endpoint.

**Deploy hook URL validation** — `triggerDeploy` validates that the hook URL matches `api.vercel.com/v1/integrations/deploy/` before making the request, preventing SSRF from a tampered document.

**External links** — All external links use `target="_blank" rel="noreferrer"` and are validated through `safeHref()` before rendering, blocking `javascript:` injection from a compromised API response.

**GROQ queries** — All GROQ queries in this plugin are static strings — no user input is interpolated.

---

## Requirements

- Sanity Studio v3, v4, or v5
- React 18 or 19
- A Vercel account with at least one project and a deploy hook configured

---

## Contributing

Issues and pull requests welcome at [github.com/Liiift-Studio/Deploy-Vercel-from-Sanity](https://github.com/Liiift-Studio/Deploy-Vercel-from-Sanity).

---

## License

MIT
