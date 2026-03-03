'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { CustomSettings } from '@/lib/types'

export function useSettings() {
  const [settings, setSettings] = useState<CustomSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.getSettings()
      setSettings(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : '設定の取得に失敗しました'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(
    async (updates: Partial<CustomSettings>) => {
      setError(null)
      try {
        const updated = await apiClient.updateSettings(updates)
        setSettings(updated)
        return updated
      } catch (err) {
        const message = err instanceof Error ? err.message : '設定の更新に失敗しました'
        setError(message)
        throw err
      }
    },
    []
  )

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  }
}
