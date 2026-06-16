import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Single typeface for the whole app — Montserrat. It's a variable font, so the
// full weight axis is available. Applied on <body>, so every surface inherits
// it (only intentional `font-mono` spots opt out).
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead Machine — AI-generated leads for any niche, any city",
  description:
    "Tell Lead Machine your niche and target city. Our AI surfaces verified leads with phones, emails, and websites — deduped and ready to contact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="font-[family-name:var(--font-montserrat)] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
