export interface VesselTransaction {
  hash: string
  from: string
  to: string
  timeStamp: string
  blockNumber: string
  input: string
  isError: string
  functionName: string
  action: string
  vesselId: string | null
  detail: string
}

export async function fetchVesselActivity(page = 1, offset = 50): Promise<VesselTransaction[]> {
  const txs = await $fetch<unknown[]>('/api/activity', {
    query: { page, offset },
  })
  if (!Array.isArray(txs)) return []

  return txs.map((tx: any) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    timeStamp: tx.timeStamp,
    blockNumber: tx.blockNumber,
    input: tx.input ?? '0x',
    isError: tx.isError ?? '0',
    functionName: tx.functionName ?? '',
    action: tx.action ?? tx._action ?? 'unknown',
    vesselId: tx.vesselId ?? tx._vesselId ?? null,
    detail: tx.detail ?? tx._detail ?? tx.action ?? 'unknown',
  }))
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
