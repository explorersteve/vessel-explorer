# Vessel Ponder Indexer

Ponder indexer for THE_VESSEL on Ethereum mainnet.

It indexes:

- all 10,000 token rows, including deterministic type, capacity, and color mode
- current ownership, delegates, roles, machine addresses, entries, payload bytes, and lock state
- transfer, claim, write, delegate, machine, entry, role, metadata, and approval activity
- vault/capsule payload entry snapshots at the block where writes happen
- GraphQL, SQL, and small REST routes used by the Nuxt explorer

## Local

```bash
cd indexer
cp .env.local.example .env.local
docker compose up -d
pnpm install
pnpm codegen
pnpm dev
```

Use `PONDER_RPC_URLS_1` for one or more mainnet RPC URLs separated by spaces.
The public fallback is enough for smoke tests but a dedicated RPC is strongly
recommended for a full historical sync. `PONDER_RPC_REQUESTS_PER_SECOND_1` and
`PONDER_ETH_GET_LOGS_BLOCK_RANGE_1` are available for provider tuning.

For a bounded replay around the first public claims:

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

Leave `VESSEL_INDEXER_START_BLOCK` and `VESSEL_INDEXER_END_BLOCK` unset for
production.

REST routes:

- `GET /tokens`
- `GET /tokens/:id`
- `GET /tokens/:id/entries`
- `GET /tokens/:id/writes`
- `GET /activity`
- `GET /transfers`
- `GET /holders`
- `GET /stats`

Ponder also exposes its built-in health/readiness endpoints. Kamal uses
`/ready`.

## Deployment

Production deployment is configured with Kamal in `config/deploy.yml`. Copy
`.env.production.example` to `.env.production`, fill the registry, host, RPC,
and database values, then run `pnpm kamal:setup` for first bootstrapping or
`pnpm kamal:deploy` for releases.

Kamal serves the Ponder app on port `42069`, uses `/ready` for proxy cutover,
and provisions a Postgres 17 accessory on the shared Docker network. The root
`Dockerfile.indexer` runs `pnpm codegen` at build time and starts Ponder with a
fresh deploy schema plus a stable views schema.

This repository intentionally does not deploy from setup or tests.
