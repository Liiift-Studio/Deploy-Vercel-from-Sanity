// Main deploy tool — fetches targets + token, renders per-project cards
import { useState, useEffect, useCallback } from 'react'
import { useClient } from 'sanity'
import {
	Card, Box, Stack, Flex, Text, Heading, Spinner, Button, Dialog, useToast,
} from '@sanity/ui'
import { RocketIcon, KeyIcon, TrashIcon, WarningOutlineIcon } from '@sanity/icons'
import { DeployItem } from './DeployItem'
import { TokenSetup } from './TokenSetup'
import type { DeployTarget } from '../types'

const TOKEN_QUERY = `*[_id == "secrets.vercelDeploy"][0].accessToken`
const TARGETS_QUERY = `*[_type == "vercel_deploy"] | order(_createdAt asc)`

export function DeployTool() {
	const client = useClient({ apiVersion: '2025-01-01' })
	const toast = useToast()

	const [token, setToken] = useState<string | null>(null)
	const [targets, setTargets] = useState<DeployTarget[]>([])
	const [loading, setLoading] = useState(true)
	const [showTokenSetup, setShowTokenSetup] = useState(false)
	const [pendingDelete, setPendingDelete] = useState<DeployTarget | null>(null)
	const [deleting, setDeleting] = useState(false)

	// ── Fetch token + targets ─────────────────────────────────────────────────
	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [fetchedToken, fetchedTargets] = await Promise.all([
				client.fetch<string | null>(TOKEN_QUERY),
				client.fetch<DeployTarget[]>(TARGETS_QUERY),
			])
			setToken(fetchedToken ?? null)
			setTargets(fetchedTargets)
		} catch (err) {
			console.error('deploy-vercel-from-sanity: load error', err)
		} finally {
			setLoading(false)
		}
	}, [client])

	useEffect(() => { load() }, [load])

	// Live subscription — update targets when documents change
	useEffect(() => {
		const sub = client
			.listen<DeployTarget>(TARGETS_QUERY)
			.subscribe(() => {
				client.fetch<DeployTarget[]>(TARGETS_QUERY).then(setTargets).catch(err => {
					console.error('deploy-vercel-from-sanity: subscription refresh error', err)
				})
			})
		return () => sub.unsubscribe()
	}, [client])

	// ── Delete target ─────────────────────────────────────────────────────────
	const confirmDelete = useCallback(async () => {
		if (!pendingDelete) return
		setDeleting(true)
		try {
			await client.delete(pendingDelete._id)
			setTargets(prev => prev.filter(t => t._id !== pendingDelete._id))
			toast.push({ status: 'success', title: `Deleted "${pendingDelete.name}"` })
		} catch (err) {
			toast.push({ status: 'error', title: 'Delete failed', description: String(err) })
		} finally {
			setDeleting(false)
			setPendingDelete(null)
		}
	}, [client, pendingDelete, toast])

	// ── Render ────────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<Card height="fill" tone="transparent">
				<Flex align="center" justify="center" height="fill">
					<Spinner muted />
				</Flex>
			</Card>
		)
	}

	if (!token && !showTokenSetup) {
		return <TokenSetup onSaved={() => { setShowTokenSetup(false); load() }} />
	}

	if (showTokenSetup) {
		return (
			<TokenSetup
				onSaved={() => {
					setShowTokenSetup(false)
					load()
				}}
			/>
		)
	}

	return (
		<Card height="fill" tone="transparent">
			<Box padding={5}>
				<Stack space={5}>
					{/* ── Header ──────────────────────────────────────────────── */}
					<Flex align="center" justify="space-between">
						<Flex align="center" gap={3}>
							<RocketIcon />
							<Heading size={2}>Deploy</Heading>
						</Flex>
						<Button
							text="API Token"
							mode="ghost"
							icon={KeyIcon}
							fontSize={1}
							onClick={() => setShowTokenSetup(true)}
						/>
					</Flex>

					{/* ── No targets ──────────────────────────────────────────── */}
					{targets.length === 0 && (
						<Card padding={5} radius={2} tone="transparent" shadow={1}>
							<Stack space={3} style={{ textAlign: 'center' }}>
								<Text size={2} weight="semibold">No deploy targets configured</Text>
								<Text size={1} muted>
									Create a <code>vercel_deploy</code> document in the dataset with a Vercel deploy
									hook URL, or add one via the Sanity CLI.
								</Text>
							</Stack>
						</Card>
					)}

					{/* ── Deploy targets ──────────────────────────────────────── */}
					{token && targets.map(target => (
						<DeployItem
							key={target._id}
							target={target}
							token={token}
							onDelete={setPendingDelete}
						/>
					))}
				</Stack>
			</Box>

			{/* ── Delete confirmation ─────────────────────────────────────────── */}
			{pendingDelete && (
				<Dialog
					header="Delete deploy target?"
					id="confirm-delete"
					onClose={() => setPendingDelete(null)}
					width={1}
					footer={
						<Flex padding={3} gap={2} justify="flex-end">
							<Button
								text="Cancel"
								mode="ghost"
								onClick={() => setPendingDelete(null)}
							/>
							<Button
								text="Delete"
								tone="critical"
								icon={TrashIcon}
								loading={deleting}
								disabled={deleting}
								onClick={confirmDelete}
							/>
						</Flex>
					}
				>
					<Box padding={4}>
						<Stack space={3}>
							<Flex align="center" gap={2}>
								<WarningOutlineIcon />
								<Text size={2} weight="semibold">{pendingDelete.name}</Text>
							</Flex>
							<Text size={1} muted>
								This removes the deploy target from the dataset. The Vercel deploy hook itself is
								not affected.
							</Text>
						</Stack>
					</Box>
				</Dialog>
			)}
		</Card>
	)
}
