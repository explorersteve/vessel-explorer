<template>
  <span
    v-if="!link"
    class="address-display"
    :class="{ 'has-ens': Boolean(ens) }"
    :title="address"
  >
    {{ label }}
  </span>
  <a
    v-else-if="external"
    :href="`${EXPLORER_BASE}/address/${address}`"
    target="_blank"
    rel="noopener"
    class="address-display"
    :class="{ 'has-ens': Boolean(ens), 'is-link': true }"
    :title="address"
  >
    {{ label }}
  </a>
  <NuxtLink
    v-else
    :to="`/address/${address}`"
    class="address-display"
    :class="{ 'has-ens': Boolean(ens), 'is-link': true }"
    :title="address"
  >
    {{ label }}
  </NuxtLink>
</template>

<script setup lang="ts">
import { EXPLORER_BASE, shortenAddress } from '~/utils/vessel'

const props = withDefaults(defineProps<{
  address: string
  external?: boolean
  link?: boolean
  resolveEns?: boolean
}>(), {
  external: false,
  link: true,
  resolveEns: true,
})

const ensIdentifier = computed(() => props.resolveEns ? props.address : undefined)
const { data: ens } = useEns(ensIdentifier, { mode: 'chain' })
const shortened = computed(() => shortenAddress(props.address))
const label = computed(() => ens.value?.ens || shortened.value)
</script>

<style scoped>
.address-display {
  font-family: var(--font-mono);
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;

  &.has-ens {
    color: var(--color);
  }

  &.is-link:hover {
    color: var(--color);
    text-decoration: underline;
  }
}
</style>
