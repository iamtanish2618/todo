/** Browser-only export. Notes and fonts never need an AI request. */
export async function makeRoomPDF(title: string, content: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const response = await fetch("/fonts/noto-sans.ttf");
  if (!response.ok)
    throw new Error("The PDF font could not load. Please try again.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  pdf.addFileToVFS("TodoSans.ttf", btoa(binary));
  pdf.addFont("TodoSans.ttf", "TodoSans", "normal");
  pdf.setFont("TodoSans");
  pdf.setTextColor("#2B2622");
  pdf.setFontSize(22);
  let y = 60;
  const write = (text: string, size: number) => {
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, 490) as string[]) {
      if (y > 775) {
        pdf.addPage();
        y = 60;
      }
      pdf.text(line, 50, y);
      y += size * 1.6;
    }
  };
  write(title || "A little note", 22);
  y += 12;
  write(content, 11);
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor("#8E7969");
    pdf.text(`todo / ${i} of ${count}`, 50, 815);
  }
  pdf.save(
    `${(title || "todo-notes").replace(/[^a-z0-9-]/gi, "-").slice(0, 70)}.pdf`,
  );
}
