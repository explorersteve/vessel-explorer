export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = new URLSearchParams()
  if (query.limit != null) params.set('limit', String(query.limit))

  return await fetchIndexerJson('/holders', params)
})
