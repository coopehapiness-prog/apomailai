'use client';

import { CompanyResearch } from '@/lib/types';
interface ResearchReportProps {
  research: CompanyResearch;
}

export default function ResearchReport({ research }: ResearchReportProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-white">調査レポート</h2>
      </div>

      {/* Company Overview Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-blue-400 text-xl">🏢</span>
          <h3 className="text-xl font-semibold text-white">企業概要</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <p className="text-sm text-gray-400">企業名</p>
            <p className="text-lg font-medium text-white">{research.companyName}</p>
          </div>
          {research.industry && (
            <div>
              <p className="text-sm text-gray-400">業界</p>
              <p className="text-lg font-medium text-white">{research.industry}</p>
            </div>
          )}
          {research.employeeCount && (
            <div>
              <p className="text-sm text-gray-400">従業員数</p>
              <p className="text-lg font-medium text-white">
                {research.employeeCount.toLocaleString('ja-JP')}
              </p>
            </div>
          )}
          {research.foundedYear && (
            <div>
              <p className="text-sm text-gray-400">設立年</p>
              <p className="text-lg font-medium text-white">{research.foundedYear}</p>
            </div>
          )}
        </div>
        {research.overview && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-gray-400 mb-2">概要</p>
            <p className="text-gray-300 leading-relaxed">{research.overview}</p>
          </div>
        )}
      </div>

      {/* Challenges Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-yellow-400 text-xl">💡</span>
          <h3 className="text-xl font-semibold text-white">課題仮説</h3>
        </div>
        {research.challenges && research.challenges.length > 0 ? (
          <ul className="space-y-3">
            {research.challenges.map((challenge, index) => (
              <li
                key={index}
                className="flex gap-3 text-gray-300 items-start"
              >
                <span className="text-blue-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{challenge}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 italic">課題仮説がまだ設定されていません</p>
        )}
      </div>

      {/* Success Factors Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-green-400 text-xl">✅</span>
          <h3 className="text-xl font-semibold text-white">成功要因</h3>
        </div>
        {research.successFactors && research.successFactors.length > 0 ? (
          <ul className="space-y-3">
            {research.successFactors.map((factor, index) => (
              <li
                key={index}
                className="flex gap-3 text-gray-300 items-start"
              >
                <span className="text-green-400 font-bold mt-0.5">✓</span>
                <span className="leading-relaxed">{factor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 italic">成功要因がまだ設定されていません</p>
        )}
      </div>

      {/* Latest News Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-orange-400 text-xl">📰</span>
          <h3 className="text-xl font-semibold text-white">最新ニュース</h3>
        </div>
        {research.news && research.news.length > 0 ? (
          <div className="space-y-4">
            {research.news.map((newsItem, index) => (
              <div
                key={index}
                className="pb-4 border-b border-slate-700 last:border-b-0 last:pb-0"
              >
                <p className="text-sm text-gray-400 mb-1">
                  {new Date(newsItem.date).toLocaleDateString('ja-JP')}
                </p>
                <p className="font-medium text-white mb-2">{newsItem.title}</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {newsItem.summary}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 italic">最新ニュースはまだ利用できません</p>
        )}
      </div>
    </div>
  );
}
