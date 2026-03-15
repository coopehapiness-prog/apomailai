'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSettings } from '@/lib/hooks/useSettings'
import { CustomSettings } from '@/lib/types'
import toast from 'react-hot-toast'

const TONE_PRESETS = [
  { value: 'プロフェッショナルで信頼感のあるトーン', label: 'プロフェッショナル' },
  { value: '親しみやすくフレンドリーなトーン', label: 'フレンドリー' },
  { value: '丁寧で礼儀正しいフォーマルなトーン', label: 'フォーマル' },
  { value: 'カジュアルで気軽に読めるトーン', label: 'カジュアル' },
  { value: '熱意があり情熱的なトーン', label: '熱意・情熱的' },
  { value: '論理的でデータドリブンなトーン', label: 'ロジカル' },
  { value: '共感を重視した寄り添うトーン', label: '共感・寄り添い' },
  { value: '簡潔でストレートなトーン', label: '簡潔・ストレート' },
  { value: 'コンサルティング的で提案型のトーン', label: 'コンサル型' },
  { value: '柔らかく控えめだが説得力のあるトーン', label: 'ソフト・説得力' },
]

const DEFAULT_IS_PROMPT = `あなたはトップクラスのインサイドセールス担当者として、以下の方針でメールを作成してください。

【リサーチ重視】
- 企業名をもとにAIリサーチを実施し、事業内容・業界・最新ニュース・経営課題を徹底的に調査した上でメールを書く
- 「この人はうちの会社のことをよく調べている」と受信者に思わせる具体的な言及を必ず冒頭〜中盤に入れる
- テンプレート感のある汎用表現は絶対に使わない

【課題仮説マッチング】
- リサーチ結果から相手企業が直面していると思われる経営課題・業務課題を推測する
- その課題に対して、送信者のサービス情報から最も関連する強み・機能をピンポイントで選び、「貴社の○○という課題に対して、弊社の△△で具体的にお力になれます」という形でブリッジする
- サービス説明をそのまま貼り付けるのではなく、相手の課題文脈に合わせて自然に言い換える

【メール構成】
- 宛名 → リサーチに基づくアイスブレイク → 課題への共感・言及 → サービスとのマッチング提案 → 具体的なCTA（日程提案等）
- 件名は25文字以内で、相手の関心を引く具体的な内容にする
- 本文中では企業名を「貴社」と表記する（宛名行を除く）`

function readSetting(settings: CustomSettings | null, ...keys: string[]): string {
  if (!settings) return ''
  for (const key of keys) {
    const val = (settings as unknown as Record<string, unknown>)[key]
    if (typeof val === 'string' && val) return val
  }
  return ''
}

