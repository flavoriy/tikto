import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikTo",
  description: "A clean planner for tasks, calendar events, and lightweight sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
