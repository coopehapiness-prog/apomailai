'use client'

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { EmailGenRequest, EmailPattern, CompanyResearch } from '@/lib/types'

const STORAGE_KEY = 'apomailai_last_generation'
const HISTORY_KEY = 'apomailai_generation_history'
const MAX_HISTORY = 20

interface SubOutputs {
  phone_script?: string
  video_prompt?: string
  follow_up_scenarios?: string[]
}

export interface GenerationRecord {
  id: string
  company: string
  source: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
  subOutputs: SubOutputs | null
  createdAt: string
}

interface UseEmailGenerationState {
  company: string
  source: string
  history: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
  subOutputs: SubOutputs | null
  loading: boolean
  error: string | null
  generationHistory: GenerationRecord[]
}

function loadSavedState(): Partial<UseEmailGenerationState> | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.patterns && parsed.patterns.length > 0) {
        return {
          company: parsed.company || '',
          source: parsed.source || '',
          patterns: parsed.patterns,
          research: parsed.research || null,
          subOutputs: parsed.subOutputs || null,
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

function loadHistory(): GenerationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(HISTORY_KEY)
    if (saved) {
      return JSON.parse(saved) || []
    }
  } catch {
    // ignore
  }
  return []
}

function saveState(data: {
  company: string
  source: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
  subOutputs: SubOutputs | null
}) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function saveHistory(history: GenerationRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {
    // ignore
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
}

export function useEmailGeneration() {
  const [state, setState] = useState<UseEmailGenerationState>(() => {
    const saved = loadSavedState()
    const historyRecords = loadHistory()
    if (saved) {
      return {
        company: saved.company || '',
        source: saved.source || '',
        history: '',
        patterns: saved.patterns || [],
        research: saved.research || null,
        subOutputs: saved.subOutputs || null,
        loading: false,
        error: null,
        generationHistory: historyRecords,
      }
    }
    return {
      company: '',
      source: '',
      history: '',
      patterns: [],
      research: null,
      subOutputs: null,
      loading: false,
      error: null,
      generationHistory: historyRecords,
    }
  })

  const generate = useCallback(
    async (request: EmailGenRequest) => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }))

      try {
        console.log('[HOOK] Calling apiClient.generateEmail...')
        const result = await apiClient.generateEmail(request)
        console.log('[HOOK] API result received:', {
          hasPatterns: !!result?.patterns,
          patternsLength: result?.patterns?.length,
          hasResearch: !!result?.research,
        })

        const company = request.companyName
        const source = (request as any).source || ''
        const history = (request as any).history || ''
        const patterns = result.patterns || []
        const research = result.research || null
        const subOutputs = result.subOutputs || null

        // Add to generation history
        let updatedHistory = state.generationHistory
        if (patterns.length > 0) {
          const record: GenerationRecord = {
            id: generateId(),
            company,
            source,
            patterns,
            research,
            subOutputs,
            createdAt: new Date().toISOString(),
          }
          updatedHistory = [record, ...state.generationHistory].slice(0, MAX_HISTORY)
          saveHistory(updatedHistory)
        }

        setState((prev) => ({
          ...prev,
          company,
          source,
          history,
          patterns,
          research,
          subOutputs,
          loading: false,
          generationHistory: updatedHistory,
        }))

        // Save to localStorage immediately
        if (patterns.length > 0) {
          saveState({ company, source, patterns, research, subOutputs })
        }

        return result
      } catch (err) {
        console.error('[HOOK] Error in generate:', err)
        const message =
          err instanceof Error ? err.message : 'メール生成に失敗しました'
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }))
        throw err
      }
    },
    [state.generationHistory]
  )

  const regenerate = useCallback(
    async (customization?: {
      personas?: string[]
      news?: string[]
      cta?: string
      freeText?: string
      chips?: string[]
    }) => {
      if (!state.company || !state.source) {
        throw new Error('企業名とリードソースが必要です')
      }

      const request: EmailGenRequest = {
        companyName: state.company,
        source: state.source as any,
        history: state.history,
        customization,
      } as any

      return generate(request)
    },
    [state.company, state.source, state.history, generate]
  )

  const reset = useCallback(() => {
    // Only clear the current generation state, NOT the localStorage
    // This preserves history and allows restoration when navigating back
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
    setState((prev) => ({
      company: '',
      source: '',
      history: '',
      patterns: [],
      research: null,
      subOutputs: null,
      loading: false,
      error: null,
      generationHistory: prev.generationHistory,
    }))
  }, [])

  const loadFromHistory = useCallback((record: GenerationRecord) => {
    setState((prev) => ({
      ...prev,
      company: record.company,
      source: record.source,
      history: '',
      patterns: record.patterns,
      research: record.research,
      subOutputs: record.subOutputs,
      loading: false,
      error: null,
    }))
    // Also save as current state so it persists on navigation
    saveState({
      company: record.company,
      source: record.source,
      patterns: record.patterns,
      research: record.research,
      subOutputs: record.subOutputs,
    })
  }, [])

  const deleteFromHistory = useCallback((recordId: string) => {
    setState((prev) => {
      const updated = prev.generationHistory.filter((r) => r.id !== recordId)
      saveHistory(updated)
      return { ...prev, generationHistory: updated }
    })
  }, [])

  return {
    ...state,
    generate,
    regenerate,
    reset,
    loadFromHistory,
    deleteFromHistory,
  }
}
