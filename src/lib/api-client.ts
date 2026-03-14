import {
  CustomSettings,
  CompanyResearch,
  EmailGenRequest,
  GeneratedEmail,
  Lead,
  AnalyticsKPI,
  UsageInfo,
} from './types'

// Use relative paths for API routes since they are co-located in Next.js
const API_URL = ''

class APIClient {
  private accessToken?: string

  setAccessToken(token: string) {
    this.accessToken = token
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      // API routes return { error: '...' } format
      const message = errorBody.error || errorBody.message || `API error: ${response.status}`
      throw new Error(message)
    }

    return response.json()
  }

  async register(email: string, password: string, name?: string, company?: string) {
    const res = await this.request<{ token: string; user: { id: string; email: string; name?: string } }>(
      'POST', '/api/auth/register', { email, password, name, company }
    )
    this.accessToken = res.token
    return res
  }

  async login(email: string, password: string) {
    const res = await this.request<{ token: string; user: { id: string; email: string; name?: string } }>(
      'POST', '/api/auth/login', { email, password }
    )
    this.accessToken = res.token
    return res
  }

  async verifyToken(token: string) {
    return this.request<{ userId: string }>('POST', '/api/auth/verify', { token })
  }

  async generateEmail(
    req: EmailGenRequest,
    onProgress?: (message: string) => void
  ): Promise<GeneratedEmail> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${API_URL}/api/email/generate`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(req),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.error || `API error: ${response.status}`)
    }

    // Handle SSE streaming response
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let result: GeneratedEmail | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'progress' && onProgress) {
            onProgress(data.message)
          } else if (data.type === 'result') {
            result = data.generatedEmail
          } else if (data.type === 'error') {
            throw new Error(data.error)
          }
        } catch (e) {
          if (e instanceof Error && e.message !== '') throw e
        }
      }
    }

    if (!result) throw new Error('メール生成に失敗しました')
    return result
  }

  async researchCompany(companyName: string): Promise<CompanyResearch> {
    const res = await this.request<{ research: CompanyResearch }>('POST', '/api/research/company', {
      companyName,
    })
    return res.research
  }

  async getSettings(): Promise<CustomSettings> {
    const res = await this.request<{ settings: CustomSettings }>('GET', '/api/settings')
    return res.settings
  }

  async updateSettings(settings: Partial<CustomSettings>): Promise<CustomSettings> {
    const res = await this.request<{ settings: CustomSettings }>('PATCH', '/api/settings', settings)
    return res.settings
  }

  async getLeads(filters?: {
    status?: string
    dateFrom?: string
    dateTo?: string
    sort?: string
  }): Promise<{ leads: Lead[]; pagination: { limit: number; offset: number; total: number } }> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
    }
    const queryString = params.toString()
    const endpoint = queryString ? `/api/leads?${queryString}` : '/api/leads'
    return this.request('GET', endpoint)
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    return this.request<Lead>('PATCH', `/api/leads/${id}`, data)
  }

  async createLead(data: Partial<Lead>): Promise<Lead> {
    const res = await this.request<{ lead: Lead }>('POST', '/api/leads', data)
    return res.lead
  }

  async deleteLead(id: string): Promise<void> {
    await this.request<{ message: string }>('DELETE', `/api/leads/${id}`)
  }

  async getEmailHistory(params?: {
    limit?: number
    offset?: number
    companyName?: string
  }): Promise<{
    history: Array<{
      id: string
      companyName: string
      patterns: import('./types').EmailPattern[]
      subOutputs: GeneratedEmail['subOutputs'] | null
      persona: string | null
      sourceType: string | null
      ctaType: string | null
      createdAt: string
    }>
    pagination: { limit: number; offset: number; total: number }
  }> {
    const searchParams = new URLSearchParams()
    if (params?.limit != null) searchParams.append('limit', String(params.limit))
    if (params?.offset != null) searchParams.append('offset', String(params.offset))
    if (params?.companyName) searchParams.append('companyName', params.companyName)
    const qs = searchParams.toString()
    return this.request('GET', qs ? `/api/email/history?${qs}` : '/api/email/history')
  }

  async getAnalytics(
    period?: string,
    member?: string
  ): Promise<AnalyticsKPI> {
    const params = new URLSearchParams()
    if (period) params.append('period', period)
    if (member) params.append('member', member)
    const queryString = params.toString()
    const endpoint = queryString
      ? `/api/analytics/kpi?${queryString}`
      : '/api/analytics/kpi'
    const res = await this.request<{ kpi: AnalyticsKPI }>('GET', endpoint)
    return res.kpi
  }

  async getSuccessFactors() {
    return this.request<{ success_factors: Array<{ factor: string; count: number; percentage: number; category: string }> }>(
      'GET', '/api/analytics/success-factors'
    )
  }
  // ===== Usage & Billing =====

  async getUsage(): Promise<UsageInfo> {
    return this.request<UsageInfo>('GET', '/api/usage')
  }

  async createCheckoutSession(plan: 'starter' | 'pro'): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/api/stripe/checkout', { plan })
  }

  async createPortalSession(): Promise<{ url: string }> {
    return this.request<{ url: string }>('POST', '/api/stripe/portal')
  }
}

export const apiClient = new APIClient()
