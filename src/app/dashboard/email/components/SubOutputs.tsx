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
      icon: '\uD83D\uDCDE',
      title: '\u67B6\u96FB\u30B9\u30AF\u30EA\u30D7\u30C8\uFF0830\u79D2\uFF09',
      content: phoneScript,
    },
    {
      icon: '\uD83C\uDFAC',
      title: '\u52D5\u753B\u30D7\u30ED\u30F3\u30D7\u30C8\uFF08Sora\u7528\uFF09',
      content: videoPrompt,
    },
    {
      icon: '\uD83D\uDCC5',
      title: '\u8FFD\u6483\u30B7\u30CA\u30EA\u30AA\uFF083\u65E5\u5F8C / 1\u9031\u9593\u5F8C / \u6398\u308A\u8D77\u3053\u3057\uFF09',
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
              \u25B6
            </span>
          </button>
          {expanded[idx] && (
            <div className="bg-slate-900 border-t border-slate-700 px-5 py-4">
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap mb-3">
                {section.content}
              </p>
              <CopyButton text={section.content} label="\u30B3\u30D4\u30FC" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
