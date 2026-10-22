import { test, expect } from "@playwright/test";
import { TableSession } from "../lib/todo/table/session";
import {
  EMPTY_CONFIG,
  newCode,
  normalizeCode,
  readMember,
  nickname,
  type Member,
} from "../lib/todo/table/protocol";
import type { Transport } from "../lib/todo/table/transport";
function network() {
  const rooms = new Map<
    string,
    Map<
      string,
      {
        member: Member | null;
        sync: (v: Record<string, unknown[]>) => void;
        message: (v: unknown) => void;
      }
    >
  >();
  const emit = (code: string) => {
    const peers = rooms.get(code)!;
    const payload = Object.fromEntries(
      [...peers].filter(([, p]) => p.member).map(([id, p]) => [id, [p.member]]),
    );
    for (const p of peers.values()) p.sync(payload);
  };
  const factory = async (): Promise<Transport> => {
    let code = "",
      id = "";
    return {
      connect: async (c, i, sync, message, state) => {
        code = c;
        id = i;
        if (!rooms.has(c)) rooms.set(c, new Map());
        rooms.get(c)!.set(i, { sync, message, member: null });
        state(true);
        emit(c);
      },
      track: async (member) => {
        const p = rooms.get(code)?.get(id);
        if (p) {
          p.member = member;
          emit(code);
        }
      },
      send: (value) => {
        rooms.get(code)?.forEach((p, peer) => {
          if (peer !== id) p.message(value);
        });
      },
      close: async () => {
        rooms.get(code)?.delete(id);
        if (rooms.has(code)) emit(code);
      },
    };
  };
  const make = () => {
    const s = new TableSession(factory);
    s.configure({ ...EMPTY_CONFIG, configured: true });
    return s;
  };
  return { make, rooms };
}
test("room codes, names and malformed presence are bounded", () => {
  for (let i = 0; i < 300; i++)
    expect(newCode()).toMatch(/^PENG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(normalizeCode(" peng abc234 ")).toBe("PENG-ABC234");
  expect(normalizeCode("PENG-OOO111")).toBeNull();
  expect(nickname("  My   pen ")).toBe("My pen");
  expect(nickname("<script>")).toBeNull();
  expect(readMember({ id: "bad" }, "bad")).toBeNull();
});
test("join never creates, duplicate names resolve, host migrates and close clears members", async () => {
  const n = network(),
    a = n.make(),
    b = n.make(),
    c = n.make();
  await c.join(false, "PENG-ABC234", "Cee", "sage");
  expect(c.getSnapshot().message).toContain("couldn't find");
  await a.join(true, "", "Mia", "blue");
  const code = a.getSnapshot().code;
  await b.join(false, code, "Mia", "pink");
  expect(b.getSnapshot().members.map((m) => m.name)).toEqual(["Mia", "Mia 2"]);
  expect(b.getSnapshot().host).toBe(a.getSnapshot().id);
  await a.leave();
  expect(b.getSnapshot().host).toBe(b.getSnapshot().id);
  b.hostAction("close_room");
  await new Promise((r) => setTimeout(r, 0));
  expect(b.getSnapshot().state).toBe("idle");
  await c.leave();
});
test("four seats, optional timer, reactions throttled, non-host cannot close", async () => {
  const n = network(),
    people = Array.from({ length: 5 }, () => n.make());
  try {
    await people[0].join(true, "", "Host", "blue");
    const code = people[0].getSnapshot().code;
    for (let i = 1; i < 5; i++)
      await people[i].join(false, code, `Peer ${i}`, "sage");
    expect(people[4].getSnapshot().message).toBe("This table is full.");
    people[1].hostAction("close_room");
    expect(people[0].getSnapshot().state).toBe("joined");
    people[0].startSit(30);
    expect(people[1].getSnapshot().sit?.minutes).toBe(30);
    people[1].dismissSit();
    expect(people[1].getSnapshot().sit).toBeNull();
    people[0].reaction("heart");
    people[0].reaction("heart");
    expect(people[1].getSnapshot().reactions).toHaveLength(1);
    people[0].hostAction("kick", people[2].getSnapshot().id);
    await new Promise((r) => setTimeout(r, 0));
    expect(people[2].getSnapshot().message).toContain("removed");
  } finally {
    await Promise.all(people.map((p) => p.leave()));
  }
});

test("table chat is two-way, bounded and keeps the chosen companion independent of beanie color", async () => {
  const n = network(),
    a = n.make(),
    b = n.make();
  try {
    await a.join(true, "", "Tanish", "blue", "male");
    await b.join(false, a.getSnapshot().code, "Rose", "sage", "female");
    expect(
      a.getSnapshot().members.find((m) => m.name === "Rose")?.companion,
    ).toBe("female");
    expect(a.chat("Hello Rose")).toBe(true);
    expect(b.chat("Hi Tanish 👋")).toBe(true);
    expect(
      a
        .getSnapshot()
        .conversation.filter((m) => m.kind === "message")
        .map((m) => [m.name, m.text]),
    ).toEqual([
      ["Tanish", "Hello Rose"],
      ["Rose", "Hi Tanish 👋"],
    ]);
    expect(
      b
        .getSnapshot()
        .conversation.filter((m) => m.kind === "message")
        .map((m) => m.text),
    ).toEqual(["Hello Rose", "Hi Tanish 👋"]);
    expect(a.chat("x".repeat(1001))).toBe(false);
    expect(a.chat("\u0000bad")).toBe(false);
    expect(a.chat("  ")).toBe(false);
    for (let i = 0; i < 5; i++) expect(a.chat(`Message ${i}`)).toBe(true);
    expect(a.chat("too fast")).toBe(false);
    a.send("chat", { id: "bad-id", text: "forged" });
    expect(b.getSnapshot().conversation.some((m) => m.text === "forged")).toBe(
      false,
    );
    await a.leave();
    expect(a.getSnapshot().conversation).toEqual([]);
    expect(
      b.getSnapshot().conversation.some((m) => m.text === "Hello Rose"),
    ).toBe(true);
  } finally {
    await Promise.all([a.leave(), b.leave()]);
  }
});

test("game invitations stay in table chat, including when a teammate is busy, and do not duplicate", async () => {
  const n = network(),
    a = n.make(),
    b = n.make();
  try {
    await a.join(true, "", "Tanish", "blue");
    await b.join(false, a.getSnapshot().code, "Rose", "pink");
    const at = Date.now();
    a.send("game_invite", { game: "bubbles", startAt: at });
    a.send("game_invite", { game: "bubbles", startAt: at });
    expect(
      b.getSnapshot().conversation.filter((m) => m.kind === "game"),
    ).toHaveLength(1);
    expect(
      b.getSnapshot().conversation.find((m) => m.kind === "game"),
    ).toMatchObject({ name: "Tanish", game: "bubbles", startAt: at });
    a.send("game_invite", { game: "unknown", startAt: at });
    expect(
      b.getSnapshot().conversation.filter((m) => m.kind === "game"),
    ).toHaveLength(1);
    for (let i = 0; i < 220; i++) a.notice(`Status ${i}`);
    expect(b.getSnapshot().conversation.some((m) => m.game === "bubbles")).toBe(
      true,
    );
  } finally {
    await Promise.all([a.leave(), b.leave()]);
  }
});

test("transient presence failure retries automatically without discarding the table", async () => {
  let sync: (v: Record<string, unknown[]>) => void = () => {},
    attempts = 0;
  const session = new TableSession(async () => ({
    connect: async (_code, _id, updated, _message, state) => {
      sync = updated;
      state(true);
      sync({});
    },
    track: async (member) => {
      attempts++;
      if (attempts === 2) throw new Error("transient");
      sync({ [member.id]: [member] });
    },
    send: () => {},
    close: async () => {},
  }));
  session.configure({ ...EMPTY_CONFIG, configured: true });
  try {
    await session.join(true, "", "Tester", "blue");
    const code = session.getSnapshot().code;
    session.setMic(true, true);
    await expect
      .poll(() => session.getSnapshot().state, { timeout: 3000 })
      .toBe("reconnecting");
    await expect
      .poll(() => session.getSnapshot().state, { timeout: 5000 })
      .toBe("joined");
    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(session.getSnapshot().code).toBe(code);
  } finally {
    await session.leave();
  }
});
