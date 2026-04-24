// TypeScript types for deploy-vercel-from-sanity

export type VercelDeployState =
	| 'QUEUED'
	| 'INITIALIZING'
	| 'BUILDING'
	| 'READY'
	| 'ERROR'
	| 'CANCELED'
	| 'LOADING' // internal — before first API response

/** A vercel_deploy document stored in the Sanity dataset */
export interface DeployTarget {
	_id: string
	_type: 'vercel_deploy'
	name: string
	/** Full Vercel deploy hook URL */
	url: string
	/** Vercel team ID — optional, only needed for team projects */
	teamId?: string
	/** Prevent editors from deleting this target */
	disableDeleteAction?: boolean
}

/** A single deployment returned by GET /v6/deployments */
export interface VercelDeployment {
	uid: string
	/** Preview hostname, e.g. my-project-abc123.vercel.app */
	url: string
	state: VercelDeployState
	/** Unix ms timestamp */
	created: number
	/** Link to the Vercel dashboard page for this deployment */
	inspectorUrl?: string
	creator?: {
		uid: string
		username: string
		avatar?: string
	}
	meta?: {
		githubCommitMessage?: string
		githubCommitRef?: string
		githubCommitSha?: string
		githubCommitAuthorName?: string
		/** GitHub repo in "org/repo" format — used to construct commit links */
		githubRepo?: string
		/** GitHub org slug — fallback when githubRepo is absent */
		githubCommitOrg?: string
	}
}

/** A single build event returned by GET /v2/deployments/{id}/events */
export interface DeploymentEvent {
	type: 'command' | 'stdout' | 'stderr' | 'exit' | 'deployment-state'
	text?: string
	created: number
	payload?: Record<string, unknown>
}

/** Vercel config document stored at _id: 'config.vercelDeploy' — readable by all authenticated users */
export interface VercelConfig {
	_id: 'config.vercelDeploy'
	_type: 'vercelDeploy.config'
	accessToken: string
}

/** Plugin configuration options */
export interface VercelDeployPluginConfig {
	/** Tool name slug shown in Studio sidebar (default: 'vercel-deploy') */
	name?: string
	/** Tool label shown in Studio sidebar (default: 'Deploy') */
	title?: string
	/** Custom icon component */
	icon?: React.ComponentType
}
