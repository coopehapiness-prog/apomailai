'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { UsageInfo, PlanType } from '@/lib/types'
import toast from 'react-hot-toast'

const PLAN_DISPLAY: Record<PlanType, { name: string; color: string; border: string; bg: string }> = {
  free: { name: 'Free', color: 'text-slate-300', border: 'border-slate-600', bg: 'bg-slate-700/50' },
  starter: { name: 'Starter', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' },
  pro: { name: 'Pro', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
}

export default function MyPage() {
  const { data: session } = useSession()
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)

  // Settings sharing state
  const [shareInfo, setShareInfo] = useState<{
    domain: string
    isFreeEmail: boolean
    currentUserEmail?: string
    teammates: Array<{ id: string; email: string }>
  } | null>(null)
  const [sharingLoading, setSharingLoading] = useState(false)

  useEffect(() => {
    if ((session as any)?.accessToken) {
      apiClient.setAccessToken((session as any).accessToken as string)
    }
    fetchUsage()
    fetchShareInfo()
  }, [session])

  const fetchUsage = async () => {
    try {
      const data = await apiClient.getUsage()
      setUsage(data)
    } catch {
      // ignore
    }
  }

  const fetchShareInfo = async () => {
    try {
      const res = await fetch('/api/settings/share', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setShareInfo(data)
      }
    } catch {
      // ignore
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('新しいパスワードが一致しません')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('パスワードは8文字以上で入力してください')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('パスワードを変更しました')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(data.error || 'パスワード変更に失敗しました')
      }
    } catch {
      toast.error('パスワード変更に失敗しました')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const { url } = await apiClient.createPortalSession()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      toast.error(message)
    }
  }

  const planInfo = usage ? PLAN_DISPLAY[usage.plan] : null

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">マイページ</h1>
        <p className="text-slate-400">
          アカウント情報とプランの管理
        </p>
      </div>

      {/* Account Info */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span>👤</span> アカウント情報
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-700">
            <span className="text-sm text-slate-400">メールアドレス</span>
            <span className="text-sm text-white font-medium">{session?.user?.email || '—'}</span>
          </div>
        </div>
      </section>

      {/* Plan & Usage */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span>💎</span> プラン・利用状況
        </h2>

        {usage && planInfo ? (
          <div className="space-y-4">
            {/* Current Plan */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${planInfo.border} ${planInfo.bg}`}>
              <div>
                <p className="text-xs text-slate-400 mb-1">現在のプラン</p>
                <p className={`text-xl font-bold ${planInfo.color}`}>{planInfo.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">メール生成上限</p>
                <p className="text-lg font-bold text-white">月 {usage.emailLimit}件</p>
              </div>
            </div>

            {/* Usage Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">今月の利用状況</span>
                <span className="text-sm font-bold text-white">
                  {usage.emailCount} <span className="text-slate-500">/ {usage.emailLimit}件</span>
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    usage.remaining <= 0 ? 'bg-red-500' : usage.emailCount / usage.emailLimit > 0.8 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((usage.emailCount / usage.emailLimit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                残り {Math.max(usage.remaining, 0)}件
              </p>
            </div>

            {/* Upgrade / Manage */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {usage.plan === 'free' ? (
                <Link
                  href="/dashboard/pricing"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/20"
                >
                  プランをアップグレード
                </Link>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-600 hover:text-white transition-colors"
                >
                  サブスクリプション管理
                </button>
              )}
              <Link
                href="/dashboard/pricing"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 text-sm font-medium hover:border-slate-500 hover:text-slate-200 transition-colors"
              >
                料金プランを見る
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">読み込み中...</div>
        )}
      </section>

      {/* Password Change */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span>🔐</span> パスワード変更
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">現在のパスワード</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="現在のパスワード"
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">新しいパスワード</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="8文字以上"
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="もう一度入力"
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
            onClick={handleChangePassword}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {changingPassword ? '変更中...' : 'パスワードを変更'}
          </button>
        </div>
      </section>

      {/* Settings Sharing */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span>🤝</span> 設定の共有（同一ドメイン）
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          同じメールドメインでログインしているチームメンバーと、サービス情報・事例・プロンプトなどの設定を共有できます。
          <br />
          ※ 送信者名・役職・メールアドレスなどの個人情報は共有されません。
        </p>

        {shareInfo?.isFreeEmail ? (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
            <p className="text-xs text-yellow-400">
              フリーメールアドレス（{shareInfo.domain}）では設定共有機能は利用できません。会社ドメインのメールアドレスでログインしてください。
            </p>
          </div>
        ) : shareInfo ? (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">
                ドメイン: <span className="text-blue-400 font-semibold">@{shareInfo.domain}</span>
                {shareInfo.teammates.length > 0
                  ? ` （チームメンバー ${shareInfo.teammates.length}人）`
                  : ' （他のメンバーはまだ登録されていません）'}
              </p>
              {shareInfo.teammates.length > 0 && (
                <div className="space-y-1.5">
                  {shareInfo.teammates.map((teammate) => (
                    <div key={teammate.id} className="flex items-center justify-between bg-slate-800 rounded-md px-3 py-2">
                      <span className="text-xs text-slate-300">{teammate.email}</span>
                      <button
                        disabled={sharingLoading}
                        onClick={async () => {
                          if (!confirm(`${teammate.email}の設定をインポートしますか？\nサービス情報・事例・プロンプトなどが上書きされます。`)) return
                          setSharingLoading(true)
                          try {
                            const res = await fetch('/api/settings/share', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'same-origin',
                              body: JSON.stringify({ action: 'import', fromUserId: teammate.id }),
                            })
                            const data = await res.json()
                            if (res.ok) {
                              toast.success(data.message)
                            } else {
                              toast.error(data.error || 'インポートに失敗しました')
                            }
                          } catch {
                            toast.error('インポートに失敗しました')
                          } finally {
                            setSharingLoading(false)
                          }
                        }}
                        className="text-[10px] px-2.5 py-1 bg-slate-700 hover:bg-blue-600 disabled:opacity-50 text-slate-300 hover:text-white rounded-md transition-colors font-medium"
                      >
                        設定を取り込む
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {shareInfo.teammates.length > 0 && (
              <button
                disabled={sharingLoading}
                onClick={async () => {
                  if (!confirm(`同じドメイン（@${shareInfo.domain}）の全メンバーにカスタム設定を共有しますか？\n※ 相手のサービス情報・事例・プロンプトが上書きされます。`)) return
                  setSharingLoading(true)
                  try {
                    const res = await fetch('/api/settings/share', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify({ action: 'export' }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success(data.message)
                    } else {
                      toast.error(data.error || '共有に失敗しました')
                    }
                  } catch {
                    toast.error('共有に失敗しました')
                  } finally {
                    setSharingLoading(false)
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {sharingLoading ? '処理中...' : `全メンバーに自分の設定を共有（${shareInfo.teammates.length}人）`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">読み込み中...</p>
        )}
      </section>
    </div>
  )
}
