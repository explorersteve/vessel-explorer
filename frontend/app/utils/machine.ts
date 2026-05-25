import { createPublicClient, http, type Hex } from 'viem'
import { mainnet } from 'viem/chains'

const MACHINE_ABI = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'craftToPayload',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
] as const

function machineRpcUrl() {
  const config = useRuntimeConfig()
  return String(config.public.machineRpcUrl || 'https://ethereum-rpc.publicnode.com')
}

export async function fetchLiveMachineState(machineAddress: Hex, tokenId: number) {
  if (!import.meta.client) {
    return {
      name: null,
      payloadHex: null,
    }
  }

  const client = createPublicClient({
    chain: mainnet,
    transport: http(machineRpcUrl()),
  })

  const [name, payloadHex] = await Promise.all([
    client.readContract({
      address: machineAddress,
      abi: MACHINE_ABI,
      functionName: 'name',
    }).catch(() => null),
    client.readContract({
      address: machineAddress,
      abi: MACHINE_ABI,
      functionName: 'craftToPayload',
      args: [BigInt(tokenId)],
    }).catch(() => null),
  ])

  return {
    name: typeof name === 'string' && name.length > 0 ? name : null,
    payloadHex: typeof payloadHex === 'string' ? payloadHex : null,
  }
}
