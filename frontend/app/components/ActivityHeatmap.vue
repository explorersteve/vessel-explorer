<template>
  <div class="activity-heatmap">
    <div v-if="loading" class="feed-status">loading heatmap...</div>
    <div v-else-if="error" class="feed-status feed-error">{{ error }}</div>
    <div v-else-if="!days.length" class="feed-status">no indexed activity</div>

    <template v-else>
      <div class="heatmap-summary">
        <span>{{ totalLabel }}</span>
        <span>{{ rangeLabel }}</span>
      </div>

      <div class="heatmap-scroll">
        <div
          class="heatmap-months"
          :style="{ gridTemplateColumns: `repeat(${weekCount}, var(--heatmap-cell))` }"
        >
          <span
            v-for="month in monthLabels"
            :key="month.key"
            class="heatmap-month"
            :style="{ gridColumn: month.column }"
          >
            {{ month.label }}
          </span>
        </div>

        <div class="heatmap-body">
          <div class="heatmap-weekdays" aria-hidden="true">
            <span v-for="(label, index) in weekdayLabels" :key="index">{{ label }}</span>
          </div>

          <div
            class="heatmap-grid"
            :style="{ gridTemplateColumns: `repeat(${weekCount}, var(--heatmap-cell))` }"
          >
            <span
              v-for="blank in leadingBlanks"
              :key="`blank-${blank}`"
              class="heatmap-empty"
              aria-hidden="true"
            />
            <span
              v-for="(day, index) in days"
              :key="day.date"
              :class="['heatmap-day', `level-${levelFor(day.count)}`, { deployment: index === 0 }]"
              :title="dayTitle(day, index)"
              :aria-label="dayTitle(day, index)"
              tabindex="0"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DailyActivityDay, DailyActivityResponse } from '~/utils/activity'

const props = defineProps<{
  data: DailyActivityResponse | null
  loading: boolean
  error: string | null
}>()

const weekdayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

const days = computed(() => props.data?.days ?? [])
const maxCount = computed(() => Math.max(0, props.data?.maxCount ?? 0))
const leadingBlanks = computed(() => days.value.length ? utcWeekday(days.value[0]!.date) : 0)
const weekCount = computed(() => Math.max(1, Math.ceil((leadingBlanks.value + days.value.length) / 7)))

const totalLabel = computed(() => {
  const total = props.data?.total ?? 0
  return `${total.toLocaleString()} ${total === 1 ? 'interaction' : 'interactions'}`
})

const rangeLabel = computed(() => {
  const start = props.data?.startDate || days.value[0]?.date
  const end = props.data?.endDate || days.value.at(-1)?.date
  if (!start || !end) return ''
  return `${formatDate(start)} -> ${formatDate(end)}`
})

const monthLabels = computed(() => {
  const labels: Array<{ key: string; label: string; column: string }> = []
  const seen = new Set<string>()

  for (let index = 0; index < days.value.length; index++) {
    const day = days.value[index]!
    const [year, month, date] = day.date.split('-').map(Number)
    const key = `${year}-${month}`
    if (seen.has(key)) continue
    if (index !== 0 && date !== 1) continue

    seen.add(key)
    labels.push({
      key,
      label: formatMonth(day.date),
      column: String(Math.floor((leadingBlanks.value + index) / 7) + 1),
    })
  }

  return labels
})

function levelFor(count: number) {
  if (count <= 0 || maxCount.value <= 0) return 0
  const ratio = count / maxCount.value
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function dayTitle(day: DailyActivityDay, index: number) {
  const count = `${day.count.toLocaleString()} ${day.count === 1 ? 'interaction' : 'interactions'}`
  return index === 0
    ? `${formatDate(day.date)}: contract deployed, ${count}`
    : `${formatDate(day.date)}: ${count}`
}

function utcWeekday(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()
}

function formatMonth(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
</script>

<style scoped>
.activity-heatmap {
  --heatmap-cell: 0.74rem;
  --heatmap-gap: 3px;
  font-size: 12px;
}

.heatmap-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  color: var(--muted);
  font-size: 12px;
}

.heatmap-scroll {
  overflow-x: auto;
  padding-bottom: 0.35rem;
}

.heatmap-months {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--heatmap-cell);
  gap: var(--heatmap-gap);
  min-inline-size: max-content;
  margin: 0 0 0.25rem 2rem;
  color: var(--text-faint);
  font-size: 10px;
  line-height: 1;
}

.heatmap-month {
  overflow: visible;
  white-space: nowrap;
}

.heatmap-body {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  min-inline-size: max-content;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, var(--heatmap-cell));
  gap: var(--heatmap-gap);
  inline-size: 1.55rem;
  color: var(--text-faint);
  font-size: 10px;
  line-height: var(--heatmap-cell);
}

.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(7, var(--heatmap-cell));
  grid-auto-flow: column;
  grid-auto-columns: var(--heatmap-cell);
  gap: var(--heatmap-gap);
  min-inline-size: max-content;
}

.heatmap-empty,
.heatmap-day {
  inline-size: var(--heatmap-cell);
  block-size: var(--heatmap-cell);
  box-sizing: border-box;
}

.heatmap-day {
  border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  background: var(--bg-muted);
}

.heatmap-day.level-1 {
  background: color-mix(in srgb, var(--color-vault) 18%, var(--background));
}

.heatmap-day.level-2 {
  background: color-mix(in srgb, var(--color-vault) 36%, var(--background));
}

.heatmap-day.level-3 {
  background: color-mix(in srgb, var(--color-vault) 58%, var(--background));
}

.heatmap-day.level-4 {
  background: var(--color-vault);
}

.heatmap-day.deployment {
  border-color: var(--color);
}

.heatmap-day:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .activity-heatmap {
    --heatmap-cell: 0.68rem;
  }

  .heatmap-summary {
    flex-direction: column;
    gap: 0.2rem;
  }
}
</style>
