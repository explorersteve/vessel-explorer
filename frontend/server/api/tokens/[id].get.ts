const TOKEN_CACHE_SECONDS = 10

export default defineCachedEventHandler(async (event) => {
  setApiCacheHeaders(event, TOKEN_CACHE_SECONDS)
  const tokenId = String(getRouterParam(event, 'id') || '')
  if (!/^\d+$/.test(tokenId)) {
    throw createError({
      statusCode: 400,
      message: 'invalid token id',
    })
  }

  return await fetchIndexerJson(`/tokens/${tokenId}`)
}, apiCacheOptions('vessel-token', TOKEN_CACHE_SECONDS))
