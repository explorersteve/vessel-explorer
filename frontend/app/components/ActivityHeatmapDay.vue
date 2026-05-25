<template>
  <Popover
    v-if="clickMode"
    v-model:open="open"
    side="top"
    align="center"
    :side-offset="8"
    :arrow="false"
    :modal="false"
    class="heatmap-popover"
  >
    <template #trigger>
      <button
        type="button"
        :class="dayClasses"
        :aria-label="dayTitle"
      />
    </template>
    <ActivityHeatmapDayDetails
      :date="dateLabel"
      :count="countLabel"
      :deployment="deployment"
    />
  </Popover>

  <Tooltip
    v-else
    side="top"
    align="center"
    :side-offset="8"
    :delay-duration="80"
    :arrow="false"
  >
    <template #trigger>
      <button
        type="button"
        :class="dayClasses"
        :aria-label="dayTitle"
      />
    </template>
    <ActivityHeatmapDayDetails
      :date="dateLabel"
      :count="countLabel"
      :deployment="deployment"
    />
  </Tooltip>
</template>

<script setup lang="ts">
import type { DailyActivityDay } from '~/utils/activity'

const props = defineProps<{
  day: DailyActivityDay
  level: number
  deployment: boolean
  clickMode: boolean
}>()

const open = ref(false)

const dayClasses = computed(() => [
  'unstyled',
  'heatmap-day',
  `level-${props.level}`,
  { deployment: props.deployment },
])

const countLabel = computed(() => interactionLabel(props.day.count))
const dateLabel = computed(() => formatDate(props.day.date))
const dayTitle = computed(() => props.deployment
  ? `${dateLabel.value}: contract deployed, ${countLabel.value}`
  : `${dateLabel.value}: ${countLabel.value}`,
)

watch(() => props.clickMode, () => {
  open.value = false
})

function interactionLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'interaction' : 'interactions'}`
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
.heatmap-day {
  inline-size: var(--heatmap-cell);
  block-size: var(--heatmap-cell);
  min-inline-size: auto;
  min-block-size: auto;
  box-sizing: border-box;
  display: block;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  border-radius: 0;
  box-shadow: none;
  background: var(--bg-muted);
  cursor: pointer;
}

.heatmap-day.level-1 {
  background: color-mix(in srgb, var(--color-vault) 12%, var(--background));
}

.heatmap-day.level-2 {
  background: color-mix(in srgb, var(--color-vault) 20%, var(--background));
}

.heatmap-day.level-3 {
  background: color-mix(in srgb, var(--color-vault) 30%, var(--background));
}

.heatmap-day.level-4 {
  background: color-mix(in srgb, var(--color-vault) 42%, var(--background));
}

.heatmap-day.level-5 {
  background: color-mix(in srgb, var(--color-vault) 55%, var(--background));
}

.heatmap-day.level-6 {
  background: color-mix(in srgb, var(--color-vault) 68%, var(--background));
}

.heatmap-day.level-7 {
  background: color-mix(in srgb, var(--color-vault) 82%, var(--background));
}

.heatmap-day.level-8 {
  background: var(--color-vault);
}

.heatmap-day.deployment {
  border-color: var(--color);
}

.heatmap-day:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}
</style>
