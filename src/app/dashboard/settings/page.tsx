'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSettings } from '@/lib/hooks/useSettings'
import { CustomSettings } from '@/lib/types'
import toast from 'react-hot-toast'

const DEFAULT_PROMPTS: Record<string, string> = {
  executive: `あなたはBtoB営業のプロフェッショナルです。
経営層（CxO / 取締役）向けに、ROIと事業インパクトを重視した営業メールを作成してください。
- 定量的な成果（コスト削減率、売上向上率など）を盛り込む
- 経営課題に直結するメッセージにする
- 簡潔かつ格調高いトーンで書く`,
  manager: `あなたはBtoB営業のプロフェッショナルです。
現場責任者（部長 / マネージャー）向けに、チーム効率化を訴求した営業メールを作成してください。
- 業務工数の削減や生甧性向上を具体的に示す
- 現場の課題に寄り添うトーンで書く
- 導入の容易さやサポート体制も言及する`,
  staff: `あなたはBtoB営業のプロフェッショナルです。
担当者（実務レベル）向けに、使いやすさと時短を訴求した営業メールを作成してください。
- 日常業務でのメリットを具体的に示す
- カジュアルで親しみやすいトーンで書く
- すぐ試せるアクション（無料トライアル等）を提案する`,
}

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.tsv']

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings()
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{id: string; title: string; content: string; category?: string}>>([])
  const [kbLoading, setKbLoading] = useState(true)

  const [senderProfile, setSenderProfile] = useState({
    senderName: '', senderTitle: '', company: '', phoneNumber: '', senderEmail: '', signature: '',
  })

  const [serviceInfo, setServiceInfo] = useState({
    name: '', description: '', strengths: [''], price: '', results: '',
  })

  const [promptSettings, setPromptSettings] = useState({
    basePrompt: '', tone: '',
    personaPrompts: { ...DEFAULT_PROMPTS },
  })

  const [editingPersona, setEditingPersona] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setSenderProfile({
        senderName: settings.sender_name || '', senderTitle: settings.sender_title || '',
        company: settings.sender_company || '', phoneNumber: settings.sender_phone || '',
        senderEmail: settings.sender_email || '', signature: settings.signature || '',
      })
      setServiceInfo({
        name: settings.service_name || '', description: settings.service_description || '',
        strengths: settings.service_strengths?.length ? settings.service_strengths : [''],
        price: settings.service_price || '', results: settings.service_results || '',
      })
      setPromptSettings({
        basePrompt: settings.prompt || '', tone: settings.tone || '',
        personaPrompts: settings.persona_prompts && Object.keys(settings.persona_prompts).length > 0
          ? settings.persona_prompts : { ...DEFAULT_PROMPTS },
      })
    }
  }, [settings])

  useEffect(() => {
    const fetchKB = async () => {
      setKbLoading(true)
      try {
        const token = localStorage.getItem('auth_token') || ''
        const res = await fetch('/api/settings/knowledge-base', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setKnowledgeItems(data.items || [])
        }
      } catch (e) { console.error('KB fetch error:', e) }
      finally { setKbLoading(false) }
    }
    fetchKB()
  }, [])

  const signaturePreview = useMemo(() => {
    if (senderProfile.signature) return senderProfile.signature
    const parts: string[] = []
    if (senderProfile.company) parts.push(senderProfile.company)
    if (senderProfile.senderName) {
      let line = senderProfile.senderName
      if (senderProfile.senderTitle) line += ' / ' + senderProfile.senderTitle
      parts.push(line)
    }
    if (senderProfile.senderEmail) parts.push('Email: ' + senderProfile.senderEmail)
    if (senderProfile.phoneNumber) parts.push('TEL: ' + senderProfile.phoneNumber)
    if (parts.length === 0) return ''
    return '────────────────────\n' + parts.join('\n') + '\n────────────────────'
  }, [senderProfile])

  const getFileIcon = (title: string) => {
    const ext = title.split('.').pop()?.toLowerCase() || ''
    if (['pdf'].includes(ext)) return '📕'
    if (['doc', 'docx'].includes(ext)) return '📘'
    if (['xls', 'xlsx'].includes(ext)) return '📗'
    if (['ppt', 'pptx'].includes(ext)) return '📙'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic'].includes(ext)) return '🖼️'
    if (['mp3', 'mp4', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return '🎵'
    return '📄'
  }

  const handleSaveSenderProfile = async () => {
    setSaving(prev => ({ ...prev, senderProfile: true }))
    try {
      await updateSettings({
        senderName: senderProfile.senderName,
        senderTitle: senderProfile.senderTitle,
        company: senderProfile.company,
        phoneNumber: senderProfile.phoneNumber,
        senderEmail: senderProfile.senderEmail,
        signature: senderProfile.signature,
      } as Partial<CustomSettings>)
      toast.success('送信者プロフィールを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(prev => ({ ...prev, senderProfile: false }))
    }
  }

  const handleSaveServiceInfo = async () => {
    setSaving(prev => ({ ...prev, serviceInfo: true }))
    try {
      await updateSettings({
        serviceInfo: {
          name: serviceInfo.name,
          description: serviceInfo.description,
          strengths: serviceInfo.strengths.filter(s => s.trim()),
          price: serviceInfo.price,
          results: serviceInfo.results,
        },
      } as Partial<CustomSettings>)
      toast.success('サービス情報を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(prev => ({ ...prev, serviceInfo: false }))
    }
  }

  const handleSavePromptSettings = async () => {
    setSaving(prev => ({ ...prev, promptSettings: true }))
    try {
      await updateSettings({
        promptSettings: {
          basePrompt: promptSettings.basePrompt,
          tone: promptSettings.tone,
          personaPrompts: promptSettings.personaPrompts,
        },
      } as Partial<CustomSettings>)
      toast.success('プロンプト設定を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(prev => ({ ...prev, promptSettings: false }))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast.error('ファイルサイズは20MB以下にしてください')
      return
    }

    setUploadingFile(true)
    try {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isTextFile = TEXT_EXTENSIONS.includes(ext)
      const token = localStorage.getItem('auth_token') || ''

      if (isTextFile) {
        const text = await file.text()
        if (!text || text.trim().length === 0) {
          toast.error('ファイルの内容が空です')
          setUploadingFile(false)
          return
        }
        const res = await fetch('/api/settings/knowledge-base', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: file.name,
            content: text.substring(0, 50000),
            category: 'uploaded_file',
          }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Upload failed')
        }
        const data = await res.json()
        if (data.item) {
          setKnowledgeItems(prev => [data.item, ...prev])
          toast.success(`${file.name} を登録しました`)
        } else {
          toast.error('レスポンスにアイテムが含まれていません')
        }
      } else {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/settings/knowledge-base/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'アップロード失敗')
        }
        const data = await res.json()
        if (data.item) {
          setKnowledgeItems(prev => [data.item, ...prev])
          toast.success(`${file.name} を登録しました`)
        } else {
          toast.error('レスポンスにアイテムが含まれていません')
        }
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(`アップロード失敗: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteKB = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch(`/api/settings/knowledge-base/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setKnowledgeItems(prev => prev.filter(item => item.id !== id))
        toast.success('削除しました')
      }
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    )
  }

  const ic = "w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="pt-6">
        <h1 className="text-3xl font-bold text-white mb-2">設定</h1>
        <p className="text-slate-400">アポメールAIの動作をカスタマイズします</p>
      </div>

      {/* Sender Profile Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6"><span>👤</span> 送信者プロフィール</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">氏名</label>
            <input
              type="text"
              value={senderProfile.senderName}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, senderName: e.target.value }))}
              className={ic}
              placeholder="山田太郎"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">役職</label>
            <input
              type="text"
              value={senderProfile.senderTitle}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, senderTitle: e.target.value }))}
              className={ic}
              placeholder="営業部長"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">企業名</label>
            <input
              type="text"
              value={senderProfile.company}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, company: e.target.value }))}
              className={ic}
              placeholder="株式会社〇〇"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">メールアドレス</label>
            <input
              type="email"
              value={senderProfile.senderEmail}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, senderEmail: e.target.value }))}
              className={ic}
              placeholder="yamada@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">電詰番号</label>
            <input
              type="tel"
              value={senderProfile.phoneNumber}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
              className={ic}
              placeholder="090-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">署名（カスタム）</label>
            <textarea
              value={senderProfile.signature}
              onChange={(e) => setSenderProfile(prev => ({ ...prev, signature: e.target.value }))}
              className={ic}
              rows={4}
              placeholder="上記で入力した情報から自動生成されます。カスタムする場合はここに入力してください。"
            />
          </div>
          {signaturePreview && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
              <p className="text-xs text-slate-500 mb-2">プレビュー</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{signaturePreview}</pre>
            </div>
          )}
        </div>
        <button
          onClick={handleSaveSenderProfile}
          disabled={saving.senderProfile}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {saving.senderProfile ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Service Info Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6"><span>🎯</span> サービス情報</h2>
        <p className="text-slate-400 text-sm mb-4">提供しているサービスの詳細情報を入力してください。メール生成時に参照されます。</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">サービス名</label>
            <input
              type="text"
              value={serviceInfo.name}
              onChange={(e) => setServiceInfo(prev => ({ ...prev, name: e.target.value }))}
              className={ic}
              placeholder="Cloud Analytics Pro"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">説明</label>
            <textarea
              value={serviceInfo.description}
              onChange={(e) => setServiceInfo(prev => ({ ...prev, description: e.target.value }))}
              className={ic}
              rows={3}
              placeholder="サービスの概要を説明してください"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">強み・特徴</label>
            <div className="space-y-2">
              {serviceInfo.strengths.map((strength, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setServiceInfo(prev => ({
                      ...prev,
                      strengths: prev.strengths.map((s, i) => i === idx ? e.target.value : s),
                    }))}
                    className={ic}
                    placeholder={`強み ${idx + 1}`}
                  />
                  {serviceInfo.strengths.length > 1 && (
                    <button
                      onClick={() => setServiceInfo(prev => ({
                        ...prev,
                        strengths: prev.strengths.filter((_, i) => i !== idx),
                      }))}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setServiceInfo(prev => ({
                  ...prev,
                  strengths: [...prev.strengths, ''],
                }))}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                + 強みを追加
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">価格</label>
            <input
              type="text"
              value={serviceInfo.price}
              onChange={(e) => setServiceInfo(prev => ({ ...prev, price: e.target.value }))}
              className={ic}
              placeholder="月額 $299 から"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">実績・成果</label>
            <textarea
              value={serviceInfo.results}
              onChange={(e) => setServiceInfo(prev => ({ ...prev, results: e.target.value }))}
              className={ic}
              rows={3}
              placeholder="導入企業での実縢や成果事例"
            />
          </div>
        </div>
        <button
          onClick={handleSaveServiceInfo}
          disabled={saving.serviceInfo}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {saving.serviceInfo ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Prompt Settings Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6"><span>⚙️</span> プロンプト設定</h2>
        <p className="text-slate-400 text-sm mb-4">メール生成時に使用されるプロンプトをカスタマイズしてください。</p>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">ベースプロンプト</label>
            <textarea
              value={promptSettings.basePrompt}
              onChange={(e) => setPromptSettings(prev => ({ ...prev, basePrompt: e.target.value }))}
              className={ic}
              rows={4}
              placeholder="メール生成の基本的な指示を入力してください"
            />
            <p className="text-xs text-slate-500 mt-1">すべてのメール生成に共通する基本ルールを指定します</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">トーン設定</label>
            <input
              type="text"
              value={promptSettings.tone}
              onChange={(e) => setPromptSettings(prev => ({ ...prev, tone: e.target.value }))}
              className={ic}
              placeholder="丁寧で信頼感のあるトーン"
            />
            <p className="text-xs text-slate-500 mt-1">メールの基調となるトーンを指定します（例：カジュアル、フォーマル、親切）</p>
          </div>

          <div className="border-t border-slate-600 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">ペルソナ別プロンプト</h3>
            <div className="space-y-4">
              {Object.entries(promptSettings.personaPrompts).map(([persona, prompt]) => (
                <div key={persona} className="bg-slate-900/50 rounded-lg border border-slate-600 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white capitalize">
                      {persona === 'executive' && '👔 経営層向け'}
                      {persona === 'manager' && '📊 マネージャー向け'}
                      {persona === 'staff' && '👨‍💼 担当者向け'}
                    </h4>
                    <button
                      onClick={() => setEditingPersona(editingPersona === persona ? null : persona)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      {editingPersona === persona ? '完了' : '編集'}
                    </button>
                  </div>
                  {editingPersona === persona ? (
                    <textarea
                      value={prompt}
                      onChange={(e) => setPromptSettings(prev => ({
                        ...prev,
                        personaPrompts: {
                          ...prev.personaPrompts,
                          [persona]: e.target.value,
                        },
                      }))}
                      className={ic}
                      rows={5}
                    />
                  ) : (
                    <p className="text-slate-400 text-sm whitespace-pre-wrap">{prompt}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleSavePromptSettings}
          disabled={saving.promptSettings}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {saving.promptSettings ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Knowledge Base Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><span>📚</span> ナレッジベース</h2>
          {knowledgeItems.length > 0 && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">{knowledgeItems.length}件登録済み</span>}
        </div>
        <p className="text-slate-400 text-sm mb-4">アップロードしたファイルの内容はメール生成時のコンテキストとして活用されます。</p>

        <div
          onClick={() => !uploadingFile && fileInputRef.current?.click()}
          className={`bg-slate-900/50 rounded-lg border-2 border-dashed ${uploadingFile ? 'border-yellow-500' : 'border-slate-600 hover:border-blue-500'} p-8 text-center cursor-pointer transition-colors mb-6`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx,.csv,.epub,.html,.xml,.json,.tsv,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.heic,.heif,.mp3,.mp4,.wav,.ogg,.m4a,.aac"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-slate-400 mb-3">{uploadingFile ? 'アップロード処理中...' : 'ファイルをクリックして選択'}</p>
          <span className={`inline-block ${uploadingFile ? 'bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2 rounded-lg font-medium transition-colors`}>
            {uploadingFile ? '⏳ アップロード中...' : '📁 ファイルを選択'}
          </span>
          <p className="text-slate-500 text-xs mt-2">PDF、Word、Excel、PowerPoint、璻像、音声、テキスト等に対応</p>
          <p className="text-slate-600 text-[10px] mt-1">.pdf .docx .xlsx .pptx .txt .md .csv .json .html .png .jpg .gif .mp3 .mp4 .wav など</p>
        </div>

        {kbLoading ? (
          <div className="text-center text-slate-400">読み込み中...</div>
        ) : knowledgeItems.length === 0 ? (
          <div className="text-center text-slate-500">
            <p className="text-sm">まだファイルがアップロードされていません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeItems.map((item) => (
              <div key={item.id} className="bg-slate-900/50 rounded-lg border border-slate-600 p-4 flex items-start justify-between hover:border-slate-500 transition-colors">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-blue-400 text-lg flex-shrink-0">{getFileIcon(item.title)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 font-medium truncate">{item.title}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {item.category === 'uploaded_file' ? 'アップロード済みファイル' : item.category || 'その他'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKB(item.id)}
                  className="ml-4 text-red-400 hover:text-red-300 font-medium text-sm flex-shrink-0"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">💡 ヒント:</span> テキストファイルは直接読み込まれ、その他のファイル形式は自動処理されます。最大ファイルサイズは20MBです。
          </p>
        </div>
      </section>
    </div>
  )
}
