interface HeaderStatsState {
  claimed: number | null
  claimedCapacity: number
  filledBytes: number | null
  holderCount: number
  largestHolder: { address: string; count: number } | null
  loading: boolean
  loaded: boolean
  error: string | null
}

let headerStatsRequest: Promise<void> | null = null

function defaultHeaderStats(): HeaderStatsState {
  return {
    claimed: null,
    claimedCapacity: 0,
    filledBytes: null,
    holderCount: 0,
    largestHolder: null,
    loading: false,
    loaded: false,
    error: null,
  }
}

export function useHeaderStats() {
  const stats = useState<HeaderStatsState>('vessel-header-stats', defaultHeaderStats)

  async function load(force = false) {
    if (!force && stats.value.loaded) return
    if (headerStatsRequest) return await headerStatsRequest

    stats.value = {
      ...stats.value,
      loading: true,
      error: null,
    }

    headerStatsRequest = (async () => {
      try {
        const [statsResponse, holdersResponse] = await Promise.all([
          $fetch<any>('/api/stats'),
          $fetch<{ rows: Array<{ address: string; count: number }> }>('/api/holders', {
            query: { limit: 1 },
          }),
        ])
        const tokens = statsResponse?.tokens || {}
        const top = holdersResponse?.rows?.[0]

        stats.value = {
          claimed: Number(tokens.claimed || 0),
          claimedCapacity: Number(tokens.claimedCapacityBytes || 0),
          filledBytes: Number(tokens.filledBytes || 0),
          holderCount: Number(tokens.uniqueHolders || 0),
          largestHolder: top ? { address: top.address, count: Number(top.count || 0) } : null,
          loading: false,
          loaded: true,
          error: null,
        }
      } catch {
        stats.value = {
          ...stats.value,
          loading: false,
          error: 'stats unavailable',
        }
      } finally {
        headerStatsRequest = null
      }
    })()

    return await headerStatsRequest
  }

  return { stats, loadHeaderStats: load }
}
