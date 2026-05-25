const STATS_CACHE_SECONDS = 30

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, STATS_CACHE_SECONDS)
  return await fetchIndexerJson('/stats')
}, apiCacheOptions('vessel-stats', STATS_CACHE_SECONDS))
