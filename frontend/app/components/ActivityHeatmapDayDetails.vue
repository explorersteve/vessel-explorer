<template>
  <div class="heatmap-tooltip">
    <span class="heatmap-tooltip-date">{{ date }}</span>
    <span class="heatmap-tooltip-count">{{ count }}</span>
    <span v-if="deployment" class="heatmap-tooltip-note">contract deployed</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  date: string
  count: string
  deployment: boolean
}>()
</script>

<style scoped>
.heatmap-tooltip {
  display: grid;
  gap: 0.18rem;
  min-inline-size: 8.5rem;
  font-size: 11px;
  line-height: 1.25;
}

.heatmap-tooltip-date {
  color: var(--color);
  font-weight: 600;
}

.heatmap-tooltip-count {
  color: var(--muted);
}

.heatmap-tooltip-note {
  color: var(--text-faint);
  font-size: 10px;
}
</style>
