// Per-deploy-target card — shows status, build timer, history, cancel, deploy, copy URL, and error logs
import { useState, useEffect, useCallback, useRef } from 'react'
import {
	Card, Box, Stack, Flex, Text, Button, Tooltip, Badge, Spinner,
	MenuButton, Menu, MenuItem, Code,
} from '@sanity/ui'
import {
	ClockIcon, TrashIcon, EllipsisVerticalIcon, LaunchIcon,
	CopyIcon, CheckmarkIcon, WarningOutlineIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, SchemaIcon
} from '@sanity/icons'
import { listDeployments, cancelDeployment, triggerDeploy, getDeploymentEvents } from '../lib/api'
import { parseHookUrl, isActiveState, formatDuration, timeAgo, shortSha, safeHref, projectHref } from '../lib/helpers'
import { StatusBadge } from './StatusBadge'
import { DeployHistory } from './DeployHistory'
import type { DeployTarget, VercelDeployment } from '../types'

const POLL_INTERVAL_MS = 5_000
const LABEL_WIDTH      = 64

interface DeployItemProps {
	target: DeployTarget
	token: string
	onDelete: (target: DeployTarget) => void
	onEdit: (target: DeployTarget) => void
}

export function DeployItem({ target, token, onDelete, onEdit }: DeployItemProps) {
	const { projectId, hookId } = parseHookUrl(target.url)

	const [deployments, setDeployments]      = useState<VercelDeployment[]>([])
	const [loadingInitial, setLoadingInitial] = useState(true)
	const [triggering, setTriggering]        = useState(false)
	const [canceling, setCanceling]          = useState(false)
	const [deployError, setDeployError]      = useState<string | null>(null)
	const [showHistory, setShowHistory]      = useState(false)
	const [elapsed, setElapsed]              = useState(0)
	const [copied, setCopied]                = useState(false)
	const [showDetails, setShowDetails]      = useState(false)
	const [showErrorLogs, setShowErrorLogs]  = useState(false)
	const [errorLines, setErrorLines]        = useState<string[]>([])
	const [loadingLogs, setLoadingLogs]      = useState(false)
	const [logError, setLogError]            = useState<string | null>(null)

	const latest   = deployments[0]
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

	useEffect(() => {
		fetchDeployments().finally(() => setLoadingInitial(false))
	}, [fetchDeployments])

	useEffect(() => {
		if (!isActive) return
		const id = setInterval(fetchDeployments, POLL_INTERVAL_MS)
		return () => clearInterval(id)
	}, [isActive, fetchDeployments])

	useEffect(() => {
		if (triggering && latest && latest.state !== undefined) setTriggering(false)
	}, [triggering, latest])

	useEffect(() => {
		setShowErrorLogs(false)
		setErrorLines([])
		setLogError(null)
	}, [latest?.uid])

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
		return () => { if (timerRef.current) clearInterval(timerRef.current) }
	}, [isActive, latest?.created])

	// ── Actions ───────────────────────────────────────────────────────────────
	const deploy = useCallback(async () => {
		setDeployError(null)
		setTriggering(true)
		try {
			await triggerDeploy(target.url)
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

	const copyUrl = useCallback(() => {
		if (!latest?.url) return
		navigator.clipboard.writeText(`https://${latest.url}`).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}).catch(err => {
			console.error('deploy-vercel-from-sanity: clipboard error', err)
		})
	}, [latest?.url])

	const fetchErrorLogs = useCallback(async () => {
		if (!latest?.uid) return
		setLoadingLogs(true)
		setLogError(null)
		try {
			const events = await getDeploymentEvents({
				deploymentId: latest.uid,
				token,
				teamId: target.teamId,
			})
			const lines = events
				.filter(e => e.type === 'stderr' || e.type === 'stdout')
				.map(e => e.text ?? '')
				.filter(Boolean)
				.reverse()
				.slice(-30)
			setErrorLines(lines.length > 0 ? lines : ['No log output captured.'])
		} catch (err) {
			setLogError(err instanceof Error ? err.message : 'Failed to load build logs')
		} finally {
			setLoadingLogs(false)
		}
	}, [latest?.uid, token, target.teamId])

	const toggleErrorLogs = useCallback(() => {
		if (!showErrorLogs && errorLines.length === 0 && !logError) fetchErrorLogs()
		setShowErrorLogs(v => !v)
	}, [showErrorLogs, errorLines.length, logError, fetchErrorLogs])

	// ── Derived display values ────────────────────────────────────────────────
	const branch           = latest?.meta?.githubCommitRef
	const commitMsg        = latest?.meta?.githubCommitMessage?.split('\n')[0]
	const sha              = shortSha(latest?.meta?.githubCommitSha)
	const fullSha          = latest?.meta?.githubCommitSha
	const creator          = latest?.creator?.username
	const deployedAt       = latest?.created ? timeAgo(latest.created) : null
	const vercelProjectUrl = projectHref(latest?.inspectorUrl)
	const isError          = latest?.state === 'ERROR'

	return (
		<>
			<Card radius={2} shadow={1} tone="default">
				<Flex align="stretch" className="dvfs-card-flex">

					{/* ── Left: info column ──────────────────────────────────── */}
					<Flex direction="column" flex={1} style={{ minWidth: 0 }}>

						<Stack space={3} padding={3} style={{ flex: 1 }}>

							{/* ── Title row: name + branch + status + menu ──────── */}
							<Flex align="center" justify="space-between" gap={2}>
								<Flex align="center" gap={2} style={{ minWidth: 0, flexWrap: 'wrap' }}>
									<Text size={2} weight="semibold" style={{ flexShrink: 0 }}>{target.name}</Text>
									{branch && (
										<Badge tone="default" padding={2}>
											<Flex align="center" gap={1}>
												{branch}
												<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ marginLeft: "-0.1em", opacity: 0.5 }}>
													<path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z" />
												</svg>
											</Flex>
										</Badge>
									)}
									{token && !loadingInitial && (
										<>
											{triggering ? (
												<Flex align="center" gap={1}>
													<Spinner muted />
													<Badge tone="caution" padding={2}>Triggering…</Badge>
												</Flex>
											) : (
												<StatusBadge state={latest?.state} showSpinner />
											)}
											{isActive && elapsed > 0 ? (
												<Flex align="center" gap={1}>
													<ClockIcon />
													<Text size={1} muted>{formatDuration(elapsed)}</Text>
												</Flex>
											) : (!isActive && deployedAt) ? (
												<Text size={1} muted>{deployedAt}</Text>
											) : null}
										</>
									)}
								</Flex>
								<MenuButton
									button={<Button mode="ghost" icon={EllipsisVerticalIcon} padding={2} />}
									id={`menu-${target._id}`}
									menu={
										<Menu>
											<MenuItem
												text="Edit target"
												icon={EditIcon}
												onClick={() => onEdit(target)}
											/>
											<MenuItem
												text="History"
												icon={ClockIcon}
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
											{vercelProjectUrl && (
												<MenuItem
													text="Open in Vercel"
													icon={LaunchIcon}
													as="a"
													href={vercelProjectUrl}
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

							{/* ── Divider below title ────────────────────────────── */}
							<hr style={{ border: 'none', borderTop: '1px solid currentColor', opacity: 0.1, margin: 0 }} />

							{/* ── Status + metadata ──────────────────────────────── */}
							{!token ? (
								<Text size={1} muted>Connect a Vercel API token to see deployment status.</Text>
							) : loadingInitial ? (
								<Flex align="center" gap={2}>
									<Spinner muted />
									<Text size={1} muted>Loading…</Text>
								</Flex>
							) : (
								<Stack space={2}>

									{/* Metadata row */}
									<Flex align="center" gap={2} wrap="wrap">

										{/* Visit link + copy URL */}
										{latest?.url && latest.state === 'READY' && (
											<>
												<a
													href={`https://${latest.url}`}
													target="_blank"
													rel="noreferrer"
													style={{ color: 'inherit' }}
												>
													<Flex align="center" gap={1}>
														<Text size={1}>{latest.url}</Text>
													</Flex>
												</a>
											</>
										)}

										{/* Commit SHA — tooltip shows full message */}
										{sha && (
											<Tooltip
												content={
													<Box padding={2}>
														<Text size={1}>{commitMsg ?? sha}</Text>
													</Box>
												}
												portal
											>
												<Text
													size={1}
													muted
													style={{ cursor: 'default', fontFamily: 'monospace' }}
												>
													{sha}
												</Text>
											</Tooltip>
										)}

										{/* Creator */}
										{creator && <Text size={1} muted>by {creator}</Text>}

										{/* Visit link + copy URL */}
										{latest?.url && latest.state === 'READY' && (
											<>
												<Tooltip
													content={
														<Box padding={2}>
															<Text size={1}>{copied ? 'Copied!' : 'Copy URL'}</Text>
														</Box>
													}
													portal
												>
													<Button
														mode="ghost"
														icon={copied ? CheckmarkIcon : CopyIcon}
														padding={1}
														tone={copied ? 'positive' : 'default'}
														onClick={copyUrl}
														style={{ cursor: 'pointer' }}
													/>
												</Tooltip>
											</>
										)}
									</Flex>

									<Flex align="center" gap={2} wrap="wrap">
										{/* Commit message */}
										{commitMsg && (
											<Text
												size={0}
												muted
												style={{ fontStyle: 'italic'}}
											>
												{commitMsg}
											</Text>
										)}

										{/* Error expansion */}
										{isError && (
											<Stack space={2}>
												<Button
													text={showErrorLogs ? 'Hide error details' : 'Show error details'}
													mode="ghost"
													tone="critical"
													icon={WarningOutlineIcon}
													fontSize={1}
													padding={2}
													onClick={toggleErrorLogs}
													style={{ alignSelf: 'flex-start', cursor: 'pointer' }}
												/>
												{showErrorLogs && (
													<Card tone="critical" radius={2} padding={3}>
														{loadingLogs && (
															<Flex align="center" gap={2}>
																<Spinner muted />
																<Text size={1} muted>Loading logs…</Text>
															</Flex>
														)}
														{logError && (
															<Stack space={2}>
																<Text size={1}>{logError}</Text>
																{safeHref(latest?.inspectorUrl) && (
																	<a href={safeHref(latest?.inspectorUrl)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
																		<Flex align="center" gap={1}>
																			<LaunchIcon />
																			<Text size={1}>View full logs in Vercel</Text>
																		</Flex>
																	</a>
																)}
															</Stack>
														)}
														{!loadingLogs && !logError && errorLines.length > 0 && (
															<Stack space={2}>
																<Box style={{ maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
																	{errorLines.map((line, i) => (
																		<Code key={i} size={1} style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
																			{line}
																		</Code>
																	))}
																</Box>
																{safeHref(latest?.inspectorUrl) && (
																	<a href={safeHref(latest?.inspectorUrl)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
																		<Flex align="center" gap={1}>
																			<LaunchIcon />
																			<Text size={1}>View full logs in Vercel</Text>
																		</Flex>
																	</a>
																)}
															</Stack>
														)}
													</Card>
												)}
											</Stack>
										)}

										{/* Trigger error */}
										{deployError && (
											<Card tone="critical" padding={2} radius={2}>
												<Text size={1}>{deployError}</Text>
											</Card>
										)}
									</Flex>
								</Stack>
							)}

						</Stack>

						{/* ── Details accordion — flush to left/bottom/right ─────── */}
						<Box>
							<Button
								mode="ghost"
								iconRight={showDetails ? ChevronUpIcon : ChevronDownIcon}
								text="Details"
								fontSize={0}
								padding={3}
								onClick={() => setShowDetails(v => !v)}
								style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, cursor: 'pointer' }}
							/>
							{showDetails && (
								<Card tone="primary" padding={3} style={{ borderRadius: 0 }}>
									<Stack space={2}>
										<Flex gap={2} align="center">
											<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Project</Text>
											<Text size={0} muted style={{ fontFamily: 'monospace' }}>{projectId || '—'}</Text>
										</Flex>
										<Flex gap={2} align="center">
											<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Hook</Text>
											<Text size={0} muted style={{ fontFamily: 'monospace' }}>{hookId || '—'}</Text>
										</Flex>
										{target.teamId && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Team</Text>
												<Text size={0} muted style={{ fontFamily: 'monospace' }}>{target.teamId}</Text>
											</Flex>
										)}
										{fullSha && (
											<Flex gap={2} align="flex-start">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Commit</Text>
												<Text size={0} muted style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{fullSha}</Text>
											</Flex>
										)}
										{latest?.meta?.githubCommitAuthorName && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Author</Text>
												<Text size={0} muted>{latest.meta.githubCommitAuthorName}</Text>
											</Flex>
										)}
										{branch && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Branch</Text>
												<Text size={0} muted style={{ fontFamily: 'monospace' }}>{branch}</Text>
											</Flex>
										)}
										{latest?.uid && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Deploy ID</Text>
												<Text size={0} muted style={{ fontFamily: 'monospace' }}>{latest.uid}</Text>
											</Flex>
										)}
										{latest?.url && (
											<Flex gap={2} align="flex-start">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>URL</Text>
												<Text size={0} muted style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{latest.url}</Text>
											</Flex>
										)}
										{safeHref(latest?.inspectorUrl) && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Inspector</Text>
												<a href={safeHref(latest?.inspectorUrl)!} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
													<Flex align="center" gap={1}>
														<Text size={0} muted style={{ fontFamily: 'monospace' }}>Open in Vercel</Text>
														<LaunchIcon style={{ width: 10, height: 10 }} />
													</Flex>
												</a>
											</Flex>
										)}
										{latest?.created && (
											<Flex gap={2} align="center">
												<Text size={0} muted weight="semibold" style={{ minWidth: LABEL_WIDTH }}>Created</Text>
												<Text size={0} muted>{new Date(latest.created).toLocaleString()}</Text>
											</Flex>
										)}
									</Stack>
								</Card>
							)}
						</Box>

					</Flex>

					{/* ── Right: action buttons — stretch full card height ── */}
					<Flex
						direction="column"
						gap={2}
						className="dvfs-deploy-col"
						style={{ flexShrink: 0, alignSelf: 'stretch' }}
					>
						{isActiveState(latest?.state) && (
							<Button
								text="Cancel"
								mode="ghost"
								tone="critical"
								loading={canceling}
								disabled={canceling}
								onClick={cancel}
								style={{ cursor: 'pointer' }}
							/>
						)}
						<Button
							text="Deploy"
							tone="primary"
							loading={triggering}
							disabled={isActive}
							onClick={deploy}
							style={{
								flex: 1,
								borderRadius: 0,
								borderTopRightRadius: 3,
								borderBottomRightRadius: 3,
								cursor: 'pointer',
							}}
						/>
					</Flex>

				</Flex>
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
