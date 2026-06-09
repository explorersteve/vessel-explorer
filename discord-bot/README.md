# Vessel Discord Bot

Polls the Vessel indexer activity feed and posts new vessel interactions to a Discord webhook.

The bot skips `transfer` and `metadata` events by default, skips rows without a vessel id, and posts one embed per included activity row.

## Message Shape

```text
0xabc1...def2 wrote 2,623 bytes on #2623
https://vessel.worldcomputer.art/2623
```

Each embed includes the vessel OG image:

```text
https://vessel.worldcomputer.art/api/og/2623
```

## Configuration

Copy `.env.example` to `.env` for local runs or `.env.production` for Kamal deploys.

```sh
pnpm install
pnpm build
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... pnpm start
```

`START_MODE=latest` records the newest included event on first boot and does not post historical backlog. Use `START_MODE=backfill` only when you intentionally want to post the current page of recent indexer activity.

## Required Env

- `DISCORD_WEBHOOK_URL`

## Defaults

- `INDEXER_URL=https://indexer.vessel.worldcomputer.art`
- `VESSEL_BASE_URL=https://vessel.worldcomputer.art`
- `ETH_RPC_URL=https://ethereum-rpc.publicnode.com`
- `POLL_INTERVAL_MS=15000`
- `START_MODE=latest`
- `STATE_FILE=/data/state.json`
- `EXCLUDED_EVENT_TYPES=transfer,metadata`
