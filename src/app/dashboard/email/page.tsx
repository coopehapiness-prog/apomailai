'use client'

import { useState, FormEvent } from 'react'
import { useEmailGeneration } from '@/lib/hooks/useEmailGeneration'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ResearchReport } from './components/ResearchReport'
import { EmailOutput } from './components/EmailOutput'
import { SubOutputs } from './components/SubOutputs'
import toast from 'react-hot-toast'

type LeadSource = 'ウェビナー参加' | '資料ダウンロード' | 'お問い合わせ' | '展示会' | '紹介'

const LEAD_SOURCES: LeadSource[] = [
  'ウェビナー参加',
  '資料ダウンロード',
  'お問い合わせ',
  '展示会',
  '紹介',
]

const PERSONAS = [
  { value: 'exec', label: '経嗶層（ROI・事業インパクト）' },
  { value: 'mgr', label: '現場責任者（チーム効率化）' },
  { value: 'staff', label: '担当者（使いやすさ・時短）' },
]

const CTA_OPTIONS = [
  { value: 'schedule', label: '日程調整URL' },
  { value: 'question', label: '軽い質問で返信促進' },
  { value: 'material', label: '資料送付の提案' },
]

const FREE_TEXT_CHIPS = [
  'カジュアルに',
  'フォーマルに',
  'コスト削減を強調',
  '短めに',
  '導入事例を追加',
  '緊急性を出す',
  '競合との差別化',
]

