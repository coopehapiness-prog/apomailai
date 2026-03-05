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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Company Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <span>\uD83C\uDFE2</span> \u4F01\u696D\u6982\u8981
          </div>
          <div className="text-sm text-slate-200 leading-relaxed mb-2">
            <span className="font-bold">{companyName || '\u4E0D\u660E'}</span>
            {homepageUrl && (
              <a
                href={homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-2 text-xs"
              >
                \uD83D\uDD17 \u516C\u5F0F\u30B5\u30A4\u30C8
              </a>
            )}
            <br />
            {overview || '\u60C5\u5831\u306A\u3057'}
          </div>
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {industry && (
              <span className="inline-block text-[11px] px-2.5 py-1 rounded bg-blue-500/15 text-blue-400 font-semibold">
                {industry}
              </span>
            )}
            {employees && (
              <span className="inline-block text-[11px] px-2.5 py-1 rounded bg-green-500/15 text-green-400 font-semibold">
                {typeof employees === 'number' ? `${employees.toLocaleString()}\u540D` : employees}
              </span>
            )}
            {stage && (
              <span className="inline-block text-[11px] px-2.5 py-1 rounded bg-purple-500/15 text-purple-400 font-semibold">
                {stage}
              </span>
            )}
          </div>
        </div>

        {/* Business Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <span>\uD83D\uDCBC</span> \u4E8B\u696D\u6982\u8981
          </div>
          <div className="text-sm text-slate-200 leading-relaxed">
            {business || '\u60C5\u5831\u306A\u3057'}
            {businessUrl && (
              <a
                href={businessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-2 text-xs"
              >
                \uD83D\uDD17 \u30B5\u30FC\u30D3\u30B9\u30DA\u30FC\u30B8
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Latest News - full width */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
        <div className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
          <span>\uD83D\uDCF0</span> \u6700\u65B0\u30CB\u30E5\u30FC\u30B9
        </div>
        {newsItems.length > 0 ? (
          <div className="space-y-3">
            {newsItems.map((news) => (
              <div key={news.id} style={{ marginBottom: '8px' }}>
                {/* Source badge + date */}
                <div className="flex items-center gap-2 mb-1">
                  {news.source && (
                    <span
                      className={`inline-block text-[11px] px-2.5 py-1 rounded font-semibold ${getSourceBadgeClass(
                        news.type
                      )}`}
                    >
                      {news.source}
                    </span>
                  )}
                  {news.date && (
                    <span className="text-xs text-slate-500">{news.date}</span>
                  )}
                </div>
                {/* News title with arrow */}
                {news.url ? (
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-sm hover:text-blue-300 hover:underline"
                  >
                    {news.title} \u2192
                  </a>
                ) : (
                  <p className="text-sm text-slate-200">{news.title}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">\u30CB\u30E5\u30FC\u30B9\u60C5\u5831\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F</p>
        )}
      </div>

      {/* AI Challenge Hypothesis - full width */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
          <span>\uD83E\uDDE0</span> AI\u306B\u3088\u308B\u8AB2\u984C\u4EEE\u8AAC
        </div>
        {painPoints.length > 0 || hypothesis ? (
          <div className="space-y-3">
            {painPoints.map((pain, index) => (
              <div
                key={index}
                className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-4 py-3 rounded text-sm leading-relaxed text-slate-300"
              >
                \u4EEE\u8AAC{index + 1}\uFF1A{pain}
              </div>
            ))}
            {hypothesis && (
              <div className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-4 py-3 rounded text-sm leading-relaxed text-slate-300">
                {hypothesis}
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">\u8AB2\u984C\u4EEE\u8AAC\u306E\u60C5\u5831\u304C\u3042\u308A\u307E\u305B\u3093</p>
        )}
      </div>
    </div>
  )
}
