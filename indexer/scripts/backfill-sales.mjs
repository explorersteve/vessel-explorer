import 'dotenv/config'

import pg from 'pg'
import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  getAddress,
  http,
} from 'viem'
import { mainnet } from 'viem/chains'

const { Client } = pg

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const VESSEL_ADDRESS = getAddress('0xECb92Cc7112b80A2234936315BbB493fb48d1463')
const SEAPORT_ADDRESSES = new Set([
  getAddress('0x00000000006c3852cbEf3e08E8dF289169EdE581'),
  getAddress('0x00000000000006c7676171937C444f6BDe3D6282'),
  getAddress('0x0000000000000aD24e80fd803C6ac37206a45f15'),
  getAddress('0x00000000000001ad428e4906aE43D8F9852d0dD6'),
  getAddress('0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'),
  getAddress('0x0000000000000068F116a894984e2DB1123eB395'),
])
const ERC20_METADATA = new Map([
  [ZERO_ADDRESS, { symbol: 'ETH', decimals: 18 }],
  [getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), { symbol: 'WETH', decimals: 18 }],
  [getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), { symbol: 'USDC', decimals: 6 }],
  [getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F'), { symbol: 'DAI', decimals: 18 }],
])

const ORDER_FULFILLED_ABI = [{
  type: 'event',
  name: 'OrderFulfilled',
  inputs: [
    { name: 'orderHash', type: 'bytes32', indexed: false },
    { name: 'offerer', type: 'address', indexed: true },
    { name: 'zone', type: 'address', indexed: true },
    { name: 'recipient', type: 'address', indexed: false },
    {
      name: 'offer',
      type: 'tuple[]',
      components: [
        { name: 'itemType', type: 'uint8' },
        { name: 'token', type: 'address' },
        { name: 'identifier', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    {
      name: 'consideration',
      type: 'tuple[]',
      components: [
        { name: 'itemType', type: 'uint8' },
        { name: 'token', type: 'address' },
        { name: 'identifier', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'recipient', type: 'address' },
      ],
    },
  ],
}]

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const batchSize = positiveIntegerEnv('BACKFILL_BATCH_SIZE', 250)
const concurrency = positiveIntegerEnv('BACKFILL_CONCURRENCY', 2)
const maxRows = optionalIntegerArg('--limit')
const startBlock = optionalIntegerArg('--start-block')
const endBlock = optionalIntegerArg('--end-block')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const rpcUrl = firstRpcUrl()
const rpc = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 60_000 }),
})
const db = new Client({ connectionString: databaseUrl })

let scanned = 0
let sales = 0
let directTransfers = 0
let failures = 0
let cursorBlock = startBlock === null ? 0n : BigInt(startBlock - 1)
let cursorLog = -1

await db.connect()
try {
  for (;;) {
    const rows = await nextBatch()
    if (!rows.length) break

    for (const group of chunk(rows, concurrency)) {
      await Promise.all(group.map(processTransfer))
    }

    const last = rows.at(-1)
    cursorBlock = BigInt(last.block_number)
    cursorLog = Number(last.log_index)

    console.log(`scanned=${scanned} sales=${sales} direct=${directTransfers} failures=${failures}`)
    if (maxRows !== null && scanned >= maxRows) break
  }
} finally {
  await db.end()
}

console.log(`done scanned=${scanned} sales=${sales} direct=${directTransfers} failures=${failures} dryRun=${dryRun}`)

async function nextBatch() {
  const remainingLimit = maxRows === null ? batchSize : Math.max(0, Math.min(batchSize, maxRows - scanned))
  if (remainingLimit === 0) return []

  const params = [
    ZERO_ADDRESS,
    cursorBlock.toString(),
    cursorLog,
    remainingLimit,
  ]
  const endBlockClause = endBlock === null ? '' : 'AND t.block_number <= $5::bigint'
  if (endBlock !== null) params.push(String(endBlock))

  const result = await db.query(`
    SELECT
      t.tx_hash,
      t.log_index,
      t.block_number,
      t.token_id,
      t."from",
      t."to",
      t.timestamp,
      a.id AS activity_id
    FROM transfers t
    JOIN activity_events a
      ON a.tx_hash = t.tx_hash
      AND a.log_index = t.log_index
      AND a.token_id = t.token_id
    WHERE t."from" <> $1
      AND (t.block_number > $2::bigint OR (t.block_number = $2::bigint AND t.log_index > $3))
      ${endBlockClause}
    ORDER BY t.block_number ASC, t.log_index ASC
    LIMIT $4
  `, params)

  return result.rows
}

