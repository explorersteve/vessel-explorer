const TOKEN_ENTRIES_CACHE_SECONDS = 10

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, TOKEN_ENTRIES_CACHE_SECONDS)
  const tokenId = String(getRouterParam(event, 'id') || '')
  if (!/^\d+$/.test(tokenId)) {
    throw createError({
      statusCode: 400,
      message: 'invalid token id',
    })
  }

  return await fetchIndexerJson(`/tokens/${tokenId}/entries`)
}, apiCacheOptions('vessel-token-entries', TOKEN_ENTRIES_CACHE_SECONDS))
