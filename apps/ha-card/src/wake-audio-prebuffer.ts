const DEFAULT_TARGET_SAMPLE_RATE = 24_000
const DEFAULT_MAX_BUFFER_MS = 8_000
const WORKLET_CHUNK_MS = 20
const LEADING_PREROLL_MS = 160
const MIN_SPEECH_RUN_MS = 60

export type WakeAudioCaptureEngine = 'audio-worklet' | 'script-processor-fallback'

export type WakeAudioPrebufferResult = {
  chunks: ArrayBuffer[]
  captureEngine: WakeAudioCaptureEngine
  originalAudioMs: number
  audioMs: number
  trimmedLeadingMs: number
  firstSpeechOffsetMs: number | null
  noiseFloorDb: number | null
  speechThresholdDb: number | null
  maxRmsDb: number | null
  maxPeak: number | null
  workletPrewarmed: boolean
}

type BufferedChunk = {
  pcm: ArrayBuffer
  samples: number
  rmsDb: number
  peak: number
}

type SharedWorkletRuntime = {
  context: AudioContext
  prewarmedAt: number
}

const WORKLET_SOURCE = `
class HomeVoiceWakePrebufferProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const requestedChunkMs = Number(options?.processorOptions?.chunkMs ?? 20)
    const chunkMs = Number.isFinite(requestedChunkMs)
      ? Math.max(10, Math.min(100, requestedChunkMs))
      : 20

    this.chunkFrames = Math.max(128, Math.round(sampleRate * chunkMs / 1000))
    this.buffer = new Float32Array(this.chunkFrames)
    this.offset = 0
    this.running = true

    this.port.onmessage = event => {
      if (event?.data?.type === 'stop') this.running = false
    }
  }

  emitChunk() {
    if (this.offset <= 0) return

    const chunk = this.offset === this.buffer.length
      ? this.buffer
      : this.buffer.slice(0, this.offset)

    this.port.postMessage({ type: 'audio', samples: chunk }, [chunk.buffer])
    this.buffer = new Float32Array(this.chunkFrames)
    this.offset = 0
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const channel = input && input[0]
    const output = outputs[0]
    const outputChannel = output && output[0]

    if (outputChannel) {
      if (channel) outputChannel.set(channel)
      else outputChannel.fill(0)
    }

    if (!this.running) return false
    if (!channel || channel.length === 0) return true

    let sourceOffset = 0
    while (sourceOffset < channel.length) {
      const writable = Math.min(
        channel.length - sourceOffset,
        this.buffer.length - this.offset,
      )

      this.buffer.set(
        channel.subarray(sourceOffset, sourceOffset + writable),
        this.offset,
      )

      sourceOffset += writable
      this.offset += writable

      if (this.offset >= this.buffer.length) this.emitChunk()
    }

    return true
  }
}

registerProcessor('home-voice-wake-prebuffer', HomeVoiceWakePrebufferProcessor)
`

let sharedWorkletRuntimePromise: Promise<SharedWorkletRuntime> | null = null

async function createSharedWorkletRuntime(): Promise<SharedWorkletRuntime> {
  if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') {
    throw new Error('AudioWorklet is not supported by this browser.')
  }

  const context = new AudioContext({ latencyHint: 'interactive' })

  if (!context.audioWorklet) {
    await context.close().catch(() => undefined)
    throw new Error('AudioWorklet is not supported by this browser.')
  }

  const module = new Blob([WORKLET_SOURCE], { type: 'text/javascript' })
  const moduleUrl = URL.createObjectURL(module)

  try {
    await context.audioWorklet.addModule(moduleUrl)
  } catch (error) {
    await context.close().catch(() => undefined)
    throw error
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }

  return {
    context,
    prewarmedAt: performance.now(),
  }
}

async function getSharedWorkletRuntime(): Promise<SharedWorkletRuntime> {
  if (!sharedWorkletRuntimePromise) {
    sharedWorkletRuntimePromise = createSharedWorkletRuntime().catch(error => {
      sharedWorkletRuntimePromise = null
      throw error
    })
  }

  return sharedWorkletRuntimePromise
}

