export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const indexerUrl = String(config.indexerUrl || process.env.NUXT_INDEXER_URL || '').replace(/\/$/, '')

  if (!indexerUrl) {
    throw createError({
      statusCode: 503,
      message: 'token index is unavailable; set NUXT_INDEXER_URL',
    })
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else if (value != null) {
      params.set(key, String(value))
    }
  }

  const response = await fetch(`${indexerUrl}/tokens?${params.toString()}`).catch(() => null)
  if (response?.ok) return await response.json()

  throw createError({
    statusCode: 502,
    message: response
      ? `token index request failed: ${response.statusText}`
      : 'token index request failed',
  })
})
