import type { StartMode } from './config.js'
import {
  cursorForActivity,
  isIncludedActivity,
  newActivitiesSinceCursor,
} from './indexer.js'
import type { BotState, VesselActivity } from './types.js'

export interface ProcessActivitiesOptions {
  excludedEventTypes: Set<string>
  startMode: StartMode
  send: (activity: VesselActivity) => Promise<void>
  save: (state: BotState) => Promise<void>
}

export async function processActivities(
  state: BotState,
  activitiesNewestFirst: VesselActivity[],
  options: ProcessActivitiesOptions,
) {
  const activities = activitiesNewestFirst.filter((activity) =>
    isIncludedActivity(activity, options.excludedEventTypes),
  )

  if (!state.cursor && options.startMode === 'latest') {
    const nextState = { cursor: activities[0] ? cursorForActivity(activities[0]) : null }
    await options.save(nextState)
    return nextState
  }

  let nextState = state
  for (const activity of newActivitiesSinceCursor(activities, state.cursor)) {
    await options.send(activity)
    nextState = { cursor: cursorForActivity(activity) }
    await options.save(nextState)
  }

  return nextState
}