async function processTransfer(row) {
  scanned++
  try {
    const receipt = await rpc.getTransactionReceipt({ hash: row.tx_hash })
    const sale = findSale(receipt.logs, {
      tokenId: BigInt(row.token_id),
      seller: getAddress(row.from),
      buyer: getAddress(row.to),
    })

    if (!sale) {
      directTransfers++
      return
    }

    sales++
    if (dryRun) {
      console.log(`sale ${row.tx_hash} #${row.token_id} ${formatSalePrice(sale)}`)
      return
    }

    await db.query('BEGIN')
    await db.query(`
      INSERT INTO seaport_sales (
        activity_id,
        tx_hash,
        transfer_log_index,
        block_number,
        token_id,
        seaport_address,
        seaport_log_index,
        order_hash,
        buyer,
        seller,
        payment_token,
        payment_symbol,
        payment_decimals,
        payment_amount_raw,
        timestamp
      ) VALUES (
        $1, $2, $3, $4::bigint, $5::bigint, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::bigint
      )
      ON CONFLICT (activity_id) DO UPDATE SET
        tx_hash = EXCLUDED.tx_hash,
        transfer_log_index = EXCLUDED.transfer_log_index,
        block_number = EXCLUDED.block_number,
        token_id = EXCLUDED.token_id,
        seaport_address = EXCLUDED.seaport_address,
        seaport_log_index = EXCLUDED.seaport_log_index,
        order_hash = EXCLUDED.order_hash,
        buyer = EXCLUDED.buyer,
        seller = EXCLUDED.seller,
        payment_token = EXCLUDED.payment_token,
        payment_symbol = EXCLUDED.payment_symbol,
        payment_decimals = EXCLUDED.payment_decimals,
        payment_amount_raw = EXCLUDED.payment_amount_raw,
        timestamp = EXCLUDED.timestamp
    `, [
      row.activity_id,
      row.tx_hash,
      Number(row.log_index),
      String(row.block_number),
      String(row.token_id),
      sale.seaportAddress,
      sale.seaportLogIndex,
      sale.orderHash,
      sale.buyer,
      sale.seller,
      sale.paymentToken,
      sale.paymentSymbol,
      sale.paymentDecimals,
      sale.paymentAmountRaw === null ? null : sale.paymentAmountRaw.toString(),
      String(row.timestamp),
    ])

    await db.query(`
      UPDATE activity_events
      SET
        type = 'sale',
        source_event = 'OrderFulfilled',
        actor = $2,
        "from" = $3,
        "to" = $4
      WHERE id = $1
    `, [row.activity_id, sale.buyer, sale.seller, sale.buyer])
    await db.query('COMMIT')
  } catch (error) {
    failures++
    await db.query('ROLLBACK').catch(() => undefined)
    console.error(`failed ${row.tx_hash} #${row.token_id}`, error instanceof Error ? error.message : error)
  }
}

