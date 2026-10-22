import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todo — A little company, a little progress",
  description:
    "Your penguin, your pace. A playful place to focus, make notes, and get a little help.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
