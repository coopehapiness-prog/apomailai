'use client'

import { useState } from 'react'
import { EmailPattern } from '@/lib/types'
import { CopyButton } from '@/components/CopyButton'

interface SubOutputsProps {
  subOutputs?: {
    phone_script?: string
    video_prompt?: string
    follow_up_scenarios?: string[]
  }
  patterns?: EmailPattern[]
}

export function SubOutputs({ subOutputs, patterns }: SubOutputsProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const toggle = (idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  // Get sub-output data from either top-level subOutputs or first pattern
  const phoneScript =
    subOutputs?.phone_script ||
    patterns?.find((p) => p.phoneScript)?.phoneScript ||
    ''
  const videoPrompt =
    subOutputs?.video_prompt ||
    patterns?.find((p) => p.videoPrompt)?.videoPrompt ||
    ''
  const followUpScenarios =
    subOutputs?.follow_up_scenarios ||
    patterns?.find((p) => p.followUpScenarios)?.followUpScenarios ||
    []

  const followUpText = Array.isArray(followUpScenarios)
    ? followUpScenarios.join('\n\n')
    : followUpScenarios || ''

  const sections = [
    {
      icon: '📞',
      title: '架電スクリプト（30秒）',
      content: phoneScript,
    },
    {
      icon: '🎬',
      title: '動画プロンプト（Sora用）',
      content: videoPrompt,
    },
    {
      icon: '📅',
      title: '追撃シナリオ（3日後 / 1週間後 / 掘り起こし）',
      content: followUpText,
    },
  ].filter((s) => s.content)

  if (sections.length === 0) return null

  return (
    <div className="space-y-2.5">
      {sections.map((section, idx) => (
        <div
          key={idx}
          className="border border-slate-700 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => toggle(idx)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-800 hover:bg-slate-700/80 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-300">
              {section.icon} {section.title}
            </span>
            <span
              className={`text-xs text-slate-500 transition-transform duration-200 ${
                expanded[idx] ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
          </button>
          {expanded[idx] && (
            <div className="bg-slate-900 border-t border-slate-700 px-5 py-4">
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap mb-3">
                {section.content}
              </p>
              <CopyButton text={section.content} label="コピー" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
