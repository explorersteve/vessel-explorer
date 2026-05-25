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

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    dir,
  })

  return await fetchIndexerJson(`/tokens/${tokenId}/writes`, params)
})
