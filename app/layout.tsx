import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GitFlix — GitHub, but Netflix",
  description: "Personalized GitHub repository recommendations in an addictive Netflix-style interface.",
  openGraph: {
    title: "GitFlix — GitHub, but Netflix",
    description: "Discover your next favorite repository with AI-powered recommendations.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GitFlix Interface Preview",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0d0d0d] min-h-screen flex flex-col`}
      >
        <div className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
