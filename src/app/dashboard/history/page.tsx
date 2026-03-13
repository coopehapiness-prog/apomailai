'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { EmailPattern } from '@/lib/types'

interface HistoryItem {
  id: string
  companyName: string
  patterns: EmailPattern[]
  subOutputs: {
    phone_script?: string
    video_prompt?: string
    follow_up_scenarios?: string[]
  } | null | undefined
  persona: string | null
  sourceType: string | null
  ctaType: string | null
  createdAt: string
}

const PERSONA_LABEL: Record<string, string> = {
  executive: '経営者',
  manager: 'マネージャー',
  staff: '担当者',
}

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web経由',
  email: 'メール経由',
  call: '電話経由',
  event: 'イベント経由',
}

const CTA_LABEL: Record<string, string> = {
  call: '電話',
  demo: 'デモ',
  meeting: '打ち合わせ',
  resource: '資料提供',
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedPatternIdx, setExpandedPatternIdx] = useState<number>(0)
  const [expandedSection, setExpandedSection] = useState<'email' | 'phone' | 'followup' | null>(null)

  const LIMIT = 20

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getEmailHistory({
        limit: LIMIT,
        offset: page * LIMIT,
        companyName: search || undefined,
      })
      setHistory(res.history)
      setTotal(res.pagination.total)
    } catch (e) {
      console.error(e)
      setError('履歴の取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(inputValue)
    setPage(0)
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedSection(null)
    } else {
      setExpandedId(id)
      setExpandedPatternIdx(0)
      setExpandedSection('email')
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">メール生成履歴</h1>
          <p className="text-slate-400 text-sm mt-1">過去に生成したメールをいつでも確認・再利用できます</p>
        </div>
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="企業名で絞り込み..."
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
          >
            検索
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setInputValue(''); setPage(0); }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              クリア
            </button>
          )}
        </form>
      </div>

      {/* Stats bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-6">
        <div className="text-sm text-slate-400">
          合計 <span className="text-white font-semibold">{total}</span> 件
          {search && <span className="ml-1 text-blue-400">（「{search}」で絞り込み中）</span>}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">読み込み中...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button onClick={fetchHistory} className="mt-3 text-sm text-red-300 underline hover:text-red-200">
            再試行
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-300 font-medium">
            {search ? `「${search}」に一致する履歴がありません` : 'まだメール生成履歴がありません'}
          </p>
          <p className="text-slate-500 text-sm mt-1">メール生成タブから企業名を入力して生成してみましょう</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpanded = expandedId === item.id
            const currentPattern = item.patterns[expandedPatternIdx] || item.patterns[0]
            return (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden transition-all"
              >
                {/* Row header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {item.companyName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold truncate">{item.companyName}</span>
                      {item.persona && (
                        <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full">
                          {PERSONA_LABEL[item.persona] || item.persona}
                        </span>
                      )}
                      {item.sourceType && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {SOURCE_LABEL[item.sourceType] || item.sourceType}
                        </span>
                      )}
                      {item.ctaType && (
                        <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full">
                          CTA: {CTA_LABEL[item.ctaType] || item.ctaType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-slate-400 text-xs">{formatDateTime(item.createdAt)}</span>
                      <span className="text-slate-500 text-xs">{item.patterns.length}パターン生成</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                      {isExpanded ? '閉じる' : '詳細を見る'}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-700">
                    {/* Pattern tabs */}
                    {item.patterns.length > 1 && (
                      <div className="flex gap-1 px-4 pt-4 overflow-x-auto">
                        {item.patterns.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => setExpandedPatternIdx(idx)}
                            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                              expandedPatternIdx === idx
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {p.patternName || `パターン ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Section selector */}
                    <div className="flex gap-1 px-4 pt-3">
                      {(['email', 'phone', 'followup'] as const).map((sec) => {
                        const labels = { email: 'メール文', phone: '架電スクリプト', followup: '追撃シナリオ' }
                        const available = sec === 'email'
                          || (sec === 'phone' && !!item.subOutputs?.phone_script)
                          || (sec === 'followup' && (item.subOutputs?.follow_up_scenarios?.length ?? 0) > 0)
                        if (!available) return null
                        return (
                          <button
                            key={sec}
                            onClick={() => setExpandedSection(sec)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                              expandedSection === sec
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                            }`}
                          >
                            {labels[sec]}
                          </button>
                        )
                      })}
                    </div>

                    {/* Content area */}
                    <div className="p-4 space-y-4">
                      {expandedSection === 'email' && currentPattern && (
                        <div className="space-y-3">
                          <div className="bg-slate-900/70 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-1">件名</p>
                            <p className="text-white font-medium text-sm">{currentPattern.subject}</p>
                          </div>
                          <div className="bg-slate-900/70 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-2">本文</p>
                            <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                              {currentPattern.body}
                            </pre>
                          </div>
                          <button
                            onClick={() => {
                              const text = `件名：${currentPattern.subject}\n\n${currentPattern.body}`
                              navigator.clipboard.writeText(text)
                            }}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            コピー
                          </button>
                        </div>
                      )}

                      {expandedSection === 'phone' && item.subOutputs?.phone_script && (
                        <div className="space-y-3">
                          <div className="bg-slate-900/70 rounded-lg p-3">
                            <p className="text-xs text-slate-500 mb-2">架電スクリプト</p>
                            <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                              {item.subOutputs.phone_script}
                            </pre>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(item.subOutputs!.phone_script!)}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            コピー
                          </button>
                        </div>
                      )}

                      {expandedSection === 'followup' && (item.subOutputs?.follow_up_scenarios?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 mb-2">追撃シナリオ</p>
                          {item.subOutputs!.follow_up_scenarios!.map((scenario, i) => (
                            <div key={i} className="bg-slate-900/70 rounded-lg p-3">
                              <p className="text-xs text-slate-500 mb-1">シナリオ {i + 1}</p>
                              <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                                {scenario}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            前へ
          </button>
          <span className="text-slate-400 text-sm">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  )
}
