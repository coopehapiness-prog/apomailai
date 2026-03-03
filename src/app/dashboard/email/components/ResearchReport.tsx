'use client'

import { CompanyResearch } from '@/lib/types'

interface ResearchReportProps {
  research: CompanyResearch
}

export function ResearchReport({ research }: ResearchReportProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-6">調査レポート</h2>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 企業概要 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">企業概要</h3>
          <p className="text-slate-100 text-sm mb-2">{research.overview}</p>
          {research.overviewUrl && (
            <a
              href={research.overviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline"
            >
              詳細を見る →
            </a>
          )}
        </div>

        {/* 事業概要 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">事業概要</h3>
          <p className="text-slate-100 text-sm mb-2">{research.businessDescription}</p>
          {research.businessUrl && (
            <a
              href={research.businessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline"
            >
              詳細を見る →
            </a>
          )}
        </div>

        {/* 業界・ステージ */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">業界・ステージ</h3>
          <div className="space-y-1">
            <p className="text-slate-100 text-sm">
              <span className="text-slate-400">業界: </span>
              {research.industry}
            </p>
            <p className="text-slate-100 text-sm">
              <span className="text-slate-400">ステージ: </span>
              {research.stage}
            </p>
          </div>
        </div>

        {/* 従業員規模 */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">従業員規模</h3>
          <p className="text-slate-100 text-sm">{research.employeeCount.toLocaleString()} 名</p>
        </div>
      </div>

      {/* Latest News */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">最新ニュース</h3>
        <div className="space-y-2">
          {research.latestNews.slice(0, 5).map((news) => (
            <div
              key={news.id}
              className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm font-medium line-clamp-2">
                    {news.title}
                  </p>
                  {news.date && (
                    <p className="text-slate-500 text-xs mt-1">{news.date}</p>
                  )}
                </div>
                {news.url && (
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:underline whitespace-nowrap flex-shrink-0"
                  >
                    リンク
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Points */}
      {research.painPoints && research.painPoints.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">課題仮説</h3>
          <div className="space-y-2">
            {research.painPoints.map((painPoint, index) => (
              <div
                key={index}
                className="bg-slate-700/50 rounded-lg p-3 flex items-start gap-3"
              >
                <span className="text-blue-400 font-semibold flex-shrink-0">•</span>
                <p className="text-slate-100 text-sm">{painPoint}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
