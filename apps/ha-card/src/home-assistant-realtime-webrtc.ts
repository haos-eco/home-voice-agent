import {
  OpenAIRealtimeBase,
  type OpenAIRealtimeModels,
  type RealtimeClientMessage,
  type RealtimeSessionConfig,
  type RealtimeTransportLayerConnectOptions,
} from '@openai/agents/realtime'

type HassLike = {
  callWS<T>(message: Record<string, unknown>): Promise<T>
}

type RealtimeCallResponse = {
  sdp?: unknown
  location?: unknown
  model?: unknown
  message?: unknown
}

type DirectWebRTCOptions = {
  hass: HassLike
  audioTrackPromise: Promise<MediaStreamTrack>
  audioElement: HTMLAudioElement
  onTrace?: (stage: string) => void
}

type DirectWebRTCState =
  | {
      status: 'disconnected'
      peerConnection: undefined
      dataChannel: undefined
    }
  | {
      status: 'connecting' | 'connected'
      peerConnection: RTCPeerConnection
      dataChannel: RTCDataChannel
    }

const SESSION_CONFIG_ACK_TIMEOUT_MS = 5_000

export class HomeAssistantRealtimeWebRTC extends OpenAIRealtimeBase {
  private state: DirectWebRTCState = {
    status: 'disconnected',
    peerConnection: undefined,
    dataChannel: undefined,
  }

  private connectPromise: Promise<void> | null = null
  private mutedState = false
  private responseActive = false
  private pendingResponseCreate: RealtimeClientMessage | null = null