export default function EmailPage() {
  const {
    company,
    source,
    patterns,
    research,
    subOutputs,
    loading,
    error,
    generate,
    regenerate,
    reset,
  } = useEmailGeneration()

  const [formData, setFormData] = useState({
    company: '',
    source: '' as LeadSource | '',
    history: '',
  })

  const [customization, setCustomization] = useState({
    personas: ['exec'] as string[],
    news: [] as string[],
    cta: 'schedule',
    freeText: '',
    usedChips: [] as string[],
  })

  const handleInitialSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!formData.company || !formData.source) {
      toast.error('企業名とリードソースを入力してください')
      return
    }

    try {
      await generate({
        companyName: formData.company,
        source: formData.source as LeadSource,
        history: formData.history,
      } as any)
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleRegenerate = async () => {
    try {
      const customizationData = {
        personas: customization.personas.length > 0 ? customization.personas : undefined,
        news: customization.news.length > 0 ? customization.news : undefined,
        cta: customization.cta || undefined,
        freeText: customization.freeText || undefined,
      }
      await regenerate(customizationData)
      toast.success('メールを再生成しました')
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleNewGeneration = () => {
    reset()
  }

  const toggleChip = (chip: string) => {
    setCustomization((prev) => {
      const isUsed = prev.usedChips.includes(chip)
      const newChips = isUsed
        ? prev.usedChips.filter((c) => c !== chip)
        : [...prev.usedChips, chip]
      const newFreeText = isUsed
        ? prev.freeText
            .replace(chip, '')
            .replace(/、\s*、/g, '、')
            .replace(/^、\s*/, '')
            .replace(/、\s*$/, '')
            .trim()
        : prev.freeText
        ? `${prev.freeText.trim()}、${chip}`
        : chip
      return { ...prev, usedChips: newChips, freeText: newFreeText }
    })
  }

  // Normalize news items for checkbox display
  const newsItems = research
    ? (research.latestNews || research.news || []).map((item, idx) => ({
        id: (item as any).id || `news-${idx}`,
        title: item.title,
      }))
    : []

  // Initial state - Form
  if (!patterns || patterns.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">メール生成</h1>
          <p className="text-slate-400">
            企業情報を入力すると、AIが営業メールを自動生成します
          </p>
        </div>

        <form onSubmit={handleInitialSubmit} className="space-y-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-200 mb-2">
                企業名
              </label>
              <input
                id="company"
                type="text"
                required
                value={formData.company}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="例: 株式会社XYZ"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="source" className="block text-sm font-semibold text-slate-200 mb-2">
                リードソース
              </label>
              <select
                id="source"
                required
                value={formData.source}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    source: e.target.value as LeadSource | '',
                  }))
                }
                className="w-full"
              >
                <option value="">選択してください</option>
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="history" className="block text-sm font-semibold text-slate-200 mb-2">
                過去のやり取り（オプション）
              </label>
              <textarea
                id="history"
                value={formData.history}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, history: e.target.value }))
                }
                placeholder="過去のメールや会話の内容を入力すると、より適切なメールが生成されます"
                rows={4}
                className="w-full"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                メール生成中...
              </span>
            ) : 'メール生成'}
          </button>
        </form>
      </div>
    )
  }

  // Result state
  return (
    <div className="max-w-[820px] mx-auto pb-16">
      {loading && <LoadingOverlay />}

      {/* Back button */}
      <button
        onClick={handleNewGeneration}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-400 text-xs font-semibold hover:border-blue-500 hover:text-blue-400 transition-colors mb-4"
      >
        {'← 新規作成に戻る'}
      </button>

      {/* ===== Section 1: Generated Email ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
        {'✉️ 生成メール'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        {company} {'×'} {source} のリサーチ結果を反映
      </p>

      <EmailOutput patterns={patterns} />

      {/* ===== Section 2: AI Research Report ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'🔍 AIリサーチレポート'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        企業名から自動取得した情報と、AIによる課題仮説
      </p>

      {research && <ResearchReport research={research} />}

      {/* ===== Section 3: Related Outputs ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'📎 関連アウトプット'}
      </h2>

      <SubOutputs
        subOutputs={subOutputs || undefined}
        patterns={patterns}
      />

      {/* ===== Section 4: Customize & Regenerate ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'🎛️ カスタマイズして再生成'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        チェックやフリーテキストで指示を入れて「再生成」すると、4パターンの文面が生成されます
      </p>

      {/* Customization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Persona Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-400 mb-2">{'👤 ペルソナ'}</div>
          {PERSONAS.map((persona) => (
            <label
              key={persona.value}
              className="flex items-center gap-1.5 py-1 text-[11px] text-slate-300 cursor-pointer hover:text-white"
            >
              <input
                type="checkbox"
                checked={customization.personas.includes(persona.value)}
                onChange={(e) => {
                  setCustomization((prev) => ({
                    ...prev,
                    personas: e.target.checked
                      ? [...prev.personas, persona.value]
                      : prev.personas.filter((p) => p !== persona.value),
                  }))
                }}
                className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500"
              />
              {persona.label}
            </label>
          ))}
        </div>

        {/* Icebreaker News Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-400 mb-1">{'📰 アイスブレイク'}</div>
          <p className="text-[10px] text-slate-500 mb-2">このニュースを起点にメール文面を作成</p>
          {newsItems.length > 0 ? (
            newsItems.map((news, idx) => (
              <label
                key={news.id}
                className="flex items-center gap-1.5 py-1 text-[11px] text-slate-300 cursor-pointer hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={customization.news.includes(news.id)}
                  onChange={(e) => {
                    setCustomization((prev) => ({
                      ...prev,
                      news: e.target.checked
                        ? [...prev.news, news.id]
                        : prev.news.filter((n) => n !== news.id),
                    }))
                  }}
                  className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500 flex-shrink-0"
                />
                <span className="line-clamp-1">{news.title}</span>
              </label>
            ))
          ) : (
            <p className="text-[11px] text-slate-500">ニュース情報なし</p>
          )}
        </div>

        {/* CTA Card - full width */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:col-span-2">
          <div className="text-[11px] font-bold text-slate-400 mb-2">
            {'📩 メールの着地点（結びの誘導先）'}
          </div>
          <div className="flex gap-4 flex-wrap">
            {CTA_OPTIONS.map((cta) => (
              <label
                key={cta.value}
                className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer hover:text-white"
              >
                <input
                  type="radio"
                  name="cta"
                  value={cta.value}
                  checked={customization.cta === cta.value}
                  onChange={(e) => {
                    setCustomization((prev) => ({
                      ...prev,
                      cta: e.target.value,
                    }))
                  }}
                  className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                />
                {cta.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Free Text + Chips */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 mt-3">
        <div className="text-[11px] font-bold text-slate-400 mb-1">
          {'✏️ フリーテキストで指示'}
        </div>
        <p className="text-[10px] text-slate-500 mb-2">
          生成したいメールのイメージや追加の指示を自由に入力してください
        </p>
        <textarea
          value={customization.freeText}
          onChange={(e) => {
            setCustomization((prev) => ({
              ...prev,
              freeText: e.target.value,
            }))
          }}
          placeholder="例：もっとカジュアルなトーンにして / コスト削減のメリットを強調して / 導入事例を具体的に入れて..."
          rows={3}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none resize-vertical"
          style={{ minHeight: '80px', lineHeight: '1.6' }}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FREE_TEXT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(chip)}
              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer select-none ${
                customization.usedChips.includes(chip)
                  ? 'bg-blue-500/25 border-blue-500 text-blue-300'
                  : 'bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Regenerate Button */}
      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="w-full py-3.5 mt-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold cursor-pointer transition-shadow hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden flex items-center justify-center gap-2"
      >
        <span className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
          animation: 'shimmer 2s infinite',
        }} />
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            再生成しています...
          </span>
        ) : '🔄 選択内容で再生成（4パターン）'}
      </button>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
