export type StartMode = 'latest' | 'backfill'

export interface Config {
  discordWebhookUrl: string
  indexerUrl: string
  vesselBaseUrl: string
  ethRpcUrl: string
  pollIntervalMs: number
  startMode: StartMode
  stateFile: string
  excludedEventTypes: Set<string>
}

const DEFAULT_INDEXER_URL = 'https://indexer.vessel.worldcomputer.art'
const DEFAULT_VESSEL_BASE_URL = 'https://vessel.worldcomputer.art'
const DEFAULT_ETH_RPC_URL = 'https://ethereum-rpc.publicnode.com'
const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_STATE_FILE = '/data/state.json'
const DEFAULT_EXCLUDED_EVENT_TYPES = 'transfer,metadata'

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const discordWebhookUrl = stringEnv(env, 'DISCORD_WEBHOOK_URL')
  if (!discordWebhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL is required')
  }

  const startMode = (env.START_MODE || 'latest').toLowerCase()
  if (startMode !== 'latest' && startMode !== 'backfill') {
    throw new Error('START_MODE must be "latest" or "backfill"')
  }

  return {
    discordWebhookUrl,
    indexerUrl: trimTrailingSlash(env.INDEXER_URL || DEFAULT_INDEXER_URL),
    vesselBaseUrl: trimTrailingSlash(env.VESSEL_BASE_URL || DEFAULT_VESSEL_BASE_URL),
    ethRpcUrl: env.ETH_RPC_URL || DEFAULT_ETH_RPC_URL,
    pollIntervalMs: positiveIntegerEnv(env, 'POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS),
    startMode,
    stateFile: env.STATE_FILE || DEFAULT_STATE_FILE,
    excludedEventTypes: commaSet(env.EXCLUDED_EVENT_TYPES || DEFAULT_EXCLUDED_EVENT_TYPES),
  }
}

function stringEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim()
  return value || ''
}

function positiveIntegerEnv(env: NodeJS.ProcessEnv, key: string, fallback: number) {
  const raw = env[key]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }
  return value
}

function commaSet(value: string) {
  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}
