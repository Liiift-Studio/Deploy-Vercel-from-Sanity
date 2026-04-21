// Per-deploy-target card — shows status, build timer, history, cancel, and deploy
import { useState, useEffect, useCallback, useRef } from 'react'
import {
	Card, Box, Stack, Flex, Text, Button, Tooltip, Badge, Spinner, MenuButton, Menu, MenuItem,
} from '@sanity/ui'
import {
	RocketIcon, ClockIcon, HistoryIcon, TrashIcon, EllipsisVerticalIcon, LaunchIcon,
} from '@sanity/icons'
import { listDeployments, cancelDeployment, triggerDeploy } from '../lib/api'
import { parseHookUrl, isActiveState, formatDuration, timeAgo, shortSha, safeHref } from '../lib/helpers'
import { StatusBadge } from './StatusBadge'
import { DeployHistory } from './DeployHistory'
import type { DeployTarget, VercelDeployment } from '../types'

const POLL_INTERVAL_MS = 5_000

interface DeployItemProps {
	target: DeployTarget
	token: string
	onDelete: (target: DeployTarget) => void
}

export function DeployItem({ target, token, onDelete }: DeployItemProps) {
	const { projectId, hookId } = parseHookUrl(target.url)

	const [deployments, setDeployments] = useState<VercelDeployment[]>([])
	const [loadingInitial, setLoadingInitial] = useState(true)
	const [triggering, setTriggering] = useState(false) // hook fired, waiting for deploy to appear
	const [canceling, setCanceling] = useState(false)
	const [deployError, setDeployError] = useState<string | null>(null)
	const [showHistory, setShowHistory] = useState(false)
	const [elapsed, setElapsed] = useState(0) // build timer in seconds

	const latest = deployments[0]
	const isActive = triggering || isActiveState(latest?.state)

	// ── Fetch deployments ──────────────────────────────────────────────────────
	const fetchDeployments = useCallback(async () => {
		if (!projectId || !hookId || !token) return
		try {
			const data = await listDeployments({ projectId, hookId, token, teamId: target.teamId })
			setDeployments(data)
		} catch (err) {
			console.error('deploy-vercel-from-sanity: fetch error', err)
		}
	}, [projectId, hookId, token, target.teamId])

	// Initial fetch
	useEffect(() => {
		fetchDeployments().finally(() => setLoadingInitial(false))
	}, [fetchDeployments])

	// Polling while active
	useEffect(() => {
		if (!isActive) return
		const id = setInterval(fetchDeployments, POLL_INTERVAL_MS)
		return () => clearInterval(id)
	}, [isActive, fetchDeployments])

	// Stop triggering once a deployment appears in an active state
	useEffect(() => {
		if (triggering && latest && latest.state !== undefined) {
			setTriggering(false)
		}
	}, [triggering, latest])

	// ── Build timer ───────────────────────────────────────────────────────────
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	useEffect(() => {
		if (isActive) {
			const start = latest?.created ?? Date.now()
			setElapsed(Math.floor((Date.now() - start) / 1000))
			timerRef.current = setInterval(() => {
				setElapsed(Math.floor((Date.now() - start) / 1000))
			}, 1000)
		} else {
			setElapsed(0)
			if (timerRef.current) clearInterval(timerRef.current)
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [isActive, latest?.created])

	// ── Actions ───────────────────────────────────────────────────────────────
	const deploy = useCallback(async () => {
		setDeployError(null)
		setTriggering(true)
		try {
			await triggerDeploy(target.url)
			// Poll immediately to pick up the new deployment faster
			setTimeout(fetchDeployments, 2000)
		} catch (err) {
			setTriggering(false)
			setDeployError(err instanceof Error ? err.message : 'Deploy failed')
		}
	}, [target.url, fetchDeployments])

	const cancel = useCallback(async () => {
		if (!latest?.uid) return
		setCanceling(true)
		try {
			await cancelDeployment({ deploymentId: latest.uid, token, teamId: target.teamId })
			await fetchDeployments()
		} catch (err) {
			console.error('deploy-vercel-from-sanity: cancel error', err)
		} finally {
			setCanceling(false)
		}
	}, [latest?.uid, token, target.teamId, fetchDeployments])

	// ── Derived display values ────────────────────────────────────────────────
	const branch = latest?.meta?.githubCommitRef
	const commitMsg = latest?.meta?.githubCommitMessage?.split('\n')[0]
	const sha = shortSha(latest?.meta?.githubCommitSha)
	const creator = latest?.creator?.username
	const deployedAt = latest?.created ? timeAgo(latest.created) : null

	return (
		<>
			<Card padding={4} radius={2} shadow={1} tone="default">
				<Stack space={4}>
					{/* ── Header ──────────────────────────────────────────────── */}
					<Flex align="flex-start" justify="space-between" gap={3}>
						<Stack space={2} flex={1}>
							<Text size={2} weight="semibold">{target.name}</Text>
							<Flex gap={2} wrap="wrap">
								<Text size={0} muted>
									{projectId ? `${projectId.slice(0, 18)}…` : '—'}
								</Text>
								<Text size={0} muted>·</Text>
								<Text size={0} muted>Hook: {hookId || '—'}</Text>
								{target.teamId && (
									<>
										<Text size={0} muted>·</Text>
										<Text size={0} muted>Team: {target.teamId}</Text>
									</>
								)}
							</Flex>
						</Stack>

						{/* Action menu */}
						<MenuButton
							button={
								<Button mode="ghost" icon={EllipsisVerticalIcon} />
							}
							id={`menu-${target._id}`}
							menu={
								<Menu>
									<MenuItem
										text="History"
										icon={HistoryIcon}
										onClick={() => setShowHistory(true)}
									/>
									{safeHref(latest?.inspectorUrl) && (
										<MenuItem
											text="Build logs"
											icon={LaunchIcon}
											as="a"
											href={safeHref(latest?.inspectorUrl)}
											target="_blank"
											rel="noreferrer"
										/>
									)}
									{!target.disableDeleteAction && (
										<MenuItem
											text="Delete"
											icon={TrashIcon}
											tone="critical"
											onClick={() => onDelete(target)}
										/>
									)}
								</Menu>
							}
							popover={{ placement: 'bottom-end' }}
						/>
					</Flex>

					{/* ── Status row ──────────────────────────────────────────── */}
					{loadingInitial ? (
						<Flex align="center" gap={2}>
							<Spinner muted />
							<Text size={1} muted>Loading…</Text>
						</Flex>
					) : (
						<Stack space={3}>
							<Flex align="center" gap={3} wrap="wrap">
								{/* Status badge */}
								{triggering ? (
									<Flex align="center" gap={2}>
										<Spinner muted />
										<Badge tone="caution" mode="outline">Triggering…</Badge>
									</Flex>
								) : (
									<StatusBadge state={latest?.state} showSpinner />
								)}

								{/* Build timer */}
								{isActive && elapsed > 0 && (
									<Flex align="center" gap={1}>
										<ClockIcon />
										<Text size={1} muted>{formatDuration(elapsed)}</Text>
									</Flex>
								)}

								{/* Time since deploy */}
								{!isActive && deployedAt && (
									<Text size={1} muted>{deployedAt}</Text>
								)}

								{/* Branch */}
								{branch && (
									<>
										<Text size={1} muted>·</Text>
										<Badge tone="default" mode="outline">{branch}</Badge>
									</>
								)}

								{/* Commit */}
								{sha && (
									<Tooltip
										content={
											<Box padding={2}>
												<Text size={1}>{commitMsg ?? sha}</Text>
											</Box>
										}
										portal
									>
										<Text size={1} muted style={{ cursor: 'default' }}>
											{sha}
										</Text>
									</Tooltip>
								)}

								{/* Creator */}
								{creator && (
									<Text size={1} muted>by {creator}</Text>
								)}

								{/* Preview link */}
								{latest?.url && latest.state === 'READY' && (
									<a
										href={`https://${latest.url}`}
										target="_blank"
										rel="noreferrer"
										style={{ color: 'inherit' }}
									>
										<Flex align="center" gap={1}>
											<LaunchIcon />
											<Text size={1}>Preview</Text>
										</Flex>
									</a>
								)}
							</Flex>

							{/* Error message from commit meta */}
							{deployError && (
								<Card tone="critical" padding={2} radius={2}>
									<Text size={1}>{deployError}</Text>
								</Card>
							)}
						</Stack>
					)}

					{/* ── Action buttons ──────────────────────────────────────── */}
					<Flex align="center" justify="flex-end" gap={2}>
						{isActiveState(latest?.state) && (
							<Button
								text="Cancel"
								mode="ghost"
								tone="critical"
								loading={canceling}
								disabled={canceling}
								onClick={cancel}
							/>
						)}
						<Button
							text="Deploy"
							tone="primary"
							icon={RocketIcon}
							loading={triggering}
							disabled={isActive}
							onClick={deploy}
						/>
					</Flex>
				</Stack>
			</Card>

			{showHistory && (
				<DeployHistory
					target={target}
					token={token}
					onClose={() => setShowHistory(false)}
				/>
			)}
		</>
	)
}
