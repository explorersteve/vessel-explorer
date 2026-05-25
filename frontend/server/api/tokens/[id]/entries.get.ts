export default defineEventHandler(async (event) => {
  const tokenId = String(getRouterParam(event, 'id') || '')
  if (!/^\d+$/.test(tokenId)) {
    throw createError({
      statusCode: 400,
      message: 'invalid token id',
    })
  }

  return await fetchIndexerJson(`/tokens/${tokenId}/entries`)
})
