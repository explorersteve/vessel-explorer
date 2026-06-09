import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.js'
import { processActivities } from './bot.js'
import { buildDiscordPayload, sendWithRetry } from './discord.js'
import { fetchActivity } from './indexer.js'
import { readState, writeState } from './state.js'
import type { Config } from './config.js'
import type { BotState, VesselActivity } from './types.js'

let config: Config | null = null

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
    await sleep(activeConfig.pollIntervalMs)
  }

  console.log('vessel discord bot stopped')
}

export async function pollOnce(state: BotState): Promise<BotState> {
  const activeConfig = getConfig()
  const activities = await fetchActivity(activeConfig.indexerUrl, 100)
  return await processActivities(state, activities, {
    excludedEventTypes: activeConfig.excludedEventTypes,
    startMode: activeConfig.startMode,
    send: sendActivity,
    save: (nextState) => writeState(activeConfig.stateFile, nextState),
  })
}

async function sendActivity(activity: VesselActivity) {
  const activeConfig = getConfig()
  const payload = buildDiscordPayload(activity, activeConfig.vesselBaseUrl)
  await sendWithRetry(activeConfig.discordWebhookUrl, payload)
  console.log(`sent ${activity.action} #${activity.vesselId} ${activity.hash}`)
}

function getConfig() {
  config ??= loadConfig()
  return config
}

function isEntrypoint() {
  const entrypoint = process.argv[1]
  return Boolean(entrypoint && import.meta.url === pathToFileURL(entrypoint).href)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
