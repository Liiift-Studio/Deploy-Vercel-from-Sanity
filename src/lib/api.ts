// Vercel REST API helpers — all calls require a bearer token
import type { VercelDeployment } from '../types'

const BASE = 'https://api.vercel.com'

async function vercelFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})
	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText)
		throw new Error(`Vercel API ${res.status}: ${text}`)
	}
	return res.json() as Promise<T>
}

/** Fetch the last N deployments triggered by a specific deploy hook */
export async function listDeployments(opts: {
	projectId: string
	hookId: string
	token: string
	teamId?: string
	limit?: number
}): Promise<VercelDeployment[]> {
	const params = new URLSearchParams({
		projectId: opts.projectId,
		'meta-deployHookId': opts.hookId,
		limit: String(opts.limit ?? 10),
	})
	if (opts.teamId) params.set('teamId', opts.teamId)
	const data = await vercelFetch<{ deployments: VercelDeployment[] }>(
		`/v6/deployments?${params}`,
		opts.token,
	)
	return data.deployments ?? []
}

/** Cancel an in-progress deployment */
export async function cancelDeployment(opts: {
	deploymentId: string
	token: string
	teamId?: string
}): Promise<void> {
	const params = opts.teamId ? `?teamId=${opts.teamId}` : ''
	await vercelFetch(`/v12/deployments/${opts.deploymentId}/cancel${params}`, opts.token, {
		method: 'PATCH',
	})
}

/** Trigger a deploy by POSTing to the hook URL — no auth needed */
export async function triggerDeploy(hookUrl: string): Promise<void> {
	const res = await fetch(hookUrl, { method: 'POST' })
	if (!res.ok) throw new Error(`Deploy hook returned ${res.status}`)
}
