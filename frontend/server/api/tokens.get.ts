const TOKENS_CACHE_SECONDS = 10

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, TOKENS_CACHE_SECONDS)
  const query = getQuery(event)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else if (value != null) {
      params.set(key, String(value))
    }
  }

  return await fetchIndexerJson('/tokens', params)
}, apiCacheOptions('vessel-tokens', TOKENS_CACHE_SECONDS))
