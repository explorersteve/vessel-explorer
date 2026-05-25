# Vessel Ponder Indexer

Production Ponder indexer for THE_VESSEL on Ethereum mainnet.

The indexer is the canonical data source for the explorer. It backfills the
contract from deployment block `24524524`, seeds all 10,000 vessels, stores the
current token state, and keeps historical payload writes so overwritten
capsules and vault entries can still be inspected.

## What It Indexes

- All 10,000 token rows with deterministic capacity, type, color mode, and
  claim state
- Current ownership, delegates, roles, machine addresses, chosen machines,
  vault entry counts, chosen entries, lock state, and payload size
- Current payload bytes for capsules and vaults as `payload_hex`
- Machine addresses are indexed, but live machine contract payloads/names are
  intentionally read by the frontend because they can change without
  `THE_VESSEL` emitting an event
- Every `PayloadSet` as `payload_writes`, including writer, payload bytes,
  block, log index, transaction hash, and timestamp
- Vault/capsule entry snapshots in `vessel_entries`
- Transfers, approvals, operator approvals, holders, and normalized activity
- Protocol-level state such as claimed count, lock start, default machine, and
  creator supply status

Event handlers use block-pinned contract reads where needed. That matters for
payloads: when a capsule is overwritten later, the write-history row still
contains the bytes observed at the original event block.

## Important Files

- `ponder.config.ts` configures mainnet, RPC load balancing, rate limiting,
  deployment block, and optional bounded replay blocks.
- `ponder.schema.ts` defines all indexed tables and query indexes.
- `src/index.ts` contains the contract event handlers and state refresh logic.
- `src/api/index.ts` exposes the REST API, GraphQL, and SQL endpoints.
- `docker-compose.yml` runs local Postgres on `127.0.0.1:5470`.
- `config/deploy.yml` deploys the indexer and Postgres accessory with Kamal.
- `../Dockerfile.indexer` builds the production container.

## Local Development

```bash
cd indexer
cp .env.local.example .env.local
docker compose up -d
pnpm install
pnpm codegen
pnpm dev
```

`pnpm dev` runs Ponder in development mode against the Postgres database from
`docker-compose.yml`.

Use `PONDER_RPC_URLS_1` for one or more Ethereum mainnet RPC URLs separated by
spaces. The public fallback is acceptable for smoke tests, but use a dedicated
RPC for full historical syncs. Tune providers with:

- `PONDER_RPC_REQUESTS_PER_SECOND_1`
- `PONDER_ETH_GET_LOGS_BLOCK_RANGE_1`
- `PONDER_RPC_FALLBACK_URLS_1`
- `PONDER_WS_URL_1`

## Bounded Smoke Replay

For a quick local replay around the first public claims:

```bash
DATABASE_URL=postgresql://vessel:vessel@localhost:5470/vessel \
PONDER_RPC_URLS_1=https://ethereum-rpc.publicnode.com \
PONDER_RPC_REQUESTS_PER_SECOND_1=6 \
PONDER_ETH_GET_LOGS_BLOCK_RANGE_1=250 \
VESSEL_INDEXER_START_BLOCK=24571300 \
VESSEL_INDEXER_END_BLOCK=24572000 \
pnpm ponder --log-level warn start \
  --schema=vessel_claim_smoke \
  --views-schema=vessel_claim_smoke_views
```

Leave `VESSEL_INDEXER_START_BLOCK` and `VESSEL_INDEXER_END_BLOCK` unset in
production. Production must sync from the deployment block so seeded tokens,
claim state, transfers, and historical writes are complete.

## REST API

All routes return JSON unless noted.

### `GET /tokens`

Paginated token table used by `/all`.

Query params:

- `page`, `pageSize`
- `sort`: `id`, `claimed`, `owner`, `type`, `filled`, `payloadBytes`,
  `capacityBytes`, `colorMode`, `role`, `claimBlock`, `entryCount`,
  `chosenEntry`, `delegate`, `machineAddress`, `chosenMachine`
