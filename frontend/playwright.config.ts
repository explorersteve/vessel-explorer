import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || 3015)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
const machineRpcUrl = process.env.NUXT_PUBLIC_MACHINE_RPC_URL || 'https://ethereum-rpc.publicnode.com'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    viewport: { width: 1200, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: [
          `NITRO_HOST=127.0.0.1`,
          `NITRO_PORT=${port}`,
          `NUXT_INDEXER_URL=${process.env.NUXT_INDEXER_URL || 'https://indexer.vessel.worldcomputer.art'}`,
          `NUXT_PUBLIC_MACHINE_RPC_URL=${machineRpcUrl}`,
          `NUXT_PUBLIC_EVM_CHAINS_MAINNET_RPCS=${process.env.NUXT_PUBLIC_EVM_CHAINS_MAINNET_RPCS || machineRpcUrl}`,
          'node .output/server/index.mjs',
        ].join(' '),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
