'use client'

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { EmailGenRequest, EmailPattern, CompanyResearch } from '@/lib/types'

interface UseEmailGenerationState {
  company: string
  source: EmailGenRequest['source'] | ''
  history: string
  patterns: EmailPattern[]
  research: CompanyResearch | null
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
        const result = await apiClient.generateEmail(request)
        setState((prev) => ({
          ...prev,
          company: request.companyName,
          source: request.source,
          history: request.history || '',
          patterns: result.patterns,
          research: result.research,
          loading: false,
        }))
        return result
      } catch (err) {
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
