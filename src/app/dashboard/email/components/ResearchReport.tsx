'use client'

import { CompanyResearch } from '@/lib/types'

interface ResearchReportProps {
  research: CompanyResearch
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Try standard date parse (handles YYYY-MM-DD, YYYY-MM, etc.)
  const d = new Date(dateStr)
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    // If day is 1 and original didn't include day component, omit day
    if (/^\d{4}-\d{2}$/.test(dateStr)) return `${y}年${m}月`
    if (/^\d{4}$/.test(dateStr)) return `${y}年`
    return `${y}年${m}月${day}日`
  }
  // Already formatted or unparseable: return as-is
  return dateStr
}

/** Validate that a URL is well-formed, uses http(s) protocol, and is a direct link (not Google Search fallback) */
function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    // Filter out Google Search fallback URLs - these are not direct links
    if (parsed.hostname === 'www.google.com' && parsed.pathname === '/search') return false
    if (parsed.hostname === 'google.com' && parsed.pathname === '/search') return false
    return true
  } catch {
    return false
  }
}

export function ResearchReport({ research }: ResearchReportProps) {
  const companyName = research.company_name || research.companyName || ''
  const overview = research.overview || ''
  const business = research.businessDescription || research.business || ''
  const industry = research.industry || ''
  const stage = research.stage || ''
  const employees = research.employeeCount || research.employees
  const rawHomepageUrl = research.overviewUrl || research.homepage_url || ''
  const rawBusinessUrl = research.businessUrl || research.business_url || ''

  // Validate URLs - only use real direct URLs
  const homepageUrl = isValidUrl(rawHomepageUrl) ? rawHomepageUrl : ''
  const businessUrl = isValidUrl(rawBusinessUrl) ? rawBusinessUrl : ''

  // Filter out news older than 6 months, then show max 7 items sorted by date descending
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10) // YYYY-MM-DD

  const rawNews = (research.latestNews || research.news || []).map((item, idx) => {
    const rawUrl = item.url || ''
    const urlIsValid = isValidUrl(rawUrl)
    return {
      id: (item as any).id || `news-${idx}`,
      title: item.title,
      url: urlIsValid ? rawUrl : '',
      date: item.date || '',
      formattedDate: formatDate(item.date || ''),
      summary: item.summary || '',
      source: (item as any).source || (item as any).src || '',
      type: (item as any).type || '',
    }
  })

  // Filter: keep items with no date (unknown) or date within last 6 months
  const recentNews = rawNews.filter(item => {
    if (!item.date) return true // keep items without date
    // Normalize: pad partial dates (YYYY -> YYYY-01-01, YYYY-MM -> YYYY-MM-01)
    const d = item.date.length === 4 ? `${item.date}-01-01`
            : item.date.length === 7 ? `${item.date}-01`
            : item.date
    return d >= sixMonthsAgoStr
  })

  const newsItems = recentNews.slice(0, 7).sort((a, b) => {
    // Sort by date descending (newest first). Items without dates go to the end.
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  // Normalize pain points
  const painPoints = research.painPoints || research.pains || []
  const hypothesis = research.hypothesis || ''

  // Source badge color
  const getSourceBadgeClass = (type: string) => {
    switch (type) {
      case 'pr':
        return 'bg-blue-500/15 text-blue-400'
      case 'job':
        return 'bg-green-500/15 text-green-400'
      case 'event':
        return 'bg-purple-500/15 text-purple-400'
      default:
        return 'bg-blue-500/15 text-blue-400'
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      {/* 2-column grid: Company Overview | Business Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* Company Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <span>{'🏢'}</span> {'企業概要'}
          </div>
          <div className="text-xs text-slate-200 leading-relaxed mb-2">
            <span className="font-bold">{companyName || '不明'}</span>
            <br />
            {overview || 'リサーチデータを取得中です。再生成をお試しください。'}
          </div>
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {industry && (
              <span className="inline-block text-[9px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold">
                {industry}
              </span>
            )}
            {employees && (
              <span className="inline-block text-[9px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 font-semibold">
                {typeof employees === 'number' ? `${employees.toLocaleString()}名` : employees}
              </span>
            )}
            {stage && (
              <span className="inline-block text-[9px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-semibold">
                {stage}
              </span>
            )}
          </div>
          {homepageUrl && (
            <a
              href={homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500 hover:text-white text-[10px] font-semibold transition-colors"
            >
              {'🏢 会社概要ページ →'}
            </a>
          )}
        </div>

        {/* Business Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <span>{'💼'}</span> {'事業概要'}
          </div>
          <div className="text-xs text-slate-200 leading-relaxed mb-2">
            {business || 'この企業の事業内容は追加リサーチが必要です。'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {businessUrl && (
              <a
                href={businessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 hover:text-blue-300 text-[10px] font-semibold transition-colors"
              >
                {'🔗 サービス・製品ページ →'}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Latest News - full width */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 mb-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
          <span>{'📰'}</span> {'最新ニュース'}
        </div>
        {newsItems.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {newsItems.map((news) => (
              <div key={news.id} className="py-2 first:pt-0 last:pb-0">
                {/* Date badge - prominent display */}
                <div className="flex items-center gap-1.5 mb-1">
                  {news.formattedDate ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 border border-slate-600 text-[10px] font-bold text-slate-200">
                      {'📅'} {news.formattedDate}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-700/50 border border-slate-700 text-[10px] text-slate-500">
                      {'日付不明'}
                    </span>
                  )}
                  {news.source && (
                    <span
                      className={`inline-block text-[9px] px-2 py-0.5 rounded font-semibold ${getSourceBadgeClass(news.type)}`}
                    >
                      {news.source}
                    </span>
                  )}
                </div>
                {/* News title - link to actual news page when URL available */}
                {news.url ? (
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline leading-snug block"
                  >
                    {news.title}
                    <span className="ml-1 text-[10px]">{' →'}</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-300 leading-snug">{news.title}</p>
                )}
                {/* Summary */}
                {news.summary && (
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                    {news.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-xs">{'ニュース情報が見つかりませんでした'}</p>
        )}
      </div>

      {/* AI Challenge Hypothesis - full width */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
          <span>{'🧠'}</span> {'AIによる課題仮説'}
        </div>
        {painPoints.length > 0 || hypothesis ? (
          <div className="space-y-2">
            {painPoints.map((pain, index) => (
              <div
                key={index}
                className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-3 py-2.5 rounded text-[11px] leading-relaxed text-slate-400"
              >
                {`仮説${index + 1}：${pain}`}
              </div>
            ))}
            {hypothesis && (
              <div className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-3 py-2.5 rounded text-[11px] leading-relaxed text-slate-400">
                {hypothesis}
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-xs">{'課題仮説の情報がありません'}</p>
        )}
      </div>
    </div>
  )
}
