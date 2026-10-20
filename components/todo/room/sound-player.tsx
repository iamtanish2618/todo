"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOUND_RECORDINGS, type Recording } from "./ambience";

type Player = {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
};
type PlayerEvent = { target: Player; data: number };
type YouTube = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: PlayerEvent) => void;
        onStateChange: (event: PlayerEvent) => void;
        onError: (event: PlayerEvent) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YouTube;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiReady: Promise<YouTube> | null = null;
/** Load the official player only after a recording is explicitly selected. */
function loadPlayerAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiReady) return apiReady;
  apiReady = new Promise<YouTube>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      apiReady = null;
      reject(new Error("YouTube could not load."));
    };
    const timeout = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiReady;
}

/** The video stays visible during focus; we never extract or hide YouTube audio. */
export function RoomSoundPlayer({
  recording,
  paused,
  onStop,
}: {
  recording: Recording;
  paused: boolean;
  onStop: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const suspended = useRef(paused);
  suspended.current = paused;
  const wasPlaying = useRef(false);
  const resumeAfterCelebration = useRef(false);
  const [status, setStatus] = useState("Loading recording…");
  const [failed, setFailed] = useState(false);
  const source = SOUND_RECORDINGS[recording];
  useEffect(() => {
    let disposed = false;
    let current: Player | null = null;
    let readiness: ReturnType<typeof setTimeout> | undefined;
    setStatus("Loading recording…");
    setFailed(false);
    // YouTube replaces its mount node; isolate that mutation from React's DOM.
    const container = mount.current!;
    const target = document.createElement("div");
    container.appendChild(target);
    void loadPlayerAPI()
      .then((YT) => {
        if (disposed) return;
        readiness = setTimeout(() => {
          if (!disposed) {
            setStatus("Press play in the video, or open it on YouTube.");
            setFailed(true);
          }
        }, 15000);
        current = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "200",
          videoId: source.videoId,
          playerVars: {
            origin: window.location.origin,
            autoplay: 0,
            playsinline: 1,
            controls: 1,
            loop: 1,
            playlist: source.videoId,
            rel: 0,
          },
          events: {
            onReady: ({ target: ready }) => {
              if (disposed) return;
              clearTimeout(readiness);
              player.current = ready;
              ready.setVolume(25);
              setStatus("Press play in the video if it hasn't started.");
              if (!suspended.current) ready.playVideo();
            },
            onStateChange: ({ data }) => {
              if (disposed) return;
              if (data === 1 && suspended.current) {
                player.current?.pauseVideo();
                return;
              }
              if (data === 1) {
                setStatus("Playing on YouTube");
                setFailed(false);
              } else if (data === 2) setStatus("Paused");
              else if (data === 3) setStatus("Buffering…");
              wasPlaying.current = data === 1;
            },
            onAutoplayBlocked: () => {
              if (!disposed) setStatus("Press play in the video to listen.");
            },
            onError: () => {
              if (disposed) return;
              clearTimeout(readiness);
              setStatus("This recording can't play here. Open it on YouTube.");
              setFailed(true);
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true);
          setStatus("YouTube couldn't load. Open the recording below.");
        }
      });
    return () => {
      disposed = true;
      clearTimeout(readiness);
      current?.destroy();
      player.current = null;
      container.replaceChildren();
    };
  }, [source.videoId]);
  useEffect(() => {
    if (paused) {
      resumeAfterCelebration.current = wasPlaying.current;
      player.current?.pauseVideo();
    } else if (resumeAfterCelebration.current) {
      resumeAfterCelebration.current = false;
      player.current?.playVideo();
    }
  }, [paused]);
  return (
    <section
      className="room-recording-player"
      aria-label={`${source.label} player`}
    >
      <header>
        <span>{source.label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Stop sound"
          onClick={onStop}
        >
          <VolumeX size={15} />
        </Button>
      </header>
      <div className="room-youtube-mount" ref={mount} />
      <footer>
        <span
          role="status"
          title={status}
          className={failed ? "recording-unavailable" : ""}
        >
          {status}
        </span>
        <a
          href={`https://www.youtube.com/watch?v=${source.videoId}`}
          target="_blank"
          rel="noopener"
          aria-label={`Open ${source.label} on YouTube`}
        >
          YouTube <ExternalLink size={11} />
        </a>
      </footer>
    </section>
  );
}
