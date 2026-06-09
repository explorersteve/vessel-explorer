export interface VesselActivity {
  hash: string
  from: string
  to: string
  timeStamp: string
  blockNumber: string
  input: string
  isError: string
  functionName: string
  action: string
  vesselId: string | null
  craftType: string | null
  entry: number | null
  detail: string
}

export interface ActivityCursor {
  blockNumber: string
  hash: string
  action: string
  vesselId: string
}

export interface BotState {
  cursor: ActivityCursor | null
}
