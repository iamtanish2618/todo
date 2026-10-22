import { gsap } from "gsap";
import { object, type Envelope } from "./protocol";
import type { TableSession } from "./session";
type Peer = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  blocked: boolean;
  ice: RTCIceCandidateInit[];
  retries: number;
  stream?: MediaStream;
  readingStats: boolean;
  nextStats: number;
  held: number;
  volume: number;
  watchdog?: ReturnType<typeof setTimeout>;
};
export type VoiceSnapshot = {
  muted: boolean;
  permission: boolean;
  incomingMuted: boolean;
  message: string;
  blocked: boolean;
  speaking: Record<string, boolean>;
  peers: Record<string, string>;
  volumes: Record<string, number>;
};
/** Audio-only mesh. Audio never enters Firebase or the application server. */
export class TableVoice {
  onSpeaking?: (id: string, speaking: boolean) => void;
  onPeerState?: (id: string, state: string) => void;
  private snapshot: VoiceSnapshot = {
    muted: true,
    permission: false,
    incomingMuted: false,
    message: "",
    blocked: false,
    speaking: {},
    peers: {},
    volumes: {},
  };
  private listeners = new Set<() => void>();
  private peers = new Map<string, Peer>();
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localSamples = new Float32Array(512);
  private localHeld = 0;
  private session: TableSession | null = null;
  private unsub: (() => void)[] = [];
  private lastSample = 0;
  private busy = false;
  private epoch = 0;
  private desiredMuted = true;
  private permissionStatus: PermissionStatus | null = null;
  private gestureReady = false;
  private pending: Envelope[] = [];
  private signaling = new Map<string, Promise<void>>();
  private iceConfig: RTCIceServer[] | null = null;
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(value: Partial<VoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((fn) => fn());
  }
  private audioContext() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
    }
    return this.context;
  }
  /** Must be called directly from Create/Join/Enable sound/Unmute user actions. */
  async unlock() {
    this.gestureReady = true;
    for (const peer of this.peers.values())
      if (peer.audio.srcObject) this.play(peer);
    try {
      // Resume synchronously in the gesture. Browsers may leave resume()
      // pending while blocked; that must never stall microphone permission.
      const context = this.audioContext();
      void context.resume().catch(() => {});
    } catch {
      // Metering is optional; native call playback does not depend on Web Audio.
    }
  }
  private play(peer: Peer) {
    void peer.audio
      .play()
      .then(() => {
        peer.blocked = false;
      })
      .catch(() => {
        peer.blocked = true;
      })
      .finally(() => {
        if ([...this.peers.values()].includes(peer))
          this.update({
            blocked: [...this.peers.values()].some((p) => p.blocked),
          });
      });
  }
  join(session: TableSession) {
    if (this.session === session) return;
    this.session = session;
    this.unsub = [
      session.subscribe(() => this.sync()),
      session.onMessage((m) => {
        this.dispatch(m);
      }),
    ];
    window.addEventListener("pointerdown", this.resumeOnGesture, {
      passive: true,
    });
    window.addEventListener("keydown", this.resumeOnGesture);
    document.addEventListener("visibilitychange", this.resumeOnVisible);
    gsap.ticker.add(this.tick);
    this.sync();
  }
  private resumeOnGesture = () => {
    if (
      this.snapshot.blocked ||
      (this.context?.state === "suspended" && this.peers.size)
    )
      void this.unlock();
  };
  private resumeOnVisible = () => {
    if (
      !document.hidden &&
      this.gestureReady &&
      this.context?.state === "suspended"
    )
      void this.unlock();
  };
  private dispatch(m: Envelope) {
    if (!["signal", "voice_retry", "host_mute_request"].includes(m.event))
      return;
    // ICE, offers and answers arrive independently through Firebase. Serialize
    // them per sender so a fast answer cannot race a pending remote description.
    const prior = this.signaling.get(m.from) || Promise.resolve();
    const next = prior.catch(() => {}).then(() => this.receive(m));
    this.signaling.set(m.from, next);
    void next
      .finally(() => {
        if (this.signaling.get(m.from) === next) this.signaling.delete(m.from);
      })
      .catch(() => {});
  }
  private sync() {
    const table = this.session?.getSnapshot();
    if (!table) return;
    if (this.iceConfig !== table.config.iceServers) {
      this.iceConfig = table.config.iceServers;
      for (const p of this.peers.values()) {
        try { p.pc.setConfiguration({ iceServers: this.iceConfig }); } catch {}
      }
    }
    if (table.state !== "joined" || !table.config.voice) {
      [...this.peers.keys()].forEach((id) => this.remove(id));
      if (table.state === "idle") this.stopMic();
      return;
    }
    const queued = this.pending.splice(0);
    queued.forEach((m) => {
      this.dispatch(m);
    });
    const ids = table.members.filter((m) => m.id !== table.id).map((m) => m.id);
    [...this.peers.keys()]
      .filter((id) => !ids.includes(id))
      .forEach((id) => this.remove(id));
    for (const id of ids)
      if (!this.peers.has(id)) {
        const p = this.makePeer(id);
        if (table.id < id) void this.offer(id, p);
      }
  }
  private makePeer(id: string) {
    const table = this.session!.getSnapshot(),
      pc = new RTCPeerConnection({ iceServers: table.config.iceServers }),
      audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.hidden = true;
    document.body.appendChild(audio);
    const peer: Peer = {
      pc,
      audio,
      blocked: false,
      readingStats: false,
      nextStats: 0,
      ice: [],
      retries: 0,
      held: 0,
      volume: this.snapshot.volumes[id] ?? 1,
    };
    this.peers.set(id, peer);
    if (table.id < id) pc.addTransceiver("audio", { direction: "sendrecv" });
    pc.onicecandidate = (e) => {
      if (e.candidate)
        this.session?.send("signal", {
          to: id,
          kind: "ice",
          data: e.candidate.toJSON(),
        });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      peer.stream = stream;
      audio.srcObject = stream;
      this.applyVolume(peer);
      // Native playout drives the receiver's decoder. A second muted sink or
      // Web Audio-only graph can leave its playout path silent in Chromium.
      this.play(peer);
    };
    pc.onconnectionstatechange = () => {
      this.peerState(id, pc.connectionState);
      if (pc.connectionState === "connected") {
        if (peer.watchdog) clearTimeout(peer.watchdog);
        void this.attach(peer).catch(() => this.trouble(id));
        this.update({ message: "" });
      }
      if (pc.connectionState === "failed") {
        if (peer.retries++ === 0) {
          if (table.id < id) void this.offer(id, peer, true);
          else this.session?.send("voice_retry", { to: id });
        } else this.trouble(id);
      }
    };
    this.peerState(id, "connecting");
    peer.watchdog = setTimeout(() => {
      if (this.peers.get(id) === peer && pc.connectionState !== "connected")
        this.trouble(id);
    }, 18000);
    return peer;
  }
  private trouble(id: string) {
    const name =
      this.session?.getSnapshot().members.find((m) => m.id === id)?.name ||
      "your friend";
    this.update({
      message: `Voice couldn’t connect to ${name}. Try reconnecting voice.${this.session?.getSnapshot().config.iceServers.some((s) => [s.urls].flat().some((u) => /^turns?:/.test(u))) ? "" : " This network may need a voice relay; table chat still works."}`,
    });
  }
  private peerState(id: string, state: string) {
    this.onPeerState?.(id, state);
    this.update({ peers: { ...this.snapshot.peers, [id]: state } });
  }
  private async attach(peer: Peer) {
    if (peer.pc.signalingState === "closed") return;
    const transceiver = peer.pc
      .getTransceivers()
      .find((t) => t.receiver.track.kind === "audio");
    if (!transceiver) return;
    transceiver.direction = "sendrecv";
    if (this.stream)
      await transceiver.sender.replaceTrack(this.stream.getAudioTracks()[0]);
    if (this.stream) transceiver.sender.setStreams(this.stream);
    const params = transceiver.sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 32000;
    await transceiver.sender.setParameters(params).catch(() => {});
  }
  private async offer(id: string, peer: Peer, restart = false) {
    try {
      await this.attach(peer);
      const offer = await peer.pc.createOffer({ iceRestart: restart });
      await peer.pc.setLocalDescription(offer);
      if (this.peers.get(id) === peer)
        this.session?.send("signal", {
          to: id,
          kind: "offer",
          data: { type: "offer", sdp: offer.sdp },
        });
    } catch {
      if (this.peers.has(id)) this.trouble(id);
    }
  }
  private async receive(m: Envelope) {
    const table = this.session?.getSnapshot();
    if (!table || !table.config.voice) return;
    if (table.state === "connecting" || table.state === "reconnecting") {
      if (this.pending.length < 80) this.pending.push(m);
      return;
    }
    if (table.state !== "joined") return;
    if (
      m.event === "host_mute_request" &&
      m.data.targetId === table.id &&
      m.from === table.host
    ) {
      await this.setMuted(true);
      this.update({
        message: "The host asked for a quiet moment. Your mic is muted.",
      });
      return;
    }
    if (m.data.to !== table.id) return;
    if (m.event === "voice_retry" && table.id < m.from) {
      const p = this.peers.get(m.from);
      if (m.data.renegotiate === true) {
        if (p && p.pc.signalingState === "stable") await this.offer(m.from, p);
        return;
      }
      if (p && p.retries === 0) {
        p.retries++;
        await this.offer(m.from, p, true);
      }
      return;
    }
    if (
      m.event !== "signal" ||
      !["offer", "answer", "ice"].includes(String(m.data.kind)) ||
      !object(m.data.data)
    )
      return;
    const kind = m.data.kind,
      data = m.data.data;
    if (
      (kind === "offer" && m.from >= table.id) ||
      (kind === "answer" && m.from <= table.id)
    )
      return;
    const peer = this.peers.get(m.from) || this.makePeer(m.from),
      pc = peer.pc;
    try {
      if (kind === "ice") {
        if (
          typeof data.candidate !== "string" ||
          data.candidate.length > 3000 ||
          (data.sdpMid != null &&
            (typeof data.sdpMid !== "string" || data.sdpMid.length > 32)) ||
          (data.sdpMLineIndex != null &&
            (!Number.isInteger(data.sdpMLineIndex) ||
              Number(data.sdpMLineIndex) < 0 ||
              Number(data.sdpMLineIndex) > 10))
        )
          return;
        const candidate = data as RTCIceCandidateInit;
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else if (peer.ice.length < 80) peer.ice.push(candidate);
        return;
      }
      if (
        data.type !== kind ||
        typeof data.sdp !== "string" ||
        data.sdp.length > 60000
      )
        return;
      if (kind === "answer" && pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription({
        type: kind as "offer" | "answer",
        sdp: data.sdp,
      });
      for (const ice of peer.ice.splice(0)) await pc.addIceCandidate(ice);
      if (kind === "offer") {
        await this.attach(peer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.session?.send("signal", {
          to: m.from,
          kind: "answer",
          data: { type: "answer", sdp: answer.sdp },
        });
      }
    } catch {
      if (this.peers.has(m.from)) this.trouble(m.from);
    }
  }
  async setMuted(muted: boolean) {
    this.desiredMuted = muted;
    if (this.busy) return;
    this.busy = true;
    const epoch = this.epoch;
    try {
      if (!muted && !this.stream) {
        void this.unlock();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
        if (
          epoch !== this.epoch ||
          !this.session ||
          this.session.getSnapshot().state !== "joined"
        ) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.stream = stream;
        const track = stream.getAudioTracks()[0];
        track.onended = () => {
          this.stopMic();
          this.update({
            message: "Your microphone disconnected. You can still listen.",
          });
        };
        const ctx = this.audioContext();
        this.localSource = ctx.createMediaStreamSource(stream);
        this.localAnalyser = ctx.createAnalyser();
        this.localAnalyser.fftSize = 512;
        this.localSource.connect(this.localAnalyser);
        await Promise.all([...this.peers.values()].map((p) => this.attach(p)));
        // A table is initially listen-only. Announce the first real microphone
        // track in SDP as well as replaceTrack, so stream-less receivers in
        // different browsers don't remain stuck on their initial silent track.
        const table = this.session.getSnapshot();
        for (const [id, peer] of this.peers) {
          if (table.id < id && peer.pc.signalingState === "stable")
            void this.offer(id, peer);
          else if (table.id > id)
            this.session.send("voice_retry", { to: id, renegotiate: true });
        }
        if (navigator.permissions?.query)
          void navigator.permissions
            .query({ name: "microphone" as PermissionName })
            .then((p) => {
              if (epoch !== this.epoch) return;
              this.permissionStatus = p;
              p.onchange = () => {
                if (p.state === "denied") {
                  this.stopMic();
                  this.update({
                    message:
                      "Microphone access was turned off. You can still listen.",
                  });
                }
              };
            })
            .catch(() => {});
        try {
          if (!sessionStorage.getItem("todo.headphones-tip")) {
            this.update({ message: "Headphones help avoid echo." });
            sessionStorage.setItem("todo.headphones-tip", "1");
          }
        } catch {}
      }
      const track = this.stream?.getAudioTracks()[0];
      if (track) track.enabled = !this.desiredMuted;
      this.update({ muted: !track || this.desiredMuted, permission: !!track });
      this.session?.setMic(!!track && !this.desiredMuted, !!track);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      this.stopMic();
      this.update({
        muted: true,
        message:
          name === "NotAllowedError"
            ? "Microphone access wasn't allowed. You can still listen."
            : name === "NotFoundError"
              ? "No microphone found. You can still listen."
              : "Couldn't use the microphone. You can still listen.",
      });
      this.session?.setMic(false, false);
    } finally {
      this.busy = false;
    }
  }
  async retry() {
    await this.unlock();
    const table = this.session?.getSnapshot();
    if (!table || table.state !== "joined") return;
    this.update({ message: "Reconnecting voice…" });
    for (const [id, peer] of this.peers) {
      peer.retries = 0;
      if (table.id < id) void this.offer(id, peer, true);
      else this.session?.send("voice_retry", { to: id });
    }
  }
  setPeerVolume(id: string, value: number) {
    const volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    this.update({ volumes: { ...this.snapshot.volumes, [id]: volume } });
    const p = this.peers.get(id);
    if (p) {
      p.volume = volume;
      this.applyVolume(p);
    }
  }
  muteAllIncoming(muted: boolean) {
    this.update({ incomingMuted: muted });
    this.peers.forEach((p) => this.applyVolume(p));
  }
  private applyVolume(p: Peer) {
    p.audio.muted = this.snapshot.incomingMuted;
    p.audio.volume = p.volume;
  }
  private tick = (time: number) => {
    if (time - this.lastSample < 1 / 15 || document.hidden) return;
    this.lastSample = time;
    const speaking: Record<string, boolean> = {},
      now = performance.now();
    const sample = (
      analyser: AnalyserNode,
      data: Float32Array<ArrayBuffer>,
    ) => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / data.length) > 0.02;
    };
    for (const [id, peer] of this.peers) {
      if (!peer.readingStats && now >= peer.nextStats) {
        peer.readingStats = true;
        peer.nextStats = now + 180;
        void peer.pc
          .getStats()
          .then((report) => {
            if (this.peers.get(id) !== peer) return;
            report.forEach((stat) => {
              if (
                stat.type === "inbound-rtp" &&
                (stat.kind === "audio" || stat.mediaType === "audio") &&
                Number(stat.audioLevel) > 0.015
              )
                peer.held = performance.now() + 320;
            });
          })
          .catch(() => {})
          .finally(() => {
            peer.readingStats = false;
          });
      }
      speaking[id] = peer.held > now;
    }
    const id = this.session?.getSnapshot().id;
    if (id) {
      if (
        !this.snapshot.muted &&
        this.localAnalyser &&
        sample(this.localAnalyser, this.localSamples)
      )
        this.localHeld = now + 150;
      speaking[id] = !this.snapshot.muted && this.localHeld > now;
    }
    if (JSON.stringify(speaking) !== JSON.stringify(this.snapshot.speaking)) {
      for (const [id, value] of Object.entries(speaking))
        if (value !== !!this.snapshot.speaking[id])
          this.onSpeaking?.(id, value);
      this.update({ speaking });
    }
  };
  private remove(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    if (p.watchdog) clearTimeout(p.watchdog);
    p.audio.pause();
    p.audio.srcObject = null;
    p.audio.remove();
    this.peers.delete(id);
    const peers = { ...this.snapshot.peers },
      speaking = { ...this.snapshot.speaking };
    delete peers[id];
    delete speaking[id];
    this.update({
      peers,
      speaking,
      blocked: [...this.peers.values()].some((peer) => peer.blocked),
    });
  }
  private stopMic() {
    this.epoch++;
    if (this.permissionStatus) this.permissionStatus.onchange = null;
    this.permissionStatus = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    this.localSource?.disconnect();
    this.localAnalyser?.disconnect();
    this.localSource = null;
    this.localAnalyser = null;
    this.update({ muted: true, permission: false });
    this.session?.setMic(false, false);
  }
  leave() {
    window.removeEventListener("pointerdown", this.resumeOnGesture);
    window.removeEventListener("keydown", this.resumeOnGesture);
    document.removeEventListener("visibilitychange", this.resumeOnVisible);
    this.unsub.forEach((fn) => fn());
    this.unsub = [];
    this.stopMic();
    [...this.peers.keys()].forEach((id) => this.remove(id));
    this.session = null;
    this.iceConfig = null;
    gsap.ticker.remove(this.tick);
    const ctx = this.context;
    this.context = null;
    void ctx?.close().catch(() => {});
    this.gestureReady = false;
    this.pending = [];
    this.signaling.clear();
    this.update({
      message: "",
      blocked: false,
      incomingMuted: false,
      speaking: {},
      peers: {},
    });
  }
}
