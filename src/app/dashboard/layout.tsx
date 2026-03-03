'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const tabs = [
    { label: 'メール生成', href: '/dashboard/email' },
    { label: 'リード管理・分析', href: '/dashboard/leads' },
    { label: 'カスタム設定', href: '/dashboard/settings' },
  ]

  const isActiveTab = (href: string) => pathname === href

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/auth/login' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation Bar */}
      <nav className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                アポメールAI
              </h1>
            </div>

            {/* Tabs */}
            <div className="hidden md:flex space-x-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isActiveTab(tab.href)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-400">
                {session?.user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="md:hidden flex space-x-1 py-2 overflow-x-auto">
            {tabs.map((tab) => (
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
