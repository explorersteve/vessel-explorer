import { grid } from '@visualizevalue/img-grid'
import type { H3Event } from 'h3'

const DAILY_GRID_CACHE_SECONDS = 3600
const PAGE_LIMIT = 1000

interface ActivityRow {
  action?: string
  functionName?: string
  vesselId?: string | number | null
  _vesselId?: string | number | null
}

export default defineEventHandler(async (event) => {
  const { start, end } = parseWindow(event)
  const vesselIds = await touchedVesselIds(start, end)
  const origin = getRequestURL(event).origin

  const png = await grid(vesselIds.map((id) => ({
    id,
    url: `${origin}/api/og/${id}?v=${end}`,
  })), {
    maxWidth: 1600,
    padding: 24,
    gutter: 8,
    background: '#000',
    pixelated: true,
    format: 'png',
    concurrency: 8,
    onError: (img, error) => {
      console.warn(`daily grid image failed for ${img.id ?? img.url}`, error)
    },
  })

  setResponseHeaders(event, {
    'Content-Type': 'image/png',
    'Cache-Control': `public, max-age=${DAILY_GRID_CACHE_SECONDS}, s-maxage=${DAILY_GRID_CACHE_SECONDS}`,
  })

  return png
})

function parseWindow(event: H3Event) {
  const query = getQuery(event)
  const start = positiveInteger(query.start)
  const end = positiveInteger(query.end)

  if (start == null || end == null || end <= start) {
    throw createError({ statusCode: 400, message: 'start and end must be unix seconds with end > start' })
  }

  return { start, end }
}

async function touchedVesselIds(start: number, end: number) {
  const seen = new Set<string>()

  for (let page = 1; ; page++) {
    const params = new URLSearchParams({
      startTime: String(start),
      endTime: String(end),
      limit: String(PAGE_LIMIT),
      page: String(page),
    })
    const rows = await fetchIndexerJson('/activity', params) as ActivityRow[]

    for (const row of rows) {
      if (!isIncludedActivity(row)) continue
      const vesselId = normalizeVesselId(row.vesselId ?? row._vesselId)
      if (vesselId) seen.add(vesselId)
    }

    if (rows.length < PAGE_LIMIT) break
  }

  return [...seen].sort((a, b) => Number(a) - Number(b))
}

function isIncludedActivity(row: ActivityRow) {
  const vesselId = normalizeVesselId(row.vesselId ?? row._vesselId)
  if (!vesselId) return false

  const action = String(row.action || '').toLowerCase()
  if (action === 'transfer' || action === 'metadata') return false

  const functionName = String(row.functionName || '').toLowerCase()
  if (functionName.startsWith('refreshmetadata')) return false

  return true
}

function normalizeVesselId(value: unknown) {
  if (value == null) return ''
  const text = String(value).trim()
  return /^\d+$/.test(text) ? text : ''
}

function positiveInteger(value: unknown) {
  if (Array.isArray(value)) return positiveInteger(value[0])
  if (value == null || !/^\d+$/.test(String(value))) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}
