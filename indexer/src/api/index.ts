import { Hono } from 'hono'
import { client, graphql, sql } from 'ponder'
import { db } from 'ponder:api'
import schema, {
  activityEvent,
  payloadWrite,
  protocol,
  token,
  transfer,
  vesselEntry,
} from 'ponder:schema'

const app = new Hono()

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_PAGE_SIZE = 250
const MAX_ACTIVITY_SIZE = 1000
const MAX_WRITE_SIZE = 500
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

const tokenSortColumns: Record<string, string> = {
  id: 'token_id',
  claimed: 'claimed',
  owner: 'owner',
  type: 'vessel_type',
  filled: 'filled',
  payloadBytes: 'payload_bytes',
  capacityBytes: 'capacity_bytes',
  colorMode: 'color_mode',
  role: 'role',
  claimBlock: 'claim_block',
  entryCount: 'entry_count',
  chosenEntry: 'chosen_entry',
  delegate: 'delegate',
  machineAddress: 'machine',
  chosenMachine: 'chosen_machine',
}

app.use('/sql/*', client({ db, schema }))

app.get('/tokens', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(c.req.query('pageSize')) || 50),
  )
  const offset = (page - 1) * pageSize
  const sortKey = c.req.query('sort') || 'id'
  const sortColumn = tokenSortColumns[sortKey] || tokenSortColumns.id
  const sortDir = c.req.query('dir')?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const includePayload = ['1', 'true', 'yes'].includes(
    (c.req.query('includePayload') || '').toLowerCase(),
  )

  const conds = tokenFilters(c)
  const whereClause = andClause(conds)
  const orderColumn = sql.raw(sortColumn)
  const orderDirection = sql.raw(sortDir)
  const payloadSelect = includePayload
    ? sql`, payload_hex AS "payloadHex"`
    : sql``

  const [countResult, rowsResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::integer AS total
      FROM ${token}
      WHERE ${whereClause}
    `),
    db.execute(sql`
      SELECT
        token_id::integer AS id,
        claimed,
        owner,
        vessel_type AS type,
        filled,
        payload_bytes AS "payloadBytes",
        capacity_bytes AS "capacityBytes",
        color_mode AS "colorMode",
        role,
        claim_block AS "claimBlock",
        entry_count AS "entryCount",
        chosen_entry AS "chosenEntry",
        delegate,
        machine AS "machineAddress",
        chosen_machine AS "chosenMachine"
        ${payloadSelect}
      FROM ${token}
      WHERE ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection} NULLS LAST, token_id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
  ])

  return c.json({
    rows: normalizeRows(rowsResult).map(normalizeTokenRow),
    total: Number(normalizeRows(countResult)[0]?.total ?? 0),
    page,
    pageSize,
    source: 'ponder',
  })
})

app.get('/tokens/:id{[0-9]+}', async (c) => {
  const id = BigInt(c.req.param('id'))
  const rows = await db
    .select()
    .from(token)
    .where(sql`${token.token_id} = ${id}`)
    .limit(1)
  const row = rows[0]
  if (!row) return c.json({ error: 'token not found' }, 404)

  return c.json({
    ...normalizeTokenRow({
      id: Number(row.token_id),
      claimed: row.claimed,
      owner: row.owner,
      type: row.vessel_type,
      filled: row.filled,
      payloadBytes: row.payload_bytes,
      capacityBytes: row.capacity_bytes,
      colorMode: row.color_mode,
      role: row.role,
      claimBlock: row.claim_block,
      entryCount: row.entry_count,
      chosenEntry: row.chosen_entry,
      delegate: row.delegate,
      machineAddress: row.machine,
      chosenMachine: row.chosen_machine,
      payloadHex: row.payload_hex,
    }),
    locked: row.locked,
    lockBlock: row.lock_block?.toString() ?? null,
    isVault: row.is_vault,
    isMachine: row.is_machine,
    firstClaimedAt: row.first_claimed_at?.toString() ?? null,
    lastPayloadAt: row.last_payload_at?.toString() ?? null,
    lastTransferAt: row.last_transfer_at?.toString() ?? null,
    updatedAt: row.updated_at.toString(),
    blockNumber: row.block_number.toString(),
  })
})

