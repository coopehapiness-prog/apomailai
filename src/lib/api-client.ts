import {
  EmailGenerationRequest,
  GeneratedEmail,
  CompanyResearch,
  CustomSettings,
  Lead,
  KPIData,
  SuccessFactors,
  KnowledgeBase,
} from '@/lib/types';

class ApiClient {
  private baseUrl = '/api';
  private token: string | null = null;

  constructor() {
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
  }

  /**
   * Set auth token for subsequent requests
   */
  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Clear auth token
   */
  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Make a request to the API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<{ token: string }> {
    const response = await this.request<{ token: string }>('POST', '/auth/login', {
      email,
      password,
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  /**
   * Register a new account
   */
  async register(email: string, password: string): Promise<{ token: string }> {
    const response = await this.request<{ token: string }>('POST', '/auth/register', {
      email,
      password,
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  /**
   * Generate email based on request
   */
  async generateEmail(req: EmailGenerationRequest): Promise<GeneratedEmail> {
    return this.request<GeneratedEmail>('POST', '/email/generate', req);
  }

  /**
   * Research a company
   */
  async researchCompany(companyName: string): Promise<CompanyResearch> {
    return this.request<CompanyResearch>('POST', '/research/company', {
      companyName,
    });
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<CustomSettings> {
    return this.request<CustomSettings>('GET', '/settings');
  }

  /**
   * Update user settings
   */
  async updateSettings(settings: Partial<CustomSettings>): Promise<CustomSettings> {
    return this.request<CustomSettings>('PATCH', '/settings', settings);
  }

  /**
   * Get all leads
   */
  async getLeads(): Promise<Lead[]> {
    return this.request<Lead[]>('GET', '/leads');
  }

  /**
   * Create a new lead
   */
  async createLead(lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    return this.request<Lead>('POST', '/leads', lead);
  }

  /**
   * Update a lead
   */
  async updateLead(
    id: string,
    lead: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Lead> {
    return this.request<Lead>('PATCH', `/leads/${id}`, lead);
  }

  /**
   * Delete a lead
   */
  async deleteLead(id: string): Promise<void> {
    await this.request<void>('DELETE', `/leads/${id}`);
  }

  /**
   * Get KPI analytics
   */
  async getKPI(params?: Record<string, string | number>): Promise<KPIData> {
    const queryString = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return this.request<KPIData>('GET', `/analytics/kpi${queryString}`);
  }

  /**
   * Get success factors analytics
   */
  async getSuccessFactors(): Promise<SuccessFactors> {
    return this.request<SuccessFactors>('GET', '/analytics/success-factors');
  }

  /**
   * Upload knowledge base file
   */
  async uploadKnowledge(formData: FormData): Promise<KnowledgeBase> {
    const url = `${this.baseUrl}/settings/knowledge-base`;
    const headers: HeadersInit = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
