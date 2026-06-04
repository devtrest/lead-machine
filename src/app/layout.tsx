import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
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
    <html lang="en" className={`${display.variable} ${dmSans.variable}`}>
      <body className="font-[family-name:var(--font-body)] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
