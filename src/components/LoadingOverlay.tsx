'use client'

import { useEffect, useState } from 'react'

const defaultSteps = [
  '企業情報を分析中...',
  'ニュースを収集中...',
  '課題を特定中...',
  'メールを生成中...',
]

interface LoadingOverlayProps {
  progressMessage?: string | null
}

export function LoadingOverlay({ progressMessage }: LoadingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)

  // If we have a real progress message, show it. Otherwise, cycle through defaults.
  useEffect(() => {
    if (progressMessage) return // Don't cycle when we have real progress
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % defaultSteps.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [progressMessage])

  const displayMessage = progressMessage || defaultSteps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-slate-600 rounded-full" />
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-purple-500 rounded-full animate-spin" />
            </div>
          </div>

          {/* Current step message */}
          <div className="text-blue-400 font-semibold text-lg transition-all duration-300">
            {displayMessage}
          </div>

          {/* Progress bar (animated) */}
          <div className="w-full bg-slate-700 rounded-full h-1">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
              style={{
                width: progressMessage ? '80%' : `${((currentStep + 1) / defaultSteps.length) * 100}%`,
                animation: progressMessage ? 'none' : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
