import type { Metadata, Viewport } from "next";
import { DM_Mono, Hanken_Grotesk, Libre_Caslon_Text } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { TabBar } from "@/components/ui/TabBar";
import "./globals.css";

const caslon = Libre_Caslon_Text({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-caslon" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const dmMono = DM_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "Cocktail Index",
  description: "See what you can make from the cocktail books on your shelf and the bottles in your bar.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1626" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${caslon.variable} ${hanken.variable} ${dmMono.variable} antialiased`}>
      <body className="ci-screen min-h-dvh font-sans">
        <AppProvider>
          <div className="ci-gutter ci-page mx-auto w-full max-w-xl">
            {children}
          </div>
          <div className="ci-tabbar-dock">
            <div className="mx-auto max-w-xl">
              <TabBar />
            </div>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
