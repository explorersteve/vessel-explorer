<template>
  <div class="detail-page">
    <AppHeader />

    <div class="detail-content">
      <div class="nav-bar">
        <a href="#" class="back-link" @click.prevent="$router.back()">[back]</a>
        <button type="button" class="text-btn" :disabled="randomLoading" @click="randomVessel">[random]</button>
      </div>

      <div v-if="loading" class="status">loading vessel #{{ id }}...</div>
      <div v-else-if="error" class="status status-error">{{ error }}</div>

      <Transition name="vessel-in">
      <div v-if="vessel" :key="vessel.id" class="vessel-loaded">
        <div class="detail-header">
          <h1 class="vessel-title">
            vessel #{{ vessel.id }}
            <span :class="['type-badge', `type-${vessel.type}`]">[{{ vessel.type }}]</span>
            <span v-if="!vessel.claimed" class="type-badge unclaimed">[unclaimed]</span>
            <span v-if="vessel.locked" class="type-badge locked">[locked]</span>
          </h1>

          <div class="vessel-meta">
            <div v-if="vessel.owner" class="meta-row">
              <span class="meta-label">owner</span>
              <span class="meta-value"><AddressDisplay :address="vessel.owner" /></span>
            </div>
            <div v-if="vessel.delegate" class="meta-row">
              <span class="meta-label">delegate</span>
              <span class="meta-value"><AddressDisplay :address="vessel.delegate" /></span>
            </div>
            <div v-if="vessel.isMachine && vessel.machineAddress" class="meta-row">
              <span class="meta-label">machine</span>
              <span class="meta-value">
                <AddressDisplay :address="vessel.machineAddress" external />
                <template v-if="vessel.machineName"> ({{ vessel.machineName }})</template>
              </span>
            </div>
            <div v-if="vessel.chosenMachine" class="meta-row">
              <span class="meta-label">chosen machine</span>
              <span class="meta-value"><AddressDisplay :address="vessel.chosenMachine" external /></span>
            </div>
            <div class="meta-row">
              <span class="meta-label">type</span>
              <span class="meta-value">{{ vessel.type }}</span>
            </div>
            <div v-if="vessel.isVault" class="meta-row">
              <span class="meta-label">entries</span>
              <span class="meta-value">{{ vessel.entryCount }}</span>
            </div>
            <div v-if="vessel.isVault" class="meta-row">
              <span class="meta-label">chosen entry</span>
              <span class="meta-value">{{ vessel.chosenEntry }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">color mode</span>
              <span class="meta-value">{{ colorModeName(vessel.colorMode) }}</span>
            </div>
            <div v-if="vessel.claimBlock" class="meta-row">
              <span class="meta-label">claimed at</span>
              <span class="meta-value">block {{ vessel.claimBlock }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">capacity</span>
              <span class="meta-value">{{ vessel.id }} bytes</span>
            </div>
          </div>
        </div>

        <div v-if="vessel.isMachine && vessel.machineAddress" class="machine-note">
          sourced from <AddressDisplay :address="vessel.machineAddress" external />
        </div>

        <div v-if="vessel.isVault && vessel.entries.length > 1" class="entry-selector">
          <button
            v-for="(_, idx) in vessel.entries"
            :key="idx"
            :class="['entry-btn', { active: activeEntry === idx }]"
            @click="activeEntry = idx"
          >
            entry {{ idx }}
          </button>
        </div>

        <ClientOnly>
          <PixelGrid
            v-if="activePayload?.length"
            :data="activePayload"
            :token-id="vessel.id"
            :show-bytes="showBytes"
            :color-mode="vessel.colorMode"
          >
            <template #actions>
              <button
                :class="['text-btn', { active: showBytes }]"
                @click="showBytes = !showBytes"
              >
                [bytes]
              </button>
              <button class="text-btn" @click="copyBytes">
                {{ copied ? '[copied]' : '[copy]' }}
              </button>
            </template>
          </PixelGrid>
          <div v-else class="status empty-label">empty</div>
        </ClientOnly>

        <ContentView
          v-if="activePayload?.length && contentType !== 'binary'"
          :data="activePayload"
        />

        <section class="write-history">
          <div class="section-header">
            <span>write history</span>
            <span class="section-count">{{ writeCountLabel }}</span>
          </div>

          <div v-if="writesLoading" class="status">loading writes...</div>
          <div v-else-if="writesError" class="status status-error">{{ writesError }}</div>
          <div v-else-if="!writeRows.length" class="status">no indexed writes</div>

          <div v-else class="write-list">
            <article v-for="write in writeRows" :key="write.id" class="write-row">
              <div class="write-row-main">
                <span class="write-bytes">{{ formatBytes(write.payloadBytes) }}</span>
                <span v-if="write.entryIndex !== null" class="write-entry">entry {{ write.entryIndex }}</span>
                <span class="write-time">{{ formatWriteTime(write.timestamp) }}</span>
              </div>

              <div class="write-row-meta">
                <span v-if="write.writer">
                  writer <AddressDisplay :address="write.writer" />
                </span>
                <a
                  :href="`${EXPLORER_BASE}/tx/${write.txHash}`"
                  target="_blank"
                  rel="noopener"
                  class="explorer-link"
                >
                  {{ shortHash(write.txHash) }}
                </a>
                <span>block {{ write.blockNumber }}</span>
              </div>

              <code class="write-hex">{{ compactHex(write.payloadHex) }}</code>
            </article>
          </div>

          <div v-if="writeTotalPages > 1" class="write-pagination">
            <button
              type="button"
              class="text-btn"
              :disabled="writesPage <= 1 || writesLoading"
              @click="loadWrites(writesPage - 1)"
            >
              [newer]
            </button>
            <span>{{ writesPage }} / {{ writeTotalPages }}</span>
            <button
              type="button"
              class="text-btn"
              :disabled="writesPage >= writeTotalPages || writesLoading"
              @click="loadWrites(writesPage + 1)"
            >
              [older]
            </button>
          </div>
        </section>
      </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { detectContent } from '~/utils/content'
import { EXPLORER_BASE, colorModeName } from '~/utils/vessel'

interface PayloadWrite {
  id: string
  tokenId: string
  entryIndex: number | null
  payloadHex: string
  payloadBytes: number
  writer: string | null
  txHash: string
  blockNumber: string
  logIndex: number | null
  timestamp: string
}

interface PayloadWriteResponse {
  rows?: PayloadWrite[]
  total?: number
  page?: number
  limit?: number
}

const WRITES_PAGE_SIZE = 25

const router = useRouter()
const route = useRoute()

const randomVesselIds = ref<number[] | null>(null)
const randomLoading = ref(false)

function positiveIds(values: unknown): number[] {
  if (!Array.isArray(values)) return []
  const ids = new Set<number>()
  for (const value of values) {
    const id = Number(value)
    if (Number.isInteger(id) && id > 0) ids.add(id)
  }
  return [...ids]
}

async function loadRandomVesselIds() {
  if (randomVesselIds.value?.length) return randomVesselIds.value

  randomLoading.value = true
  try {
    const { ownership } = await fetchOwnership()
    const ids = positiveIds([...ownership.keys()])
    randomVesselIds.value = ids
    return ids
  } finally {
    randomLoading.value = false
  }
}

async function randomVessel() {
  const candidates = (await loadRandomVesselIds()).filter((candidate) => candidate !== id.value)
  if (!candidates.length) return
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  router.push(`/${pick}`)
}

const id = computed(() => {
  const raw = route.params.id as string
  const n = parseInt(raw, 10)
  return isNaN(n) ? undefined : n
})

const { vessel, loading, error } = useVesselReader(id)

const showBytes = ref(false)
const copied = ref(false)
const writesLoading = ref(false)
const writesError = ref('')
const writeRows = ref<PayloadWrite[]>([])
const writeTotal = ref(0)
const writesPage = ref(1)
let writesRequestId = 0

const activeEntry = ref(0)
watch(() => vessel.value?.id, () => {
  if (vessel.value?.isVault && vessel.value.entries.length > 0) {
    const chosen = Number(vessel.value.chosenEntry)
    if (Number.isInteger(chosen) && chosen >= 0 && chosen < vessel.value.entries.length) {
      activeEntry.value = chosen
    } else {
      activeEntry.value = vessel.value.entries.length - 1
    }
  } else {
    activeEntry.value = 0
  }
}, { immediate: true })

const activePayload = computed(() => {
  if (!vessel.value) return null
  if (vessel.value.isVault && vessel.value.entries.length > 0) {
    const idx = Math.min(Math.max(activeEntry.value, 0), vessel.value.entries.length - 1)
    return vessel.value.entries[idx] || null
  }
  return vessel.value.payload
})

const contentType = computed(() => {
  if (!activePayload.value?.length) return 'binary'
  return detectContent(activePayload.value).type
})

const writeTotalPages = computed(() => Math.max(1, Math.ceil(writeTotal.value / WRITES_PAGE_SIZE)))
const writeCountLabel = computed(() => {
  if (writesLoading.value && !writeRows.value.length) return 'loading'
  if (writeTotal.value === 1) return '1 write'
  return `${writeTotal.value} writes`
})

watch(id, () => {
  void loadWrites(1)
}, { immediate: true })

// OG meta tags are injected server-side by server/plugins/og-meta.ts
useHead(() => ({
  title: id.value ? `vessel #${id.value}` : 'vessel explorer',
}))

async function copyBytes() {
  if (!activePayload.value) return
  const hex = Array.from(activePayload.value)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  await navigator.clipboard.writeText('0x' + hex)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function loadWrites(page: number) {
  const tokenId = id.value
  if (!tokenId) {
    writeRows.value = []
    writeTotal.value = 0
    writesPage.value = 1
    writesError.value = ''
    return
  }

  const requestId = ++writesRequestId
  writesLoading.value = true
  writesError.value = ''

  try {
    const data = await $fetch<PayloadWriteResponse>(`/api/tokens/${tokenId}/writes`, {
      query: {
        page,
        limit: WRITES_PAGE_SIZE,
        dir: 'desc',
      },
    })
    if (requestId !== writesRequestId) return
    writeRows.value = Array.isArray(data.rows) ? data.rows : []
    writeTotal.value = Number(data.total) || 0
    writesPage.value = Number(data.page) || page
  } catch (err: any) {
    if (requestId !== writesRequestId) return
    writeRows.value = []
    writeTotal.value = 0
    writesPage.value = 1
    writesError.value = err?.data?.message || err?.message || 'failed to load write history'
  } finally {
    if (requestId === writesRequestId) writesLoading.value = false
  }
}

function formatBytes(bytes: number) {
  return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
}

function formatWriteTime(timestamp: string) {
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return 'unknown time'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function compactHex(hex: string) {
  const value = hex?.startsWith('0x') ? hex : `0x${hex || ''}`
  if (value.length <= 98) return value
  return `${value.slice(0, 66)}...${value.slice(-16)}`
}

function shortHash(hash: string) {
  if (!hash) return ''
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`
}
</script>

<style scoped>
.detail-page {
  font-family: var(--font-mono);
  max-width: 960px;
  margin: 0 auto;
}

.detail-content {
  padding: 1rem;
}

.nav-bar {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
}

.empty-label {
  text-align: center;
  padding: 3rem 0;
}

.detail-header {
  margin-bottom: 1.5rem;
}

.vessel-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.type-badge {
  font-size: 13px;
  font-weight: 700;
  text-transform: lowercase;
}

.type-capsule { color: var(--color-capsule); }
.type-vault { color: var(--color-vault); }
.type-machine { color: var(--color-machine); }
.unclaimed { color: var(--text-faint); }
.locked { color: var(--error, #e06c75); }

.vessel-meta {
  font-size: 13px;
}

.meta-row {
  display: flex;
  gap: 1rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-color);
}

.meta-label {
  color: var(--muted);
  width: 7rem;
  flex-shrink: 0;
}

.meta-value {
  color: var(--color);
  overflow: hidden;
  text-overflow: ellipsis;
}

.machine-note {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 0.75rem;
}

.entry-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  gap: 0.25rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

.entry-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  min-width: 5rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &:hover {
    color: var(--color);
  }

  &.active {
    color: var(--accent);
    border-color: var(--accent);
    font-weight: 700;
  }
}

.section-header {
  height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border-color);
  background: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  box-sizing: border-box;
}

.section-count {
  color: var(--text-faint);
}

.write-history {
  margin-top: 1.5rem;
  font-size: 13px;
}

.write-list {
  border-inline: 1px solid var(--border-color);
}

.write-row {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.write-row-main,
.write-row-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.write-row-main {
  margin-bottom: 0.35rem;
}

.write-bytes {
  color: var(--write);
  font-weight: 700;
}

.write-entry,
.write-time,
.write-row-meta {
  color: var(--muted);
}

.explorer-link {
  color: var(--muted);
  text-decoration: none;

  &:hover {
    color: var(--color);
  }
}

.write-hex {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.write-pagination {
  min-height: 2rem;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0 0.75rem;
  color: var(--muted);
  font-size: 12px;
}

.text-btn:disabled {
  color: var(--text-faint);
  cursor: default;
}

.vessel-in-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.vessel-in-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 640px) {
  .vessel-title {
    font-size: 16px;
  }

  .meta-row {
    flex-direction: column;
    gap: 0.15rem;
  }

  .meta-label {
    width: auto;
  }

  .meta-value {
    word-break: break-all;
  }

  .entry-btn {
    min-width: 4rem;
    font-size: 11px;
  }

  .section-header,
  .write-pagination {
    padding-inline: 0.5rem;
  }

  .write-row {
    padding-inline: 0.5rem;
  }

  .write-row-main,
  .write-row-meta {
    gap: 0.4rem;
  }
}
</style>
