import { fetchAllTokenRows } from '~/utils/indexer'

export interface OwnerTokens {
  ownership: Map<string, string>
  ownerTokens: Map<string, string[]>
}

// Cache for the global (no-address) ownership fetch
let globalCache: Promise<OwnerTokens> | null = null

/**
 * Fetch indexed token ownership from Ponder.
 *
 * Returns:
 *  - ownership: Map<tokenId, ownerAddress>
 *  - ownerTokens: Map<ownerAddress, tokenId[]>
 */
export async function fetchOwnership(address?: string): Promise<OwnerTokens> {
  const normalizedAddress = address?.trim() || undefined
  if (!normalizedAddress && globalCache) return globalCache

  const promise = _fetchOwnership(normalizedAddress)
  if (!normalizedAddress) {
    globalCache = promise.catch((error) => {
      if (globalCache === promise) globalCache = null
      throw error
    })
  }
  return promise
}

async function _fetchOwnership(address?: string): Promise<OwnerTokens> {
  const rows = await fetchAllTokenRows({
    claim: 'claimed',
    owner: address,
    sort: 'id',
    dir: 'asc',
    pageSize: 250,
  })
  const ownership = new Map<string, string>()
  for (const row of rows) {
    if (row.owner) ownership.set(String(row.id), row.owner.toLowerCase())
  }

  const ownerTokens = new Map<string, string[]>()
  for (const [tokenId, owner] of ownership.entries()) {
    if (!ownerTokens.has(owner)) ownerTokens.set(owner, [])
    ownerTokens.get(owner)!.push(tokenId)
  }

  for (const tokens of ownerTokens.values()) {
    tokens.sort((a, b) => Number(a) - Number(b))
  }

  return { ownership, ownerTokens }
}

/**
 * Get token IDs owned by a specific address from a full ownership map.
 */
export function tokensOwnedBy(ownership: Map<string, string>, address: string): string[] {
  const lower = address.toLowerCase()
  return [...ownership.entries()]
    .filter(([, owner]) => owner === lower)
    .map(([id]) => id)
    .sort((a, b) => Number(a) - Number(b))
}
