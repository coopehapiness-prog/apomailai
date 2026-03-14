'use client'

import { useState } from 'react'
import { EmailPattern } from '@/lib/types'
import { CopyButton } from '@/components/CopyButton'

interface EmailOutputProps {
  patterns: EmailPattern[]
}

const TIMING_ICONS: Record<string, string> = {
  '追撃メール（3日後）': '📅',
  '追撃メール（1週間後）': '📅',
  '掘り起こしメール（1ヶ月後）': '🔄',
}

const TIMING_LABELS: Record<string, string> = {
  '追撃メール（3日後）': '3日後',
  '追撃メール（1週間後）': '1週間後',
  '掘り起こしメール（1ヶ月後）': '1ヶ月後',
}

export function EmailOutput({ patterns }: EmailOutputProps) {
  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set([0]))

  const togglePanel = (index: number) => {
    setOpenPanels((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const getPatternLabel = (pattern: EmailPattern): string => {
    return pattern.patternName || pattern.description || ''
  }

  const getTimingBadge = (pattern: EmailPattern): string => {
    const name = getPatternLabel(pattern)
    return TIMING_LABELS[name] || ''
  }

  const getIcon = (pattern: EmailPattern): string => {
    const name = getPatternLabel(pattern)
    return TIMING_ICONS[name] || '📧'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-white">📅 追撃シナリオ</span>
        <span className="text-xs text-slate-400">タイミング別メール</span>
      </div>

      {patterns.map((pattern, index) => {
        const isOpen = openPanels.has(index)
        const label = getPatternLabel(pattern)
        const timingBadge = getTimingBadge(pattern)
        const icon = getIcon(pattern)

        return (
          <div
            key={index}
            className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5"
          >
            {/* Accordion Header */}
            <button
              onClick={() => togglePanel(index)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <div className="flex items-center gap-2">
                  {timingBadge && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      {timingBadge}
                    </span>
                  )}
                  <span className="text-sm font-bold text-white">
                    {label || `パターン${index + 1}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isOpen && (
                  <CopyButton
                    text={`${pattern.subject}\n\n${pattern.body}`}
                    label="コピー"
                  />
                )}
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Accordion Content */}
            {isOpen && (
              <div className="border-t border-slate-700">
                {/* Top bar with copy */}
                <div className="flex items-center justify-end px-4 py-2 bg-slate-800/50">
                  <CopyButton
                    text={`${pattern.subject}\n\n${pattern.body}`}
                    label="全文コピー"
                  />
                </div>

                {/* Subject Line */}
                <div className="bg-blue-500/5 border-l-[3px] border-l-blue-500 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-300">
                      {pattern.subject}
                    </p>
                    <CopyButton text={pattern.subject} label="件名コピー" />
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap flex-1">
                      {pattern.body}
                    </p>
                  </div>
                  <div className="flex justify-end mt-3">
                    <CopyButton text={pattern.body} label="本文コピー" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
