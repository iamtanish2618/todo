/** Browser-only QA fixture, excluded from production's app entry graph. */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getDatabase,
  connectDatabaseEmulator,
  goOffline,
  goOnline,
} from "firebase/database";
import { TableSession } from "../../lib/todo/table/session";
import { TableVoice } from "../../lib/todo/table/voice";
import { BreakGameSession } from "../../lib/todo/table/games";
import { BreakGames } from "../../components/todo/room/shared/break-games";
import { EMPTY_CONFIG } from "../../lib/todo/table/protocol";
export async function harness(email: string, password: string) {
  const app =
    getApps().find((a) => a.name === "todo-auth") ||
    initializeApp(
      {
        projectId: "demo-todo",
        apiKey: "fake-api-key",
        authDomain: "demo-todo.firebaseapp.com",
        databaseURL: "https://demo-todo-default-rtdb.firebaseio.com",
      },
      "todo-auth",
    );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, password);
  const db = getDatabase(app, "https://demo-todo-default-rtdb.firebaseio.com");
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  const session = new TableSession();
  session.configure({
    ...EMPTY_CONFIG,
    configured: true,
    voice: true,
    url: "https://demo-todo-default-rtdb.firebaseio.com",
    iceServers: [],
  });
  const voice = new TableVoice();
  voice.join(session);
  const games = new BreakGameSession(session);
  games.connect();
  return {
    session,
    voice,
    games,
    disconnect: () => goOffline(db),
    reconnect: () => goOnline(db),
  };
}
import { createRoot } from "react-dom/client";
import { useSyncExternalStore } from "react";
import { RoomScene } from "../../components/todo/room/scene";
import { TableSeats } from "../../components/todo/room/shared/seating";
import { FriendsPanel } from "../../components/todo/room/shared/friends";
import { VoiceControls } from "../../components/todo/room/shared/voice-controls";
import "../../components/todo/room/room.css";
import "../../components/todo/room/scene.css";
import "../../components/todo/room/calm.css";
import "../../components/todo/room/cinematic.css";
import "../../components/todo/room/dock-panels.css";
import "../../components/todo/room/shared/shared.css";
function QAView({
  session,
  voice,
  games,
}: {
  session: TableSession;
  voice: TableVoice;
  games: BreakGameSession;
}) {
  const game = useSyncExternalStore(games.subscribe, games.getSnapshot);
  const table = useSyncExternalStore(session.subscribe, session.getSnapshot),
    state = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
  return (
    <main
      className="cozy-room cozy-room-active"
      data-loaded="true"
      data-dock="true"
    >
      <div className="cozy-room-stage">
        {game.active && (
          <button
            className="qa-play"
            style={{
              position: "absolute",
              left: "50%",
              bottom: "5%",
              zIndex: 50,
            }}
            onClick={() => games.showMenu()}
          >
            Play
          </button>
        )}
        <BreakGames games={games} reduced={false} sound={false} />
        <RoomScene
          pose="idle"
          female={false}
          reduced={false}
          active
          sky="night"
          focusing={false}
          clock={null}
          weather="night"
          arrived
          teammates={
            table.members.length ? (
              <TableSeats
                table={table}
                voice={voice}
                voiceState={state}
                session={session}
                reduced={false}
              />
            ) : undefined
          }
        />
        <section className="dock-panel" data-dock-pane="friends">
          <div className="room-panel-heading">
            <h2>Friends</h2>
          </div>
          <div className="room-panel-body">
            <FriendsPanel
              session={session}
              table={table}
              onGesture={() => void voice.unlock()}
            >
              <VoiceControls voice={voice} state={state} />
            </FriendsPanel>
          </div>
        </section>
      </div>
    </main>
  );
}
export function mountRoom(qa: {
  session: TableSession;
  voice: TableVoice;
  games: BreakGameSession;
}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  createRoot(target).render(<QAView {...qa} />);
}
