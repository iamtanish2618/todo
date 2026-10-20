import type { Envelope, Member, PublicConfig } from "./protocol";
export type Transport = {
  connect: (
    code: string,
    id: string,
    sync: (state: Record<string, unknown[]>) => void,
    message: (value: unknown) => void,
    state: (connected: boolean) => void,
  ) => Promise<void>;
  track: (member: Member) => Promise<void>;
  send: (message: Envelope) => void;
  close: () => Promise<void>;
};
/** Firebase is already installed for Todo accounts. Room data is temporary and separate. */
export async function firebaseTransport(
  config: PublicConfig,
): Promise<Transport> {
  const [appSDK, authSDK, sdk] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/database"),
  ]);
  const app = appSDK.getApps().find((a) => a.name === "todo-auth");
  if (!app) throw new Error("signin");
  const auth = authSDK.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser?.emailVerified) throw new Error("signin");
  const uid = auth.currentUser.uid,
    db = sdk.getDatabase(app, config.url);
  let code = "",
    id = "",
    closed = false,
    member: Member | null = null;
  let connected = false,
    serverOffset = 0;
  const cleanups: (() => void)[] = [],
    outgoing = new Set<string>(),
    pending = new Set<ReturnType<typeof setTimeout>>();
  let peers: string[] = [];
  let disconnect: ReturnType<typeof sdk.onDisconnect> | null = null;
  const cleanupPaths = () => ({
    [`tables/${code}/members/${id}`]: null,
    [`tables/${code}/inbox/${id}`]: null,
    [`tableClaims/${code}/${id}`]: null,
  });
  let inboxOff = () => {},
    onMessage: (value: unknown) => void = () => {};
  const seen = new Set<string>();
  function listenInbox() {
    inboxOff();
    inboxOff = sdk.onValue(
      sdk.ref(db, `tables/${code}/inbox/${id}`),
      (snapshot) => {
        const senders = snapshot.val() || {};
        for (const [senderId, batches] of Object.entries(senders)) {
          if (!batches || typeof batches !== "object") continue;
          for (const [key, unknownValue] of Object.entries(batches)) {
            if (seen.has(key)) continue;
            seen.add(key);
            if (seen.size > 1500) seen.delete(seen.values().next().value!);
            const v = unknownValue as {
              from?: string;
              body?: string;
              sentAt?: number;
            };
            if (
              v &&
              v.from === senderId &&
              typeof v.body === "string" &&
              v.body.length <= 65000 &&
              typeof v.sentAt === "number" &&
              Math.abs(v.sentAt - (Date.now() + serverOffset)) < 60000
            ) {
              try {
                const payload = JSON.parse(v.body);
                if (payload.from === senderId) onMessage(payload);
              } catch {}
            }
            void sdk
              .remove(
                sdk.ref(db, `tables/${code}/inbox/${id}/${senderId}/${key}`),
              )
              .catch(() => {});
          }
        }
      },
      () => {},
    );
  }
  async function register() {
    if (closed || !member) return;
    await sdk.set(sdk.ref(db, `tableClaims/${code}/${id}`), uid);
    disconnect = sdk.onDisconnect(sdk.ref(db));
    await disconnect.update(cleanupPaths());
    if (!closed) {
      const result = await sdk.runTransaction(
        sdk.ref(db, `tables/${code}/members/${id}`),
        (current) => ({
          ...member,
          joinedAt: current?.joinedAt || sdk.serverTimestamp(),
        }),
        { applyLocally: false },
      );
      if (!result.committed) throw new Error("presence");
      listenInbox();
    }
  }
  return {
    connect: async (roomCode, peerId, sync, message, state) => {
      onMessage = message;
      code = roomCode;
      id = peerId;
      await new Promise<void>((resolve, reject) => {
        cleanups.push(
          sdk.onValue(
            sdk.ref(db, `tables/${code}/members`),
            (snap) => {
              const v = snap.val() || {};
              const next = Object.keys(v);
              for (const departed of peers.filter(
                (peer) => peer !== id && !next.includes(peer),
              )) {
                const path = `tables/${code}/inbox/${departed}/${id}`;
                outgoing.delete(path);
                void sdk.remove(sdk.ref(db, path)).catch(() => {});
                void sdk
                  .onDisconnect(sdk.ref(db, path))
                  .cancel()
                  .catch(() => {});
              }
              peers = next;
              sync(
                Object.fromEntries(
                  Object.entries(v).map(([k, value]) => [k, [value]]),
                ),
              );
              resolve();
            },
            reject,
          ),
        );
        cleanups.push(
          sdk.onValue(sdk.ref(db, ".info/serverTimeOffset"), (snap) => {
            serverOffset = Number(snap.val()) || 0;
          }),
        );
        cleanups.push(
          sdk.onValue(sdk.ref(db, ".info/connected"), (snap) => {
            const next = snap.val() === true;
            const reconnect = next && !connected && !!member;
            connected = next;
            if (reconnect) {
              disconnect = null;
              void register()
                .then(() => state(true))
                .catch(() => state(false));
            } else state(next);
          }),
        );
      });
      if (closed) return;
      // Listen to an inbox owned by this peer. Messages are deleted after receipt, never a history.
      await sdk.set(sdk.ref(db, `tableClaims/${code}/${id}`), uid);
      await sdk.onDisconnect(sdk.ref(db, `tableClaims/${code}/${id}`)).remove();
      listenInbox();
    },
    track: async (value) => {
      member = value;
      if (!disconnect) await register();
      else
        await sdk.update(sdk.ref(db, `tables/${code}/members/${id}`), {
          name: value.name,
          color: value.color,
          status: value.status,
          mic: value.mic,
          hasMicPermission: value.hasMicPermission,
          playing: value.playing,
        });
    },
    send: (value) => {
      if (closed || !connected || !member) return;
      // Fan-out only to currently admitted members; a maximum of three small writes.
      peers
        .filter(
          (peer) => peer !== id && (!value.data.to || value.data.to === peer),
        )
        .slice(0, 3)
        .forEach((peer) => {
          const path = `tables/${code}/inbox/${peer}/${id}`,
            target = sdk.push(sdk.ref(db, path));
          if (!outgoing.has(path)) {
            outgoing.add(path);
            void sdk.onDisconnect(sdk.ref(db, path)).remove();
          }
          void sdk
            .set(target, {
              from: id,
              body: JSON.stringify(value),
              sentAt: sdk.serverTimestamp(),
            })
            .then(() => {
              if (closed) {
                void sdk.remove(target).catch(() => {});
                return;
              }
              const t = setTimeout(() => {
                pending.delete(t);
                void sdk.remove(target).catch(() => {});
              }, 31000);
              pending.add(t);
            })
            .catch(() => {});
        });
    },
    close: async () => {
      closed = true;
      inboxOff();
      pending.forEach(clearTimeout);
      pending.clear();
      cleanups.forEach((fn) => fn());
      if (code && id) {
        const paths: Record<string, null> = cleanupPaths();
        outgoing.forEach((p) => {
          paths[p] = null;
        });
        await sdk.update(sdk.ref(db), paths).catch(() => {});
      }
      await disconnect?.cancel().catch(() => {});
    },
  };
}
