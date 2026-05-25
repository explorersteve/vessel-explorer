export default defineAppConfig({
  evm: {
    title: 'vessel explorer',
    defaultChain: 'mainnet',
    chains: {
      mainnet: {
        id: 1,
        blockExplorer: 'https://evm.now',
      },
    },
    ens: {
      mode: 'chain',
    },
    inAppWallet: {
      enabled: false,
    },
  },
})
