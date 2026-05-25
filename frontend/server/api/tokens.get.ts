import { getDatabase } from '../utils/db'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const MAX_PAGE_SIZE = 100

const sortColumns: Record<string, string> = {
  id: 'id',
  claimed: 'claimed',
  owner: 'owner_address',
  type: 'vessel_type',
  filled: 'filled',
  payloadBytes: 'payload_bytes',
  capacityBytes: 'capacity_bytes',
  colorMode: 'color_mode',
  role: 'role',
  claimBlock: 'claim_block',
  entryCount: 'entry_count',
  chosenEntry: 'chosen_entry',
  delegate: 'delegate_address',
  machineAddress: 'machine_address',
  chosenMachine: 'chosen_machine_address',
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const indexerUrl = String(config.indexerUrl || process.env.NUXT_INDEXER_URL || '').replace(/\/$/, '')
  if (indexerUrl) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, String(item))
      } else if (value != null) {
        params.set(key, String(value))
      }
    }

    const response = await fetch(`${indexerUrl}/tokens?${params.toString()}`).catch(() => null)
    if (response?.ok) return await response.json()
  }

  const sql = getDatabase()
  if (!sql) {
    throw createError({
      statusCode: 503,
      message: 'token index is unavailable; set NUXT_INDEXER_URL or configure DATABASE_URL and run pnpm db:backfill',
    })
  }

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || 50))
  const offset = (page - 1) * pageSize
  const sortKey = String(query.sort || 'id')
  const sortColumn = sortColumns[sortKey] || sortColumns.id
  const sortDir = String(query.dir).toLowerCase() === 'desc' ? 'desc' : 'asc'
  const includePayload = ['1', 'true', 'yes'].includes(String(query.includePayload || '').toLowerCase())
  const payloadSelect = includePayload ? ', encode(payload_data, \'hex\') as "payloadHex"' : ''
  const params: unknown[] = []
  const where: string[] = []

  const search = String(query.search || '').trim().toLowerCase()
  if (search) {
    if (/^\d+$/.test(search)) {
      params.push(Number(search))
      where.push(`id = $${params.length}`)
    } else if (ADDRESS_PATTERN.test(search)) {
      params.push(search)
      where.push(`owner_address = $${params.length}`)
    } else {
      where.push('false')
    }
  }

  const claim = String(query.claim || 'all')
  if (claim === 'claimed') where.push('claimed = true')
  if (claim === 'unclaimed') where.push('claimed = false')

  const filled = String(query.filled || 'all')
  if (filled === 'filled') where.push('filled = true')
  if (filled === 'empty') where.push('filled = false')

  const type = String(query.type || 'all')
  if (['capsule', 'vault', 'machine'].includes(type)) {
    params.push(type)
    where.push(`vessel_type = $${params.length}`)
  }

  const color = String(query.color || 'all')
  if (/^[0-3]$/.test(color)) {
    params.push(Number(color))
    where.push(`color_mode = $${params.length}`)
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  try {
    const countRows = await sql.unsafe(
      `select count(*)::integer as total from tokens ${whereSql}`,
      params,
    )

    const dataParams = [...params, pageSize, offset]
    const limitParam = dataParams.length - 1
    const offsetParam = dataParams.length
    const rows = await sql.unsafe(
      `
        select
          id,
          claimed,
          owner_address as "owner",
          vessel_type as "type",
          filled,
          payload_bytes as "payloadBytes",
          capacity_bytes as "capacityBytes",
          color_mode as "colorMode",
          role,
          claim_block as "claimBlock",
          entry_count as "entryCount",
          chosen_entry as "chosenEntry",
          delegate_address as "delegate",
          machine_address as "machineAddress",
          chosen_machine_address as "chosenMachine"
          ${payloadSelect}
        from tokens
        ${whereSql}
        order by ${sortColumn} ${sortDir} nulls last, id asc
        limit $${limitParam} offset $${offsetParam}
      `,
      dataParams,
    )

    return {
      rows,
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      source: 'database',
    }
  } catch (e: any) {
    if (e?.code === '42P01') {
      throw createError({
        statusCode: 503,
        message: 'database schema is missing; run pnpm db:schema or pnpm db:backfill',
      })
    }
    throw e
  }
})
