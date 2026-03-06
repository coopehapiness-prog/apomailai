'use client'

import { CompanyResearch } from '@/lib/types'

interface ResearchReportProps {
  research: CompanyResearch
}

export function ResearchReport({ research }: ResearchReportProps) {
  const companyName = research.company_name || research.companyName || ''
  const overview = research.overview || ''
  const business = research.businessDescription || research.business || ''
  const industry = research.industry || ''
  const stage = research.stage || ''
  const employees = research.employeeCount || research.employees
  const homepageUrl = research.overviewUrl || research.homepage_url || ''
  const businessUrl = research.businessUrl || research.business_url || ''

  // Normalize news array
  const newsItems = (research.latestNews || research.news || []).map((item, idx) => ({
    id: (item as any).id || `news-${idx}`,
    title: item.title,
    url: item.url || '',
    date: item.date || '',
    summary: item.summary || '',
    source: (item as any).source || (item as any).src || '',
    type: (item as any).type || '',
  }))

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
            {homepageUrl && (
              <a
                href={homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-2 text-[10px]"
              >
                {'🔗 公式サイト'}
              </a>
            )}
            <br />
            {overview || '情報なし'}
          </div>
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
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
        </div>

        {/* Business Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <span>{'💼'}</span> {'事業概要'}
          </div>
          <div className="text-xs text-slate-200 leading-relaxed mb-2">
            {business || '情報なし'}
          </div>
          {businessUrl && (
            <a
              href={businessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 hover:text-blue-300 text-[10px] font-semibold transition-colors"
            >
              {'🔗 サービス・製品ページを見る →'}
            </a>
          )}
        </div>
      </div>

      {/* Latest News - full width */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 mb-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
          <span>{'📰'}</span> {'最新ニュース'}
        </div>
        {newsItems.length > 0 ? (
          <div className="space-y-2">
            {newsItems.map((news) => (
              <div key={news.id} style={{ marginBottom: '8px' }}>
                {/* Source badge + date */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  {news.source && (
                    <span
                      className={`inline-block text-[9px] px-2 py-0.5 rounded font-semibold ${getSourceBadgeClass(
                        news.type
                      )}`}
                    >
                      {news.source}
                    </span>
                  )}
                  {news.date && (
                    <span className="text-[10px] text-slate-500">{news.date}</span>
                  )}
                </div>
                {/* News title with arrow */}
                {news.url ? (
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:text-blue-300 hover:underline"
                  >
                    {news.title} {' →'}
                  </a>
                ) : (
                  <p className="text-xs text-slate-200">{news.title}</p>
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
