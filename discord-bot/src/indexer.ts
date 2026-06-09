import type { ActivityCursor, ProtocolStats, VesselActivity } from './types.js'

export interface FetchActivityOptions {
  limit?: number
  page?: number
  startTime?: number
  endTime?: number
}

export async function fetchActivity(
  indexerUrl: string,
  options: FetchActivityOptions | number = {},
): Promise<VesselActivity[]> {
  const resolved = typeof options === 'number' ? { limit: options } : options
  const url = new URL('/activity', indexerUrl)
  url.searchParams.set('limit', String(resolved.limit ?? 100))
  if (resolved.page !== undefined) url.searchParams.set('page', String(resolved.page))
  if (resolved.startTime !== undefined) url.searchParams.set('startTime', String(resolved.startTime))
  if (resolved.endTime !== undefined) url.searchParams.set('endTime', String(resolved.endTime))

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`indexer request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data.map(normalizeActivity).filter(Boolean) as VesselActivity[]
}

export async function fetchAllActivity(
  indexerUrl: string,
  options: Omit<FetchActivityOptions, 'page'>,
) {
  const limit = options.limit ?? 1000
  const rows: VesselActivity[] = []
  for (let page = 1; ; page++) {
    const pageRows = await fetchActivity(indexerUrl, { ...options, limit, page })
    rows.push(...pageRows)
    if (pageRows.length < limit) return rows
  }
}

export async function fetchStats(indexerUrl: string): Promise<ProtocolStats> {
  const url = new URL('/stats', indexerUrl)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`indexer stats request failed: ${response.status} ${response.statusText}`)
  }

  return normalizeStats(await response.json())
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
    craftType: nullableString(row.craftType ?? row._craftType),
    entry: numberField(row.entry),
    detail: stringField(row.detail ?? row._detail),
  }
}

function normalizeStats(value: unknown): ProtocolStats {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const tokens = row.tokens && typeof row.tokens === 'object'
    ? row.tokens as Record<string, unknown>
    : {}

  return {
    tokens: {
      total: numberField(tokens.total) ?? 0,
      claimed: numberField(tokens.claimed) ?? 0,
      filled: numberField(tokens.filled) ?? 0,
      claimedCapacityBytes: numberField(tokens.claimedCapacityBytes) ?? 0,
      filledBytes: numberField(tokens.filledBytes) ?? 0,
      uniqueHolders: numberField(tokens.uniqueHolders) ?? 0,
    },
  }
}

function stringField(value: unknown) {
  return value == null ? '' : String(value)
}

function nullableString(value: unknown) {
  const text = stringField(value)
  return text || null
}

function numberField(value: unknown) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
