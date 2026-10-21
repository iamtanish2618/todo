import { test, expect, type Page, type Browser } from "@playwright/test";
const logins = new WeakMap<Page, { email: string; password: string }>();
const contexts: Awaited<ReturnType<Browser["newContext"]>>[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
async function peer(
  browser: Browser,
  index: number,
  mount = true,
  invite = "",
  login?: { email: string; password: string },
) {
  const email = login?.email || `table-${index}-${Date.now()}@example.test`,
    password = login?.password || "OnlyEmulatorTest123!";
  if (!login) {
    const r = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const user = (await r.json()) as { localId: string };
    await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer owner",
        },
        body: JSON.stringify({ localId: user.localId, emailVerified: true }),
      },
    );
  }
  const context = await browser.newContext({ permissions: ["microphone"] });
  contexts.push(context);
  const page = await context.newPage();
  if (!mount)
    await page.route("**/api/rooms/config", (route) =>
      route.fulfill({
        json: {
          enabled: true,
          configured: true,
          voice: true,
          games: true,
          url: "https://demo-todo-default-rtdb.firebaseio.com",
          iceServers: [],
        },
      }),
    );
  await page.goto(
    mount
      ? "/"
      : "/signin-with-chatgpt?return_to=" +
          encodeURIComponent(invite ? "/?room=" + invite : "/"),
  );
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 45000 },
  );
  await page.evaluate(
    async ({ email, password, mount }) => {
      const { harness, mountRoom } = await import(
        /* @vite-ignore */ "/tests/fixtures/table-harness.tsx" as string
      );
      (window as unknown as { qa: unknown }).qa = await harness(
        email,
        password,
      );
      if (mount) mountRoom((window as unknown as { qa: unknown }).qa);
    },
    { email, password, mount },
  );
  logins.set(page, { email, password });
  return page;
}
async function state(page: Page) {
  return page.evaluate(() => {
    const qa = (
      window as unknown as {
        qa: {
          session: { getSnapshot: () => unknown };
          voice: { getSnapshot: () => unknown };
        };
      }
    ).qa;
    return { table: qa.session.getSnapshot(), voice: qa.voice.getSnapshot() };
  }) as Promise<{
    table: {
      state: string;
      code: string;
      members: { name: string; id: string }[];
      host: string;
      id: string;
      message: string;
    };
    voice: {
      muted: boolean;
      permission: boolean;
      peers: Record<string, string>;
      speaking: Record<string, boolean>;
      message: string;
    };
  }>;
}
const act = (page: Page, code: string) => page.evaluate(code);
test("Firebase presence, real audio WebRTC with a listen-only peer, manual microphone control and cleanup", async ({
  browser,
}) => {
  const a = await peer(browser, 1),
    b = await peer(browser, 2);
  await act(a, "qa.voice.unlock()");
  await act(b, "qa.voice.unlock()");
  await act(a, "qa.session.join(true,'','Mia','blue')");
  const code = (await state(a)).table.code;
  await act(b, `qa.session.join(false,${JSON.stringify(code)},'Mia','pink')`);
  await expect.poll(async () => (await state(a)).table.members.length).toBe(2);
  await expect(a.locator(".table-name-tag")).toHaveCount(2);
  await expect(
    a.locator(".table-arrival-name").filter({ hasText: "Mia 2" }),
  ).toBeVisible();
  expect((await state(b)).table.members.map((m) => m.name)).toEqual([
    "Mia",
    "Mia 2",
  ]);
  await expect
    .poll(async () => Object.values((await state(a)).voice.peers), {
      timeout: 12000,
    })
    .toEqual(["connected"]);
  expect((await state(b)).voice.permission).toBe(false);
  await act(a, "qa.voice.setMuted(false)");
  expect((await state(a)).voice.muted).toBe(false);
  await expect
    .poll(
      async () => {
        const id = (await state(a)).table.id;
        return (await state(b)).voice.speaking[id];
      },
      { timeout: 10000 },
    )
    .toBe(true);
  await act(a, "qa.session.setStatus('focusing')");
  expect((await state(a)).voice.muted).toBe(false);
  await act(a, "qa.session.setStatus('break')");
  expect((await state(a)).voice.muted).toBe(false);
  await act(a, "qa.voice.setMuted(true)");
  expect((await state(a)).voice.muted).toBe(true);
  await act(a, "qa.session.leave()");
  await expect
    .poll(async () => (await state(b)).table.host)
    .toBe((await state(b)).table.id);
  await act(b, "qa.session.leave();qa.voice.leave()");
  expect((await state(b)).voice.peers).toEqual({});
});
test("Friends is wider, has one leave action and confirms repeat copies inside the code", async ({
  browser,
}) => {
  const page = await peer(browser, 9);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copiedText: string }).copiedText = text;
        },
      },
    });
  });
  await page
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Tanish");
  await page.getByRole("button", { name: "Create table", exact: true }).click();
  await expect.poll(async () => (await state(page)).table.state).toBe("joined");
  const panel = page.locator('.dock-panel[data-dock-pane="friends"]');
  const size = await panel.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(300);
  expect(size!.x + size!.width).toBeLessThanOrEqual(1440);
  await expect(
    panel.getByRole("button", { name: /Unmute|Mic on|Close table/ }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("switch", { name: "Table is quiet" }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("switch", { name: "Mute everyone" }),
  ).toBeVisible();
  const copy = page.getByRole("button", { name: "Copy table code" });
  await copy.click();
  await expect(page.locator('.table-code [role="status"]')).toHaveText(
    "Copied!",
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { copiedText: string }).copiedText,
    ),
  ).toBe((await state(page)).table.code);
  await page.waitForTimeout(200);
  await page.screenshot({ path: "outputs/todo-friends-copied.png" });
  await expect(page.locator(".table-copy-feedback")).toHaveCount(0, {
    timeout: 3000,
  });
  await copy.click();
  await expect(page.locator(".table-copy-feedback")).toHaveText("Copied!");
  await page
    .getByRole("button", { name: "Copy invite link", exact: true })
    .click();
  await expect(page.locator(".table-copy-feedback")).toHaveText("Link copied!");
  expect(
    await page.evaluate(
      () => (window as unknown as { copiedText: string }).copiedText,
    ),
  ).toContain("?room=PENG-");
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Leave table", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create table", exact: true }),
  ).toBeVisible();
});
test("four original penguins seat gently, nicknames appear and Friends stays clear", async ({
  browser,
}) => {
  const pages = [];
  for (let i = 0; i < 4; i++) pages.push(await peer(browser, 10 + i));
  const a = pages[0];
  await a.setViewportSize({ width: 1440, height: 960 });
  await a
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Tanish");
  await a.getByRole("button", { name: "Create table", exact: true }).click();
  await expect.poll(async () => (await state(a)).table.state).toBe("joined");
  const code = (await state(a)).table.code;
  for (let i = 1; i < 4; i++)
    await act(
      pages[i],
      `qa.session.join(false,${JSON.stringify(code)},${JSON.stringify(["", "Luna", "Kai", "Ari"][i])},${JSON.stringify(["blue", "pink", "sage", "honey"][i])})`,
    );
  await expect(a.locator(".table-name-tag")).toHaveCount(4);
  await a.waitForTimeout(650);
  const geometry = await a.locator(".table-seat").evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        opacity: getComputedStyle(n).opacity,
      };
    }),
  );
  expect(
    geometry.every((g) => g.w > 100 && g.w < 350 && Number(g.opacity) > 0.99),
  ).toBe(true);
  expect(geometry.map((g) => g.x)).toEqual(
    [...geometry.map((g) => g.x)].sort((a, b) => a - b),
  );
  await a.screenshot({ path: "outputs/todo-four-real-teammates.png" });
  await act(pages[0], "qa.session.setStatus('focusing')");
  await act(pages[1], "qa.session.setStatus('break')");
  await expect(
    a.locator('.table-member-tools[data-pose="writing"]'),
  ).toHaveCount(1);
  await expect(a.locator('.table-member-tools[data-pose="tea"]')).toHaveCount(
    1,
  );
  await expect
    .poll(() =>
      a
        .locator('.table-member-tools[data-pose="writing"] .todo-writing-rig')
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  expect(
    await a
      .locator('.table-member-tools[data-pose="tea"] .todo-writing-rig')
      .evaluate((el) => Number(getComputedStyle(el).opacity)),
  ).toBe(0);
  await act(pages[2], "qa.session.leave()");
  await expect(a.locator(".table-name-tag")).toHaveCount(3);
  await a.waitForTimeout(700);
  await expect(a.locator(".table-seat")).toHaveCount(3);
  await Promise.all(
    pages.map((p) => act(p, "qa.session.leave();qa.voice.leave()")),
  );
});
test("shared doodles, late breathing invitation and immediate break-end cleanup", async ({
  browser,
}) => {
  const a = await peer(browser, 30),
    b = await peer(browser, 31);
  await act(a, "qa.session.join(true,'','Ink','blue')");
  const code = (await state(a)).table.code;
  await act(b, `qa.session.join(false,${JSON.stringify(code)},'Cloud','pink')`);
  await act(a, "qa.session.setStatus('break');qa.games.setBreak(true)");
  await act(b, "qa.session.setStatus('break');qa.games.setBreak(true)");
  await a.waitForTimeout(3200);
  await a.getByRole("button", { name: "Play", exact: true }).click();
  await a.getByRole("button", { name: /^Doodle Art/ }).click();
  await expect(b.getByText("Ink started Doodle Art")).toBeVisible();
  await b.getByRole("button", { name: "Join", exact: true }).click();
  await expect(b.locator(".table-doodle")).toBeVisible();
  await a.waitForTimeout(600);
  await act(
    b,
    "qa.received=[];qa.games.listen(m=>qa.received.push({event:m.event,pts:m.data.pts}))",
  );
  const rect = await a.locator(".table-doodle").boundingBox();
  expect(rect).not.toBeNull();
  expect(rect).toEqual({
    x: 0,
    y: 0,
    width: a.viewportSize()!.width,
    height: a.viewportSize()!.height,
  });
  await a.mouse.move(rect!.x + rect!.width * 0.7, rect!.y + rect!.height * 0.7);
  await a.mouse.down();
  await a.mouse.move(
    rect!.x + rect!.width * 0.8,
    rect!.y + rect!.height * 0.75,
    { steps: 12 },
  );
  await a.mouse.up();
  await b.waitForTimeout(150);
  const alpha = await b.locator(".table-doodle").evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement,
      d = c
        .getContext("2d")!
        .getImageData(
          Math.round(c.width * 0.75) - 8,
          Math.round(c.height * 0.725) - 8,
          16,
          16,
        ).data;
    let min = 255;
    for (let i = 3; i < d.length; i += 4) min = Math.min(min, d[i]);
    return min;
  });
  expect(alpha).toBeLessThan(160);

  await a.screenshot({ path: "outputs/todo-fullscreen-doodle.png" });
  await a.keyboard.press("Escape");
  await expect(a.locator(".table-doodle-screen")).toHaveCount(0);
  await b.getByRole("button", { name: "Done", exact: true }).click();
  await a.getByRole("button", { name: "Play", exact: true }).click();
  await a.getByRole("button", { name: /^Breathing Bubble/ }).click();
  await act(b, "qa.games.setBreak(false);qa.session.setStatus('idle')");
  await b.waitForTimeout(600);
  await act(b, "qa.session.setStatus('break');qa.games.setBreak(true)");
  await expect(b.getByText("Ink started Breathing Bubble")).toBeVisible();
  await b.getByRole("button", { name: "Join", exact: true }).click();
  await expect(
    b.getByRole("region", { name: "Breathing Bubble" }),
  ).toBeVisible();
  await act(b, "qa.games.setBreak(false);qa.session.setStatus('focusing')");
  await expect(b.locator(".table-breath-panel")).toHaveCount(0);
  await expect(
    b.getByRole("button", { name: "Play", exact: true }),
  ).toHaveCount(0);
  await expect(
    b.getByText("Break's over, we'll save your spot."),
  ).toBeVisible();
  await expect(a.locator(".table-breath-panel")).toBeVisible();
  await Promise.all(
    [a, b].map((p) =>
      act(p, "qa.games.dispose();qa.session.leave();qa.voice.leave()"),
    ),
  );
});

