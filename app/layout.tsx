import type { Metadata, Viewport } from "next";
import "./globals.css";

import { PRESENTATION as P } from "@/lib/todo/presentation";
export const viewport: Viewport = { themeColor: P.theme };
export const metadata: Metadata = {
  metadataBase: new URL(P.url),
  title: P.title,
  description: P.description,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Todo",
    title: P.title,
    description: P.description,
    url: P.url,
    images: [
      {
        url: "/share-todo.png",
        width: 1200,
        height: 630,
        alt: "Todo — a cozy room for a little progress",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: P.title,
    description: P.description,
    images: ["/share-todo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/nunito.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
