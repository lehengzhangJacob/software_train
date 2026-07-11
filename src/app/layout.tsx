import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Food Tracker",
  description: "食物热量识别与饮食管理系统",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only fixed top-3 left-3 z-50 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-emerald-950 focus:ring-offset-2"
        >
          跳至主要内容
        </a>
        <div className="flex min-h-screen bg-neutral-50">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="ml-0 flex-1 p-4 pt-16 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:p-8 lg:pt-8 lg:pb-8">
            {children}
          </main>
        </div>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
