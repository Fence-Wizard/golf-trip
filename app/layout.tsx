import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppErrorBoundary } from "@/components/trip/AppErrorBoundary";
import { TripProvider } from "@/components/trip/TripProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Williamsburg Golf Trip App",
  description: "Phase 2 scoring, teams, and payout tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppErrorBoundary>
          <TripProvider>{children}</TripProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
