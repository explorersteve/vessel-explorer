export interface VesselActivity {
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
  craftType: string | null
  entry: number | null
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

export interface ActivityCursor {
  blockNumber: string
  hash: string
  action: string
  vesselId: string
}

export interface BotState {
  cursor: ActivityCursor | null
  lastSummaryWindowEnd: number | null
  lastForcedSummaryWindowEnd: number | null
}

export interface ProtocolStats {
  tokens: {
    total: number
    claimed: number
    filled: number
    claimedCapacityBytes: number
    filledBytes: number
    uniqueHolders: number
  }
}
