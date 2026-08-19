const DEFAULT_TARGET_SAMPLE_RATE = 24_000
const DEFAULT_MAX_BUFFER_MS = 8_000

export class WakeAudioPrebuffer {
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: ArrayBuffer[] = []
  private bufferedSamples = 0
  private started = false

  constructor(
    private readonly stream: MediaStream,
    private readonly targetSampleRate = DEFAULT_TARGET_SAMPLE_RATE,
    private readonly maxBufferMs = DEFAULT_MAX_BUFFER_MS,
    private readonly onFirstChunk?: () => void,
  ) {}

  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    const context = new AudioContext({ latencyHint: 'interactive' })
    const source = context.createMediaStreamSource(this.stream)
    const processor = context.createScriptProcessor(2048, 1, 1)
    const sink = context.createGain()
    sink.gain.value = 0

    let emittedFirstChunk = false

    processor.onaudioprocess = event => {
      const input = event.inputBuffer.getChannelData(0)
      if (input.length === 0) return

      const pcm = this.resampleToPcm16(input, context.sampleRate, this.targetSampleRate)
      if (pcm.byteLength === 0) return

      this.pushChunk(pcm)

      if (!emittedFirstChunk) {
        emittedFirstChunk = true
        this.onFirstChunk?.()
      }
    }

    source.connect(processor)
    processor.connect(sink)
    sink.connect(context.destination)

    this.context = context
    this.source = source
    this.processor = processor
    this.sink = sink

    if (context.state === 'suspended') {
      await context.resume()
    }
  }

  async stopAndTake(): Promise<ArrayBuffer[]> {
    this.stopNodes()

    const chunks = this.chunks
    this.chunks = []
    this.bufferedSamples = 0

    const context = this.context
    this.context = null

    if (context && context.state !== 'closed') {
      await context.close().catch(() => undefined)
    }

    return chunks
  }

  async discard(): Promise<void> {
    this.chunks = []
    this.bufferedSamples = 0
    await this.stopAndTake()
  }

  private stopNodes(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null
      try {
        this.processor.disconnect()
      } catch {
        // Already disconnected.
      }
    }

    if (this.source) {
      try {
        this.source.disconnect()
      } catch {
        // Already disconnected.
      }
    }

    if (this.sink) {
      try {
        this.sink.disconnect()
      } catch {
        // Already disconnected.
      }
    }

    this.processor = null
    this.source = null
    this.sink = null
    this.started = false
  }

  private pushChunk(chunk: ArrayBuffer): void {
    const samples = chunk.byteLength / 2
    this.chunks.push(chunk)
    this.bufferedSamples += samples

    const maxSamples = Math.round((this.targetSampleRate * this.maxBufferMs) / 1000)

    while (this.bufferedSamples > maxSamples && this.chunks.length > 1) {
      const removed = this.chunks.shift()
      if (removed) this.bufferedSamples -= removed.byteLength / 2
    }
  }

  private resampleToPcm16(
    input: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number,
  ): ArrayBuffer {
    if (inputSampleRate <= 0 || outputSampleRate <= 0 || input.length === 0) {
      return new ArrayBuffer(0)
    }

    const ratio = inputSampleRate / outputSampleRate
    const outputLength = Math.max(1, Math.floor(input.length / ratio))
    const output = new Int16Array(outputLength)

    for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
      const start = Math.floor(outputIndex * ratio)
      const end = Math.min(input.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)))

      let sum = 0
      for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
        sum += input[inputIndex] ?? 0
      }

      const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
      output[outputIndex] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff)
    }

    return output.buffer
  }
}