- `dir`: `asc` or `desc`
- `search`: token ID or owner address
- `ids`: comma-separated token IDs, up to the current page-size limit
- `owner`: exact owner address
- `delegate`: exact delegate address
- `claim`: `all`, `claimed`, `unclaimed`
- `filled`: `all`, `filled`, `empty`
- `type`: `all`, `capsule`, `vault`, `machine`
- `color`: `all`, `0`, `1`, `2`, `3`
- `includePayload`: `true` to include `payloadHex`

Response shape:

```json
{
  "rows": [],
  "total": 10000,
  "page": 1,
  "pageSize": 50,
  "source": "ponder"
}
```

### `GET /tokens/:id`

Single token state, including current `payloadHex`, machine address, lock
metadata, timestamps, and machine/vault flags.

### `GET /tokens/:id/entries`

Vault/capsule entry snapshots ordered by `entryIndex`.

### `GET /tokens/:id/writes`

Historical payload writes for a token. This is the endpoint that lets the
frontend show capsule history even after later writes overwrite the current
contract payload.

Query params:

- `page`
- `limit`
- `dir`: `desc` by default, `asc` for chronological order

### `GET /activity`

Normalized activity feed. Supports filters for `type`, `tokenId`, `actor`, and
`address`.

### `GET /transfers`

Transfer history. Supports `tokenId`, `from`, `to`, and `address`.

### `GET /holders`

Current holder leaderboard derived from indexed token ownership.

### `GET /stats`

Indexer summary counts and activity type counts.

## Built-In Endpoints

Ponder exposes:

- `GET /health`
- `GET /ready`
- GraphQL at `/graphql`
- SQL at `/sql/*`

Kamal proxy cutover uses `/ready`.

## Production Deployment

Production deployment is configured with Kamal in `config/deploy.yml`.

```bash
cd indexer
cp .env.production.example .env.production
pnpm kamal:setup   # first server bootstrapping only
pnpm kamal:deploy  # normal releases
```

Kamal serves the app on port `42069`, provisions a Postgres 17 accessory, and
mounts persistent database storage at:

```txt
/home/deploy/vessel-indexer-db/data
```

`../Dockerfile.indexer` runs `pnpm codegen` during the image build. The runtime
starts Ponder with a fresh deploy schema and a stable views schema:

```bash
pnpm ponder --schema=vessel_$(git rev) --views-schema=vessel
```

This keeps old failed deploy schemas isolated while exposing stable views for
the running application.

## Environment Variables

Required in production:

- `DATABASE_URL`
- `PONDER_RPC_URLS_1`
- `INDEXER_HOST`
- `DOCKER_REGISTRY_USERNAME`
- `KAMAL_REGISTRY_PASSWORD`
- `DEPLOY_HOST`
- Postgres accessory values from `.env.production.example`

Optional:

- `PONDER_RPC_FALLBACK_URLS_1`
- `PONDER_WS_URL_1`
- `PONDER_RPC_REQUESTS_PER_SECOND_1`
- `PONDER_ETH_GET_LOGS_BLOCK_RANGE_1`
- `VESSEL_INDEXER_START_BLOCK`
- `VESSEL_INDEXER_END_BLOCK`

## Verification

After a local or production start:

```bash
curl -f http://127.0.0.1:42069/ready
curl -s http://127.0.0.1:42069/stats | jq .
curl -s 'http://127.0.0.1:42069/tokens?pageSize=3' | jq .
curl -s 'http://127.0.0.1:42069/tokens/1/writes' | jq .
```

For production, replace the host with:

```txt
https://indexer.vessel.worldcomputer.art
```

## Operational Notes

- Do not set bounded replay env vars in production.
- Keep RPC rate limits conservative when backfilling on a shared provider.
- `PayloadSet` history is intentionally append-only in `payload_writes`.
- Current token state can change, but historical write rows should not be
  rewritten except by a full schema rebuild.
- This repository intentionally does not deploy from setup or tests.
