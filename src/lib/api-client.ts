import {
  CustomSettings,
  CompanyResearch,
  EmailGenRequest,
  GeneratedEmail,
  Lead,
  AnalyticsKPI,
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
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API error: ${response.status}`)
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

  async generateEmail(req: EmailGenRequest): Promise<GeneratedEmail> {
    console.log('[API_CLIENT] generateEmail called with:', req.companyName)
    const res = await this.request<{ generatedEmail: GeneratedEmail }>('POST', '/api/email/generate', req)
    console.log('[API_CLIENT] generateEmail result:', {
      hasGeneratedEmail: !!res?.generatedEmail,
      patternsLength: res?.generatedEmail?.patterns?.length,
    })
    return res.generatedEmail
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
}

export const apiClient = new APIClient()
