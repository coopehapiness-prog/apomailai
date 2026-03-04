'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { Lead, AnalyticsKPI, SuccessFactor } from '@/lib/types'
import toast from 'react-hot-toast'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsKPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    sort: 'createdAt_desc',
  })

  const [selectedMember, setSelectedMember] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [expandedFactors, setExpandedFactors] = useState<Record<string, boolean>>({})

  const periods = ['today', 'week', 'month', 'quarter', 'year']
  const statuses = ['initial', 'engaged', 'interested', 'appointment', 'dealt']
  const members = ['メンバー1', 'メンバー2', 'メンバー3']

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [leadsData, analyticsData] = await Promise.all([
        apiClient.getLeads(filters),
        apiClient.getAnalytics(selectedPeriod, selectedMember || undefined),
      ])

      setLeads(leadsData)
      setAnalytics(analyticsData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データ取得に失敗しました'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filters, selectedMember, selectedPeriod])

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      initial: '初期接触',
      engaged: '関心あり',
      interested: '興味深い',
      appointment: 'アポ設定',
      dealt: '成約',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      initial: 'bg-slate-700 text-slate-200',
      engaged: 'bg-blue-900 text-blue-200',
      interested: 'bg-purple-900 text-purple-200',
      appointment: 'bg-green-900 text-green-200',
      dealt: 'bg-emerald-900 text-emerald-200',
    }
    return colors[status] || 'bg-slate-700 text-slate-200'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP')
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">リード管理・分析</h1>
        <p className="text-slate-400">営業成績とリード情報を管理します</p>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">メール生成</h3>
            <p className="text-3xl font-bold text-white">
              {analytics.emailsGenerated}
            </p>
            <p className="text-xs text-slate-500 mt-2">{selectedPeriod}</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">返信数</h3>
            <p className="text-3xl font-bold text-white">{analytics.emailsReplied}</p>
            <p className="text-xs text-slate-500 mt-2">返信率: {(analytics.replyRate * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">アポ設定</h3>
            <p className="text-3xl font-bold text-white">{analytics.appointmentsSet}</p>
            <p className="text-xs text-slate-500 mt-2">設定率: {(analytics.appointmentRate * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">成約数</h3>
            <p className="text-3xl font-bold text-white">{analytics.dealsCreated}</p>
            <p className="text-xs text-slate-500 mt-2">成約率: {(analytics.dealRate * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1">ステータス</label>
            <select value={filters.status} onChange={(e) => setFilters(p => ({...p, status: e.target.value}))} className="w-full text-sm">
              <option value="">すべて</option>
              {statuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">開始日</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters(p => ({...p, startDate: e.target.value}))} className="w-full text-sm"/></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">終了日</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters(p => ({...p, endDate: e.target.value}))} className="w-full text-sm"/></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">メンバー</label>
            <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} className="w-full text-sm">
              <option value="">全メンバー</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">期間</label>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full text-sm">
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-200 text-sm">{error}</div>}

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">企業名</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">担当者</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">メール</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">ステータス</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">作成日</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-200">メール/返信</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">読み込み中...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">リードがありません</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-slate-100">{lead.companyName}</td>
                  <td className="px-4 py-3 text-slate-100">{lead.contactName}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{lead.contactEmail}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>{getStatusLabel(lead.status)}</span></td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(lead.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-300">{lead.emailsGenerated || 0} / {lead.emailsReplied || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analytics?.successFactors && analytics.successFactors.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">成功要因分析</h2>
          <div className="space-y-2">
            {analytics.successFactors.map(f => (
              <div key={f.id} className="border border-slate-600 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedFactors(p => ({...p, [f.id]: !p[f.id]}))}
                  className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-700 flex items-center justify-between font-medium text-slate-200">
                  <div className="text-left">
                    <p className="font-semibold text-white">{f.emailSubject}</p>
                    <p className="text-sm text-slate-400 mt-1">{f.category}</p>
                  </div>
                  <span className="text-slate-400">{expandedFactors[f.id] ? '−' : '+'}</span>
                </button>
                {expandedFactors[f.id] && (
                  <div className="px-4 py-3 bg-slate-800 border-t border-slate-600 space-y-2">
                    <div><h4 className="text-sm font-semibold text-slate-300 mb-2">要因</h4>
                      <p className="text-slate-200 text-sm">{f.factor}</p></div>
                    {f.evidenceText && (
                      <div><h4 className="text-sm font-semibold text-slate-300 mb-2">根拠</h4>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{f.evidenceText}</p></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
