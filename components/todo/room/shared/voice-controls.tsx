"use client";
import { Mic, MicOff, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TableVoice, VoiceSnapshot } from "@/lib/todo/table/voice";
const needsReconnect = (state: VoiceSnapshot) =>
  state.message.includes("Voice couldn’t connect") ||
  state.message.includes("Having trouble connecting") ||
  Object.values(state.peers).some(
    (s) => s === "failed" || s === "disconnected",
  );
export function VoiceControls({
  voice,
  state,
}: {
  voice: TableVoice;
  state: VoiceSnapshot;
}) {
  return (
    <div className="table-voice-controls">
      <label>
        <span>Mute everyone</span>
        <Switch
          checked={state.incomingMuted}
          onCheckedChange={(v) => voice.muteAllIncoming(v)}
          aria-label="Mute everyone"
        />
      </label>
      {state.message && (
        <p role="status" className="table-notice">
          {state.message}
        </p>
      )}
      {state.blocked && (
        <Button onClick={() => void voice.unlock()}>
          <Volume2 size={15} />
          Tap to enable sound
        </Button>
      )}
      {needsReconnect(state) && (
        <Button variant="ghost" onClick={() => void voice.retry()}>
          <RefreshCw size={14} />
          Reconnect voice
        </Button>
      )}
    </div>
  );
}
export function PersistentMic({
  voice,
  state,
}: {
  voice: TableVoice;
  state: VoiceSnapshot;
}) {
  return (
    <div className="table-persistent-mic" data-live={!state.muted}>
      <button
        onClick={() => void voice.setMuted(!state.muted)}
        aria-label={state.muted ? "Unmute microphone" : "Mute microphone"}
      >
        {state.muted ? <MicOff size={14} /> : <Mic size={14} />}
        <span>{state.muted ? "Mic off" : "Mic on"}</span>
      </button>
      {state.message && <small role="status">{state.message}</small>}
      {state.blocked && (
        <button onClick={() => void voice.unlock()}>
          <VolumeX size={14} />
          Tap to enable sound
        </button>
      )}
      {needsReconnect(state) && (
        <button onClick={() => void voice.retry()}>
          <RefreshCw size={14} />
          Reconnect voice
        </button>
      )}
    </div>
  );
}
