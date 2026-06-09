import assert from 'node:assert/strict'
import test from 'node:test'
import { createEnsResolver } from '../src/ens.js'

test('ENS resolver falls back to shortened invalid/unresolved addresses', async () => {
  const resolver = createEnsResolver('http://127.0.0.1:1')

  assert.equal(await resolver.displayName('not-an-address'), 'not-an-address')
  assert.equal(
    await resolver.displayName('0xabc100000000000000000000000000000000def2'),
    '0xabc1...def2',
  )
})
