<template>
  <canvas
    ref="canvas"
    class="write-payload-canvas"
    :title="`${payloadBytes} ${payloadBytes === 1 ? 'byte' : 'bytes'}`"
    aria-label="write payload preview"
  />
</template>

<script setup lang="ts">
import { hexToBytes, renderToCanvas, type ColorMode } from '~/utils/vessel'

const props = withDefaults(defineProps<{
  payloadHex: string
  tokenId: number
  colorMode?: ColorMode
  maxSize?: number
}>(), {
  colorMode: 0,
  maxSize: 84,
})

const canvas = ref<HTMLCanvasElement | null>(null)
const payloadBytes = computed(() => hexToBytes(props.payloadHex).length)

function draw() {
  if (!canvas.value) return
  renderToCanvas(
    canvas.value,
    hexToBytes(props.payloadHex),
    props.tokenId,
    props.maxSize,
    props.colorMode,
  )
}

onMounted(draw)

watch(
  () => [props.payloadHex, props.tokenId, props.maxSize, props.colorMode] as const,
  () => draw(),
)
</script>

<style scoped>
.write-payload-canvas {
  display: block;
  max-inline-size: 100%;
  max-block-size: 5rem;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
