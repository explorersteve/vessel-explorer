export default defineEventHandler(async () => {
  return await fetchIndexerJson('/stats')
})