test("disconnect rebuilds presence and audio without acquiring another microphone", async ({
  browser,
}) => {
  const a = await peer(browser, 50),
    b = await peer(browser, 51);
  await act(a, "qa.voice.unlock();qa.session.join(true,'','North','blue')");
  await expect.poll(async () => (await state(a)).table.state).toBe("joined");
  const code = (await state(a)).table.code;
  await act(
    b,
    `qa.voice.unlock();qa.session.join(false,${JSON.stringify(code)},'South','sage')`,
  );
  await expect
    .poll(async () => Object.values((await state(a)).voice.peers), {
      timeout: 15000,
    })
    .toEqual(["connected"]);

  await act(b, "qa.disconnect()");
  await expect
    .poll(async () => (await state(b)).table.state)
    .toBe("reconnecting");
  await expect.poll(async () => (await state(a)).table.members.length).toBe(1);
  await act(b, "qa.reconnect()");
  await expect.poll(async () => (await state(b)).table.state).toBe("joined");
  await expect
    .poll(async () => Object.values((await state(a)).voice.peers), {
      timeout: 15000,
    })
    .toEqual(["connected"]);
  expect((await state(b)).voice.permission).toBe(false);
  await Promise.all(
    [a, b].map((p) =>
      act(p, "qa.games.dispose();qa.session.leave();qa.voice.leave()"),
    ),
  );
});
test("real Todo entry, invite link and existing timer use one shared deadline", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const a = await peer(browser, 60, false);
  await expect(a.locator(".todo-root")).toHaveAttribute("data-ready", "true");
  await a.getByRole("button", { name: "Focus with Todo", exact: true }).click();
  await expect(a.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
    { timeout: 45000 },
  );
  await a.locator('[data-dock-item="friends"]').click();
  await a
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Bluebird");
  await a.getByRole("button", { name: "Create table", exact: true }).click();
  await expect(a.locator(".table-code strong")).toBeVisible();
  const code = (await a.locator(".table-code strong").textContent())!;
  const b = await peer(browser, 61, false, code);
  await expect(b.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
    { timeout: 45000 },
  );
  await expect(
    b.getByRole("textbox", { name: "Join with a code", exact: true }),
  ).toHaveValue(code);
  await b.getByRole("textbox", { name: "Nickname", exact: true }).fill("Rose");
  await b.getByRole("button", { name: "Join table", exact: true }).click();
  await expect(a.locator(".table-name-tag")).toHaveCount(2);
  await a.getByRole("button", { name: "Sit together", exact: true }).click();
  await b.getByRole("button", { name: "Join focus", exact: true }).click();
  await expect(a.locator(".cozy-room")).toHaveAttribute("data-working", "true");
  await expect(b.locator(".cozy-room")).toHaveAttribute("data-working", "true");
  const deadline = async (p: Page) =>
    p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("todo.timer.v1")!).deadline as number,
    );
  expect(Math.abs((await deadline(a)) - (await deadline(b)))).toBeLessThan(500);
  await a.waitForTimeout(1800);
  await a.screenshot({ path: "outputs/todo-shared-focus.png" });
});
test("denied microphone remains a listener and incoming volume controls never request capture", async ({
  browser,
}) => {
  const a = await peer(browser, 70),
    b = await peer(browser, 71);
  await act(a, "qa.voice.unlock();qa.session.join(true,'','Lake','blue')");
  await expect.poll(async () => (await state(a)).table.state).toBe("joined");
  const code = (await state(a)).table.code;
  await act(
    b,
    `qa.voice.unlock();qa.session.join(false,${JSON.stringify(code)},'Mist','pink')`,
  );
  await expect
    .poll(async () => Object.values((await state(b)).voice.peers), {
      timeout: 15000,
    })
    .toEqual(["connected"]);
  await b.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied for isolated test", "NotAllowedError");
      },
    });
  });
  await act(b, "qa.voice.setMuted(false)");
  expect((await state(b)).voice.message).toContain("You can still listen");
  expect((await state(b)).voice.permission).toBe(false);
  const id = (await state(a)).table.id;
  await act(
    b,
    `qa.voice.setPeerVolume(${JSON.stringify(id)},0.25);qa.voice.muteAllIncoming(true)`,
  );
  expect(await b.evaluate("qa.voice.getSnapshot().incomingMuted")).toBe(true);
  expect(
    await b.evaluate(`qa.voice.getSnapshot().volumes[${JSON.stringify(id)}]`),
  ).toBe(0.25);
  await act(b, "qa.voice.muteAllIncoming(false)");
  await Promise.all(
    [a, b].map((p) =>
      act(p, "qa.games.dispose();qa.session.leave();qa.voice.leave()"),
    ),
  );
});
test("solo break Play closes back to the existing room; keyboard and reduced motion stay usable", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(page.locator(".todo-root")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem(
      "todo.timer.v1",
      JSON.stringify({
        remaining: 600,
        duration: 600,
        deadline: Date.now() + 600000,
        phase: "break",
        started: true,
        task: "A little rest",
        id: crypto.randomUUID(),
        startedAt: Date.now(),
      }),
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Focus with Todo", exact: true })
    .click();
  await expect(page.locator(".cozy-room")).toHaveAttribute(
    "data-arriving",
    "false",
    { timeout: 45000 },
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /^Breathing Bubble/ }).click();
  await expect(page.locator(".table-breath-panel")).toBeVisible();
  expect(
    await page
      .locator(".table-breath-orb")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await page.getByRole("button", { name: "End break", exact: true }).click();
  await expect(page.locator(".table-breath-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".cozy-room")).toHaveClass(/cozy-room-active/);
  await expect(page.locator('[data-dock-item="focus"]')).toBeVisible();
});

test("host moderation uses authenticated senders and clears the temporary room", async ({
  browser,
}) => {
  const a = await peer(browser, 80),
    b = await peer(browser, 81);
  await act(a, "qa.voice.unlock();qa.session.join(true,'','Host','blue')");
  await expect.poll(async () => (await state(a)).table.state).toBe("joined");
  const code = (await state(a)).table.code;
  await act(
    b,
    `qa.voice.unlock();qa.session.join(false,${JSON.stringify(code)},'Friend','pink')`,
  );
  await expect
    .poll(async () => Object.values((await state(b)).voice.peers), {
      timeout: 15000,
    })
    .toEqual(["connected"]);
  await act(b, "qa.voice.setMuted(false)");
  expect((await state(b)).voice.muted).toBe(false);
  const id = (await state(b)).table.id;
  await act(
    a,
    `qa.session.hostAction('host_mute_request',${JSON.stringify(id)})`,
  );
  await expect.poll(async () => (await state(b)).voice.muted).toBe(true);
  await act(b, "qa.session.hostAction('close_room')");
  expect((await state(a)).table.state).toBe("joined");
  await act(a, `qa.session.hostAction('kick',${JSON.stringify(id)})`);
  await expect
    .poll(async () => (await state(b)).table.message)
    .toContain("removed");
  await act(
    b,
    `qa.session.join(false,${JSON.stringify(code)},'Friend','pink')`,
  );
  await expect.poll(async () => (await state(a)).table.members.length).toBe(2);
  await act(a, "qa.session.hostAction('close_room')");
  await expect
    .poll(async () => (await state(b)).table.message)
    .toContain("host closed");
  await Promise.all(
    [a, b].map((p) => act(p, "qa.games.dispose();qa.voice.leave()")),
  );
});

test("two tabs using one account leave no room or ownership residue", async ({
  browser,
}) => {
  const a = await peer(browser, 90),
    b = await peer(browser, 91, true, "", logins.get(a));
  await act(a, "qa.session.join(true,'','One','blue')");
  const code = (await state(a)).table.code;
  await act(b, `qa.session.join(false,${JSON.stringify(code)},'Two','pink')`);
  await expect.poll(async () => (await state(a)).table.members.length).toBe(2);
  await act(b, "qa.session.leave()");
  await expect.poll(async () => (await state(a)).table.members.length).toBe(1);
  await act(a, "qa.session.leave()");
  const get = async (path: string) => {
    const r = await fetch(
      `http://127.0.0.1:9000/${path}.json?ns=demo-todo-default-rtdb`,
      { headers: { Authorization: "Bearer owner" } },
    );
    return r.json();
  };
  await expect.poll(() => get(`tables/${code}`)).toBeNull();
  await expect.poll(() => get(`tableClaims/${code}`)).toBeNull();
  await Promise.all(
    [a, b].map((p) => act(p, "qa.games.dispose();qa.voice.leave()")),
  );
});