  constructor(private readonly options: DirectWebRTCOptions) {
    super()

    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is not supported in this browser.')
    }
  }

  get status(): 'connected' | 'disconnected' | 'connecting' | 'disconnecting' {
    return this.state.status
  }

  get muted(): boolean {
    return this.mutedState
  }

  async connect(options: RealtimeTransportLayerConnectOptions): Promise<void> {
    if (this.state.status === 'connected') return
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = this.prepareConnection(options).finally(() => {
      this.connectPromise = null
    })

    return this.connectPromise
  }

  private async prepareConnection(options: RealtimeTransportLayerConnectOptions): Promise<void> {
    const initialSessionConfig: Partial<RealtimeSessionConfig> = {
      ...(options.initialSessionConfig ?? {}),
    }

    if (options.model) {
      this.currentModel = options.model as OpenAIRealtimeModels
    }

    let peerConnection = new RTCPeerConnection()
    const dataChannel = peerConnection.createDataChannel('oai-events')

    this.state = {
      status: 'connecting',
      peerConnection,
      dataChannel,
    }
    this.emit('connection_change', 'connecting')

    peerConnection.onconnectionstatechange = () => {
      if (this.state.peerConnection !== peerConnection) return

      if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed'
      ) {
        this.close()
      }
    }

    peerConnection.ontrack = event => {
      const [stream] = event.streams
      if (stream) this.options.audioElement.srcObject = stream
    }

    // Negotiate an audio sender immediately, without waiting for Android/WebView
    // getUserMedia. The real microphone track is attached asynchronously with
    // replaceTrack(), so SDP setup and microphone acquisition run in parallel.
    const audioTransceiver = peerConnection.addTransceiver('audio', {
      direction: 'sendrecv',
    })

    void this.options.audioTrackPromise
      .then(async audioTrack => {
        if (this.state.peerConnection !== peerConnection) {
          audioTrack.stop()
          return
        }

        await audioTransceiver.sender.replaceTrack(audioTrack)
        this.options.onTrace?.('direct_audio_track_attached')
      })
      .catch(error => {
        this._onError(error)
      })

    dataChannel.addEventListener('message', event => {
      this._onMessage(event)

      try {
        const parsed = JSON.parse(String(event.data)) as {
          type?: unknown
          response?: { status?: unknown }
        }

        if (parsed.type === 'response.created') {
          this.responseActive = true
        } else if (parsed.type === 'response.done') {
          this.responseActive = false
          const pending = this.pendingResponseCreate
          this.pendingResponseCreate = null
          if (pending) this.sendEventNow(pending)
        }
      } catch {
        // The base transport already handles malformed/non-JSON events.
      }
    })

    dataChannel.addEventListener('error', event => {
      this._onError(event)
    })

    this.options.onTrace?.('direct_sdp_offer_started')
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    if (!offer.sdp) {
      throw new Error('Could not create a WebRTC SDP offer.')
    }
    this.options.onTrace?.('direct_sdp_offer_ready')

    this.options.onTrace?.('direct_sdp_call_started')
    const call = await this.options.hass.callWS<RealtimeCallResponse>({
      type: 'home_voice_agent/realtime_call',
      sdp: offer.sdp,
    })
    this.options.onTrace?.('direct_sdp_answer_received')

    if (typeof call.model === 'string' && call.model) {
      this.currentModel = call.model as OpenAIRealtimeModels
    }

    if (typeof call.sdp !== 'string' || call.sdp.length < 32) {
      const message =
        typeof call.message === 'string'
          ? call.message
          : 'Home Assistant returned no valid Realtime SDP answer.'
      throw new Error(message)
    }

    const connected = new Promise<void>((resolve, reject) => {
      let settled = false
      let ackTimer: number | null = null

      const cleanup = () => {
        if (ackTimer !== null) window.clearTimeout(ackTimer)
        dataChannel.removeEventListener('message', onMessage)
        dataChannel.removeEventListener('close', onClose)
      }

      const finish = () => {
        if (settled) return
        settled = true
        cleanup()

        if (dataChannel.readyState !== 'open') {
          reject(new Error('Realtime data channel closed before session configuration was ready.'))
          return
        }

        this.state = {
          status: 'connected',
          peerConnection,
          dataChannel,
        }
        this.emit('connection_change', 'connected')
        this._onOpen()
        resolve()
      }

      const onMessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(String(event.data)) as { type?: unknown }
          if (parsed.type === 'session.updated') finish()
        } catch {
          // Ignore unrelated transport messages while waiting for the config ack.
        }
      }

      const onClose = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('Realtime data channel closed during startup.'))
      }

      dataChannel.addEventListener('message', onMessage)
      dataChannel.addEventListener('close', onClose)

      dataChannel.addEventListener(
        'open',
        () => {
          this.options.onTrace?.('direct_data_channel_open')

          try {
            this.updateSessionConfig(initialSessionConfig)
          } catch (error) {
            cleanup()
            reject(error)
            return
          }

          ackTimer = window.setTimeout(() => {
            this.options.onTrace?.('direct_session_ack_timeout')
            finish()
          }, SESSION_CONFIG_ACK_TIMEOUT_MS)
        },
        { once: true },
      )
    })

    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: call.sdp,
    })
    this.options.onTrace?.('direct_remote_description_set')

    await connected
  }

  sendEvent(event: RealtimeClientMessage): void {
    if (event.type === 'response.create' && this.responseActive) {
      this.pendingResponseCreate = event
      return
    }

    if (event.type === 'response.cancel') {
      this.pendingResponseCreate = null
    }

    this.sendEventNow(event)
  }

  private sendEventNow(event: RealtimeClientMessage): void {
    const dataChannel = this.state.dataChannel
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Realtime data channel is not connected.')
    }

    dataChannel.send(JSON.stringify(event))
  }

  mute(muted: boolean): void {
    this.mutedState = muted

    const peerConnection = this.state.peerConnection
    if (!peerConnection) return

    for (const sender of peerConnection.getSenders()) {
      if (sender.track) sender.track.enabled = !muted
    }
  }

  interrupt(): void {
    const dataChannel = this.state.dataChannel
    if (!dataChannel || dataChannel.readyState !== 'open') return

    if (this.responseActive) {
      this.sendEvent({ type: 'response.cancel' })
      this.responseActive = false
    }

    this.sendEvent({ type: 'output_audio_buffer.clear' })
  }

  close(): void {
    const previousState = this.state

    this.pendingResponseCreate = null
    this.responseActive = false

    this.state = {
      status: 'disconnected',
      peerConnection: undefined,
      dataChannel: undefined,
    }

    if (previousState.dataChannel) {
      try {
        previousState.dataChannel.close()
      } catch {
        // Already closed.
      }
    }

    if (previousState.peerConnection) {
      previousState.peerConnection.onconnectionstatechange = null
      for (const sender of previousState.peerConnection.getSenders()) {
        sender.track?.stop()
      }
      previousState.peerConnection.close()
    }

    if (previousState.status !== 'disconnected') {
      this.emit('connection_change', 'disconnected')
      this._onClose()
    }
  }
}
