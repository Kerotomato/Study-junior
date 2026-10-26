import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "勉強ごほうび",
  description: "勉強時間や成果をポイントにして、成長を見える化するアプリ",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
