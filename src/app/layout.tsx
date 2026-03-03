import type { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'アポメールAI - IS Sales Email Generation',
  description: 'AI-powered sales email generation tool',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  return (
    <html lang="ja">
      <body>
        <SessionProvider session={session}>
          {children}
          <Toaster position="top-right" />
        </SessionProvider>
      </body>
    </html>
  )
}
