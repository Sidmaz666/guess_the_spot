import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Guess the Spot - Interactive Geography Game",
    template: "%s | Guess the Spot"
  },
  description: "Test your geography knowledge with Guess the Spot! Look at real images from around the world and guess their location on an interactive map. Challenge yourself with locations from every continent.",
  keywords: [
    "geography game",
    "world map game", 
    "location guessing",
    "interactive map",
    "geography quiz",
    "world locations",
    "map game",
    "geography challenge",
    "educational game",
    "world geography"
  ],
  authors: [{ name: "Sidmaz666", url: "https://github.com/Sidmaz666" }],
  creator: "Sidmaz666",
  publisher: "Sidmaz666",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://guess-the-spot.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://guess-the-spot.vercel.app",
    title: "Guess the Spot - Interactive Geography Game",
    description: "Test your geography knowledge! Look at real images from around the world and guess their location on an interactive map.",
    siteName: "Guess the Spot",
    images: [
      {
        url: "https://guess-the-spot.vercel.app/preview.png",
        width: 1200,
        height: 630,
        alt: "Guess the Spot - Interactive Geography Game Landing Page",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guess the Spot - Interactive Geography Game",
    description: "Test your geography knowledge! Look at real images from around the world and guess their location on an interactive map.",
    images: ["https://guess-the-spot.vercel.app/preview.png"],
    creator: "@Sidmaz666",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
  category: "games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden max-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
