'use client'

import { useState, FormEvent } from 'react'
import { useEmailGeneration, GenerationRecord } from '@/lib/hooks/useEmailGeneration'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ResearchReport } from './components/ResearchReport'
import { EmailOutput } from './components/EmailOutput'
import { SubOutputs } from './components/SubOutputs'
import toast from 'react-hot-toast'

type LeadSource = 'ã¦ã§ããã¼åå ' | 'è³æãã¦ã³ã­ã¼ã' | 'ãåãåãã' | 'å±ç¤ºä¼' | 'ç´¹ä»'

const LEAD_SOURCES: LeadSource[] = [
  'ã¦ã§ããã¼åå ',
  'è³æãã¦ã³ã­ã¼ã',
  'ãåãåãã',
  'å±ç¤ºä¼',
  'ç´¹ä»',
]

const PERSONAS = [
  { value: 'exec', label: 'çµå¶å±¤ï¼ROIã»äºæ¥­ã¤ã³ãã¯ãï¼' },
  { value: 'mgr', label: 'ç¾å ´è²¬ä»»èï¼ãã¼ã å¹çåï¼' },
  { value: 'staff', label: 'æå½èï¼ä½¿ããããã»æç­ï¼' },
]

const CTA_OPTIONS = [
  { value: 'schedule', label: 'æ¥ç¨èª¿æ´URL' },
  { value: 'question', label: 'è»½ãè³ªåã§è¿ä¿¡ä¿é²' },
  { value: 'material', label: 'è³æéä»ã®ææ¡' },
]

const FREE_TEXT_CHIPS = [
  'ã«ã¸ã¥ã¢ã«ã«',
  'ãã©ã¼ãã«ã«',
  'ã³ã¹ãåæ¸ãå¼·èª¿',
  'ç­ãã«',
  'å°å¥äºä¾ãè¿½å ',
  'ç·æ¥æ§ãåºã',
  'ç«¶åã¨ã®å·®å¥å',
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
    loadFromHistory,
    deleteFromHistory,
    generationHistory,
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
      toast.error('ä¼æ¥­åã¨ãªã¼ãã½ã¼ã¹ãå¥åãã¦ãã ãã')
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
      toast.success('ã¡ã¼ã«ãåçæãã¾ãã')
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
            .replace(/ã\s*ã/g, 'ã')
            .replace(/^ã\s*/, '')
            .replace(/ã\s*$/, '')
            .trim()
        : prev.freeText
        ? `${prev.freeText.trim()}ã${chip}`
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
          <h1 className="text-3xl font-bold text-white mb-2">ã¡ã¼ã«çæ</h1>
          <p className="text-slate-400">
            ä¼æ¥­æå ±ãå¥åããã¨ãAIãå¶æ¥­ã¡ã¼ã«ãèªåçæãã¾ã
          </p>
        </div>

        <form onSubmit={handleInitialSubmit} className="space-y-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-200 mb-2">
                ä¼æ¥­å
              </label>
              <input
                id="company"
                type="text"
                required
                value={formData.company}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="ä¾: æ ªå¼ä¼ç¤¾XYZ"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="source" className="block text-sm font-semibold text-slate-200 mb-2">
                ãªã¼ãã½ã¼ã¹
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
                <option value="">é¸æãã¦ãã ãã</option>
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="history" className="block text-sm font-semibold text-slate-200 mb-2">
                éå»ã®ããåãï¼ãªãã·ã§ã³ï¼
              </label>
              <textarea
                id="history"
                value={formData.history}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, history: e.target.value }))
                }
                placeholder="éå»ã®ã¡ã¼ã«ãä¼è©±ã®åå®¹ãå¥åããã¨ãããé©åãªã¡ã¼ã«ãçæããã¾ã"
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
                ã¡ã¼ã«çæä¸­...
              </span>
            ) : 'ã¡ã¼ã«çæ'}
          </button>
        </form>

        {/* History Panel */}
        {generationHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📋</span> 生成履歴
            </h2>
            <div className="space-y-3">
              {generationHistory.map((record) => (
                <div
                  key={record.id}
                  className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-semibold truncate">{record.company}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full whitespace-nowrap">
                          {record.source}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(record.createdAt).toLocaleString('ja-JP')} · {record.patterns.length}パターン
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => loadFromHistory(record)}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                      >
                        表示
                      </button>
                      <button
                        onClick={() => deleteFromHistory(record.id)}
                        className="px-2 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        {'â æ°è¦ä½æã«æ»ã'}
      </button>

      {/* ===== Section 1: Generated Email ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
        {'âï¸ çæã¡ã¼ã«'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        {company} {'Ã'} {source} ã®ãªãµã¼ãçµæãåæ 
      </p>

      <EmailOutput patterns={patterns} />

      {/* ===== Section 2: AI Research Report ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'ð AIãªãµã¼ãã¬ãã¼ã'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        ä¼æ¥­åããèªååå¾ããæå ±ã¨ãAIã«ããèª²é¡ä»®èª¬
      </p>

      {research && <ResearchReport research={research} />}

      {/* ===== Section 3: Related Outputs ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'ð é¢é£ã¢ã¦ãããã'}
      </h2>

      <SubOutputs
        subOutputs={subOutputs || undefined}
        patterns={patterns}
      />

      {/* ===== Section 4: Customize & Regenerate ===== */}
      <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mt-7 mb-3">
        {'ðï¸ ã«ã¹ã¿ãã¤ãºãã¦åçæ'}
      </h2>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3 pl-[26px]">
        ãã§ãã¯ãããªã¼ãã­ã¹ãã§æç¤ºãå¥ãã¦ãåçæãããã¨ã4ãã¿ã¼ã³ã®æé¢ãçæããã¾ã
      </p>

      {/* Customization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Persona Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-400 mb-2">{'ð¤ ãã«ã½ã'}</div>
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
          <div className="text-[11px] font-bold text-slate-400 mb-1">{'ð° ã¢ã¤ã¹ãã¬ã¤ã¯'}</div>
          <p className="text-[10px] text-slate-500 mb-2">ãã®ãã¥ã¼ã¹ãèµ·ç¹ã«ã¡ã¼ã«æé¢ãä½æ</p>
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
            <p className="text-[11px] text-slate-500">ãã¥ã¼ã¹æå ±ãªã</p>
          )}
        </div>

        {/* CTA Card - full width */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:col-span-2">
          <div className="text-[11px] font-bold text-slate-400 mb-2">
            {'ð© ã¡ã¼ã«ã®çå°ç¹ï¼çµã³ã®èªå°åï¼'}
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
          {'âï¸ ããªã¼ãã­ã¹ãã§æç¤º'}
        </div>
        <p className="text-[10px] text-slate-500 mb-2">
          çæãããã¡ã¼ã«ã®ã¤ã¡ã¼ã¸ãè¿½å ã®æç¤ºãèªç±ã«å¥åãã¦ãã ãã
        </p>
        <textarea
          value={customization.freeText}
          onChange={(e) => {
            setCustomization((prev) => ({
              ...prev,
              freeText: e.target.value,
            }))
          }}
          placeholder="ä¾ï¼ãã£ã¨ã«ã¸ã¥ã¢ã«ãªãã¼ã³ã«ãã¦ / ã³ã¹ãåæ¸ã®ã¡ãªãããå¼·èª¿ãã¦ / å°å¥äºä¾ãå·ä½çã«å¥ãã¦..."
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
            åçæãã¦ãã¾ã...
          </span>
        ) : 'ð é¸æåå®¹ã§åçæï¼4ãã¿ã¼ã³ï¼'}
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
