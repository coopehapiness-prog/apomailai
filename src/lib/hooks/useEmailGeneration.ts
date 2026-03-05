'use client'

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { EmailGenRequest, EmailPattern, CompanyResearch } from 'A/lib/types'

interface SubOutputs {
  phone_script?: string
  video_prompt?: string
  follow_up_scenarios?: string[]
}

interface UseEmailGenerationState {
  company: string
  source: EmailGenRequest['source'] | ''
  history: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
  subOutputs: SubOutputs | null
  loading: boolean
  error: string | null
}

export function useEmailGeneration() {
  const [state, setState] = useState<UseEmailGenerationState>({
    company: '',
    source: '',
    history: '',
    patterns: [],
    research: null,
    subOutputs: null,
    loading: false,
    error: null,
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
          patternsIsArray: Array.isArray(result?.patterns),
          patternsLength: result?.patterns?.length,
          hasResearch: !!result?.research,
        })
        setState((prev) => {
          const newState = {
            ...prev,
            company: request.companyName,
            source: (request as any).source || '',
            history: (request as any).history || '',
            patterns: result.patterns || [],
            research: result.research || null,
            subOutputs: result.subOutputs || null,
            loading: false,
          }
          console.log('[HOOK] setState called, new patterns length:', newState.patterns.length)
          return newState
        })
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
        source: state.source as EmailGenRequest['source'],
        history: state.history,
        customization,
      }

      return generate(request)
    },
    [state.company, state.source, state.history, generate]
  )

  const reset = useCallback(() => {
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
