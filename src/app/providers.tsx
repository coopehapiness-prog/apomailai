'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import type { Session } from 'next-auth'

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            marginTop: '72px',
          },
        }}
      />
    </SessionProvider>
  )
}
