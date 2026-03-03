'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface CopyButtonProps {
  text: string
  label?: string
}

export function CopyButton({ text, label = 'コピー' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('コピーしました')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('コピーに失敗しました')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
        copied
          ? 'bg-green-600 text-white'
          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
      }`}
    >
      {copied ? 'コピー済み' : label}
    </button>
  )
}
