'use client'

import { useEffect, useState } from 'react'

const steps = [
  '企業情報を分析中...',
  'ニュースを収集中...',
  '課題を特定中...',
  'メールを生成中...',
]

export function LoadingOverlay() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

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

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`transition-all duration-300 ${
                  index === currentStep
                    ? 'text-blue-400 font-semibold scale-105'
                    : index < currentStep
                    ? 'text-slate-400 line-through'
                    : 'text-slate-500'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-current" />
                  <span>{step}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-1">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
