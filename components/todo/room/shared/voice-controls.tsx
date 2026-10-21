"use client";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TableVoice, VoiceSnapshot } from "@/lib/todo/table/voice";
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
      {state.blocked && (
        <button onClick={() => void voice.unlock()}>
          <VolumeX size={14} />
          Enable sound
        </button>
      )}
    </div>
  );
}
