const BASE = 'https://api.etherscan.io/v2/api?chainid=1'
const VESSEL_ADDRESS = '0xECb92Cc7112b80A2234936315BbB493fb48d1463'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const address = query.address as string || ''
  const page = Number(query.page) || 1
  const rawOffset = Number(query.offset ?? query.limit)
  const offset = Math.min(Number.isFinite(rawOffset) ? rawOffset : 1000, 10000)

  const config = useRuntimeConfig()
  const indexerUrl = String(config.indexerUrl || process.env.NUXT_INDEXER_URL || '').replace(/\/$/, '')
  if (indexerUrl) {
    const params = new URLSearchParams({
      page: String(page),
      offset: String(offset),
    })
    if (address) params.set('address', address)
    const response = await fetch(`${indexerUrl}/transfers?${params.toString()}`).catch(() => null)
    if (response?.ok) return await response.json()
  }

  const apiKey = config.etherscanKey as string
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      message: 'Etherscan fallback is unavailable; set NUXT_ETHERSCAN_KEY and restart the frontend',
    })
  }

  let url = `${BASE}&module=account&action=tokennfttx&contractaddress=${VESSEL_ADDRESS}&page=${page}&offset=${offset}&sort=desc&apikey=${apiKey}`
  if (address) url += `&address=${address}`

  const res = await fetch(url)
  const data = await res.json()
  if (!Array.isArray(data.result)) return []
  return data.result
})
