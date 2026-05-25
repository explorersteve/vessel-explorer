const HOLDERS_CACHE_SECONDS = 60

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, HOLDERS_CACHE_SECONDS)
  const query = getQuery(event)
  const params = new URLSearchParams()
  if (query.limit != null) params.set('limit', String(query.limit))

  return await fetchIndexerJson('/holders', params)
}, apiCacheOptions('vessel-holders', HOLDERS_CACHE_SECONDS))
