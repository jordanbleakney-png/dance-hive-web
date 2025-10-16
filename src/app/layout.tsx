import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Toaster } from "react-hot-toast"; // ✅ Toast notifications

// ✅ Use Inter (built-in Google font)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Dance Hive",
  description: "Dance Hive booking and management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {/* ✅ Wrap your app's global providers */}
        <Providers>{children}</Providers>

        {/* ✅ Toast notification system */}
        <Toaster position="top-right" reverseOrder={false} />
      </body>
    </html>
  );
}
