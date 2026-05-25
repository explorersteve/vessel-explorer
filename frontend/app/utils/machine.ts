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

let clientRpcUrl = ''
let client: ReturnType<typeof createPublicClient> | null = null
const machineNameRequests = new Map<string, Promise<string | null>>()

function machineRpcUrl() {
  const config = useRuntimeConfig()
  return String(config.public.machineRpcUrl || 'https://ethereum-rpc.publicnode.com')
}

function getMachineClient() {
  const rpcUrl = machineRpcUrl()
  if (!client || clientRpcUrl !== rpcUrl) {
    clientRpcUrl = rpcUrl
    client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }
  return client
}

export async function fetchMachineName(machineAddress: Hex) {
  if (!import.meta.client) return null

  const cacheKey = machineAddress.toLowerCase()
  const cached = machineNameRequests.get(cacheKey)
  if (cached) return cached

  const request = getMachineClient().readContract({
    address: machineAddress,
    abi: MACHINE_ABI,
    functionName: 'name',
  })
    .then((name) => typeof name === 'string' && name.length > 0 ? name : null)
    .catch(() => null)

  machineNameRequests.set(cacheKey, request)
  return request
}

export async function fetchLiveMachineState(machineAddress: Hex, tokenId: number) {
  if (!import.meta.client) {
    return {
      name: null,
      payloadHex: null,
    }
  }

  const [name, payloadHex] = await Promise.all([
    fetchMachineName(machineAddress),
    getMachineClient().readContract({
      address: machineAddress,
      abi: MACHINE_ABI,
      functionName: 'craftToPayload',
      args: [BigInt(tokenId)],
    }).catch(() => null),
  ])

  return {
    name,
    payloadHex: typeof payloadHex === 'string' ? payloadHex : null,
  }
}
