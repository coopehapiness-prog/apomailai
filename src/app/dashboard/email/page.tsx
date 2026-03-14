'use client'

import { useState, useEffect, FormEvent, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEmailGeneration } from '@/lib/hooks/useEmailGeneration'
import { apiClient } from '@/lib/api-client'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ResearchReport } from './components/ResearchReport'
import { EmailOutput } from './components/EmailOutput'
import { UsageInfo, PLAN_LABELS } from '@/lib/types'
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
  { value: 'exec', label: '経営層（ROI・事業インパクト）' },
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
  const { data: session } = useSession()
  const {
    company,
    source,
    patterns,
    research,
    loading,
    progressMessage,
    error,
    generate,
    regenerate,
    reset,
  } = useEmailGeneration()

  const [usage, setUsage] = useState<UsageInfo | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      const data = await apiClient.getUsage()
      setUsage(data)
    } catch {
      // Silently fail - usage bar just won't show
    }
  }, [])

  useEffect(() => {
    if ((session as any)?.accessToken) {
      apiClient.setAccessToken((session as any).accessToken as string)
    }
    fetchUsage()
  }, [session, fetchUsage])

  // Refresh usage after generation
  useEffect(() => {
    if (!loading && patterns && patterns.length > 0) {
      fetchUsage()
    }
  }, [loading, patterns, fetchUsage])

  const isOverLimit = usage ? usage.remaining <= 0 : false

  const [formData, setFormData] = useState({
    company: '',
    source: '' as LeadSource | '',
    history: '',
    contactDepartment: '',
    contactName: '',
    contactEmail: '',
  })

  const [showOptional, setShowOptional] = useState(false)

  const [customization, setCustomization] = useState({
    personas: ['exec'] as string[],
    news: [] as string[],
    cta: 'schedule',
    freeText: '',
    usedChips: [] as string[],
    selectedPain: '' as string,
  })

  const handleInitialSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!formData.company || !formData.source) {
      toast.error('企業名とリードの流入経路を入力してください')
      return
    }

    try {
      // Build contact info string for freeText if provided
      const contactParts: string[] = []
      if (formData.contactDepartment) contactParts.push(`所属部署：${formData.contactDepartment}`)
      if (formData.contactName) contactParts.push(`担当者名：${formData.contactName}`)
      if (formData.contactEmail) contactParts.push(`メールアドレス：${formData.contactEmail}`)
      const contactInstruction = contactParts.length > 0
        ? `【宛先担当者情報】以下の担当者情報がある場合は、宛名に反映してください。\n${contactParts.join('\n')}`
        : ''

      await generate({
        companyName: formData.company,
        source: formData.source,
        history: formData.history,
        contactName: formData.contactName || undefined,
        contactDepartment: formData.contactDepartment || undefined,
        freeText: contactInstruction || undefined,
      })
    } catch (err) {
      // Show toast so user sees the error clearly
      const message = err instanceof Error ? err.message : 'メール生成に失敗しました'
      toast.error(message, { duration: 6000 })
    }
  }

  const handleRegenerate = async () => {
    try {
      // Combine selected pain hook with freeText
      const painHookInstruction = customization.selectedPain
        ? `以下の課題をメールのメインテーマ・フックとして使用し、この課題に対してサービスがどう貢献できるかを前面に出してください：「${customization.selectedPain}」`
        : ''
      const combinedFreeText = [painHookInstruction, customization.freeText]
        .filter(Boolean)
        .join('\n')

      const customizationData = {
        personas: customization.personas.length > 0 ? customization.personas : undefined,
        news: customization.news.length > 0 ? customization.news : undefined,
        cta: customization.cta || undefined,
        freeText: combinedFreeText || undefined,
      }
      await regenerate(customizationData)
      toast.success('メールを再生成しました')
    } catch (err) {
      const message = err instanceof Error ? err.message : '再生成に失敗しました'
      toast.error(message, { duration: 6000 })
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

  // Normalize news items for checkbox display (include url for links)
  const newsItems = research
    ? (research.latestNews || research.news || []).map((item, idx) => ({
        id: (item as any).id || `news-${idx}`,
        title: item.title,
        url: item.url || '',
      }))
    : []

  // Normalize pain points (AI課題仮説) for hook selection
  const painItems: string[] = research
    ? (research.painPoints || (research as any).pains || [])
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

        {/* Usage Bar */}
        {usage && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  {PLAN_LABELS[usage.plan]}プラン
                </span>
                <span className="text-[10px] text-slate-500">
                  {usage.emailCount} / {usage.emailLimit} 件使用済み
                </span>
              </div>
              {usage.plan === 'free' && (
                <Link
                  href="/dashboard/pricing"
                  className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  アップグレード →
                </Link>
              )}
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usage.remaining <= 0
                    ? 'bg-red-500'
                    : usage.remaining <= 3
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(100, (usage.emailCount / usage.emailLimit) * 100)}%`,
                }}
              />
            </div>
            {isOverLimit && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-red-400 font-semibold">
                  今月の生成上限に達しました
                </span>
                <Link
                  href="/dashboard/pricing"
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 font-semibold transition-colors"
                >
                  プランをアップグレード
                </Link>
              </div>
            )}
          </div>
        )}

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
                リードの流入経路
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

            {/* Optional fields - collapsible */}
            <div className="border-t border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setShowOptional((prev) => !prev)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full"
              >
                <span>{showOptional ? '−' : '+'}</span>
                <span className="font-medium">任意項目（担当者情報・過去のやり取り）</span>
                {(formData.contactDepartment || formData.contactName || formData.contactEmail) && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">入力済</span>
                )}
              </button>
              {showOptional && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="contactDept" className="block text-xs font-medium text-slate-400 mb-1">
                        所属部署
                      </label>
                      <input
                        id="contactDept"
                        type="text"
                        value={formData.contactDepartment}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactDepartment: e.target.value }))
                        }
                        placeholder="例: 営業部"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="contactName" className="block text-xs font-medium text-slate-400 mb-1">
                        担当者名
                      </label>
                      <input
                        id="contactName"
                        type="text"
                        value={formData.contactName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactName: e.target.value }))
                        }
                        placeholder="例: 田中太郎"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="contactEmail" className="block text-xs font-medium text-slate-400 mb-1">
                        メールアドレス
                      </label>
                      <input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                        }
                        placeholder="例: tanaka@example.com"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="history" className="block text-xs font-medium text-slate-400 mb-1">
                      過去のやり取り
                    </label>
                    <textarea
                      id="history"
                      value={formData.history}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, history: e.target.value }))
                      }
                      placeholder="過去のメールや会話の内容を入力すると、より適切なメールが生成されます"
                      rows={3}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isOverLimit}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                メール生成中...
              </span>
            ) : isOverLimit ? '生成上限に達しました' : 'メール生成'}
          </button>
        </form>
      </div>
    )
  }

  // Result state
  return (
    <div className="max-w-[820px] mx-auto pb-16">
      {loading && <LoadingOverlay progressMessage={progressMessage} />}

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

      {/* ===== Section 3: Customize & Regenerate ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'🎛️ カスタマイズして再生成'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        チェックやフリーテキストで指示を入れて「再生成」すると、追撃シナリオ（3日後/1週間後/1ヶ月後）の文面が生成されます
      </p>

      {/* Pain Hook Selection - AI課題仮説フック */}
      {painItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-slate-300">{'🧠 AIによる課題仮説を起点に再生成'}</span>
            {customization.selectedPain && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-semibold">
                選択中
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mb-3">
            選択した課題をメールのメインテーマとして再生成します。ひとつ選ぶと、その課題への共感と解決策を軸にした文面になります。
          </p>
          <div className="space-y-1.5">
            {painItems.map((pain, idx) => {
              const isSelected = customization.selectedPain === pain
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setCustomization((prev) => ({
                      ...prev,
                      selectedPain: prev.selectedPain === pain ? '' : pain,
                    }))
                  }
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-[11px] leading-relaxed ${
                    isSelected
                      ? 'bg-blue-500/15 border-blue-500/60 text-blue-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                    )}
                  </span>
                  <span>
                    <span className="text-[9px] font-bold text-slate-500 mr-1.5">{`仮説${idx + 1}`}</span>
                    {pain}
                  </span>
                </button>
              )
            })}
          </div>
          {customization.selectedPain && (
            <button
              type="button"
              onClick={() => setCustomization((prev) => ({ ...prev, selectedPain: '' }))}
              className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕ 選択を解除する
            </button>
          )}
        </div>
      )}

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
          <div className="text-[11px] font-bold text-slate-400 mb-2">{'📰 このニュースを起点にメール文面を作成'}</div>
          {newsItems.length > 0 ? (
            newsItems.map((news, idx) => (
              <div
                key={news.id}
                className="flex items-center gap-1.5 py-1"
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
                {news.url ? (
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline line-clamp-1 flex-1"
                  >
                    {news.title} <span className="text-[9px]">{'↗'}</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-300 line-clamp-1 flex-1">{news.title}</span>
                )}
              </div>
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

      {/* Selected Pain Hook Summary */}
      {customization.selectedPain && (
        <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
          <span className="text-blue-400 text-[11px] flex-shrink-0 mt-0.5">🧠</span>
          <p className="text-[11px] text-blue-300 leading-relaxed">
            <span className="font-bold">フック：</span>
            {customization.selectedPain}
          </p>
        </div>
      )}

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
        ) : customization.selectedPain
          ? `🧠 「${customization.selectedPain.length > 20 ? customization.selectedPain.substring(0, 20) + '…' : customization.selectedPain}」を起点に再生成`
          : '🔄 選択内容で再生成（追撃シナリオ）'}
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
