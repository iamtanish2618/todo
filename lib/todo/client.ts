export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};
export type FocusSession = {
  id: string;
  task: string;
  seconds: number;
  character: string;
  createdAt: number;
};
export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
};
export type Connection = {
  ai: boolean;
  vision: boolean;
  provider: string;
  friends: boolean;
};
export async function api<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error || "Couldn’t connect. Please try again.");
  return result;
}
export async function exportPDF(title: string, content: string) {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default);
  const response = await fetch("/fonts/noto-sans.ttf");
  if (!response.ok)
    throw new Error("The PDF font couldn’t load. Please try again.");
  const font = await pdf.embedFont(await response.arrayBuffer(), {
    subset: true,
  });
  const supported = new Set(font.getCharacterSet());
  if (
    Array.from(title + content).some(
      (c) => !supported.has(c.codePointAt(0)!) && !/\s/.test(c),
    )
  )
    throw new Error(
      "Some characters need another PDF font. Try removing emoji or using Latin, Greek, or Cyrillic text for now.",
    );
  const clean = (s: string) =>
    Array.from(s)
      .filter(
        (c) => supported.has(c.codePointAt(0)!) || c === "\n" || c === "\t",
      )
      .join("");
  let page = pdf.addPage([595.28, 841.89]),
    y = 780;
  const line = (text: string, size = 11) => {
    if (y < 65) {
      page = pdf.addPage([595.28, 841.89]);
      y = 780;
    }
    page.drawText(clean(text), {
      x: 50,
      y,
      size,
      font,
      color: rgb(0.16, 0.16, 0.18),
    });
    y -= size * 1.65;
  };
  line(title, 21);
  y -= 10;
  for (const paragraph of content.replace(/\r/g, "").split("\n")) {
    const words = paragraph
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .split(/\s+/);
    let current = "";
    for (const word of words) {
      if (
        font.widthOfTextAtSize(clean(`${current} ${word}`), 11) > 490 &&
        current
      ) {
        line(current);
        current = "";
      }
      if (font.widthOfTextAtSize(clean(word), 11) > 490) {
        for (const char of word) {
          if (font.widthOfTextAtSize(clean(current + char), 11) > 490) {
            line(current);
            current = "";
          }
          current += char;
        }
      } else current += (current ? " " : "") + word;
    }
    line(current);
    y -= 3;
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`todo / ${i + 1} of ${pages.length}`, {
      x: 50,
      y: 30,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }),
  );
  const bytes = await pdf.save(),
    blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9-]/gi, "-").slice(0, 70) || "todo-notes"}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
