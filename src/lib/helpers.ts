// URL parsing and time formatting utilities
import type { VercelDeployState } from '../types'

/**
 * Extracts projectId and hookId from a Vercel deploy hook URL.
 * Format: https://api.vercel.com/v1/integrations/deploy/{projectId}/{hookId}
 */
export function parseHookUrl(url: string): { projectId: string; hookId: string } {
	try {
		const path = new URL(url).pathname
		const parts = path.split('/').filter(Boolean)
		// parts: ['v1', 'integrations', 'deploy', '{projectId}', '{hookId}']
		return {
			projectId: parts[3] ?? '',
			hookId: parts[4] ?? '',
		}
	} catch {
		return { projectId: '', hookId: '' }
	}
}

/** Active states — deployment is in progress and should be polled */
const ACTIVE_STATES: ReadonlySet<VercelDeployState> = new Set([
	'QUEUED',
	'INITIALIZING',
	'BUILDING',
])

export function isActiveState(state: VercelDeployState | undefined): boolean {
	return !!state && ACTIVE_STATES.has(state)
}

/** Human-readable elapsed duration from a number of seconds */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	return `${m}m ${s}s`
}

/** Human-readable relative time from a Unix ms timestamp */
export function timeAgo(ms: number): string {
	const diff = Math.floor((Date.now() - ms) / 1000)
	if (diff < 60) return `${diff}s ago`
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
	return `${Math.floor(diff / 86400)}d ago`
}

/**
 * Validates a URL is safe to use as an href.
 * Rejects anything that isn't http/https to block javascript: injection
 * from a compromised API response.
 */
export function safeHref(url: string | undefined): string | undefined {
	if (!url) return undefined
	try {
		const parsed = new URL(url)
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined
		return url
	} catch {
		return undefined
	}
}

/** Truncates a commit SHA to 7 chars */
export function shortSha(sha: string | undefined): string {
	return sha ? sha.slice(0, 7) : ''
}

/** Returns a label and tone for a Vercel deployment state */
export function stateLabel(state: VercelDeployState | undefined): {
	label: string
	tone: 'positive' | 'caution' | 'critical' | 'default'
} {
	switch (state) {
		case 'READY':       return { label: 'Ready',        tone: 'positive' }
		case 'BUILDING':    return { label: 'Building',     tone: 'caution' }
		case 'QUEUED':      return { label: 'Queued',       tone: 'caution' }
		case 'INITIALIZING':return { label: 'Initializing', tone: 'caution' }
		case 'ERROR':       return { label: 'Error',        tone: 'critical' }
		case 'CANCELED':    return { label: 'Canceled',     tone: 'default' }
		case 'LOADING':     return { label: 'Loading…',     tone: 'default' }
		default:            return { label: 'Unknown',      tone: 'default' }
	}
}
