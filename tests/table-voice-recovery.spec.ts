import { test, expect } from "@playwright/test";
import { TableVoice } from "../lib/todo/table/voice";
function setup() {
  const calls: string[] = [];
  const config = { voice: true, iceServers: [{ urls: "stun:old.test:3478" }] };
  const snapshot = {
    state: "joined",
    id: "a",
    members: [{ id: "a" }, { id: "b" }],
    config,
  };
  const pc = {
    signalingState: "stable",
    connectionState: "failed",
    setConfiguration: (value: { iceServers: RTCIceServer[] }) => {
      calls.push(String(value.iceServers[0].urls));
    },
    getTransceivers: () => [],
    createOffer: async () => {
      calls.push("offer");
      return { type: "offer", sdp: "test-sdp" };
    },
    setLocalDescription: async () => {
      pc.signalingState = "have-local-offer";
    },
  };
  const peer = {
    pc,
    retries: 2,
    makingOffer: false,
    offerPending: false,
    restartPending: false,
  };
  // Isolate signaling/control logic. Real relay audio is checked separately.
  const voice = new TableVoice() as any;
  voice.unlock = async () => {};
  voice.session = {
    getSnapshot: () => snapshot,
    send: () => {
      calls.push("signal");
    },
    refreshConfig: async () => {
      calls.push("refresh");
      config.iceServers = [{ urls: "turns:relay.test:443?transport=tcp" }];
    },
  };
  voice.peers.set("b", peer);
  return { voice, peer, pc, calls };
}
test("reconnect refreshes relay settings and applies them before restarting ICE", async () => {
  const { voice, calls } = setup();
  await voice.retry();
  await expect.poll(() => calls.includes("signal")).toBe(true);
  expect(calls.slice(0, 3)).toEqual([
    "refresh",
    "turns:relay.test:443?transport=tcp",
    "offer",
  ]);
});
test("a manual remote retry is accepted after an earlier failed retry", async () => {
  const { voice, calls } = setup();
  await voice.receive({
    from: "b",
    event: "voice_retry",
    data: { to: "a", manual: true },
  });
  expect(calls).toContain("refresh");
  expect(calls).toContain("offer");
  expect(calls).toContain("signal");
});
test("microphone renegotiation waits for an outstanding offer instead of colliding", async () => {
  const { voice, peer, pc, calls } = setup();
  pc.signalingState = "have-local-offer";
  await voice.offer("b", peer, true);
  expect(peer.offerPending).toBe(true);
  expect(calls).not.toContain("offer");
  pc.signalingState = "stable";
  await voice.offer("b", peer);
  expect(peer.offerPending).toBe(false);
  expect(calls.filter((c) => c === "offer")).toHaveLength(1);
});

test("denied and missing microphones stay muted with friendly notices", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  try {
    for (const name of [
      "NotAllowedError",
      "NotFoundError",
      "NotReadableError",
    ]) {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("raw driver detail", name);
          },
        },
      });
      const voice = new TableVoice();
      voice.unlock = async () => {};
      await voice.setMuted(false);
      expect(voice.getSnapshot().muted).toBe(true);
      expect(voice.getSnapshot().message).toContain("You can still listen.");
      expect(voice.getSnapshot().message).not.toContain("raw driver");
    }
  } finally {
    if (descriptor)
      Object.defineProperty(navigator, "mediaDevices", descriptor);
    else Reflect.deleteProperty(navigator, "mediaDevices");
  }
});
