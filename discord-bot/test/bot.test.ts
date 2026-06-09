import assert from 'node:assert/strict'
import test from 'node:test'
import { processActivities } from '../src/bot.js'
import type { BotState, VesselActivity } from '../src/types.js'

test('latest start mode records newest included event without sending backlog', async () => {
  const sent: VesselActivity[] = []
  const saved: BotState[] = []

  const state = await processActivities({ cursor: null }, [
    activity({ hash: '0x2', blockNumber: '2', action: 'write' }),
    activity({ hash: '0x1', blockNumber: '1', action: 'claim' }),
  ], {
    excludedEventTypes: new Set(['transfer', 'metadata']),
    startMode: 'latest',
    send: async (row) => {
      sent.push(row)
    },
    save: async (nextState) => {
      saved.push(nextState)
    },
  })

  assert.equal(sent.length, 0)
  assert.deepEqual(state.cursor, {
    blockNumber: '2',
    hash: '0x2',
    action: 'write',
    vesselId: '2623',
  })
  assert.deepEqual(saved, [state])
})

test('backfill sends included events once oldest-to-newest', async () => {
  const sent: VesselActivity[] = []

  const state = await processActivities({ cursor: null }, [
    activity({ hash: '0x3', blockNumber: '3', action: 'metadata' }),
    activity({ hash: '0x2', blockNumber: '2', action: 'write' }),
    activity({ hash: '0x1', blockNumber: '1', action: 'claim' }),
  ], {
    excludedEventTypes: new Set(['transfer', 'metadata']),
    startMode: 'backfill',
    send: async (row) => {
      sent.push(row)
    },
    save: async () => {},
  })

  assert.deepEqual(sent.map((row) => row.hash), ['0x1', '0x2'])
  assert.equal(state.cursor?.hash, '0x2')
})

test('does not advance cursor when Discord send fails', async () => {
  const originalState: BotState = {
    cursor: {
      blockNumber: '1',
      hash: '0x1',
      action: 'claim',
      vesselId: '2623',
    },
  }
  const saved: BotState[] = []

  await assert.rejects(
    processActivities(originalState, [
      activity({ hash: '0x2', blockNumber: '2', action: 'write' }),
      activity({ hash: '0x1', blockNumber: '1', action: 'claim' }),
    ], {
      excludedEventTypes: new Set(['transfer', 'metadata']),
      startMode: 'latest',
      send: async () => {
        throw new Error('webhook down')
      },
      save: async (nextState) => {
        saved.push(nextState)
      },
    }),
    /webhook down/,
  )

  assert.deepEqual(saved, [])
})

function activity(overrides: Partial<VesselActivity> = {}): VesselActivity {
  return {
    hash: '0xhash',
    from: '0xabc100000000000000000000000000000000def2',
    to: '0x0000000000000000000000000000000000000000',
    timeStamp: '1780943435',
    blockNumber: '25274501',
    input: '0x',
    isError: '0',
    functionName: '',
    action: 'write',
    vesselId: '2623',
    detail: 'wrote 2,623 bytes to #2623',
    ...overrides,
  }
}
