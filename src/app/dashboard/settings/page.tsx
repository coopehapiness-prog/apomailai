'use client'

import { useState, useEffect } from 'react'
import { useSettings } from '@/lib/hooks/useSettings'
import { CustomSettings } from '@/lib/types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings()
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const [senderProfile, setSenderProfile] = useState({
    senderName: '',
    senderTitle: '',
    company: '',
    phoneNumber: '',
    signaturePreview: false,
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
  })

  useEffect(() => {
    if (settings) {
      setSenderProfile({
        senderName: settings.senderName || '',
        senderTitle: settings.senderTitle || '',
        company: settings.company || '',
        phoneNumber: settings.phoneNumber || '',
        signaturePreview: settings.signaturePreview || false,
        signature: settings.signature || '',
      })

      setServiceInfo({
        name: settings.serviceInfo?.name || '',
        description: settings.serviceInfo?.description || '',
        strengths: settings.serviceInfo?.strengths || [''],
        price: settings.serviceInfo?.price || '',
        results: settings.serviceInfo?.results || '',
      })

      setPromptSettings({
        basePrompt: settings.promptSettings?.basePrompt || '',
        tone: settings.promptSettings?.tone || '',
      })
    }
  }, [settings])

  const handleSaveSenderProfile = async () => {
    setSaving((prev) => ({ ...prev, senderProfile: true }))
    try {
      await updateSettings({
        senderName: senderProfile.senderName,
        senderTitle: senderProfile.senderTitle,
        company: senderProfile.company,
        phoneNumber: senderProfile.phoneNumber,
        signaturePreview: senderProfile.signaturePreview,
        signature: senderProfile.signature,
      } as Partial<CustomSettings>)
      toast.success('送信者プロフィールを保存しました')
    } catch (err) {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, senderProfile: false }))
    }
  }

  const handleSaveServiceInfo = async () => {
    setSaving((prev) => ({ ...prev, serviceInfo: true }))
    try {
      await updateSettings({
        serviceInfo: {
          name: serviceInfo.name,
          description: serviceInfo.description,
          strengths: serviceInfo.strengths.filter((s) => s.trim()),
          price: serviceInfo.price,
          results: serviceInfo.results,
        },
      } as Partial<CustomSettings>)
      toast.success('サービス情報を保存しました')
    } catch (err) {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, serviceInfo: false }))
    }
  }

  const handleSavePromptSettings = async () => {
    setSaving((prev) => ({ ...prev, promptSettings: true }))
    try {
      await updateSettings({
        promptSettings: {
          basePrompt: promptSettings.basePrompt,
          tone: promptSettings.tone,
        },
      } as Partial<CustomSettings>)
      toast.success('プロンプト設定を保存しました')
    } catch (err) {
      toast.error('保存に失敗しました')
    } finally {
      setSaving((prev) => ({ ...prev, promptSettings: false }))
    }
  }

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
                onChange={(e) =>
                  setSenderProfile((prev) => ({
                    ...prev,
                    senderName: e.target.value,
                  }))
                }
                placeholder="例: 山田太郎"
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
                onChange={(e) =>
                  setSenderProfile((prev) => ({
                    ...prev,
                    senderTitle: e.target.value,
                  }))
                }
                placeholder="例: 営業部長"
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
                onChange={(e) =>
                  setSenderProfile((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
                placeholder="例: IS Sales Inc."
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
                onChange={(e) =>
                  setSenderProfile((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder="例: 090-1234-5678"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signature" className="block text-sm font-medium text-slate-300 mb-2">
              署名
            </label>
            <textarea
              id="signature"
              value={senderProfile.signature}
              onChange={(e) =>
                setSenderProfile((prev) => ({
                  ...prev,
                  signature: e.target.value,
                }))
              }
              placeholder="メール署名を入力してください"
              rows={3}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={senderProfile.signaturePreview}
              onChange={(e) =>
                setSenderProfile((prev) => ({
                  ...prev,
                  signaturePreview: e.target.checked,
                }))
              }
              className="w-4 h-4 rounded border-slate-600 cursor-pointer"
            />
            <span className="text-slate-200">署名プレビューを表示</span>
          </label>
        </div>

        {senderProfile.signaturePreview && senderProfile.signature && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6 border-l-2 border-blue-500">
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {senderProfile.signature}
            </p>
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
              onChange={(e) =>
                setServiceInfo((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="例: IS Sales 営業支援AI"
            />
          </div>

          <div>
            <label htmlFor="serviceDesc" className="block text-sm font-medium text-slate-300 mb-2">
              説明
            </label>
            <textarea
              id="serviceDesc"
              value={serviceInfo.description}
              onChange={(e) =>
                setServiceInfo((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="サービスの説明を入力してください"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              強み（1つずつ入力）
            </label>
            <div className="space-y-2">
              {serviceInfo.strengths.map((strength, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => {
                      const newStrengths = [...serviceInfo.strengths]
                      newStrengths[index] = e.target.value
                      setServiceInfo((prev) => ({
                        ...prev,
                        strengths: newStrengths,
                      }))
                    }}
                    placeholder="例: 高速メール生成"
                    className="flex-1"
                  />
                  {serviceInfo.strengths.length > 1 && (
                    <button
                      onClick={() => {
                        setServiceInfo((prev) => ({
                          ...prev,
                          strengths: prev.strengths.filter((_, i) => i !== index),
                        }))
                      }}
                      className="bg-red-900/30 hover:bg-red-900/50 text-red-300 px-3 py-2 rounded transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setServiceInfo((prev) => ({
                  ...prev,
                  strengths: [...prev.strengths, ''],
                }))
              }}
              className="mt-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded transition-colors"
            >
              追加
            </button>
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
                onChange={(e) =>
                  setServiceInfo((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                placeholder="例: 月額 99,000円"
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
                onChange={(e) =>
                  setServiceInfo((prev) => ({
                    ...prev,
                    results: e.target.value,
                  }))
                }
                placeholder="例: 5000社以上が導入"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveServiceInfo}
          disabled={saving.serviceInfo}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saving.serviceInfo ? '保存中...' : '保存'}
        </button>
      </section>

      {/* Prompt Settings */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">プロンプト設定</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="basePrompt" className="block text-sm font-medium text-slate-300 mb-2">
              ベースプロンプト
            </label>
            <textarea
              id="basePrompt"
              value={promptSettings.basePrompt}
              onChange={(e) =>
                setPromptSettings((prev) => ({
                  ...prev,
                  basePrompt: e.target.value,
                }))
              }
              placeholder="メール生成時のベースとなるプロンプトを入力してください"
              rows={4}
            />
          </div>

          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-slate-300 mb-2">
              トーン
            </label>
            <input
              id="tone"
              type="text"
              value={promptSettings.tone}
              onChange={(e) =>
                setPromptSettings((prev) => ({
                  ...prev,
                  tone: e.target.value,
                }))
              }
              placeholder="例: プロフェッショナル、カジュアル、フレンドリー"
            />
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
        <h2 className="text-xl font-bold text-white mb-6">ナレッジベース</h2>
        <p className="text-slate-400 mb-4">
          ナレッジベースはプロンプト設定で利用されます
        </p>

        <div className="bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 p-8 text-center">
          <p className="text-slate-400 mb-4">ファイルをドラッグ＆ドロップするか、クリックして選択</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            ファイルを選択
          </button>
        </div>

        {settings?.knowledgeBase && settings.knowledgeBase.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">登録済みアイテム</h3>
            {settings.knowledgeBase.map((item) => (
              <div
                key={item.id}
                className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-slate-100 font-medium">{item.title}</p>
                  {item.category && (
                    <p className="text-slate-400 text-xs">{item.category}</p>
                  )}
                </div>
                <button className="text-red-400 hover:text-red-300 text-sm font-medium">
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