function findSale(logs, transfer) {
  const candidates = []

  for (const log of logs) {
    const seaportAddress = safeAddress(log.address)
    if (!seaportAddress || !SEAPORT_ADDRESSES.has(seaportAddress)) continue

    const decoded = decodeOrderFulfilled(log)
    if (!decoded) continue

    const offer = decoded.offer.map(normalizeOfferItem)
    const consideration = decoded.consideration.map(normalizeConsiderationItem)
    const vesselItems = [
      ...offer
        .filter((item) => item.token === VESSEL_ADDRESS && item.identifier === transfer.tokenId)
        .map((item) => ({ ...item, side: 'offer' })),
      ...consideration
        .filter((item) => item.token === VESSEL_ADDRESS && item.identifier === transfer.tokenId)
        .map((item) => ({ ...item, side: 'consideration' })),
    ]
    if (!vesselItems.length) continue

    const payment = grossPayment([...offer, ...consideration])
    if (!payment) continue

    candidates.push({
      seaportAddress,
      seaportLogIndex: Number(log.logIndex),
      orderHash: decoded.orderHash,
      tokenId: transfer.tokenId,
      buyer: transfer.buyer,
      seller: transfer.seller,
      paymentToken: payment.token,
      paymentSymbol: payment.symbol,
      paymentDecimals: payment.decimals,
      paymentAmountRaw: payment.amountRaw,
      score: scoreCandidate({
        offerer: getAddress(decoded.offerer),
        recipient: getAddress(decoded.recipient),
        vesselItems,
        buyer: transfer.buyer,
        seller: transfer.seller,
      }),
    })
  }

  candidates.sort((a, b) =>
    b.score - a.score
    || compareBigint(b.paymentAmountRaw ?? 0n, a.paymentAmountRaw ?? 0n)
    || a.seaportLogIndex - b.seaportLogIndex,
  )
  const best = candidates[0]
  if (!best) return null
  const { score: _score, ...sale } = best
  return sale
}

function decodeOrderFulfilled(log) {
  try {
    return decodeEventLog({
      abi: ORDER_FULFILLED_ABI,
      data: log.data,
      eventName: 'OrderFulfilled',
      topics: log.topics,
    }).args
  } catch {
    return null
  }
}

function normalizeOfferItem(item) {
  return {
    itemType: Number(item.itemType),
    token: getAddress(item.token),
    identifier: item.identifier,
    amount: item.amount,
  }
}

function normalizeConsiderationItem(item) {
  return {
    ...normalizeOfferItem(item),
    recipient: getAddress(item.recipient),
  }
}

function grossPayment(items) {
  const paymentItems = items.filter((item) =>
    (item.itemType === 0 || item.itemType === 1) && item.amount > 0n,
  )
  if (!paymentItems.length) return null

  const tokens = new Set(paymentItems.map((item) =>
    item.itemType === 0 ? ZERO_ADDRESS : getAddress(item.token),
  ))
  if (tokens.size !== 1) {
    return {
      token: null,
      symbol: 'MIXED',
      decimals: null,
      amountRaw: null,
    }
  }

  const token = [...tokens][0]
  const amountRaw = paymentItems.reduce((sum, item) => sum + item.amount, 0n)
  const metadata = ERC20_METADATA.get(token) ?? { symbol: 'ERC20', decimals: 18 }
  return {
    token: token === ZERO_ADDRESS ? null : token,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    amountRaw,
  }
}

function scoreCandidate(values) {
  let score = 0
  if (values.recipient === values.buyer) score += 1
  for (const item of values.vesselItems) {
    if (item.side === 'offer' && values.offerer === values.seller) score += 4
    if (item.side === 'consideration' && values.offerer === values.buyer) score += 4
    if (item.recipient === values.buyer) score += 2
  }
  return score
}

function formatSalePrice(sale) {
  if (sale.paymentAmountRaw === null || sale.paymentDecimals === null) return 'mixed payment'
  const value = formatUnits(sale.paymentAmountRaw, sale.paymentDecimals)
  return `${value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')} ${sale.paymentSymbol}`
}

function compareBigint(a, b) {
  if (a === b) return 0
  return a > b ? 1 : -1
}

function safeAddress(address) {
  try {
    return getAddress(address)
  } catch {
    return null
  }
}

function firstRpcUrl() {
  return [
    process.env.ETH_RPC_URL,
    process.env.PONDER_RPC_URLS_1?.split(/\s+/)[0],
    process.env.PONDER_RPC_FALLBACK_URLS_1?.split(/\s+/)[0],
    'https://ethereum-rpc.publicnode.com',
  ].find(Boolean)
}

function chunk(values, size) {
  const groups = []
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size))
  }
  return groups
}

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function optionalIntegerArg(name) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}
