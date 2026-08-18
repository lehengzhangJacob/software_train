import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AppChrome } from "@/components/app-chrome"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "营养 Agent",
    template: "%s | 营养 Agent",
  },
  description: "本地优先的个人饮食、运动与营养管理工具",
  icons: {
    icon: [{ url: "/brand/nutrition-agent-icon.png", type: "image/png" }],
    shortcut: ["/brand/nutrition-agent-icon.png"],
    apple: [{ url: "/brand/nutrition-agent-icon.png", type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only fixed left-3 top-3 z-[60] rounded-md bg-[var(--brand-mint)] px-3 py-2 text-sm font-semibold text-[var(--brand-plum)] focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--brand-plum)]"
          >
            跳至主要内容
          </a>
          <AppChrome>{children}</AppChrome>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
