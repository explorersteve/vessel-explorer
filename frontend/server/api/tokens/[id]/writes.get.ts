const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const tokenId = String(getRouterParam(event, 'id') || '')
  if (!/^\d+$/.test(tokenId)) {
    throw createError({
      statusCode: 400,
      message: 'invalid token id',
    })
  }

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit ?? query.offset) || 25))
  const dir = String(query.dir).toLowerCase() === 'asc' ? 'asc' : 'desc'

  const config = useRuntimeConfig()
  const indexerUrl = String(config.indexerUrl || process.env.NUXT_INDEXER_URL || '').replace(/\/$/, '')
  if (!indexerUrl) {
    throw createError({
      statusCode: 503,
      message: 'write history is unavailable; set NUXT_INDEXER_URL and restart the frontend',
    })
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    dir,
  })

  const response = await fetch(`${indexerUrl}/tokens/${tokenId}/writes?${params.toString()}`).catch(() => null)
  if (!response) {
    throw createError({
      statusCode: 502,
      message: 'indexer write history request failed',
    })
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      message: `indexer write history request failed: ${response.statusText}`,
    })
  }

  return await response.json()
})
