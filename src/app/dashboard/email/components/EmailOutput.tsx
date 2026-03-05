'use client'

import { useState } from 'react'
import { EmailPattern } from '@/lib/types'
import { CopyButton } from 'A/components/CopyButton'

interface EmailOutputProps {
  patterns: EmailPattern[]
}

export function EmailOutput({ patterns }: EmailOutputProps) {
  const [activeTab, setActiveTab] = useState(0)

  const currentPattern = patterns[activeTab]

  const getPatternConcept = (pattern: EmailPattern): string => {
    return pattern.patternName || pattern.description || ''
  }

  return (
    <div>
      {/* Pattern Tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 flex-wrap">
        {patterns.map((pattern, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap border ${
              activeTab === index
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400'
            }`}
          >
            <span className="text-xs font-bold">
              {getPatternConcept(pattern) || `パターン${index + 1}`}
            </span>
          </button>
        ))}
      </div>

      {/* Email Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
          <span className="text-sm font-bold text-white">
            {getPatternConcept(currentPattern) || `パターン${activeTab + 1}`}
          </span>
          <CopyButton
            text={`${currentPattern.subject}\n\n${currentPattern.body}`}
            label="コピー"
          />
        </div>

        {/* Subject Line */}
        <div className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-4 py-3">
          <p className="text-sm font-semibold text-blue-300">{currentPattern.subject}</p>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
            {currentPattern.body}
          </p>
        </div>
      </div>
    </div>
  )
}