/**
 * Load the AudioWorklet module before a wake word happens. This does not request
 * microphone access, so Kiosk Satellite keeps owning the input device while idle.
 */
export async function prewarmWakeAudioWorklet(): Promise<boolean> {
  try {
    const runtime = await getSharedWorkletRuntime()
    console.debug('[Home Voice Agent] Wake audio worklet prewarmed', {
      state: runtime.context.state,
    })
    return true
  } catch (error) {
    console.warn('[Home Voice Agent] Wake audio worklet prewarm unavailable', error)
    return false
  }
}

export class WakeAudioPrebuffer {
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private fallbackProcessor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: BufferedChunk[] = []
  private bufferedSamples = 0
  private started = false
  private captureEngine: WakeAudioCaptureEngine = 'audio-worklet'
  private usingSharedContext = false
  private workletPrewarmed = false

  constructor(
    private readonly stream: MediaStream,
    private readonly targetSampleRate = DEFAULT_TARGET_SAMPLE_RATE,
    private readonly maxBufferMs = DEFAULT_MAX_BUFFER_MS,
    private readonly onFirstChunk?: () => void,
  ) {}

  async start(): Promise<WakeAudioCaptureEngine> {
    if (this.started) return this.captureEngine
    this.started = true

    try {
      const waitStartedAt = performance.now()
      const runtime = await getSharedWorkletRuntime()
      const context = runtime.context
      this.workletPrewarmed = runtime.prewarmedAt <= waitStartedAt

      if (context.state === 'suspended') {
        await context.resume()
      }

      if (context.state === 'closed') {
        sharedWorkletRuntimePromise = null
        throw new Error('The prewarmed AudioContext was closed.')
      }

      const source = context.createMediaStreamSource(this.stream)
      const sink = context.createGain()
      sink.gain.value = 0

      this.context = context
      this.source = source
      this.sink = sink
      this.usingSharedContext = true

      this.startAudioWorklet(context, source, sink)
      this.captureEngine = 'audio-worklet'
      return this.captureEngine
    } catch (error) {
      console.warn(
        '[Home Voice Agent] Prewarmed AudioWorklet unavailable, using ScriptProcessor fallback',
        error,
      )

      this.stopNodes()
      this.usingSharedContext = false
      this.workletPrewarmed = false

      const context = new AudioContext({ latencyHint: 'interactive' })
      const source = context.createMediaStreamSource(this.stream)
      const sink = context.createGain()
      sink.gain.value = 0

      if (context.state === 'suspended') {
        await context.resume()
      }

      this.context = context
      this.source = source
      this.sink = sink
      this.startScriptProcessorFallback(context, source, sink)
      this.captureEngine = 'script-processor-fallback'
      return this.captureEngine
    }
  }

  async stopAndTake(): Promise<WakeAudioPrebufferResult> {
    this.stopNodes()

    const originalChunks = this.chunks
    this.chunks = []
    this.bufferedSamples = 0

    const result = this.trimLeadingSilence(originalChunks)
    const context = this.context
    const shouldCloseContext = context && !this.usingSharedContext
    this.context = null

    if (shouldCloseContext && context.state !== 'closed') {
      await context.close().catch(() => undefined)
    }

    return {
      ...result,
      captureEngine: this.captureEngine,
      workletPrewarmed: this.workletPrewarmed,
    }
  }

  async discard(): Promise<void> {
    this.chunks = []
    this.bufferedSamples = 0
    await this.stopAndTake()
  }

  private startAudioWorklet(
    context: AudioContext,
    source: MediaStreamAudioSourceNode,
    sink: GainNode,
  ): void {
    const worklet = new AudioWorkletNode(context, 'home-voice-wake-prebuffer', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: {
        chunkMs: WORKLET_CHUNK_MS,
      },
    })

    let emittedFirstChunk = false

