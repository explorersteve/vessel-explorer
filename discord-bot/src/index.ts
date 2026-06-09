import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.js'
import { processActivities } from './bot.js'
import { buildDiscordPayload, sendWithRetry } from './discord.js'
import { createEnsResolver, type EnsResolver } from './ens.js'
import { fetchActivity, fetchAllActivity, fetchStats } from './indexer.js'
import { readState, writeState } from './state.js'
import { processDailySummary } from './summary.js'
import type { Config } from './config.js'
import type { BotState, VesselActivity } from './types.js'

let config: Config | null = null
let ensResolver: EnsResolver | null = null
let sendLatestOnStartPending = true

let shuttingDown = false
process.on('SIGINT', () => {
  shuttingDown = true
})
process.on('SIGTERM', () => {
  shuttingDown = true
})

if (isEntrypoint()) {
  await run()
}

async function run() {
  const activeConfig = getConfig()
  console.log('vessel discord bot starting')
  let state = await readState(activeConfig.stateFile)

  while (!shuttingDown) {
    try {
      state = await pollOnce(state)
    } catch (error) {
      console.error('poll failed', error)
    }
    try {
      state = await summarizeOnce(state)
    } catch (error) {
      console.error('daily summary failed', error)
    }
    await sleep(activeConfig.pollIntervalMs)
  }

  console.log('vessel discord bot stopped')
}

export async function pollOnce(state: BotState): Promise<BotState> {
  const activeConfig = getConfig()
  const activities = await fetchActivity(activeConfig.indexerUrl, 100)
  const shouldSendLatestOnStart = activeConfig.sendLatestOnStart && sendLatestOnStartPending
  const nextState = await processActivities(state, activities, {
    excludedEventTypes: activeConfig.excludedEventTypes,
    startMode: activeConfig.startMode,
    sendLatestOnStart: shouldSendLatestOnStart,
    send: sendActivity,
    save: (nextState) => writeState(activeConfig.stateFile, nextState),
  })
  if (shouldSendLatestOnStart) {
    sendLatestOnStartPending = false
  }
  return nextState
}

export async function summarizeOnce(state: BotState): Promise<BotState> {
  const activeConfig = getConfig()
  const nextState = await processDailySummary(state, {
    schedule: {
      enabled: activeConfig.dailySummaryEnabled,
      timeZone: activeConfig.dailySummaryTimeZone,
      hour: activeConfig.dailySummaryHour,
      minute: activeConfig.dailySummaryMinute,
      windowHours: activeConfig.dailySummaryWindowHours,
      deployedAt: activeConfig.vesselDeployedAt,
    },
    excludedEventTypes: activeConfig.excludedEventTypes,
    vesselBaseUrl: activeConfig.vesselBaseUrl,
    fetchActivities: (options) => fetchAllActivity(activeConfig.indexerUrl, options),
    fetchStats: () => fetchStats(activeConfig.indexerUrl),
    send: (payload) => sendWithRetry(activeConfig.discordWebhookUrl, payload),
    save: (nextState) => writeState(activeConfig.stateFile, nextState),
  })
  if (nextState.lastSummaryWindowEnd !== state.lastSummaryWindowEnd) {
    console.log(`sent daily summary through ${nextState.lastSummaryWindowEnd}`)
  }
  return nextState
}

async function sendActivity(activity: VesselActivity) {
  const activeConfig = getConfig()
  const actor = await getEnsResolver().displayName(activity.from)
  const payload = buildDiscordPayload(activity, activeConfig.vesselBaseUrl, actor)
  await sendWithRetry(activeConfig.discordWebhookUrl, payload)
  console.log(`sent ${activity.action} #${activity.vesselId} ${activity.hash}`)
}

function getConfig() {
  config ??= loadConfig()
  return config
}

function getEnsResolver() {
  ensResolver ??= createEnsResolver(getConfig().ethRpcUrl)
  return ensResolver
}

function isEntrypoint() {
  const entrypoint = process.argv[1]
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
