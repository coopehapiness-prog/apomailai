'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)

  const tabs = [
    { label: 'メール生成', href: '/dashboard/email' },
    { label: 'メール生成履歴', href: '/dashboard/history' },
    { label: 'リード管理・分析', href: '/dashboard/leads', hidden: true },
    { label: 'カスタム設定', href: '/dashboard/settings' },
    { label: '💎 プラン', href: '/dashboard/pricing' },
  ]

  const isActiveTab = (href: string) => pathname === href

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/auth/login' })
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <nav className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Nav */}
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                アポメールAI
              </h1>
            </div>

            <div className="hidden md:flex space-x-1">
              {tabs.filter((tab) => !tab.hidden).map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    isActiveTab(tab.href)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 hidden sm:inline">
                {session?.user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="relative z-[110] bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-600 active:bg-red-700 disabled:opacity-50 cursor-pointer select-none"
              >
                {loggingOut ? '...' : 'ログアウト'}
              </button>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="md:hidden flex space-x-1 py-2 overflow-x-auto">
            {tabs.filter((tab) => !tab.hidden).map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  isActiveTab(tab.href)
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
