export type WakeDetection = {
  keyword: string
  score: number
}

export type WakeWordStreamConfig = {
  room: string
  deviceId: string
}

type WakeServerMessage =
  | {
      type: 'ready'
      keyword: string
      sample_rate: number
      frame_samples: number
    }
  | {
      type: 'wake'
      keyword: string
      score: number
    }

const WORKLET_SOURCE = `
class WakePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;

    this.samples = [];
    this.position = 0;

    this.frame = new Int16Array(1280);
    this.frameOffset = 0;
  }

  push(value) {
    const clamped = Math.max(-1, Math.min(1, value));

    this.frame[this.frameOffset++] =
      clamped < 0
        ? Math.round(clamped * 32768)
        : Math.round(clamped * 32767);

    if (this.frameOffset === 1280) {
      const buffer = this.frame.buffer;

      this.port.postMessage(buffer, [buffer]);

      this.frame = new Int16Array(1280);
      this.frameOffset = 0;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (output) {
      output.fill(0);
    }

    if (!input?.length) {
      return true;
    }

    for (const sample of input) {
      this.samples.push(sample);
    }

    while (this.position + 1 < this.samples.length) {
      const index = Math.floor(this.position);
      const fraction = this.position - index;

      const a = this.samples[index];
      const b = this.samples[index + 1];

      this.push(
        a + (b - a) * fraction
      );

      this.position += this.ratio;
    }

    const consumed = Math.floor(this.position);

    if (consumed > 0) {
      this.samples.splice(0, consumed);
      this.position -= consumed;
    }

    return true;
  }
}

registerProcessor(
  "wake-pcm-processor",
  WakePcmProcessor
);
`

export class WakeWordStream {
  private socket: WebSocket | null = null
  private stream: MediaStream | null = null

  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: AudioWorkletNode | null = null
  private sink: GainNode | null = null

  private workletUrl: string | null = null

  private active = false
  private startPromise: Promise<void> | null = null

  public constructor(private readonly onWake: (detection: WakeDetection) => Promise<void> | void) {}

  public get isActive(): boolean {
    return this.active
  }

  private async startInternal(config: WakeWordStreamConfig): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is unavailable')
    }

    console.info('[Home Voice Agent] Opening wake socket')

    const socket = await this.connectSocket(config)

    try {
      console.info('[Home Voice Agent] Wake socket connected')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      console.info('[Home Voice Agent] Microphone acquired')

      const context = new AudioContext({
        latencyHint: 'interactive',
      })

      if (context.state === 'suspended') {
        await context.resume()
      }

      const blob = new Blob([WORKLET_SOURCE], {
        type: 'text/javascript',
      })

      const workletUrl = URL.createObjectURL(blob)

      await context.audioWorklet.addModule(workletUrl)

      const source = context.createMediaStreamSource(stream)

      const processor = new AudioWorkletNode(context, 'wake-pcm-processor')

      const sink = context.createGain()

      sink.gain.value = 0

      processor.port.onmessage = event => {
        if (socket.readyState !== WebSocket.OPEN || !(event.data instanceof ArrayBuffer)) {
          return
        }

        if (socket.bufferedAmount > 256_000) {
          return
        }

        socket.send(event.data)
      }

      source.connect(processor)
      processor.connect(sink)
      sink.connect(context.destination)

      this.socket = socket
      this.stream = stream
      this.context = context
      this.source = source
      this.processor = processor
      this.sink = sink
      this.workletUrl = workletUrl

      this.active = true

      console.info('[Home Voice Agent] Listening for Hey Jarvis')
    } catch (error) {
      socket.close()
      throw error
    }
  }

  public async start(config: WakeWordStreamConfig): Promise<void> {
    if (this.active) {
      return
    }

    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this.startInternal(config)

    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  public async stop(): Promise<void> {
    this.active = false

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.processor?.disconnect()
    this.source?.disconnect()
    this.sink?.disconnect()

    this.processor = null
    this.source = null
    this.sink = null

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }

      this.stream = null
    }

    if (this.context) {
      try {
        await this.context.close()
      } catch {
        // Already closed.
      }

      this.context = null
    }

    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl)

      this.workletUrl = null
    }

    console.info('[Home Voice Agent] Wake listener stopped')
  }

  private async connectSocket(config: WakeWordStreamConfig): Promise<WebSocket> {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'

    const socket = new WebSocket(`${protocol}//${location.host}` + '/home-voice-agent/wake')

    socket.binaryType = 'arraybuffer'

    socket.onmessage = event => {
      if (typeof event.data !== 'string') {
        return
      }

      let message: WakeServerMessage

      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }

      if (message.type === 'ready') {
        console.info('[Home Voice Agent] Wake server ready:', message.keyword)

        return
      }

      if (message.type === 'wake') {
        console.info('[Home Voice Agent] WAKE DETECTED:', message.keyword, message.score)

        void this.onWake({
          keyword: message.keyword,
          score: message.score,
        })
      }
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.close()

        reject(new Error('Wake WebSocket timeout'))
      }, 7000)

      socket.onopen = () => {
        console.info('[Home Voice Agent] Wake WebSocket OPEN')

        window.clearTimeout(timeout)

        socket.send(
          JSON.stringify({
            type: 'hello',
            room: config.room,
            deviceId: config.deviceId,
          }),
        )

        resolve()
      }

      socket.onclose = event => {
        console.info('[Home Voice Agent] Wake WebSocket closed', {
          code: event.code,
          reason: event.reason,
          clean: event.wasClean,
        })
      }

      socket.onerror = event => {
        console.error('[Home Voice Agent] Wake WebSocket error', event)
        window.clearTimeout(timeout)
        reject(new Error('Wake WebSocket connection failed'))
      }
    })

    return socket
  }
}
