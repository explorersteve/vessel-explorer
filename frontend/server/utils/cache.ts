import { setHeader, type H3Event } from 'h3'

export function setApiCacheHeaders(event: H3Event, maxAge: number, staleMaxAge = maxAge * 2) {
  setHeader(
    event,
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleMaxAge}`,
  )
}

export function setNoStoreHeaders(event: H3Event) {
  setHeader(event, 'Cache-Control', 'no-store, max-age=0')
}

export function apiCacheOptions(name: string, maxAge: number) {
  return {
    name,
    maxAge,
    swr: true,
  }
}
