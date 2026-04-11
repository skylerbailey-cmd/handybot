import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "HandyBot — Your AI Handyman",
  description:
    "Take a photo of something broken in your house and get step-by-step repair help from an AI handyman.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
