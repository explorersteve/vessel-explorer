import { createPublicClient, getAddress, http, type Address, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { shortenAddress } from './discord.js'

export interface EnsResolver {
  displayName(address: string): Promise<string>
}

export function createEnsResolver(rpcUrl: string): EnsResolver {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })
  return new ViemEnsResolver(client)
}

class ViemEnsResolver implements EnsResolver {
  private cache = new Map<string, string>()

  constructor(private client: PublicClient) {}

  async displayName(address: string) {
    const fallback = shortenAddress(address)
    let normalized: Address
    try {
      normalized = getAddress(address)
    } catch {
      return fallback
    }

    const key = normalized.toLowerCase()
    const cached = this.cache.get(key)
    if (cached) return cached

    try {
      const ensName = await this.client.getEnsName({ address: normalized })
      const display = ensName || fallback
      this.cache.set(key, display)
      return display
    } catch {
      this.cache.set(key, fallback)
      return fallback
    }
  }
}
