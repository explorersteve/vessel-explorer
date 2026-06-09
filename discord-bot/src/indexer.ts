import type { ActivityCursor, VesselActivity } from './types.js'

export async function fetchActivity(indexerUrl: string, limit = 100): Promise<VesselActivity[]> {
  const url = new URL('/activity', indexerUrl)
  url.searchParams.set('limit', String(limit))

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`indexer request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data.map(normalizeActivity).filter(Boolean) as VesselActivity[]
}

export function isIncludedActivity(
  activity: VesselActivity,
  excludedEventTypes: Set<string>,
) {
  if (!activity.vesselId) return false
  const action = activity.action.toLowerCase()
  if (excludedEventTypes.has(action)) return false
  if (activity.functionName.toLowerCase().startsWith('refreshmetadata')) return false
  return true
}

export function cursorForActivity(activity: VesselActivity): ActivityCursor {
  if (!activity.vesselId) {
    throw new Error('cannot create cursor for activity without vesselId')
  }
  return {
    blockNumber: activity.blockNumber,
    hash: activity.hash,
    action: activity.action,
    vesselId: activity.vesselId,
  }
}

export function cursorKey(cursor: ActivityCursor) {
  return [
    cursor.blockNumber,
    cursor.hash.toLowerCase(),
    cursor.action.toLowerCase(),
    cursor.vesselId,
  ].join(':')
}

export function activityKey(activity: VesselActivity) {
  return cursorKey(cursorForActivity(activity))
}

export function newActivitiesSinceCursor(
  activitiesNewestFirst: VesselActivity[],
  cursor: ActivityCursor | null,
) {
  if (!cursor) return [...activitiesNewestFirst].reverse()

  const key = cursorKey(cursor)
  const newer: VesselActivity[] = []
  for (const activity of activitiesNewestFirst) {
    if (activityKey(activity) === key) break
    newer.push(activity)
  }
  return newer.reverse()
}

function normalizeActivity(value: unknown): VesselActivity | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const hash = stringField(row.hash)
  const action = stringField(row.action ?? row._action)
  const blockNumber = stringField(row.blockNumber)
  if (!hash || !action || !blockNumber) return null

  return {
    hash,
    from: stringField(row.from),
    to: stringField(row.to),
    timeStamp: stringField(row.timeStamp),
    blockNumber,
    input: stringField(row.input) || '0x',
    isError: stringField(row.isError) || '0',
    functionName: stringField(row.functionName),
    action,
    vesselId: nullableString(row.vesselId ?? row._vesselId),
    detail: stringField(row.detail ?? row._detail),
  }
}

function stringField(value: unknown) {
  return value == null ? '' : String(value)
}

function nullableString(value: unknown) {
  const text = stringField(value)
  return text || null
}
