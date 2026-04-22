# deploy-vercel-from-sanity

A [Sanity Studio](https://www.sanity.io) plugin to trigger, monitor, and manage Vercel deployments — without leaving your studio.

![Deploy tool screenshot](./docs/screenshot.png)

## Features

- **Trigger deployments** via Vercel deploy hooks
- **Live status** with automatic polling — Queued → Building → Ready / Error
- **Build timer** showing elapsed time while a deploy is running
- **Cancel** in-progress deployments
- **Copy deployment URL** with one click
- **Inline error log viewer** — see build errors directly in the card without going to Vercel
- **Deployment history** per target
- **"Open in Vercel"** link to the project dashboard
- **Responsive grid layout** — 2 columns on desktop, 1 on mobile
- **Shared API token** — set it once, works for all studio users with editor access or above

---

## Installation

```bash
npm install @liiift-studio/deploy-vercel-from-sanity
```

---

## Setup

### 1. Add the plugin to your Sanity config

```ts
// sanity.config.ts
import { defineConfig } from 'sanity'
import { vercelDeploy } from '@liiift-studio/deploy-vercel-from-sanity'

export default defineConfig({
  // ...
  plugins: [
    vercelDeploy(),
    // or with a custom label / name:
    vercelDeploy({ title: 'Deploy', name: 'vercel-deploy' }),
  ],
})
```

### 2. (Optional) Restrict the tool to editors and above

By default the tool is visible to all authenticated users. To hide it from viewers:

```ts
// sanity.config.ts
tools: (prev, { currentUser }) => {
  const canDeploy = currentUser?.roles?.some(r =>
    ['administrator', 'editor'].includes(r.name)
  )
  return canDeploy ? prev : prev.filter(t => t.name !== 'vercel-deploy')
},
```

### 3. Connect your Vercel API token

Open the **Deploy** tool in Sanity Studio. Enter a Vercel API token when prompted.

To create a token: **vercel.com → Settings → Tokens → Create → Full Account scope**.

The token is stored in a `config.vercelDeploy` document in your dataset and is shared across all authenticated studio users (see [Security](#security)).

### 4. Create deploy targets

Create one or more `vercel_deploy` documents in your dataset. Each represents a deployment environment (e.g. Production, Staging).

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

**Fields on each `vercel_deploy` document:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✓ | Display label shown in the studio |
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

## How it works

1. Deploy targets are stored as `vercel_deploy` documents in your Sanity dataset.
2. The plugin fetches the last 10 deployments for each target from the Vercel API, filtered to those triggered by that hook.
3. While a deployment is active (Queued / Initializing / Building), it polls every 5 seconds.
4. Clicking **Deploy** POSTs to the hook URL — Vercel queues a new build.
5. If a deploy fails, clicking **Show error details** fetches the last 30 build log lines from the Vercel API inline.

---

## Security

### API token storage

The Vercel API token is stored in a `config.vercelDeploy` Sanity document, which is readable by **all authenticated studio users**. Anyone with a login to your Sanity project can read the token value via the Sanity API.

**Recommendations:**
- Audit who has access to your Sanity project at sanity.io → Project → Members.
- If your studio includes untrusted editors, consider a server-side proxy that holds the token outside Sanity and exposes only a scoped deploy endpoint.

### Deploy hook URL validation

`triggerDeploy` validates that the hook URL matches `api.vercel.com/v1/integrations/deploy/` before making the request. This prevents SSRF if a `vercel_deploy` document is created or modified outside the Studio's schema validation.

### External links

All external links use `target="_blank" rel="noreferrer"` and are validated through `safeHref()` before rendering, blocking `javascript:` injection from a compromised API response.

### GROQ queries

All GROQ queries in this plugin are static strings — no user input is interpolated, so there is no GROQ injection risk.

---

## Requirements

- Sanity Studio v3, v4, or v5
- React 18 or 19
- A Vercel account with at least one project configured with a deploy hook

---

## Contributing

Issues and pull requests are welcome at [github.com/Liiift-Studio/Deploy-Vercel-from-Sanity](https://github.com/Liiift-Studio/Deploy-Vercel-from-Sanity).

---

## License

MIT
