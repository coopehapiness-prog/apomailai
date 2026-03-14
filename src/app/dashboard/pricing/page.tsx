'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'
import { PlanType, PLAN_LABELS } from '@/lib/types'
import toast from 'react-hot-toast'

interface PlanCard {
  plan: PlanType
  name: string
  price: string
  priceNote: string
  emails: string
  features: string[]
  cta: string
  popular?: boolean
}

const PLANS: PlanCard[] = [
  {
    plan: 'free',
    name: 'Free',
    price: '¥0',
    priceNote: '',
    emails: '月15件',
    features: [
      'AIメール生成（追撃シナリオ3通）',
      'AIリサーチレポート',
      'カスタマイズ再生成',
    ],
    cta: '現在のプラン',
  },
  {
    plan: 'starter',
    name: 'Starter',
    price: '¥2,980',
    priceNote: '/月',
    emails: '月100件',
    features: [
      'Freeプランの全機能',
      'AIメール生成 月100件',
      '優先サポート',
    ],
    cta: 'アップグレード',
    popular: true,
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: '¥9,800',
    priceNote: '/月',
    emails: '月500件',
    features: [
      'Starterプランの全機能',
      'AIメール生成 月500件',
      '優先サポート',
      'チーム利用（近日公開）',
    ],
    cta: 'アップグレード',
  },
]

export default function PricingPage() {
  const { data: session } = useSession()
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free')
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if ((session as any)?.accessToken) {
      apiClient.setAccessToken((session as any).accessToken as string)
    }
    fetchUsage()
  }, [session])

  const fetchUsage = async () => {
    try {
      const usage = await apiClient.getUsage()
      setCurrentPlan(usage.plan)
    } catch {
      // Default to free
    }
  }

  const handleUpgrade = async (plan: 'starter' | 'pro') => {
    setLoading(plan)
    try {
      const { url } = await apiClient.createCheckoutSession(plan)
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      toast.error(message)
    } finally {
      setLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    setLoading('portal')
    try {
      const { url } = await apiClient.createPortalSession()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      toast.error(message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">料金プラン</h1>
        <p className="text-slate-400">
          ビジネスの規模に合わせてプランをお選びください
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((planCard) => {
          const isCurrent = currentPlan === planCard.plan
          const isUpgrade = !isCurrent && planCard.plan !== 'free'
          const isDowngrade = currentPlan !== 'free' && planCard.plan === 'free'

          return (
            <div
              key={planCard.plan}
              className={`relative bg-slate-800 border rounded-xl p-6 flex flex-col ${
                planCard.popular
                  ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'border-slate-700'
              }`}
            >
              {planCard.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                  人気
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{planCard.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-white">{planCard.price}</span>
                  <span className="text-sm text-slate-400">{planCard.priceNote}</span>
                </div>
                <div className="mt-1">
                  <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold">
                    メール生成 {planCard.emails}
                  </span>
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-grow">
                {planCard.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-slate-700 text-slate-400 text-sm font-semibold cursor-not-allowed"
                  >
                    現在のプラン
                  </button>
                  {currentPlan !== 'free' && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={loading === 'portal'}
                      className="w-full py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-400 text-xs font-medium hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
                    >
                      {loading === 'portal' ? '読み込み中...' : 'サブスクリプション管理'}
                    </button>
                  )}
                </div>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(planCard.plan as 'starter' | 'pro')}
                  disabled={loading === planCard.plan}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    planCard.popular
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600'
                      : 'bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {loading === planCard.plan ? '処理中...' : planCard.cta}
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={loading === 'portal'}
                  className="w-full py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-400 text-xs font-medium hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
                >
                  {loading === 'portal' ? '読み込み中...' : 'ダウングレード'}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-slate-500">
          サブスクリプションはいつでもキャンセル可能です。解約後は当月末まで利用できます。
        </p>
      </div>
    </div>
  )
}
