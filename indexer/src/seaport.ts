import {
  decodeEventLog,
  formatUnits,
  getAddress,
  type Hex,
} from 'viem'

export type Address = `0x${string}`

export interface ReceiptLog {
  address: Address
  data: Hex
  topics: [] | [signature: Hex, ...args: Hex[]]
  logIndex: number | bigint
}

export interface SeaportSaleMatch {
  seaportAddress: Address
  seaportLogIndex: number
  orderHash: Hex
  tokenId: bigint
  buyer: Address
  seller: Address
  paymentToken: Address | null
  paymentSymbol: string
  paymentDecimals: number | null
  paymentAmountRaw: bigint | null
}

type SeaportItem = {
  itemType: number
  token: Address
  identifier: bigint
  amount: bigint
  recipient?: Address
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const SEAPORT_ADDRESSES = new Set([
  getAddress('0x00000000006c3852cbEf3e08E8dF289169EdE581'),
  getAddress('0x00000000000006c7676171937C444f6BDe3D6282'),
  getAddress('0x0000000000000aD24e80fd803C6ac37206a45f15'),
  getAddress('0x00000000000001ad428e4906aE43D8F9852d0dD6'),
  getAddress('0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC'),
  getAddress('0x0000000000000068F116a894984e2DB1123eB395'),
])

const ERC20_METADATA = new Map<string, { symbol: string, decimals: number }>([
  [ZERO_ADDRESS, { symbol: 'ETH', decimals: 18 }],
  [getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), { symbol: 'WETH', decimals: 18 }],
  [getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), { symbol: 'USDC', decimals: 6 }],
  [getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F'), { symbol: 'DAI', decimals: 18 }],
])

export const SEAPORT_ORDER_FULFILLED_ABI = [{
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
}] as const

export function findSeaportSaleForTransfer(
  logs: ReceiptLog[],
  transfer: {
    vesselAddress: Address
    tokenId: bigint
    seller: Address
    buyer: Address
  },
): SeaportSaleMatch | null {
  const seller = getAddress(transfer.seller)
  const buyer = getAddress(transfer.buyer)
  const vesselAddress = getAddress(transfer.vesselAddress)
  const candidates: Array<SeaportSaleMatch & { score: number }> = []

  for (const log of logs) {
    const seaportAddress = safeGetAddress(log.address)
    if (!seaportAddress || !SEAPORT_ADDRESSES.has(seaportAddress)) continue

    const decoded = decodeSeaportOrderFulfilled(log)
    if (!decoded) continue

    const offer = decoded.offer.map(normalizeOfferItem)
    const consideration = decoded.consideration.map(normalizeConsiderationItem)
    const vesselItems = [
      ...offer
        .filter((item) => item.token === vesselAddress && item.identifier === transfer.tokenId)
        .map((item) => ({ ...item, side: 'offer' as const })),
      ...consideration
        .filter((item) => item.token === vesselAddress && item.identifier === transfer.tokenId)
        .map((item) => ({ ...item, side: 'consideration' as const })),
    ]

    if (!vesselItems.length) continue

    const payment = grossPayment([...offer, ...consideration])
    if (!payment) continue

    candidates.push({
      seaportAddress,
      seaportLogIndex: Number(log.logIndex),
      orderHash: decoded.orderHash,
      tokenId: transfer.tokenId,
      buyer,
      seller,
      paymentToken: payment.token,
      paymentSymbol: payment.symbol,
      paymentDecimals: payment.decimals,
      paymentAmountRaw: payment.amountRaw,
      score: scoreCandidate({
        offerer: getAddress(decoded.offerer),
        recipient: getAddress(decoded.recipient),
        vesselItems,
        buyer,
        seller,
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

export function formatSalePrice(
  sale: Pick<SeaportSaleMatch, 'paymentAmountRaw' | 'paymentDecimals' | 'paymentSymbol'>,
) {
  if (sale.paymentAmountRaw === null || sale.paymentDecimals === null) return 'mixed payment'
  return `${trimTokenAmount(formatUnits(sale.paymentAmountRaw, sale.paymentDecimals))} ${sale.paymentSymbol}`
}

function decodeSeaportOrderFulfilled(log: ReceiptLog) {
  try {
    const decoded = decodeEventLog({
      abi: SEAPORT_ORDER_FULFILLED_ABI,
      data: log.data,
      eventName: 'OrderFulfilled',
      topics: log.topics,
    })
    return decoded.args
  } catch {
    return null
  }
}

function normalizeOfferItem(item: {
  itemType: number
  token: Address
  identifier: bigint
  amount: bigint
}): SeaportItem {
  return {
    itemType: Number(item.itemType),
    token: getAddress(item.token),
    identifier: item.identifier,
    amount: item.amount,
  }
}

function normalizeConsiderationItem(item: {
  itemType: number
  token: Address
  identifier: bigint
  amount: bigint
  recipient: Address
}): SeaportItem {
  return {
    ...normalizeOfferItem(item),
    recipient: getAddress(item.recipient),
  }
}

function grossPayment(items: SeaportItem[]) {
  const paymentItems = items.filter((item) =>
    (item.itemType === 0 || item.itemType === 1) && item.amount > 0n,
  )
  if (!paymentItems.length) return null

  const tokens = new Set(
    paymentItems.map((item) => item.itemType === 0 ? ZERO_ADDRESS : getAddress(item.token)),
  )
  if (tokens.size !== 1) {
    return {
      token: null,
      symbol: 'MIXED',
      decimals: null,
      amountRaw: null,
    }
  }

  const token = [...tokens][0] as Address
  const amountRaw = paymentItems.reduce((sum, item) => sum + item.amount, 0n)
  const metadata = ERC20_METADATA.get(token) ?? {
    symbol: 'ERC20',
    decimals: 18,
  }

  return {
    token: token === ZERO_ADDRESS ? null : token,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    amountRaw,
  }
}

function scoreCandidate(values: {
  offerer: Address
  recipient: Address
  vesselItems: Array<SeaportItem & { side: 'offer' | 'consideration' }>
  buyer: Address
  seller: Address
}) {
  let score = 0
  if (values.recipient === values.buyer) score += 1

  for (const item of values.vesselItems) {
    if (item.side === 'offer' && values.offerer === values.seller) score += 4
    if (item.side === 'consideration' && values.offerer === values.buyer) score += 4
    if (item.recipient === values.buyer) score += 2
  }

  return score
}

function compareBigint(a: bigint, b: bigint) {
  if (a === b) return 0
  return a > b ? 1 : -1
}

function trimTokenAmount(value: string) {
  if (!value.includes('.')) return value
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
}

function safeGetAddress(address: Address) {
  try {
    return getAddress(address)
  } catch {
    return null
  }
}
