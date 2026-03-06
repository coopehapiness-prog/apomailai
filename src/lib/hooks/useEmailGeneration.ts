'use client'

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { EmailGenRequest, EmailPattern, CompanyResearch } from '@/lib/types'

const STORAGE_KEY = 'apomailai_last_generation'

interface SubOutputs {
  phone_script?: string
  video_prompt?: string
  follow_up_scenarios?: string[]
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
}

function loadSavedState(): Partial<UseEmailGenerationState> | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
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

function saveState(data: {
  company: string
  source: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
  subOutputs: SubOutputs | null
}) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function useEmailGeneration() {
  const [state, setState] = useState<UseEmailGenerationState>(() => {
    const saved = loadSavedState()
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

        setState((prev) => ({
          ...prev,
          company,
          source,
          history,
          patterns,
          research,
          subOutputs,
          loading: false,
        }))

        // Save to sessionStorage immediately
        if (patterns.length > 0) {
          saveState({ company, source, patterns, research, subOutputs })
        }

        return result
      } catch (err) {
        console.error('[HOOK] Error in generate:', err)
        const message = err instanceof Error ? err.message : 'メール生成に失敗しました'
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }))
        throw err
      }
    },
    []
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
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
    setState({
      company: '',
      source: '',
      history: '',
      patterns: [],
      research: null,
      subOutputs: null,
      loading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    generate,
    regenerate,
    reset,
  }
}
