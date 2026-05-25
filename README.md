# Vessel Explorer

A read-only explorer for [THE_VESSEL](https://evm.now/address/0xECb92Cc7112b80A2234936315BbB493fb48d1463), an on-chain storage protocol on Ethereum by [@stephensantoro_](https://x.com/stephensantoro_) and [@producedbydav](https://x.com/producedbydav). Browse vessels (capsules, vaults, and machines), view pixel-rendered payloads, inspect raw bytes, detect content types (SVG, HTML, bytecode), and explore holder leaderboards — all read directly from the blockchain.

## Tech Stack

- **[Nuxt 4](https://nuxt.com/)** — Vue framework (SPA mode)
- **[Ponder](https://ponder.sh/)** — production indexer for token state, payload writes, transfers, holders, and activity
- **[@1001-digital/layers.evm](https://www.npmjs.com/package/@1001-digital/layers.evm)** — ENS resolution, dark/light mode, wagmi/viem config
- **[viem](https://viem.sh/)** — contract reads via public RPC
- **[Etherscan API v2](https://docs.etherscan.io/)** — fallback transaction history and transfer data (server-side proxied)

Read-only. No wallet connect, no transactions.

## Setup

Run the frontend at `http://127.0.0.1:3001`.

### Frontend

```bash
git clone <repo-url>
cd vessel-explorer/frontend
cp .env.example .env
pnpm install
pnpm dev
```

Edit `.env` before starting the frontend if needed:

- `NUXT_ETHERSCAN_KEY` enables Etherscan fallback activity and transfer routes.
- `NUXT_INDEXER_URL` points the frontend server routes at the Ponder indexer.
- `NUXT_PUBLIC_EVM_CHAINS_MAINNET_RPC1/2/3` are the browser RPC fallbacks.

### Ponder Indexer

The production data source lives in `indexer/`. It backfills THE_VESSEL from
deployment block `24524524`, seeds all 10,000 tokens, stores payload bytes and
vault entries at write time, and exposes REST routes used by the Nuxt app.

```bash
cd vessel-explorer/indexer
cp .env.local.example .env.local
docker compose up -d
pnpm install
pnpm codegen
pnpm dev
```

Point the frontend at it with:

```bash
NUXT_INDEXER_URL=http://127.0.0.1:42069 pnpm dev
```

For bounded local smoke tests, set `VESSEL_INDEXER_START_BLOCK` and
`VESSEL_INDEXER_END_BLOCK`. Do not set those for a production full sync.

## Project Structure

```
frontend/
  app/
    pages/
      index.vue              # activity feed, holders leaderboard, search
      all.vue                # Ponder-backed all-vessels table
      [id].vue               # vessel detail (pixel grid, metadata, content view)
      address/[addr].vue     # address profile (owned vessels grid)
    components/
      AppHeader.vue           # site header with dark/light toggle
      PixelGrid.vue           # interactive pixel grid (cell-level rendering)
      PixelRender.vue         # simple pixel render via data URL
      ContentView.vue         # content viewer (text, SVG, HTML with [run], bytecode hex dump)
      HexDump.vue             # raw hex dump
      AddressDisplay.vue      # address with ENS resolution + EVM.NOW links
    composables/
      useVesselReader.ts      # reads vessel metadata, payload, entries from contract
      useOwnership.ts         # transfer replay to compute current ownership
    utils/
      vessel.ts               # ABI (30+ functions), grid math, pixel helpers
      etherscan.ts            # etherscan API fetch + tx decoding
      content.ts              # content type detection (SVG, HTML, text, bytecode, binary)
  server/api/
    activity.get.ts           # Ponder activity API with Etherscan fallback
    tokens.get.ts             # Ponder token API proxy
    transfers.get.ts          # Ponder transfer API with Etherscan fallback
    og/[id].get.ts            # dynamic OG image: grayscale BMP from on-chain payload
indexer/
  ponder.config.ts            # mainnet chain, RPC load balancing, start/end override
  ponder.schema.ts            # protocol, token, entry, payload, transfer, activity tables
  src/index.ts                # event handlers and block-pinned contract reads
  src/api/index.ts            # REST, SQL, GraphQL routes
  config/deploy.yml           # Kamal deployment with Postgres accessory
```

## Pages

- **`/`** — live activity feed (claims, writes, transfers, delegates, machines), holders leaderboard, search by vessel ID or address/ENS
- **`/all`** — table of all vessel token IDs with Ponder-backed filtering/sorting
- **`/[id]`** — vessel detail with pixel grid, metadata (type, capacity, color mode, claim block), entry navigation for vaults, content detection (renders SVG/HTML, shows bytecode hex dumps), [bytes] toggle, [copy] button
- **`/address/[addr]`** — profile page with owned vessels grid, type stats (machines/vaults/capsules/empty), progressive payload loading

## Key Contracts

- **THE_VESSEL**: [`0xECb92Cc7112b80A2234936315BbB493fb48d1463`](https://evm.now/address/0xECb92Cc7112b80A2234936315BbB493fb48d1463)
- **Renderer**: [`0x85c7D2933f178A02Ee9AAC0E654094EaDAca48a2`](https://evm.now/address/0x85c7D2933f178A02Ee9AAC0E654094EaDAca48a2)
- **Sequences (ERC1155)**: [`0x9423548a957284eD17E55c37c4B6D96e5E63065f`](https://evm.now/address/0x9423548a957284eD17E55c37c4B6D96e5E63065f)

## Vessel Types

| Type | Description |
|------|-------------|
| Capsule | Single-entry storage, payload size = tokenId bytes |
| Vault | Append-only, multiple entries |
| Machine | Programmable, delegates rendering to an IMachine contract |

## Renderer

Grid dimensions: `cols = ceil(sqrt(tokenId))`, `rows = ceil(tokenId / cols)`. Mode 0 = grayscale: each byte maps to `rgb(v, v, v)`.

## License

MIT
