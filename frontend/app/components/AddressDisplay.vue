<template>
  <a v-if="external" :href="`${EXPLORER_BASE}/address/${address}`" target="_blank" rel="noopener" class="address-display">
    {{ shortened }}
  </a>
  <NuxtLink v-else :to="`/address/${address}`" class="address-display">
    {{ shortened }}
  </NuxtLink>
</template>

<script setup lang="ts">
import { EXPLORER_BASE, shortenAddress } from '~/utils/vessel'

const props = withDefaults(defineProps<{
  address: string
  external?: boolean
}>(), {
  external: false,
})

const shortened = computed(() => shortenAddress(props.address))
</script>

<style scoped>
.address-display {
  font-family: var(--font-mono);
  color: var(--muted);
  text-decoration: none;

  &:hover {
    color: var(--color);
    text-decoration: underline;
  }
}
</style>
