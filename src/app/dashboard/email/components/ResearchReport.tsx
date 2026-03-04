'use client'

import { CompanyResearch } from '@/lib/types'

interface ResearchReportProps {
  research: CompanyResearch
}

export function ResearchReport({ research }: ResearchReportProps) {
  // Handle both snake_case (API) and camelCase (frontend alias) field names
  const overview = research.overview || ''
  const business = research.businessDescription || research.business || ''
  const industry = research.industry || '不明'
  const stage = research.stage || '不明'
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
  }))

  // Normalize pain points / challenges
  const painPoints = research.painPoints || research.pains || []
  const hypothesis = research.hypothesis || ''

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-6">調査レポート</h2>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 企業概要 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {homepageUrl ? (
              <a
                href={homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
              >
                企業概要
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <h3 className="text-sm font-semibold text-slate-300">企業概要</h3>
            )}
          </div>
          <p className="text-slate-100 text-sm mb-2">{overview || '情報なし'}</p>
          {homepageUrl && (
            <a
              href={homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline inline-flex items-center gap-1"
            >
              {homepageUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 30)}
              {homepageUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').length > 30 ? '...' : ''}
            </a>
          )}
        </div>

        {/* 事業内容 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {businessUrl ? (
              <a
                href={businessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
              >
                事業内容
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <h3 className="text-sm font-semibold text-slate-300">事業内容</h3>
            )}
          </div>
          <p className="text-slate-100 text-sm mb-2">{business || '情報なし'}</p>
          {businessUrl && (
            <a
              href={businessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline inline-flex items-center gap-1"
            >
              {businessUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 30)}
              {businessUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').length > 30 ? '...' : ''}
            </a>
          )}
        </div>

        {/* 業界・ステージ */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">業界・ステージ</h3>
          <div className="space-y-1">
            <p className="text-slate-100 text-sm">
              <span className="text-slate-400">業界: </span>
              {industry}
            </p>
            <p className="text-slate-100 text-sm">
              <span className="text-slate-400">ステージ: </span>
              {stage}
            </p>
          </div>
        </div>

        {/* 従業員規模 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">従業員規模</h3>
          <p className="text-slate-100 text-sm">
            {employees
              ? `${typeof employees === 'number' ? employees.toLocaleString() : employees} 名`
              : '不明'}
          </p>
        </div>
      </div>

      {/* Latest News */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-white">最新ニュース</h3>
          <span className="text-xs text-slate-400 bg-slate-700 rounded-full px-2 py-0.5">
            {newsItems.length}件
          </span>
        </div>
        <div className="space-y-2">
          {newsItems.length > 0 ? (
            newsItems.map((news) => (
              <div
                key={news.id}
                className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {news.url ? (
                        <a
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 text-sm font-medium hover:text-blue-300 hover:underline line-clamp-2 flex-1"
                        >
                          {news.title}
                        </a>
                      ) : (
                        <p className="text-slate-100 text-sm font-medium line-clamp-2 flex-1">
                          {news.title}
                        </p>
                      )}
                    </div>
                    {news.summary && (
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2">{news.summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {news.date && (
                        <span className="text-slate-500 text-xs">{news.date}</span>
                      )}
                      {news.url && (
                        <a
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400/70 text-xs hover:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          記事を読む
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-400 text-sm">ニュース情報が見つかりませんでした</p>
          )}
        </div>
      </div>

      {/* 課題仮説 */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">課題仮説</h3>
        {(painPoints.length > 0 || hypothesis) ? (
          <div className="space-y-2">
            {painPoints.map((painPoint, index) => (
              <div
                key={index}
                className="bg-slate-700/50 rounded-lg p-3 flex items-start gap-3"
              >
                <span className="text-blue-400 font-semibold flex-shrink-0">•</span>
                <p className="text-slate-100 text-sm">{painPoint}</p>
              </div>
            ))}
            {hypothesis && (
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 mt-2">
                <p className="text-sm text-slate-300">
                  <span className="text-blue-400 font-semibold">仮説: </span>
                  {hypothesis}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">課題仮説の情報がありません</p>
        )}
      </div>
    </div>
  )
}
