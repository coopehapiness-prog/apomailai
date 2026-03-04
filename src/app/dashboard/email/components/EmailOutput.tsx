'use client'

import { useState } from 'react'
import { EmailPattern } from '@/lib/types'
import { CopyButton } from 'A/components/CopyButton'

interface EmailOutputProps {
  patterns: EmailPattern[]
}

export function EmailOutput({ patterns }: EmailOutputProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({})

  const currentPattern = patterns[activeTab]

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      {/* Pattern Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {patterns.map((pattern, index) => (
          <button
            key={pattern.id}
            onClick={() => {
              setActiveTab(index)
              setExpandedSections({})
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === index
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            パターン {pattern.label}
          </button>
        ))}
      </div>

      {/* Email Card */}
      <div className="bg-slate-700/50 rounded-lg p-6 mb-6 space-y-4">
        {/* Subject */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">件名</h3>
          <div className="bg-slate-600 rounded-lg p-4">
            <p className="text-slate-100 text-sm font-medium break-words">
              {currentPattern.subject}
            </p>
          </div>
          <div className="mt-2">
            <CopyButton text={currentPattern.subject} label="件名をコピー" />
          </div>
        </div>

        {/* Body */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">本文</h3>
          <div className="bg-slate-600 rounded-lg p-4">
            <p className="text-slate-100 text-sm whitespace-pre-wrap break-words">
              {currentPattern.body}
            </p>
          </div>
          <div className="mt-2">
            <CopyButton text={currentPattern.body} label="本文をコピー" />
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-2">
        {/* Phone Script */}
        {currentPattern.phoneScript && (
          <div className="border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(0)}
              className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-700 flex items-center justify-between font-medium text-slate-200 transition-colors"
            >
              <span>電話スクリプト</span>
              <span className="text-slate-400">
                {expandedSections[0] ? '−' : '+'}
              </span>
            </button>
            {expandedSections[0] && (
              <div className="px-4 py-3 bg-slate-800 border-t border-slate-600">
                <p className="text-slate-200 text-sm whitespace-pre-wrap mb-3">
                  {currentPattern.phoneScript}
                </p>
                <CopyButton text={currentPattern.phoneScript} label="コピー" />
              </div>
            )}
          </div>
        )}

        {/* Video Prompt */}
        {currentPattern.videoPrompt && (
          <div className="border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(1)}
              className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-700 flex items-center justify-between font-medium text-slate-200 transition-colors"
            >
              <span>動画プロンプト</span>
              <span className="text-slate-400">
                {expandedSections[1] ? '−' : '+'}
              </span>
            </button>
            {expandedSections[1] && (
              <div className="px-4 py-3 bg-slate-800 border-t border-slate-600">
                <p className="text-slate-200 text-sm whitespace-pre-wrap mb-3">
                  {currentPattern.videoPrompt}
                </p>
                <CopyButton text={currentPattern.videoPrompt} label="コピー" />
              </div>
            )}
          </div>
        )}

        {/* Follow-up Scenarios */}
        {currentPattern.followUpScenarios &&
          currentPattern.followUpScenarios.length > 0 && (
            <div className="border border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(2)}
                className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-700 flex items-center justify-between font-medium text-slate-200 transition-colors"
              >
                <span>フォローアップシナリオ</span>
                <span className="text-slate-400">
                  {expandedSections[2] ? '−' : '+'}
                </span>
              </button>
              {expandedSections[2] && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-600 space-y-3">
                  {currentPattern.followUpSections.map((scenario, index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-slate-100 text-sm whitespace-pre-wrap">
                        {scenario}
                      </p>
                      {index < currentPattern.followUpSecnarios!.length - 1 && (
                        <div className="border-t border-slate-700" />
                      )}
                     </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}
