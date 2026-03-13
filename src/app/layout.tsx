import type { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import Providers from './providers'
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
  const session = await getServerSession(authOptions)

  return (
    <html lang="ja">
      <body>
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
