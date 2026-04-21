# deploy-vercel-from-sanity

Sanity Studio v5 plugin — trigger and monitor Vercel deployments directly from the Studio.

- Deploy button per target with live status polling
- Build timer while the deployment is running
- Branch, commit message, and creator shown inline
- Cancel an in-progress build
- Deployment history (last 10) with preview URLs and direct build log links
- Vercel API token stored securely in your Sanity dataset

---

## Requirements

- Sanity Studio v5
- A Vercel project with at least one [Deploy Hook](https://vercel.com/docs/git/deploy-hooks) configured
- A Vercel API token (for reading deployment status, history, and logs)

---

## Installation

```bash
npm install deploy-vercel-from-sanity
```

---

## Setup

### 1. Add the plugin

```ts
// sanity.config.ts
import { defineConfig } from 'sanity'
import { vercelDeploy } from 'deploy-vercel-from-sanity'

export default defineConfig({
  // ...
  plugins: [
    vercelDeploy(),
    // or with custom label/icon:
    vercelDeploy({ title: 'Deploy', name: 'vercel-deploy' }),
  ],
})
```

### 2. Add a deploy hook document

Create a `vercel_deploy` document in your Sanity dataset with the deploy hook URL from
**Vercel → Project Settings → Git → Deploy Hooks**:

```ts
// Via Sanity CLI (run once):
// npx sanity exec scripts/seed.js --with-user-token

import { getCliClient } from 'sanity/cli'
const client = getCliClient({ apiVersion: '2025-01-01' })

await client.createOrReplace({
  _id: 'vercel-deploy-production',
  _type: 'vercel_deploy',
  name: 'Production',
  url: 'https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy',
})
```

Or create it from the Studio — the plugin registers the `vercel_deploy` schema automatically.

### 3. Add your Vercel API token

On first launch, the plugin shows a token setup screen. Create a token at
**vercel.com → Settings → Tokens** with **Full Account** scope, paste it in, and save.

The token is stored in a Sanity document at `_id: "secrets.vercelDeploy"`.

---

## Security

### Vercel API token storage

The token is stored in a Sanity document with `_id: "secrets.vercelDeploy"`. Sanity's
platform excludes documents in the `secrets.*` namespace from public/unauthenticated
API access — they are only readable by authenticated Studio sessions.

**If your dataset is in public mode**, verify this protection is in place before storing
sensitive credentials. You can confirm by attempting to fetch the document without an
auth token:

```bash
curl "https://{projectId}.api.sanity.io/v2021-06-07/data/query/{dataset}?query=*[_id==\"secrets.vercelDeploy\"]"
# Should return empty results
```

### Link safety

All external links (`inspectorUrl`, preview URLs) from the Vercel API are validated
to allow only `http:` and `https:` protocols before being used as `href` values.
This prevents `javascript:` injection from a malformed API response.

### Deploy hook URLs

Deploy hook URLs act as secrets — anyone with the URL can trigger a deployment.
Do not log them, commit them to public repos, or expose them client-side outside
the Studio. The plugin only sends a POST to the hook URL; the URL itself is never
displayed in full.

---

## `vercel_deploy` document schema

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✓ | Display label (e.g. "Production") |
| `url` | url | ✓ | Vercel deploy hook URL |
| `teamId` | string | | Vercel team ID — required for team-owned projects |
| `disableDeleteAction` | boolean | | Prevent deletion from the Studio |

The `projectId` and hook ID are parsed automatically from the hook URL.

---

## Options

```ts
vercelDeploy({
  name?: string   // Tool slug in the Studio sidebar (default: 'vercel-deploy')
  title?: string  // Tool label (default: 'Deploy')
  icon?: React.ComponentType  // Custom icon
})
```

---

## License

MIT
