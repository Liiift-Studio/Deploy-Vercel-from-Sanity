// Vercel API token setup — stores token in secrets.vercelDeploy Sanity document
import { useState, useCallback } from 'react'
import { useClient } from 'sanity'
import {
	Card, Box, Stack, Text, Heading, TextInput, Button, Flex,
} from '@sanity/ui'
import { KeyIcon, CheckmarkCircleIcon } from '@sanity/icons'

interface TokenSetupProps {
	/** Called after the token is successfully saved */
	onSaved: () => void
}

const TOKEN_DOC_ID = 'secrets.vercelDeploy'

export function TokenSetup({ onSaved }: TokenSetupProps) {
	const client = useClient({ apiVersion: '2025-01-01' })
	const [token, setToken] = useState('')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const save = useCallback(async () => {
		if (!token.trim()) return
		setSaving(true)
		setError(null)
		try {
			await client.createOrReplace({
				_id: TOKEN_DOC_ID,
				_type: 'vercelDeploy.config',
				accessToken: token.trim(),
			})
			onSaved()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save token')
		} finally {
			setSaving(false)
		}
	}, [client, token, onSaved])

	return (
		<Card height="fill" tone="transparent">
			<Flex align="center" justify="center" height="fill" padding={6}>
				<Card padding={5} radius={3} shadow={1} style={{ maxWidth: 480, width: '100%' }}>
					<Stack space={5}>
						<Flex align="center" gap={3}>
							<Text size={3}><KeyIcon /></Text>
							<Heading size={2}>Connect to Vercel</Heading>
						</Flex>

						<Stack space={3}>
							<Text size={1} muted>
								A Vercel API token is required to read deployment status, history, and build logs.
								Your token is stored securely in the Sanity dataset under a{' '}
								<code>secrets.*</code> document ID that is not publicly readable.
							</Text>
							<Text size={1} muted>
								Create a token at{' '}
								<strong>vercel.com → Settings → Tokens</strong>.
								Choose <strong>Full Account</strong> scope.
							</Text>
						</Stack>

						<Stack space={3}>
							<Text size={1} weight="semibold">Vercel API Token</Text>
							<TextInput
								value={token}
								onChange={e => setToken((e.target as HTMLInputElement).value)}
								placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
								type="password"
							/>
						</Stack>

						{error && (
							<Card tone="critical" padding={3} radius={2}>
								<Text size={1}>{error}</Text>
							</Card>
						)}

						<Button
							text="Save and connect"
							tone="primary"
							icon={CheckmarkCircleIcon}
							loading={saving}
							disabled={!token.trim() || saving}
							onClick={save}
						/>
					</Stack>
				</Card>
			</Flex>
		</Card>
	)
}
