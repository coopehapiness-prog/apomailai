import type { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import Providers from '@/components/Providers'
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
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
