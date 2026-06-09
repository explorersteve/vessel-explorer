import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readState, writeState } from '../src/state.js'

test('reads missing state as empty cursor and persists cursor', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vessel-discord-bot-'))
  const path = join(dir, 'state.json')

  try {
    assert.deepEqual(await readState(path), { cursor: null })

    const state = {
      cursor: {
        blockNumber: '25274501',
        hash: '0xhash',
        action: 'write',
        vesselId: '2623',
      },
    }
    await writeState(path, state)
    assert.deepEqual(await readState(path), state)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
