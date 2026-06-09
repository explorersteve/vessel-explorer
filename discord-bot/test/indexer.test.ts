import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cursorForActivity,
  isIncludedActivity,
  newActivitiesSinceCursor,
} from '../src/indexer.js'
import type { VesselActivity } from '../src/types.js'

test('skips transfer and metadata events by default', () => {
  const excluded = new Set(['transfer', 'metadata'])

  assert.equal(isIncludedActivity(activity({ action: 'transfer' }), excluded), false)
  assert.equal(isIncludedActivity(activity({ action: 'metadata' }), excluded), false)
  assert.equal(isIncludedActivity(activity({ action: 'unknown', functionName: 'refreshMetadata(uint256)' }), excluded), false)
  assert.equal(isIncludedActivity(activity({ action: 'write' }), excluded), true)
})

test('skips rows without vesselId', () => {
  assert.equal(isIncludedActivity(activity({ vesselId: null }), new Set()), false)
})

test('returns new activities oldest-to-newest', () => {
  const newestFirst = [
    activity({ hash: '0x3', blockNumber: '3', action: 'machine' }),
    activity({ hash: '0x2', blockNumber: '2', action: 'write' }),
    activity({ hash: '0x1', blockNumber: '1', action: 'claim' }),
  ]

  const rows = newActivitiesSinceCursor(newestFirst, cursorForActivity(newestFirst[2]!))
  assert.deepEqual(rows.map((row) => row.hash), ['0x2', '0x3'])
})

test('with no cursor, backfill order is oldest-to-newest', () => {
  const newestFirst = [
    activity({ hash: '0x3', blockNumber: '3' }),
    activity({ hash: '0x2', blockNumber: '2' }),
  ]

  const rows = newActivitiesSinceCursor(newestFirst, null)
  assert.deepEqual(rows.map((row) => row.hash), ['0x2', '0x3'])
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
    craftType: 'vault',
    entry: null,
    detail: 'wrote 2,623 bytes to #2623',
    ...overrides,
  }
}
