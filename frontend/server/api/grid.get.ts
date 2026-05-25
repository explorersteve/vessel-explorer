const GRID_CACHE_SECONDS = 30

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, GRID_CACHE_SECONDS)
  return await fetchIndexerJson('/grid')
}, apiCacheOptions('vessel-grid', GRID_CACHE_SECONDS))