app.get('/tokens/:id{[0-9]+}/entries', async (c) => {
  const id = BigInt(c.req.param('id'))
  const result = await db.execute(sql`
    SELECT
      entry_index AS "entryIndex",
      payload_hex AS "payloadHex",
      payload_bytes AS "payloadBytes",
      tx_hash AS "txHash",
      block_number AS "blockNumber",
      log_index AS "logIndex",
      timestamp
    FROM ${vesselEntry}
    WHERE token_id = ${id}
    ORDER BY entry_index ASC
  `)

  return c.json({
    rows: normalizeRows(result).map((row) => ({
      entryIndex: Number(row.entryIndex),
      payloadHex: row.payloadHex,
      payloadBytes: Number(row.payloadBytes),
      txHash: row.txHash,
      blockNumber: stringify(row.blockNumber),
      logIndex: row.logIndex == null ? null : Number(row.logIndex),
      timestamp: stringify(row.timestamp),
    })),
  })
})

app.get('/tokens/:id{[0-9]+}/writes', async (c) => {
  const id = BigInt(c.req.param('id'))
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const limit = Math.min(
    MAX_WRITE_SIZE,
    Math.max(1, Number(c.req.query('offset') ?? c.req.query('limit')) || 50),
  )
  const offset = (page - 1) * limit
  const sortDir = c.req.query('dir')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const orderDirection = sql.raw(sortDir)

  const [countResult, rowsResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::integer AS total
      FROM ${payloadWrite}
      WHERE token_id = ${id}
    `),
    db.execute(sql`
      SELECT
        id,
        token_id AS "tokenId",
        entry_index AS "entryIndex",
        payload_hex AS "payloadHex",
        payload_bytes AS "payloadBytes",
        writer,
        tx_hash AS "txHash",
        block_number AS "blockNumber",
        log_index AS "logIndex",
        timestamp
      FROM ${payloadWrite}
      WHERE token_id = ${id}
      ORDER BY block_number ${orderDirection}, log_index ${orderDirection}
      LIMIT ${limit} OFFSET ${offset}
    `),
  ])

  return c.json({
    rows: normalizeRows(rowsResult).map((row) => ({
      id: row.id,
      tokenId: stringify(row.tokenId),
      entryIndex: row.entryIndex == null ? null : Number(row.entryIndex),
      payloadHex: row.payloadHex,
      payloadBytes: Number(row.payloadBytes),
      writer: row.writer ?? null,
      txHash: row.txHash,
      blockNumber: stringify(row.blockNumber),
      logIndex: row.logIndex == null ? null : Number(row.logIndex),
      timestamp: stringify(row.timestamp),
    })),
    total: Number(normalizeRows(countResult)[0]?.total ?? 0),
    page,
    limit,
  })
})

app.get('/activity', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const limit = Math.min(
    MAX_ACTIVITY_SIZE,
    Math.max(1, Number(c.req.query('offset') ?? c.req.query('limit')) || 50),
  )
  const offset = (page - 1) * limit
  const conds = activityFilters(c)
  const whereClause = andClause(conds)

  const result = await db.execute(sql`
    SELECT *
    FROM ${activityEvent}
    WHERE ${whereClause}
    ORDER BY timestamp DESC, block_number DESC, log_index DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  return c.json(normalizeRows(result).map(activityToExplorerTx))
})

app.get('/transfers', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const limit = Math.min(
    10_000,
    Math.max(1, Number(c.req.query('offset') ?? c.req.query('limit')) || 1000),
  )
  const offset = (page - 1) * limit
  const address = (c.req.query('address') || '').trim()
  const conds = []
  if (ADDRESS_PATTERN.test(address)) {
    conds.push(sql`(lower("from") = lower(${address}) OR lower("to") = lower(${address}))`)
  }
  const whereClause = andClause(conds)

  const result = await db.execute(sql`
    SELECT
      tx_hash AS hash,
      "from",
      "to",
      token_id AS "tokenID",
      block_number AS "blockNumber",
      timestamp AS "timeStamp"
    FROM ${transfer}
    WHERE ${whereClause}
    ORDER BY block_number DESC, log_index DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  return c.json(
    normalizeRows(result).map((row) => ({
      hash: row.hash,
      from: row.from,
      to: row.to,
      tokenID: stringify(row.tokenID),
      blockNumber: stringify(row.blockNumber),
      timeStamp: stringify(row.timeStamp),
    })),
  )
})

app.get('/holders', async (c) => {
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit')) || 100))
  const result = await db.execute(sql`
    SELECT
      owner AS address,
      COUNT(*)::integer AS count,
      COUNT(*) FILTER (WHERE vessel_type = 'machine')::integer AS machines,
      COUNT(*) FILTER (WHERE vessel_type = 'vault')::integer AS vaults,
      COUNT(*) FILTER (WHERE vessel_type = 'capsule')::integer AS capsules,
      COUNT(*) FILTER (WHERE filled = false)::integer AS empty
    FROM ${token}
    WHERE claimed = true AND owner IS NOT NULL
    GROUP BY owner
    ORDER BY count DESC, owner ASC
    LIMIT ${limit}
  `)

  return c.json({ rows: normalizeRows(result) })
})

app.get('/stats', async (c) => {
  const [protocolResult, tokenResult, activityResult] = await Promise.all([
    db.execute(sql`SELECT * FROM ${protocol} WHERE id = 'main' LIMIT 1`),
    db.execute(sql`
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE claimed = true)::integer AS claimed,
        COUNT(*) FILTER (WHERE filled = true)::integer AS filled,
        COUNT(*) FILTER (WHERE vessel_type = 'machine')::integer AS machines,
        COUNT(*) FILTER (WHERE vessel_type = 'vault')::integer AS vaults,
        COUNT(*) FILTER (WHERE vessel_type = 'capsule')::integer AS capsules
      FROM ${token}
    `),
    db.execute(sql`
      SELECT type, COUNT(*)::integer AS count
      FROM ${activityEvent}
      GROUP BY type
      ORDER BY count DESC
    `),
  ])

  return c.json({
    protocol: normalizeRows(protocolResult)[0] ?? null,
    tokens: normalizeRows(tokenResult)[0] ?? null,
    activity: normalizeRows(activityResult),
  })
})

app.use('/', graphql({ db, schema }))
app.use('/graphql', graphql({ db, schema }))

export default app

type Row = Record<string, unknown>

function normalizeRows(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[]
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: Row[] }).rows
  }
  return []
}

function tokenFilters(c: { req: { query: (key: string) => string | undefined } }) {
  const conds = [sql`true`]
  const search = (c.req.query('search') || '').trim().toLowerCase()

  if (search) {
    if (/^\d+$/.test(search)) {
      conds.push(sql`token_id = ${BigInt(search)}`)
    } else if (ADDRESS_PATTERN.test(search)) {
      conds.push(sql`lower(owner) = lower(${search})`)
    } else {
      conds.push(sql`false`)
    }
  }

  const claim = c.req.query('claim') || 'all'
  if (claim === 'claimed') conds.push(sql`claimed = true`)
  if (claim === 'unclaimed') conds.push(sql`claimed = false`)

  const filled = c.req.query('filled') || 'all'
  if (filled === 'filled') conds.push(sql`filled = true`)
  if (filled === 'empty') conds.push(sql`filled = false`)

  const type = c.req.query('type') || 'all'
  if (['capsule', 'vault', 'machine'].includes(type)) {
    conds.push(sql`vessel_type = ${type}`)
  }

  const color = c.req.query('color') || 'all'
  if (/^[0-3]$/.test(color)) {
    conds.push(sql`color_mode = ${Number(color)}`)
  }

  return conds
}

function activityFilters(c: { req: { query: (key: string) => string | undefined } }) {
  const conds = [sql`true`]
  const tokenId = c.req.query('tokenId') || c.req.query('id')
  const address = (c.req.query('address') || '').trim()
  const type = c.req.query('type')

  if (tokenId && /^\d+$/.test(tokenId)) {
    conds.push(sql`token_id = ${BigInt(tokenId)}`)
  }
  if (ADDRESS_PATTERN.test(address)) {
    conds.push(sql`(
      lower(actor) = lower(${address})
      OR lower("from") = lower(${address})
      OR lower("to") = lower(${address})
      OR lower(delegate) = lower(${address})
      OR lower(machine) = lower(${address})
    )`)
  }
  if (type) conds.push(sql`type = ${type}`)

  return conds
}

function andClause(conds: ReturnType<typeof sql>[]) {
  if (conds.length === 0) return sql`true`
  return conds.reduce((acc, cond, index) =>
    index === 0 ? cond : sql`${acc} AND ${cond}`,
  )
}

function normalizeTokenRow(row: Row) {
  return {
    id: Number(row.id),
    claimed: Boolean(row.claimed),
    owner: row.owner ?? null,
    type: row.type ?? null,
    filled: Boolean(row.filled),
    payloadBytes: Number(row.payloadBytes ?? 0),
    capacityBytes: Number(row.capacityBytes ?? row.id ?? 0),
    colorMode: row.colorMode == null ? null : Number(row.colorMode),
    role: row.role == null ? null : Number(row.role),
    claimBlock: row.claimBlock == null ? null : Number(row.claimBlock),
    entryCount: row.entryCount == null ? null : Number(row.entryCount),
    chosenEntry: row.chosenEntry == null ? null : Number(row.chosenEntry),
    delegate: row.delegate ?? null,
    machineAddress: row.machineAddress ?? null,
    chosenMachine: row.chosenMachine ?? null,
    ...(row.payloadHex == null ? {} : { payloadHex: row.payloadHex }),
  }
}

function activityToExplorerTx(row: Row) {
  const tokenId = row.token_id == null ? null : stringify(row.token_id)
  const action = String(row.type)
  const from = row.actor ?? row.from ?? row.to ?? ZERO_ADDRESS

  return {
    hash: row.tx_hash,
    from,
    to: row.to ?? row.delegate ?? row.machine ?? ZERO_ADDRESS,
    timeStamp: stringify(row.timestamp),
    blockNumber: stringify(row.block_number),
    input: '0x',
    isError: '0',
    functionName: functionNameForActivity(action),
    action,
    vesselId: tokenId,
    detail: detailForActivity(action, tokenId, row),
    _action: action,
    _vesselId: tokenId,
    _detail: detailForActivity(action, tokenId, row),
  }
}

function functionNameForActivity(action: string) {
  switch (action) {
    case 'claim':
      return 'claim(address,uint256[],bytes,address)'
    case 'write':
      return 'setPayloadHolder(uint256,bytes)'
    case 'delegate':
      return 'setDelegate(uint256,address)'
    case 'machine':
      return 'setMachineHolder(uint256,address)'
    case 'setvaultentry':
      return 'setVaultEntryHolder(uint256,uint256)'
    case 'approval':
      return 'approve(address,uint256)'
    case 'approvalforall':
      return 'setApprovalForAll(address,bool)'
    case 'metadata':
      return 'refreshMetadata(uint256)'
    default:
      return action
  }
}

function detailForActivity(action: string, tokenId: string | null, row: Row) {
  const suffix = tokenId ? ` #${tokenId}` : ''
  switch (action) {
    case 'claim':
      return `claimed${suffix}`
    case 'write':
      return `wrote ${Number(row.payload_bytes ?? 0).toLocaleString()} bytes to${suffix}`
    case 'delegate':
      return `delegated${suffix}`
    case 'machine':
      return `set machine on${suffix}`
    case 'setvaultentry':
      return `set entry ${Number(row.entry ?? 0)} on${suffix}`
    case 'transfer':
      return `transferred${suffix}`
    case 'role':
      return `set role ${Number(row.role ?? 0)}`
    case 'metadata':
      return `refreshed metadata for${suffix}`
    case 'lock':
      return 'started lock clock'
    default:
      return action
  }
}

function stringify(value: unknown) {
  return value == null ? '' : value.toString()
}
