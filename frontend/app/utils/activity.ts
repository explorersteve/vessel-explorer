export interface VesselTransaction {
  hash: string
  actor?: string | null
  from: string
  to: string
  timeStamp: string
  blockNumber: string
  input: string
  isError: string
  functionName: string
  action: string
  vesselId: string | null
  buyer?: string | null
  seller?: string | null
  salePrice?: {
    amountRaw: string | null
    decimals: number | null
    symbol: string
    token: string | null
    formatted: string
  }
  detail: string
}

export interface DailyActivityDay {
  date: string
  count: number
}

export interface DailyActivityResponse {
  startDate: string
  endDate: string
  total: number
  maxCount: number
  days: DailyActivityDay[]
  source: 'ponder'
}

export async function fetchVesselActivity(page = 1, offset = 50): Promise<VesselTransaction[]> {
  const txs = await $fetch<unknown[]>('/api/activity', {
    query: { page, offset },
  })
  if (!Array.isArray(txs)) return []

  return txs.map((tx: any) => ({
    hash: tx.hash,
    actor: tx.actor ?? null,
    from: tx.from,
    to: tx.to,
    timeStamp: tx.timeStamp,
    blockNumber: tx.blockNumber,
    input: tx.input ?? '0x',
    isError: tx.isError ?? '0',
    functionName: tx.functionName ?? '',
    action: tx.action ?? tx._action ?? 'unknown',
    vesselId: tx.vesselId ?? tx._vesselId ?? null,
    buyer: tx.buyer ?? null,
    seller: tx.seller ?? null,
    salePrice: normalizeSalePrice(tx.salePrice),
    detail: tx.detail ?? tx._detail ?? tx.action ?? 'unknown',
  }))
}

function normalizeSalePrice(value: any): VesselTransaction['salePrice'] {
  if (!value || typeof value !== 'object') return undefined
  return {
    amountRaw: value.amountRaw == null ? null : String(value.amountRaw),
    decimals: value.decimals == null ? null : Number(value.decimals),
    symbol: String(value.symbol || 'MIXED'),
    token: value.token == null ? null : String(value.token),
    formatted: String(value.formatted || 'mixed payment'),
  }
}

export async function fetchDailyActivity(): Promise<DailyActivityResponse> {
  const data = await $fetch<DailyActivityResponse>('/api/activity/daily')
  const days = Array.isArray(data.days)
    ? data.days.map((day) => ({
        date: String(day.date),
        count: Number(day.count || 0),
      }))
    : []

  return {
    startDate: String(data.startDate || days[0]?.date || ''),
    endDate: String(data.endDate || days.at(-1)?.date || ''),
    total: Number(data.total || 0),
    maxCount: Number(data.maxCount || Math.max(0, ...days.map((day) => day.count))),
    days,
    source: 'ponder',
  }
}

export interface TokenTransfer {
  hash: string
  from: string
  to: string
  tokenID: string
  blockNumber: string
  timeStamp: string
}

export async function fetchVesselTransfersForAddress(address: string): Promise<TokenTransfer[]> {
  const data = await $fetch<unknown[]>('/api/transfers', {
    query: { address },
  })
  return Array.isArray(data) ? data as TokenTransfer[] : []
}
