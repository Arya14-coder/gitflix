import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://gitflix.vercel.app'),
  title: {
    default: "GitFlix — GitHub, but Netflix",
    template: "%s | GitFlix",
  },
  description: "Personalized GitHub repository recommendations in an addictive Netflix-style interface.",
  keywords: ["GitHub", "Recommendations", "Netflix clone", "Developer tools", "Open source discovery"],
  authors: [{ name: "GitFlix" }],
  creator: "GitFlix",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "GitFlix — GitHub, but Netflix",
    description: "Discover your next favorite repository with AI-powered recommendations.",
    siteName: "GitFlix",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GitFlix Interface Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GitFlix — GitHub, but Netflix",
    description: "Discover your next favorite repository with AI-powered recommendations.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
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