export default function SettingsPage() {
  const { settings, loading, updateSettings, fetchSettings } = useSettings()
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [senderProfile, setSenderProfile] = useState({
    senderName: '',
    senderTitle: '',
    company: '',
    phoneNumber: '',
    email: '',
    schedulingUrl: '',
  })

  const [serviceInfo, setServiceInfo] = useState({
    name: '',
    description: '',
    benefit: '',
    price: '',
    results: '',
    documentUrl: '',
  })

  const [promptSettings, setPromptSettings] = useState({
    basePrompt: '',
    tone: '',
  })

  const [caseStudies, setCaseStudies] = useState('')
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeType, setScrapeType] = useState<'case_study' | 'service'>('case_study')
  const [scrapedPages, setScrapedPages] = useState<Array<{ url: string; title: string; content: string }>>([])
  const [selectedCaseStudies, setSelectedCaseStudies] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!settings) return

    setSenderProfile({
      senderName: readSetting(settings, 'sender_name', 'senderName'),
      senderTitle: readSetting(settings, 'sender_title', 'senderTitle'),
      company: readSetting(settings, 'sender_company', 'senderCompany', 'company'),
      phoneNumber: readSetting(settings, 'sender_phone', 'phoneNumber'),
      email: readSetting(settings, 'sender_email', 'senderEmail'),
      schedulingUrl: readSetting(settings, 'scheduling_url', 'schedulingUrl'),
    })

    setServiceInfo({
      name: readSetting(settings, 'service_name', 'serviceName') || settings.serviceInfo?.name || '',
      description: readSetting(settings, 'service_description', 'serviceDescription') || settings.serviceInfo?.description || '',
      benefit: readSetting(settings, 'service_benefit', 'serviceBenefit') || settings.serviceInfo?.strengths?.join('、') || '',
      price: readSetting(settings, 'service_price', 'servicePrice') || settings.serviceInfo?.price || '',
      results: readSetting(settings, 'service_results', 'serviceResults') || settings.serviceInfo?.results || '',
      documentUrl: readSetting(settings, 'service_document_url', 'serviceDocumentUrl') || '',
    })

    setCaseStudies(readSetting(settings, 'case_studies') || '')

    setPromptSettings({
      basePrompt: readSetting(settings, 'prompt') || settings.promptSettings?.basePrompt || '',
      tone: readSetting(settings, 'tone') || settings.promptSettings?.tone || '',
    })
  }, [settings])

  const generatedSignature = useMemo(() => {
    const parts: string[] = []
    parts.push('━━━━━━━━━━━━━━━━━━━━')
    if (senderProfile.company) parts.push(senderProfile.company)
    const nameTitle = [senderProfile.senderName, senderProfile.senderTitle].filter(Boolean).join(' / ')
    if (nameTitle) parts.push(nameTitle)
    if (senderProfile.email) parts.push(`Email: ${senderProfile.email}`)
    if (senderProfile.phoneNumber) parts.push(`TEL: ${senderProfile.phoneNumber}`)
    parts.push('━━━━━━━━━━━━━━━━━━━━')
    return parts.join('\n')
  }, [senderProfile.senderName, senderProfile.senderTitle, senderProfile.company, senderProfile.phoneNumber, senderProfile.email])

  const handleSaveSenderProfile = async () => {
    setSaving((prev) => ({ ...prev, senderProfile: true }))
    try {
      await updateSettings({
        senderName: senderProfile.senderName,
        senderTitle: senderProfile.senderTitle,
        senderCompany: senderProfile.company,
        phoneNumber: senderProfile.phoneNumber,
        senderEmail: senderProfile.email,
        schedulingUrl: senderProfile.schedulingUrl,
      } as Partial<CustomSettings>)
      toast.success('送信者プロフィールを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, senderProfile: false }))
    }
  }

  const handleSaveServiceInfo = async () => {
    setSaving((prev) => ({ ...prev, serviceInfo: true }))
    try {
      await updateSettings({
        serviceName: serviceInfo.name,
        serviceDescription: serviceInfo.description,
        serviceBenefit: serviceInfo.benefit,
        servicePrice: serviceInfo.price,
        serviceResults: serviceInfo.results,
        serviceDocumentUrl: serviceInfo.documentUrl,
      } as Partial<CustomSettings>)
      toast.success('サービス情報を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, serviceInfo: false }))
    }
  }

  const handleScrapePages = async () => {
    if (!scrapeUrl.trim()) {
      toast.error('URLを入力してください')
      return
    }
    setScraping(true)
    setScrapedPages([])
    try {
      const res = await fetch('/api/settings/scrape-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ url: scrapeUrl.trim(), type: scrapeType }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'スクレイピングに失敗しました')
      }
      const data = await res.json()
      setScrapedPages(data.pages || [])
      toast.success(`${data.count}件のページを取得しました`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'スクレイピングに失敗しました')
    } finally {
      setScraping(false)
    }
  }

  /** Extract URLs already stored in case_studies text */
  const getExistingUrls = (text: string): Set<string> => {
    const urls = new Set<string>()
    const matches = text.match(/URL:\s*(https?:\/\/[^\s\n]+)/g)
    if (matches) {
      for (const m of matches) {
        urls.add(m.replace(/^URL:\s*/, '').trim().replace(/\/+$/, ''))
      }
    }
    return urls
  }

  const handleImportScrapedPages = async () => {
    if (scrapedPages.length === 0) return

    // Deduplicate: skip pages whose URL already exists in saved case studies
    const existingUrls = getExistingUrls(
      scrapeType === 'case_study' ? caseStudies : serviceInfo.description
    )
    const newPages = scrapedPages.filter(
      (p) => !existingUrls.has(p.url.replace(/\/+$/, ''))
    )
    const skippedCount = scrapedPages.length - newPages.length

    if (newPages.length === 0) {
      toast.error(`すべて学習済みです（${skippedCount}件スキップ）`)
      setScrapedPages([])
      return
    }

    const label = scrapeType === 'service' ? 'サービス' : '事例'
    // Number new entries continuing from existing count
    const existingEntries = (scrapeType === 'case_study' ? caseStudies : serviceInfo.description)
      .split(/\n---\n/).filter((s: string) => s.trim().length > 0)
    const startIdx = existingEntries.length
    const formatted = newPages.map((p, i) =>
      `【${label}${startIdx + i + 1}】${p.title}\nURL: ${p.url}\n${p.content}`
    ).join('\n\n---\n\n')

    if (scrapeType === 'case_study') {
      const merged = caseStudies
        ? `${caseStudies}\n\n---\n\n${formatted}`
        : formatted
      setCaseStudies(merged)
      try {
        await updateSettings({ caseStudies: merged } as Partial<CustomSettings>)
        const msg = skippedCount > 0
          ? `${newPages.length}件の事例を保存（${skippedCount}件は学習済みのためスキップ）`
          : `${newPages.length}件の事例を保存しました`
        toast.success(msg)
      } catch {
        toast.error('保存に失敗しました')
      }
    } else {
      const merged = serviceInfo.description
        ? `${serviceInfo.description}\n\n---\n\n${formatted}`
        : formatted
      setServiceInfo((prev) => ({ ...prev, description: merged }))
      try {
        await updateSettings({ serviceDescription: merged } as Partial<CustomSettings>)
        const msg = skippedCount > 0
          ? `${newPages.length}件のサービスページを保存（${skippedCount}件は学習済みのためスキップ）`
          : `${newPages.length}件のサービスページを保存しました`
        toast.success(msg)
      } catch {
        toast.error('保存に失敗しました')
      }
    }
    setScrapedPages([])
    setScrapeUrl('')
    fetchSettings()
  }

  const handleDeleteCaseStudyEntry = async (indexToDelete: number) => {
    const entries = caseStudies.split(/\n\n---\n\n/).filter((s: string) => s.trim().length > 0)
    if (indexToDelete < 0 || indexToDelete >= entries.length) return
    const updated = entries.filter((_: string, i: number) => i !== indexToDelete).join('\n\n---\n\n')
    setCaseStudies(updated)
    try {
      await updateSettings({ caseStudies: updated } as Partial<CustomSettings>)
      toast.success('事例を削除しました')
      fetchSettings()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleClearAllCaseStudies = async () => {
    if (!confirm('すべての学習済み事例データを削除しますか？この操作は元に戻せません。')) return
    setCaseStudies('')
    try {
      await updateSettings({ caseStudies: '' } as Partial<CustomSettings>)
      toast.success('すべての事例データを削除しました')
      fetchSettings()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleDeleteSelectedCaseStudies = async () => {
    if (selectedCaseStudies.size === 0) {
      toast.error('削除する事例を選択してください')
      return
    }
    if (!confirm(`選択した${selectedCaseStudies.size}件の事例を削除しますか？`)) return
    const entries = caseStudies.split(/\n\n---\n\n/).filter((s: string) => s.trim().length > 0)
    const updated = entries.filter((_: string, i: number) => !selectedCaseStudies.has(i)).join('\n\n---\n\n')
    setCaseStudies(updated)
    setSelectedCaseStudies(new Set())
    try {
      await updateSettings({ caseStudies: updated } as Partial<CustomSettings>)
      toast.success(`${selectedCaseStudies.size}件の事例を削除しました`)
      fetchSettings()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const toggleCaseStudySelection = (index: number) => {
    setSelectedCaseStudies((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleSelectAllCaseStudies = (totalEntries: number) => {
    setSelectedCaseStudies((prev) => {
      if (prev.size === totalEntries) return new Set()
      return new Set(Array.from({ length: totalEntries }, (_, i) => i))
    })
  }

  const handleSaveCaseStudies = async () => {
    setSaving((prev) => ({ ...prev, caseStudies: true }))
    try {
      await updateSettings({ caseStudies } as Partial<CustomSettings>)
      toast.success('事例情報を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, caseStudies: false }))
    }
  }

  const handleSavePromptSettings = async () => {
    setSaving((prev) => ({ ...prev, promptSettings: true }))
    try {
      await updateSettings({
        prompt: promptSettings.basePrompt,
        tone: promptSettings.tone,
      } as Partial<CustomSettings>)
      toast.success('プロンプト設定を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, promptSettings: false }))
    }
  }

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    let successCount = 0

    for (const file of Array.from(files)) {
      try {
        let content = ''
        const fileName = file.name
        const ext = fileName.split('.').pop()?.toLowerCase() || ''

        if (['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'yaml', 'yml', 'log'].includes(ext)) {
          content = await file.text()
        } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
          const buffer = await file.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          const textDecoder = new TextDecoder('utf-8', { fatal: false })
          const rawText = textDecoder.decode(bytes)
          const printable = rawText.replace(/[^\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim()
          content = printable.length > 100 ? printable : `[${ext.toUpperCase()} file] ${fileName} (${(file.size / 1024).toFixed(1)} KB) — バイナリファイルのため全文テキスト抽出は限定的です。テキスト版のアップロードを推奨します。`
        } else {
          content = await file.text().catch(() => `[${ext.toUpperCase()} file] ${fileName}`)
        }

        if (!content.trim()) {
          toast.error(`${fileName}: 内容が空です`)
          continue
        }

        const category = ext === 'csv' ? 'データ' : ext === 'json' ? 'データ' : ext === 'md' ? 'ドキュメント' : 'ファイル'

        const res = await fetch('/api/settings/knowledge-base', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            title: fileName,
            content: content.substring(0, 50000),
            category,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'アップロードに失敗しました')
        }

        successCount++
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'アップロードに失敗しました'}`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount}件のファイルをアップロードしました`)
      fetchSettings()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [fetchSettings])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">カスタム設定</h1>
        <p className="text-slate-400">
          送信者情報、サービス情報、プロンプト設定を管理します
        </p>
      </div>

      {/* Sender Profile */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">送信者プロフィール</h2>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="senderName" className="block text-sm font-medium text-slate-300 mb-2">
                名前
              </label>
              <input
                id="senderName"
                type="text"
                value={senderProfile.senderName}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, senderName: e.target.value }))}
                placeholder="例: 山田太郎"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="senderTitle" className="block text-sm font-medium text-slate-300 mb-2">
                肩書
              </label>
              <input
                id="senderTitle"
                type="text"
                value={senderProfile.senderTitle}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, senderTitle: e.target.value }))}
                placeholder="例: 営業部長"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-2">
                会社名
              </label>
              <input
                id="company"
                type="text"
                value={senderProfile.company}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, company: e.target.value }))}
                placeholder="例: IS Sales Inc."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-300 mb-2">
                電話番号
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={senderProfile.phoneNumber}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="例: 090-1234-5678"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="senderEmail" className="block text-sm font-medium text-slate-300 mb-2">
                メールアドレス
              </label>
              <input
                id="senderEmail"
                type="email"
                value={senderProfile.email}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="例: yamada@example.com"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="schedulingUrl" className="block text-sm font-medium text-slate-300 mb-2">
                日程調整URL
              </label>
              <input
                id="schedulingUrl"
                type="url"
                value={senderProfile.schedulingUrl}
                onChange={(e) => setSenderProfile((prev) => ({ ...prev, schedulingUrl: e.target.value }))}
                placeholder="例: https://calendly.com/your-name"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                入力すると、メールの結びでこのURLへ誘導する文面がデフォルトで生成されます
              </p>
            </div>
          </div>

        </div>

        {/* Signature Preview - always visible, real-time update from fields above */}
        <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-300">署名プレビュー</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              リアルタイム更新
            </span>
          </div>
          <pre className="text-sm text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
            {generatedSignature}
          </pre>
          <p className="text-[10px] text-slate-500 mt-2">
            上の入力欄を編集すると、署名プレビューがリアルタイムで更新されます
          </p>
        </div>

        {/* Saved values indicator */}
        {settings && (readSetting(settings, 'sender_name', 'senderName') || readSetting(settings, 'sender_company', 'senderCompany', 'company')) && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 mb-4">
            <div className="text-[10px] font-bold text-green-400 mb-1">保存済み</div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              {readSetting(settings, 'sender_name', 'senderName') && (
                <div>名前: {readSetting(settings, 'sender_name', 'senderName')}</div>
              )}
              {readSetting(settings, 'sender_title', 'senderTitle') && (
                <div>肩書: {readSetting(settings, 'sender_title', 'senderTitle')}</div>
              )}
              {readSetting(settings, 'sender_company', 'senderCompany', 'company') && (
                <div>会社名: {readSetting(settings, 'sender_company', 'senderCompany', 'company')}</div>
              )}
              {readSetting(settings, 'sender_phone', 'phoneNumber') && (
                <div>電話番号: {readSetting(settings, 'sender_phone', 'phoneNumber')}</div>
              )}
              {readSetting(settings, 'sender_email', 'senderEmail') && (
                <div>メール: {readSetting(settings, 'sender_email', 'senderEmail')}</div>
              )}
              {readSetting(settings, 'scheduling_url', 'schedulingUrl') && (
                <div>日程調整URL: {readSetting(settings, 'scheduling_url', 'schedulingUrl')}</div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSaveSenderProfile}
          disabled={saving.senderProfile}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving.senderProfile ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Service Info */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">サービス情報</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="serviceName" className="block text-sm font-medium text-slate-300 mb-2">
              サービス名
            </label>
            <input
              id="serviceName"
              type="text"
              value={serviceInfo.name}
              onChange={(e) => setServiceInfo((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例: IS Sales 営業支援AI"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="serviceDesc" className="block text-sm font-medium text-slate-300 mb-2">
              説明
            </label>
            <textarea
              id="serviceDesc"
              value={serviceInfo.description}
              onChange={(e) => setServiceInfo((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="サービスの説明を入力してください"
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-vertical"
            />
          </div>

          <div>
            <label htmlFor="serviceBenefit" className="block text-sm font-medium text-slate-300 mb-2">
              強み・特徴
            </label>
            <textarea
              id="serviceBenefit"
              value={serviceInfo.benefit}
              onChange={(e) => setServiceInfo((prev) => ({ ...prev, benefit: e.target.value }))}
              placeholder="例: AIによる高速メール生成、企業リサーチの自動化、パーソナライズされた営業文面の作成"
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-vertical"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              サービスの強みや特徴を自由に記述してください
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-slate-300 mb-2">
                価格
              </label>
              <input
                id="price"
                type="text"
                value={serviceInfo.price}
                onChange={(e) => setServiceInfo((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="例: 月額 99,000円"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="results" className="block text-sm font-medium text-slate-300 mb-2">
                実績
              </label>
              <input
                id="results"
                type="text"
                value={serviceInfo.results}
                onChange={(e) => setServiceInfo((prev) => ({ ...prev, results: e.target.value }))}
                placeholder="例: 5000社以上が導入"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="documentUrl" className="block text-sm font-medium text-slate-300 mb-2">
              サービス資料URL
            </label>
            <input
              id="documentUrl"
              type="url"
              value={serviceInfo.documentUrl}
              onChange={(e) => setServiceInfo((prev) => ({ ...prev, documentUrl: e.target.value }))}
              placeholder="例: https://example.com/download/service-guide.pdf"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              入力すると、初回メール（流入直後）の本文にこの資料リンクが自動で挿入されます。資料ダウンロード経由のリードには特に効果的です。
            </p>
          </div>
        </div>

        {/* Saved values indicator */}
        {settings && (readSetting(settings, 'service_name', 'serviceName') || readSetting(settings, 'service_description', 'serviceDescription')) && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 mb-4">
            <div className="text-[10px] font-bold text-green-400 mb-1">保存済み</div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              {readSetting(settings, 'service_name', 'serviceName') && (
                <div>サービス名: {readSetting(settings, 'service_name', 'serviceName')}</div>
              )}
              {readSetting(settings, 'service_description', 'serviceDescription') && (
                <div className="line-clamp-1">説明: {readSetting(settings, 'service_description', 'serviceDescription')}</div>
              )}
              {readSetting(settings, 'service_benefit', 'serviceBenefit') && (
                <div className="line-clamp-1">強み: {readSetting(settings, 'service_benefit', 'serviceBenefit')}</div>
              )}
              {readSetting(settings, 'service_price', 'servicePrice') && (
                <div>価格: {readSetting(settings, 'service_price', 'servicePrice')}</div>
              )}
              {readSetting(settings, 'service_results', 'serviceResults') && (
                <div>実績: {readSetting(settings, 'service_results', 'serviceResults')}</div>
              )}
              {readSetting(settings, 'service_document_url', 'serviceDocumentUrl') && (
                <div>資料URL: {readSetting(settings, 'service_document_url', 'serviceDocumentUrl')}</div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSaveServiceInfo}
          disabled={saving.serviceInfo}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving.serviceInfo ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Case Studies & Page Scraping */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-2">事例・サービスページ取り込み</h2>
        <p className="text-slate-400 mb-6 text-sm">
          事例一覧ページやサービスページのURLを入力すると、自動でサブページをスクレイピングし事例情報を学習します。
          学習した事例はメール・架電スクリプト・フォローアップに自動で活用されます。
        </p>

        {/* URL Scraping */}
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-300">URLから自動取り込み</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              自動スクレイピング
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setScrapeType('case_study')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                scrapeType === 'case_study'
                  ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              事例ページ
            </button>
            <button
              type="button"
              onClick={() => setScrapeType('service')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                scrapeType === 'service'
                  ? 'bg-green-500/20 border-green-500/60 text-green-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              サービス・製品ページ
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder={scrapeType === 'case_study'
                ? '例: https://example.com/voice/ や https://example.com/case/'
                : '例: https://example.com/service/ や https://example.com/product/'}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
            />
            <button
              onClick={handleScrapePages}
              disabled={scraping || !scrapeUrl.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
            >
              {scraping ? '取得中...' : '取得'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {scrapeType === 'case_study'
              ? '事例一覧ページのURLを入力すると、各事例ページを自動でスクレイピングします'
              : 'サービス一覧ページのURLを入力すると、各サービスページを自動でスクレイピングします'}
          </p>
        </div>

        {/* Scraped pages preview */}
        {scrapedPages.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-4 border border-purple-500/30 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-purple-300">
                取得結果: {scrapedPages.length}件
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setScrapedPages([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImportScrapedPages}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                >
                  すべて取り込む
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {scrapedPages.map((page, i) => {
                const existingUrls = getExistingUrls(caseStudies)
                const pageUrlNormalized = page.url.replace(/\/+$/, '')
                const isAlreadyLearned = existingUrls.has(pageUrlNormalized)
                return (
                  <div key={i} className={`bg-slate-800 rounded p-2.5 border ${isAlreadyLearned ? 'border-green-500/30 opacity-60' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="text-xs font-medium text-slate-200 truncate flex-1">{page.title}</div>
                      {isAlreadyLearned && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 flex-shrink-0">
                          学習済み
                        </span>
                      )}
                    </div>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 truncate block"
                    >
                      {page.url}
                    </a>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{page.content.substring(0, 150)}...</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Manual case studies textarea */}
        <div className="mb-6">
          <label htmlFor="caseStudies" className="block text-sm font-medium text-slate-300 mb-2">
            事例情報（手動入力・編集可）
          </label>
          <textarea
            id="caseStudies"
            value={caseStudies}
            onChange={(e) => setCaseStudies(e.target.value)}
            placeholder={'導入事例を入力してください。URLからの自動取り込みも上のフォームから可能です。\n\n例:\n【事例1】株式会社A社 - 営業効率が2倍に\nURL: https://example.com/voice/a-corp\n導入前は月100件だったアポイント数が、導入後は月200件に。営業チームの生産性が大幅に向上しました。'}
            rows={8}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-vertical text-sm leading-relaxed"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            登録された事例はメール生成・架電スクリプト・フォローアップシナリオに自動で活用されます
          </p>
        </div>

        {/* Saved case studies viewer */}
        {settings && readSetting(settings, 'case_studies') && (() => {
          const raw = readSetting(settings, 'case_studies')
          const entries = raw.split(/\n---\n/).filter((s: string) => s.trim().length > 0)
          const totalChars = raw.length
          return (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-green-400">学習済み事例データ</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                    {entries.length}件 / {(totalChars / 1000).toFixed(1)}K文字
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCaseStudies.size > 0 && (
                    <button
                      onClick={handleDeleteSelectedCaseStudies}
                      className="text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10 font-medium"
                    >
                      選択削除（{selectedCaseStudies.size}件）
                    </button>
                  )}
                  <button
                    onClick={() => toggleSelectAllCaseStudies(entries.length)}
                    className="text-[10px] text-slate-400 hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-slate-600 hover:border-slate-500"
                  >
                    {selectedCaseStudies.size === entries.length ? '全選択解除' : '全選択'}
                  </button>
                  <button
                    onClick={handleClearAllCaseStudies}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10"
                  >
                    全削除
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {entries.map((entry: string, i: number) => {
                  const lines = entry.trim().split('\n')
                  const titleLine = lines[0] || ''
                  const urlLine = lines.find((l: string) => l.startsWith('URL:'))
                  const contentLines = lines.filter((l: string) => l !== titleLine && !l.startsWith('URL:'))
                  const contentPreview = contentLines.join(' ').substring(0, 120)
                  const isSelected = selectedCaseStudies.has(i)
                  return (
                    <div
                      key={i}
                      className={`bg-slate-800/50 rounded p-2 border transition-colors cursor-pointer ${
                        isSelected ? 'border-red-500/40 bg-red-500/5' : 'border-slate-700/50 hover:border-slate-600/50'
                      }`}
                      onClick={() => toggleCaseStudySelection(i)}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCaseStudySelection(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 flex-shrink-0 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500/30 cursor-pointer"
                        />
                        <span className="text-[10px] text-green-400 font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-slate-200 truncate">{titleLine.replace(/^【.*?】/, '')}</div>
                          {urlLine && (
                            <a
                              href={urlLine.replace('URL: ', '').trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-blue-400 hover:text-blue-300 truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {urlLine.replace('URL: ', '').trim()}
                            </a>
                          )}
                          {contentPreview && (
                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{contentPreview}</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCaseStudyEntry(i) }}
                          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1 p-0.5"
                          title="この事例を削除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <button
          onClick={handleSaveCaseStudies}
          disabled={saving.caseStudies}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving.caseStudies ? '保存中...' : '事例情報を保存'}
        </button>
      </section>

      {/* Prompt Settings */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">プロンプト設定</h2>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="basePrompt" className="block text-sm font-medium text-slate-300">
                ベースプロンプト
              </label>
              {!promptSettings.basePrompt && (
                <button
                  type="button"
                  onClick={() => setPromptSettings((prev) => ({
                    ...prev,
                    basePrompt: DEFAULT_IS_PROMPT,
                  }))}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-colors"
                >
                  IS向けデフォルトを設定
                </button>
              )}
            </div>
            <textarea
              id="basePrompt"
              value={promptSettings.basePrompt}
              onChange={(e) => setPromptSettings((prev) => ({ ...prev, basePrompt: e.target.value }))}
              placeholder="メール生成時のベースとなるプロンプトを入力してください。空欄の場合はIS向けのデフォルト設定が使用されます。"
              rows={6}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-vertical text-sm leading-relaxed"
            />
            {promptSettings.basePrompt && (
              <button
                type="button"
                onClick={() => setPromptSettings((prev) => ({
                  ...prev,
                  basePrompt: DEFAULT_IS_PROMPT,
                }))}
                className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                デフォルトに戻す
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              トーン
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {TONE_PRESETS.map((preset) => {
                const isSelected = promptSettings.tone === preset.value
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPromptSettings((prev) => ({
                      ...prev,
                      tone: prev.tone === preset.value ? '' : preset.value,
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                        : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <input
              id="tone"
              type="text"
              value={promptSettings.tone}
              onChange={(e) => setPromptSettings((prev) => ({ ...prev, tone: e.target.value }))}
              placeholder="上から選択するか、自由にトーンを入力（例: 熱意があり説得力のあるトーン）"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              プリセットを選択するか、自分でカスタムトーンを入力できます
            </p>
          </div>
        </div>

        <button
          onClick={handleSavePromptSettings}
          disabled={saving.promptSettings}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving.promptSettings ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Knowledge Base Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-2">ナレッジベース</h2>
        <p className="text-slate-400 mb-4 text-sm">
          アップロードしたファイルの内容はメール生成時のプロンプトに活用されます。
          対応形式：TXT、CSV、JSON、MD、HTML、XML、PDF、DOCX など
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={handleDrop}
          className="bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 p-8 text-center hover:border-blue-500/50 transition-colors"
        >
          <div className="text-3xl mb-3 text-slate-500">📁</div>
          <p className="text-slate-400 mb-4">ファイルをドラッグ＆ドロップするか、ボタンをクリックして選択</p>
          <button
            type="button"
            disabled={uploading}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors cursor-pointer"
          >
            {uploading ? 'アップロード中...' : 'ファイルを選択'}
          </button>
          <p className="text-[10px] text-slate-500 mt-3">
            対応形式: TXT, CSV, JSON, MD, HTML, XML, YAML, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, その他テキスト形式
          </p>
        </div>

        {settings?.knowledgeBase && settings.knowledgeBase.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              登録済みアイテム（{settings.knowledgeBase.length}件）
            </h3>
            {settings.knowledgeBase.map((item) => (
              <div
                key={item.id}
                className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-slate-100 font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-600 text-slate-300">
                        {item.category}
                      </span>
                    )}
                    {item.created_at && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('このアイテムを削除しますか？')) return
                    try {
                      await fetch(`/api/settings/knowledge-base/${item.id}`, {
                        method: 'DELETE',
                        credentials: 'same-origin',
                      })
                      toast.success('削除しました')
                      fetchSettings()
                    } catch {
                      toast.error('削除に失敗しました')
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-sm font-medium flex-shrink-0 ml-3"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
