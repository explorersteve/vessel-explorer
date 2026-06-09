import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDiscordPayload, sentenceForActivity } from '../src/discord.js'
import type { VesselActivity } from '../src/types.js'

test('formats minimal activity sentences', () => {
  assert.equal(sentenceForActivity(activity({ action: 'claim', detail: 'claimed #728' })), '**0xabc1...def2** claimed on **vault #2623**')
  assert.equal(sentenceForActivity(activity({ action: 'write', detail: 'wrote 2,623 bytes to #2623' })), '**0xabc1...def2** wrote 2,623 bytes on **vault #2623**')
  assert.equal(sentenceForActivity(activity({ action: 'write', entry: 3 })), '**0xabc1...def2** wrote 2,623 bytes to entry 3 on **vault #2623**')
  assert.equal(sentenceForActivity(activity({ action: 'machine', detail: 'set machine on #5134', vesselId: '5134', craftType: 'machine' })), '**0xabc1...def2** set machine on **machine #5134**')
  assert.equal(sentenceForActivity(activity({ action: 'delegate', detail: 'delegated #2623' })), '**0xabc1...def2** set delegate on **vault #2623**')
  assert.equal(sentenceForActivity(activity({ action: 'setvaultentry', detail: 'set entry 3 on #2623' })), '**0xabc1...def2** set vault entry 3 on **vault #2623**')
  assert.equal(sentenceForActivity(activity({ action: 'write' }), 'agent.yougogirl.eth'), '**agent.yougogirl.eth** wrote 2,623 bytes on **vault #2623**')
})

test('builds Discord embed with vessel link and OG image', () => {
  const payload = buildDiscordPayload(activity({ action: 'machine', vesselId: '5134' }), 'https://vessel.worldcomputer.art')

  assert.equal(payload.embeds[0]?.title, 'Machine set')
  assert.equal(payload.embeds[0]?.url, 'https://evm.now/tx/0xhash')
  assert.equal(payload.embeds[0]?.image.url, 'https://vessel.worldcomputer.art/api/og/5134?v=25274501-machine-5134-1780943435')
  assert.match(payload.embeds[0]?.description || '', /\n\nhttps:\/\/vessel\.worldcomputer\.art\/5134/)
  assert.match(payload.embeds[0]?.description || '', /https:\/\/vessel\.worldcomputer\.art\/5134/)
})

test('builds human action titles', () => {
  assert.equal(buildDiscordPayload(activity({ action: 'write', craftType: 'vault' }), 'https://vessel.worldcomputer.art').embeds[0]?.title, 'Vault write')
  assert.equal(buildDiscordPayload(activity({ action: 'setvaultentry' }), 'https://vessel.worldcomputer.art').embeds[0]?.title, 'Vault entry set')
  assert.equal(buildDiscordPayload(activity({ action: 'delegate' }), 'https://vessel.worldcomputer.art').embeds[0]?.title, 'Delegate set')
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
