/** Owner-run relay check. Reads local private env; prints no addresses or credentials.
 * node --env-file-if-exists=.env.local scripts/verify-turn.mjs
 * Uses generated tones, never captures a person's microphone. */
import { chromium } from "@playwright/test";
import {
  createMeteredRelayIssuer,
  createRelayIssuer,
} from "../lib/todo/table/relay.ts";

const metered = process.env.TODO_TURN_METERED_HOST;
let iceServers = metered
  ? await createMeteredRelayIssuer()("owner-verification", {
      host: metered,
      apiKey: process.env.TODO_TURN_METERED_API_KEY || "",
    })
  : await createRelayIssuer()("owner-verification", {
      id: process.env.TODO_TURN_KEY_ID || "",
      token: process.env.TODO_TURN_API_TOKEN || "",
    });
if (process.argv.includes("--tls-only")) {
  for (const server of iceServers)
    server.urls = [server.urls]
      .flat()
      .filter((url) => /^turns:.*:443\?transport=tcp$/.test(url));
  if (!iceServers.some((server) => server.urls.length))
    throw new Error("No TLS relay on port 443 was returned");
  iceServers = iceServers.filter(server => server.urls.length);
}
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--disable-audio-output",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async (iceServers) => {
    const a = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "relay",
    });
    const b = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "relay",
    });
    const context = new AudioContext();
    const players = [];
    const oscillators = [];
    const tracks = [];
    const queues = [[], []];
    try {
      await context.resume();
      for (const [i, pc] of [a, b].entries()) {
        const osc = context.createOscillator();
        osc.frequency.value = i ? 440 : 330;
        const dest = context.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        oscillators.push(osc);
        const track = dest.stream.getAudioTracks()[0];
        tracks.push(track);
        pc.addTrack(track, dest.stream);
        pc.ontrack = (event) => {
          const audio = document.createElement("audio");
          audio.srcObject = event.streams[0];
          audio.autoplay = true;
          document.body.append(audio);
          players.push(audio);
          void audio.play();
        };
        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          const target = i ? a : b;
          if (target.remoteDescription)
            void target.addIceCandidate(event.candidate);
          else queues[1 - i].push(event.candidate);
        };
      }
      await a.setLocalDescription(await a.createOffer());
      await b.setRemoteDescription(a.localDescription);
      for (const candidate of queues[1].splice(0))
        await b.addIceCandidate(candidate);
      await b.setLocalDescription(await b.createAnswer());
      await a.setRemoteDescription(b.localDescription);
      for (const candidate of queues[0].splice(0))
        await a.addIceCandidate(candidate);
      const deadline = Date.now() + 45000;
      let last;
      while (Date.now() < deadline) {
        const stats = await Promise.all(
          [a, b].map(async (pc) => {
            const report = await pc.getStats();
            let packets = 0,
              energy = 0,
              candidateType = "",
              protocol = "";
            report.forEach((s) => {
              if (s.type === "inbound-rtp" && s.kind === "audio") {
                packets += s.packetsReceived || 0;
                energy += s.totalAudioEnergy || 0;
              }
              if (s.type === "transport" && s.selectedCandidatePairId) {
                const pair = report.get(s.selectedCandidatePairId);
                const candidate = pair && report.get(pair.localCandidateId);
                candidateType = candidate?.candidateType || "";
                protocol =
                  candidate?.relayProtocol || candidate?.protocol || "";
              }
            });
            return {
              state: pc.connectionState,
              packets,
              energy,
              candidateType,
              protocol,
            };
          }),
        );
        last = stats;
        if (
          stats.every(
            (s) =>
              s.state === "connected" &&
              s.candidateType === "relay" &&
              s.packets > 30 &&
              s.energy > 0,
          )
        )
          return stats;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error(
        "Forced relay audio check timed out: " + JSON.stringify(last),
      );
    } finally {
      a.close();
      b.close();
      tracks.forEach((t) => t.stop());
      oscillators.forEach((o) => o.stop());
      players.forEach((p) => {
        p.pause();
        p.srcObject = null;
        p.remove();
      });
      await context.close();
    }
  }, iceServers);
  console.log(
    JSON.stringify(
      {
        test: "bidirectional synthetic audio through forced TURN",
        passed: true,
        peers: result,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
