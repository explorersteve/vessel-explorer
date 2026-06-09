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
  sendLatestOnStart: boolean
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

  if (!state.cursor && options.sendLatestOnStart && activities[0]) {
    await options.send(activities[0])
    const nextState = { ...state, cursor: cursorForActivity(activities[0]) }
    await options.save(nextState)
    return nextState
  }

  if (!state.cursor && options.startMode === 'latest') {
    const nextState = { ...state, cursor: activities[0] ? cursorForActivity(activities[0]) : null }
    await options.save(nextState)
    return nextState
  }

  const newActivities = newActivitiesSinceCursor(activities, state.cursor)
  if (options.sendLatestOnStart && activities[0] && newActivities.length === 0) {
    await options.send(activities[0])
    const nextState = { ...state, cursor: cursorForActivity(activities[0]) }
    await options.save(nextState)
    return nextState
  }

  let nextState = state
  for (const activity of newActivities) {
    await options.send(activity)
    nextState = { ...nextState, cursor: cursorForActivity(activity) }
    await options.save(nextState)
  }

  return nextState
}
