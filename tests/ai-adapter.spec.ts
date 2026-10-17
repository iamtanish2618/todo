import { test, expect } from "@playwright/test";
import { askModel } from "../lib/todo/ai";

test("AI adapter sends text, system guidance, credentials and image to the configured provider (mock transport)", async () => {
  let payload: Record<string, unknown> | undefined;
  const transport: typeof fetch = async (input, init) => {
    expect(String(input)).toBe("https://provider.example/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer test-only-key",
    );
    payload = JSON.parse(String(init?.body));
    return Response.json({
      id: "test-completion",
      object: "chat.completion",
      created: 1,
      model: "test-vision-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "The image shows a single pixel.",
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 9, total_tokens: 19 },
    });
  };
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq3cAAAAASUVORK5CYII=";
  const result = await askModel(
    {
      key: "test-only-key",
      baseURL: "https://provider.example/v1",
      model: "test-vision-model",
    },
    {
      mode: "explain",
      messages: [{ role: "user", content: "Describe this image" }],
      image,
    },
    AbortSignal.timeout(10000),
    transport,
  );
  expect(result).toContain("single pixel");
  expect(payload?.model).toBe("test-vision-model");
  expect(JSON.stringify(payload?.messages)).toContain("age-appropriate");
  expect(JSON.stringify(payload?.messages)).toContain("image_url");
  expect(JSON.stringify(payload?.messages)).toContain(image);
});

test("AI adapter surfaces provider failure without silently making up a reply (mock transport)", async () => {
  await expect(
    askModel(
      {
        key: "test-only-key",
        baseURL: "https://provider.example/v1",
        model: "test-model",
      },
      { mode: "chat", messages: [{ role: "user", content: "Hello" }] },
      AbortSignal.timeout(10000),
      async () =>
        Response.json({ error: { message: "Out of quota" } }, { status: 429 }),
    ),
  ).rejects.toThrow();
});
