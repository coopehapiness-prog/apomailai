'use client'

import { useState, FormEvent } from 'react'
import { useEmailGeneration } from '@/lib/hooks/useEmailGeneration'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ResearchReport } from './components/ResearchReport'
import { EmailOutput } from './components/EmailOutput'
import toast from 'react-hot-toast'

type LeadSource = 'ウェビナー参加' | '資料ダウンロード' | 'お問い合わせ' | '展示会' | '紹介'

const LEAD_SOURCES: LeadSource[] = [
  'ウェビナー参加',
  '資料ダウンロード',
  'お問い合わせ',
  '展示会',
  '紹介',
]

export default function EmailPage() {
  const {
    company,
    source,
    history,
    patterns,
    research,
    loading,
    error,
    generate,
    regenerate,
  } = useEmailGeneration()

  const [formData, setFormData] = useState({
    company: '',
    source: '' as LeadSource | '',
    history: '',
  })

  const [customization, setCustomization] = useState({
    personas: [] as string[],
    news: [] as string[],
    cta: '',
    freeText: '',
    chips: [] as string[],
  })

  const [showCustomize, setShowCustomize] = useState(false)

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
      })
      setShowCustomize(false)
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
        chips: customization.chips.length > 0 ? customization.chips : undefined,
      }
      await regenerate(customizationData)
      toast.success('メールを再生成しました')
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleAddChip = (chipText: string) => {
    if (chipText.trim()) {
      setCustomization((prev) => ({
        ...prev,
        chips: [...prev.chips, chipText.trim()],
        freeText: '',
      }))
    }
  }

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
            {/* Company Name */}
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

            {/* Lead Source */}
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

            {/* History (Optional) */}
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
            {loading ? 'メール生成中...' : 'メール生成'}
          </button>
        </form>
      </div>
    )
  }

  // Result state - Display generated content
  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">メール生成結果</h1>
          <p className="text-slate-400">
            {company} - {source}
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ company: '', source: '', history: '' })
            setCustomization({
              personas: [],
              news: [],
              cta: '',
              freeText: '',
              chips: [],
            })
            setShowCustomize(false)
          }}
          className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
        >
          新規作成
        </button>
      </div>

      {research && <ResearchReport research={research} />}

      <EmailOutput patterns={patterns} />

      {/* Customization Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="w-full flex items-center justify-between font-semibold text-white hover:text-blue-400 transition-colors"
        >
          <span>カスタマイズしてメールを再生成</span>
          <span className="text-slate-400">{showCustomize ? '−' : '+'}</span>
        </button>

        {showCustomize && (
          <div className="mt-6 space-y-6">
            {/* Personas */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">ペルソナ</h3>
              <div className="space-y-2">
                {['営業担当者', 'マーケティング責任者', 'IT部長', 'CEO'].map((persona) => (
                  <label key={persona} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customization.personas.includes(persona)}
                      onChange={(e) => {
                        setCustomization((prev) => ({
                          ...prev,
                          personas: e.target.checked
                            ? [...prev.personas, persona]
                            : prev.personas.filter((p) => p !== persona),
                        }))
                      }}
                      className="w-4 h-4 rounded border-slate-600 cursor-pointer"
                    />
                    <span className="text-slate-200">{persona}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* News Selection */}
            {research?.latestNews && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">ニュース</h3>
                <div className="space-y-2">
                  {research.latestNews.slice(0, 3).map((news) => (
                    <label key={news.id} className="flex items-start gap-3 cursor-pointer">
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
                        className="w-4 h-4 rounded border-slate-600 cursor-pointer mt-1 flex-shrink-0"
                      />
                      <span className="text-slate-200 text-sm">{news.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Selection */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">お客様への提案アクション</h3>
              <div className="space-y-2">
                {['資料請求', '無料デモ', 'メール返信', '電話相談', '訪啍'].map((cta) => (
                  <label key={cta} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="cta"
                      value={cta}
                      checked={customization.cta === cta}
                      onChange={(e) => {
                        setCustomization((prev) => ({
                          ...prev,
                          cta: e.target.value,
                        }))
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-200">{cta}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Free Text */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">追加指示</h3>
              <textarea
                value={customization.freeText}
                onChange={(e) => {
                  setCustomization((prev) => ({
                    ...prev,
                    freeText: e.target.value,
                  }))
                }}
                placeholder="メール生成をカスタマイズするための追加指示を入力してください"
                rows={3}
                className="w-full mb-2"
              />
              {customization.freeText && (
                <button
                  type="button"
                  onClick={() => handleAddChip(customization.freeText)}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                >
                  追加
                </button>
              )}
            </div>

            {/* Chips Display */}
            {customization.chips.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">指示</h3>
                <div className="flex flex-wrap gap-2">
                  {customization.chips.map((chip, index) => (
                    <div
                      key={index}
                      className="bg-blue-900/30 border border-blue-700 text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      <span>{chip}</span>
                      <button
                        onClick={() => {
                          setCustomization((prev) => ({
                            ...prev,
                            chips: prev.chips.filter((_, i) => i !== index),
                          }))
                        }}
                        className="text-blue-400 hover:text-blue-200 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold py-3 rounded-lg hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '再生成中...' : '再生成'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
