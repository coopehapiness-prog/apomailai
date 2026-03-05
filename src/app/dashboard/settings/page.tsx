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
- 業務工数の削減や生産性向上を具体的に示す
- 現場の課題に寄り添うトーンで書く
- 導入の容易さやサポート体制も言及する`,
  staff: `あなたはBtoB営業のプロフェッショナルです。
担当者（実務レベル）向けに、使いやすさと時短を訴求した営業メールを作成してください。
- 日常業務でのメリットを具体的に示す
- カジュアルで親しみやすいトーンで書く
- すぐ試せるアクション（無料トライアル等）を提案する`,
}

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings()
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{id: string; title: string; content: string; category?: string}>>([])
  const [kbLoading, setKbLoading] = useState(true)

  const [senderProfile, setSenderProfile] = useState({
    senderName: '',
    senderTitle: '',
    company: '',
    phoneNumber: '',
    senderEmail: '',
    signature: '',
  })

  const [serviceInfo, setServiceInfo] = useState({
    name: '',
    description: '',
    strengths: [''],
    price: '',
    results: '',
  })

  const [promptSettings, setPromptSettings] = useState({
    basePrompt: '',
    tone: '',
    personaPrompts: { ...DEFAULT_PROMPTS },
  })

  const [editingPersona, setEditingPersona] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setSenderProfile({
        senderName: settings.sender_name || '',
        senderTitle: settings.sender_title || '',
        company: settings.sender_company || '',
        phoneNumber: settings.sender_phone || '',
        senderEmail: settings.sender_email || '',
        signature: settings.signature || '',
      })
      setServiceInfo({
        name: settings.service_name || '',
        description: settings.service_description || '',
        strengths: settings.service_strengths?.length ? settings.service_strengths : [''],
        price: settings.service_price || '',
        results: settings.service_results || '',
      })
      setPromptSettings({
        basePrompt: settings.prompt || '',
        tone: settings.tone || '',
        personaPrompts: settings.persona_prompts && Object.keys(settings.persona_prompts).length > 0
          ? settings.persona_prompts
          : { ...DEFAULT_PROMPTS },
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

  // Signature preview: company -> name -> email -> phone
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
    return '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' + parts.join('\n') + '\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'
  }, [senderProfile])

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
    } catch { toast.error('保存に失敗しました') }
    finally { setSaving(prev => ({ ...prev, senderProfile: false })) }
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
    } catch { toast.error('保存に失敗しました') }
    finally { setSaving(prev => ({ ...prev, serviceInfo: false })) }
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
    } catch { toast.error('保存に失敗しました') }
    finally { setSaving(prev => ({ ...prev, promptSettings: false })) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const text = await file.text()
      if (!text || text.trim().length === 0) {
        toast.error('ファイルの内容が空です')
        setUploadingFile(false)
        return
      }
      const token = localStorage.getItem('auth_token') || ''
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
    } catch { toast.error('削除に失敗しました') }
  }

  if (loading) {
    return (<div className="flex items-center justify-center min-h-screen"><div className="text-slate-400">読み込み中...</div></div>)
  }

  const ic = "w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">カスタム設定</h1>
        <p className="text-slate-400">送信者情報、サービス情報、プロンプト設定を管理します</p>
      </div>

      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><span>👤</span> 送信者プロフィール</h2>
          {settings?.sender_name && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">✓ 登録済み</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">会社名</label>
            <input type="text" value={senderProfile.company} onChange={e => setSenderProfile(p => ({ ...p, company: e.target.value }))} placeholder="例: IS Sales Inc." className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">名前</label>
            <input type="text" value={senderProfile.senderName} onChange={e => setSenderProfile(p => ({ ...p, senderName: e.target.value }))} placeholder="例: 山田太郎" className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">肩書</label>
            <input type="text" value={senderProfile.senderTitle} onChange={e => setSenderProfile(p => ({ ...p, senderTitle: e.target.value }))} placeholder="例: 営業部長" className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">メールアドレス</label>
            <input type="email" value={senderProfile.senderEmail} onChange={e => setSenderProfile(p => ({ ...p, senderEmail: e.target.value }))} placeholder="例: yamada@example.com" className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">電話番号</label>
            <input type="tel" value={senderProfile.phoneNumber} onChange={e => setSenderProfile(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="例: 090-1234-5678" className={ic} />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">カスタム署名（空欄時は上記情報から自動生成）</label>
          <textarea value={senderProfile.signature} onChange={e => setSenderProfile(p => ({ ...p, signature: e.target.value }))} placeholder="カスタム署名を入力（省略可）" rows={3} className={ic} />
        </div>
        {signaturePreview && (
          <div className="bg-slate-900/70 rounded-lg p-4 mb-4 border border-slate-600">
            <p className="text-xs font-semibold text-slate-400 mb-2">📝 署名プレビュー（リアルタイム）</p>
            <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans">{signaturePreview}</pre>
          </div>
        )}
        <button onClick={handleSaveSenderProfile} disabled={saving.senderProfile} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          {saving.senderProfile ? '保存中...' : '💾 保存'}
        </button>
      </section>

      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><span>🏢</span> サービス情報</h2>
          {settings?.service_name && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">✓ 登録済み</span>}
        </div>
        {settings?.service_name && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-5 border border-slate-700">
            <p className="text-xs font-semibold text-slate-400 mb-2">📋 現在の登録内容</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">サービス名:</span> <span className="text-slate-200">{settings.service_name || '未設定'}</span></div>
              <div><span className="text-slate-500">価格:</span> <span className="text-slate-200">{settings.service_price || '未設定'}</span></div>
              <div className="col-span-2"><span className="text-slate-500">説明:</span> <span className="text-slate-200">{settings.service_description || '未設定'}</span></div>
              <div className="col-span-2"><span className="text-slate-500">実績:</span> <span className="text-slate-200">{settings.service_results || '未設定'}</span></div>
            </div>
          </div>
        )}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">サービス名</label>
            <input type="text" value={serviceInfo.name} onChange={e => setServiceInfo(p => ({ ...p, name: e.target.value }))} placeholder="例: IS Sales 営業支援AI" className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">説明</label>
            <textarea value={serviceInfo.description} onChange={e => setServiceInfo(p => ({ ...p, description: e.target.value }))} placeholder="サービスの説明を入力" rows={3} className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">強み（1つずつ入力）</label>
            <div className="space-y-2">
              {serviceInfo.strengths.map((strength, index) => (
                <div key={index} className="flex gap-2">
                  <input type="text" value={strength} onChange={e => {
                    const ns = [...serviceInfo.strengths]; ns[index] = e.target.value;
                    setServiceInfo(p => ({ ...p, strengths: ns }))
                  }} placeholder="例: 高速メール生成" className={ic + ' flex-1'} />
                  {serviceInfo.strengths.length > 1 && (
                    <button onClick={() => setServiceInfo(p => ({ ...p, strengths: p.strengths.filter((_, i) => i !== index) }))}
                      className="bg-red-900/30 hover:bg-red-900/50 text-red-300 px-3 py-2 rounded-lg transition-colors text-sm">削除</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setServiceInfo(p => ({ ...p, strengths: [...p.strengths, ''] }))}
              className="mt-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors">+ 追加</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">価格</label>
              <input type="text" value={serviceInfo.price} onChange={e => setServiceInfo(p => ({ ...p, price: e.target.value }))} placeholder="例: 月額 99,000円" className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">実績</label>
              <input type="text" value={serviceInfo.results} onChange={e => setServiceInfo(p => ({ ...p, results: e.target.value }))} placeholder="例: 5000社以上が導入" className={ic} />
            </div>
          </div>
        </div>
        <button onClick={handleSaveServiceInfo} disabled={saving.serviceInfo} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          {saving.serviceInfo ? '保存中...' : '💾 保存'}
        </button>
      </section>

      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><span>⚙️</span> プロンプト設定</h2>
          {settings?.prompt && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">✓ カスタム設定あり</span>}
        </div>
        <div className="space-y-5 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ベースプロンプト（全パターン共通の指示）</label>
            <textarea value={promptSettings.basePrompt} onChange={e => setPromptSettings(p => ({ ...p, basePrompt: e.target.value }))}
              placeholder="メール生成時のベースとなるプロンプトを入力。空欄時はデフォルト使用。" rows={4} className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">トーン</label>
            <input type="text" value={promptSettings.tone} onChange={e => setPromptSettings(p => ({ ...p, tone: e.target.value }))}
              placeholder="例: プロフェッショナル、カジュアル" className={ic} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">ペルソナ別プロンプト（クリックで編集）</label>
            <div className="space-y-3">
              {Object.entries({ executive: '経営層向け（ROI訴求）', manager: '現場責任者向け（効率化訴求）', staff: '担当者向け（時短訴求）' }).map(([key, label]) => (
                <div key={key} className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                  <button onClick={() => setEditingPersona(editingPersona === key ? null : key)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors">
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                    <span className="text-slate-400 text-xs">{editingPersona === key ? '▲ 閉じる' : '▼ 編集'}</span>
                  </button>
                  {editingPersona === key && (
                    <div className="px-4 pb-4">
                      <textarea value={promptSettings.personaPrompts[key] || DEFAULT_PROMPTS[key]}
                        onChange={e => setPromptSettings(p => ({ ...p, personaPrompts: { ...p.personaPrompts, [key]: e.target.value } }))}
                        rows={6} className={ic + ' text-sm'} />
                      <button onClick={() => setPromptSettings(p => ({ ...p, personaPrompts: { ...p.personaPrompts, [key]: DEFAULT_PROMPTS[key] } }))}
                        className="mt-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">↩ デフォルトに戻す</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleSavePromptSettings} disabled={saving.promptSettings} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          {saving.promptSettings ? '保存中...' : '💾 保存'}
        </button>
      </section>

      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><span>📚</span> ナレッジベース</h2>
          {knowledgeItems.length > 0 && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">{knowledgeItems.length}件登録済み</span>}
        </div>
        <p className="text-slate-400 text-sm mb-4">アップロードしたファイルの内容はメール生成時のコンテキストとして活用されます。</p>
        <div onClick={() => !uploadingFile && fileInputRef.current?.click()}
          className={`bg-slate-900/50 rounded-lg border-2 border-dashed ${uploadingFile ? 'border-yellow-500' : 'border-slate-600 hover:border-blue-500'} p-8 text-center cursor-pointer transition-colors mb-6`}>
          <input ref={fileInputRef} type="file" accept=".txt,.csv,.md,.json" onChange={handleFileUpload} className="hidden" />
          <p className="text-slate-400 mb-3">{uploadingFile ? 'アップロード処理中...' : 'ファイルをクリックして選択'}</p>
          <span className={`inline-block ${uploadingFile ? 'bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2 rounded-lg font-medium transition-colors`}>
            {uploadingFile ? '⏳ アップロード中...' : '📁 ファイルを選択'}
          </span>
          <p className="text-slate-500 text-xs mt-2">対応形式: .txt, .csv, .md, .json</p>
        </div>
        {kbLoading ? (
          <div className="text-center py-4"><p className="text-slate-500 text-sm">ナレッジベースを読み込み中...</p></div>
        ) : knowledgeItems.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">登録済みアイテム</h3>
            {knowledgeItems.map(item => (
              <div key={item.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">📄</span>
                    <p className="text-slate-100 font-medium text-sm">{item.title}</p>
                    {item.category && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{item.category}</span>}
                  </div>
                  <button onClick={() => handleDeleteKB(item.id)} className="text-red-400 hover:text-red-300 text-sm font-medium px-2 py-1 rounded hover:bg-red-900/20 transition-colors">削除</button>
                </div>
                <p className="text-slate-400 text-xs line-clamp-2">{item.content?.substring(0, 200)}...</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4"><p className="text-slate-500 text-sm">まだナレッジが登録されていません。ファイルをアップロードするとメール生成に活用されます。</p></div>
        )}
      </section>
    </div>
  )
}