    worklet.port.onmessage = event => {
      const data = event.data as { type?: unknown; samples?: unknown }
      if (data?.type !== 'audio' || !(data.samples instanceof Float32Array)) return

      this.acceptFloatChunk(data.samples, context.sampleRate)

      if (!emittedFirstChunk) {
        emittedFirstChunk = true
        this.onFirstChunk?.()
      }
    }

    source.connect(worklet)
    worklet.connect(sink)
    sink.connect(context.destination)
    this.worklet = worklet
  }

  private startScriptProcessorFallback(
    context: AudioContext,
    source: MediaStreamAudioSourceNode,
    sink: GainNode,
  ): void {
    const processor = context.createScriptProcessor(1024, 1, 1)
    let emittedFirstChunk = false

    processor.onaudioprocess = event => {
      const input = event.inputBuffer.getChannelData(0)
      if (input.length === 0) return

      this.acceptFloatChunk(input, context.sampleRate)

      if (!emittedFirstChunk) {
        emittedFirstChunk = true
        this.onFirstChunk?.()
      }
    }

    source.connect(processor)
    processor.connect(sink)
    sink.connect(context.destination)
    this.fallbackProcessor = processor
  }

  private acceptFloatChunk(input: Float32Array, inputSampleRate: number): void {
    const pcm = this.resampleToPcm16(input, inputSampleRate, this.targetSampleRate)
    if (pcm.byteLength === 0) return

    const { rmsDb, peak } = this.measureFloatAudio(input)
    this.pushChunk({
      pcm,
      samples: pcm.byteLength / 2,
      rmsDb,
      peak,
    })
  }

  private stopNodes(): void {
    if (this.worklet) {
      try {
        this.worklet.port.postMessage({ type: 'stop' })
        this.worklet.port.onmessage = null
        this.worklet.port.close()
      } catch {
        // Already stopped.
      }

      try {
        this.worklet.disconnect()
      } catch {
        // Already disconnected.
      }
    }

    if (this.fallbackProcessor) {
      this.fallbackProcessor.onaudioprocess = null
      try {
        this.fallbackProcessor.disconnect()
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

    this.worklet = null
    this.fallbackProcessor = null
    this.source = null
    this.sink = null
    this.started = false
  }

  private pushChunk(chunk: BufferedChunk): void {
    this.chunks.push(chunk)
    this.bufferedSamples += chunk.samples

    const maxSamples = Math.round((this.targetSampleRate * this.maxBufferMs) / 1000)

    while (this.bufferedSamples > maxSamples && this.chunks.length > 1) {
      const removed = this.chunks.shift()
      if (removed) this.bufferedSamples -= removed.samples
    }
  }

  private trimLeadingSilence(chunks: BufferedChunk[]): Omit<WakeAudioPrebufferResult, 'captureEngine' | 'workletPrewarmed'> {
    const originalSamples = chunks.reduce((sum, chunk) => sum + chunk.samples, 0)
    const originalAudioMs = this.samplesToMs(originalSamples)
    const finiteRms = chunks.map(chunk => chunk.rmsDb).filter(value => Number.isFinite(value))
    const maxRmsDb = finiteRms.length > 0 ? Math.max(...finiteRms) : null
    const maxPeak = chunks.length > 0 ? Math.max(...chunks.map(chunk => chunk.peak)) : null

    if (chunks.length < 3 || originalSamples === 0) {
      return {
        chunks: chunks.map(chunk => chunk.pcm),
        originalAudioMs,
        audioMs: originalAudioMs,
        trimmedLeadingMs: 0,
        firstSpeechOffsetMs: null,
        noiseFloorDb: null,
        speechThresholdDb: null,
        maxRmsDb: maxRmsDb === null ? null : Math.round(maxRmsDb * 10) / 10,
        maxPeak: maxPeak === null ? null : Math.round(maxPeak * 1000) / 1000,
      }
    }

    const rmsValues = [...finiteRms].sort((a, b) => a - b)

    const noiseFloorDb = rmsValues.length > 0
      ? rmsValues[Math.min(rmsValues.length - 1, Math.floor(rmsValues.length * 0.2))]!
      : -60

    // The local detector only decides how much leading silence to trim. Be more
    // permissive than Realtime so quiet but genuine speech is never discarded.
    const speechThresholdDb = Math.max(-58, Math.min(-32, noiseFloorDb + 8))
    const requiredRunSamples = Math.round((this.targetSampleRate * MIN_SPEECH_RUN_MS) / 1000)

    let firstSpeechIndex: number | null = null
    let activeRunSamples = 0
    let activeRunStart = 0

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]!
      const active = chunk.rmsDb >= speechThresholdDb || chunk.peak >= 0.035

      if (active) {
        if (activeRunSamples === 0) activeRunStart = index
        activeRunSamples += chunk.samples

        if (activeRunSamples >= requiredRunSamples) {
          firstSpeechIndex = activeRunStart
          break
        }
      } else {
        activeRunSamples = 0
      }
    }

    if (firstSpeechIndex === null) {
      return {
        chunks: chunks.map(chunk => chunk.pcm),
        originalAudioMs,
        audioMs: originalAudioMs,
        trimmedLeadingMs: 0,
        firstSpeechOffsetMs: null,
        noiseFloorDb: Math.round(noiseFloorDb * 10) / 10,
        speechThresholdDb: Math.round(speechThresholdDb * 10) / 10,
        maxRmsDb: maxRmsDb === null ? null : Math.round(maxRmsDb * 10) / 10,
        maxPeak: maxPeak === null ? null : Math.round(maxPeak * 1000) / 1000,
      }
    }

    const samplesBeforeSpeech = chunks
      .slice(0, firstSpeechIndex)
      .reduce((sum, chunk) => sum + chunk.samples, 0)
    const firstSpeechOffsetMs = this.samplesToMs(samplesBeforeSpeech)
    const preRollSamples = Math.round((this.targetSampleRate * LEADING_PREROLL_MS) / 1000)
    const desiredTrimSamples = Math.max(0, samplesBeforeSpeech - preRollSamples)

    let trimSamples = 0
    let trimChunkCount = 0

    while (trimChunkCount < firstSpeechIndex) {
      const chunk = chunks[trimChunkCount]!
      if (trimSamples + chunk.samples > desiredTrimSamples) break
      trimSamples += chunk.samples
      trimChunkCount += 1
    }

    const retained = chunks.slice(trimChunkCount)
    const retainedSamples = retained.reduce((sum, chunk) => sum + chunk.samples, 0)

    return {
      chunks: retained.map(chunk => chunk.pcm),
      originalAudioMs,
      audioMs: this.samplesToMs(retainedSamples),
      trimmedLeadingMs: this.samplesToMs(trimSamples),
      firstSpeechOffsetMs,
      noiseFloorDb: Math.round(noiseFloorDb * 10) / 10,
      speechThresholdDb: Math.round(speechThresholdDb * 10) / 10,
      maxRmsDb: maxRmsDb === null ? null : Math.round(maxRmsDb * 10) / 10,
      maxPeak: maxPeak === null ? null : Math.round(maxPeak * 1000) / 1000,
    }
  }

  private measureFloatAudio(input: Float32Array): { rmsDb: number; peak: number } {
    let sumSquares = 0
    let peak = 0

    for (let index = 0; index < input.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index] ?? 0))
      sumSquares += sample * sample
      peak = Math.max(peak, Math.abs(sample))
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, input.length))
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-8))

    return { rmsDb, peak }
  }

  private samplesToMs(samples: number): number {
    return Math.round((samples / this.targetSampleRate) * 1000)
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
      const end = Math.min(
        input.length,
        Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)),
      )

      let sum = 0
      for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
        sum += input[inputIndex] ?? 0
      }

      const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
      output[outputIndex] = sample < 0
        ? Math.round(sample * 0x8000)
        : Math.round(sample * 0x7fff)
    }

    return output.buffer
  }
}
