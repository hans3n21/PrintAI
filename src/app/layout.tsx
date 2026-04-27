import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrintAI - Dein Design. In Minuten.",
  description:
    "Personalisierte T-Shirts, Hoodies und mehr - erstellt von KI, gedruckt auf Bestellung.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
