export interface User {
  id: string
  email: string
  name?: string
  company?: string
  role?: string
}

export interface CustomSettings {
  [key: string]: unknown
  id?: string
  user_id?: string
  sender_name: string
  sender_title: string
  sender_company: string
  sender_email?: string
  sender_phone?: string
  scheduling_url?: string
  service_name: string
  service_description: string
  service_benefit: string
  service_price?: string
  service_results?: string
  case_studies?: string
  tone: string
  prompt?: string
  knowledge_base_ids?: string[]
  created_at?: string
  updated_at?: string
  // Frontend aliases (camelCase)
  senderName?: string
  senderTitle?: string
  company?: string
  phoneNumber?: string
  serviceInfo?: {
    name: string
    description: string
    strengths: string[]
    price?: string
    results?: string
  }
  promptSettings?: {
    basePrompt: string
    personaPrompts?: Record<string, string>
    tone?: string
  }
  knowledgeBase?: KnowledgeBaseItem[]
}

export interface KnowledgeBaseItem {
  id: string
  title: string
  content: string
  category?: string
  created_at?: string
  updated_at?: string
  createdAt?: string
}

export interface CompanyResearch {
  company_name: string
  overview?: string
  business?: string
  industry?: string
  stage?: string
  employees?: number | string
  homepage_url?: string
  business_url?: string
  news: Array<{ title: string; summary?: string; url?: string; date?: string; source?: string; type?: string }>
  pains: string[]
  hypothesis?: string
  scraped_at?: string
  // Frontend aliases
  companyName?: string
  businessDescription?: string
  employeeCount?: number
  latestNews?: Array<{ id: string; title: string; url?: string; date?: string; summary?: string }>
  painPoints?: string[]
  opportunities?: string[]
  overviewUrl?: string
  businessUrl?: string
}

export interface EmailGenRequest {
  companyName: string
  contactName?: string
  contactTitle?: string
  contactDepartment?: string
  persona?: 'executive' | 'manager' | 'staff'
  sourceType?: 'web' | 'email' | 'call' | 'event'
  source?: string
  ctaType?: 'call' | 'demo' | 'meeting' | 'resource'
  newsIdx?: number
  freeText?: string
  history?: string
  customization?: {
    personas?: string[]
    news?: string[]
    cta?: string
    freeText?: string
    chips?: string[]
  }
}

export interface EmailPattern {
  patternName: string
  subject: string
  body: string
  targetPersona?: string
  description?: string
  phoneScript?: string
  videoPrompt?: string
  followUpScenarios?: string[]
}

export interface GeneratedEmail {
  id?: string
  companyName: string
  patterns: EmailPattern[]
  research: CompanyResearch
  subOutputs?: {
    phone_script?: string
    video_prompt?: string
    follow_up_scenarios?: string[]
  }
  createdAt?: string
}

export interface Lead {
  id: string
  user_id?: string
  company_name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  contact_title?: string
  status: 'prospect' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost'
  notes?: string
  source?: string
  assignee?: string
  last_contact_date?: string
  is_deleted?: boolean
  created_at?: string
  updated_at?: string
  // Frontend aliases
  companyName?: string
  contactName?: string
  contactEmail?: string
  createdAt?: string
  lastContactDate?: string
}

export interface SuccessFactor {
  factor: string
  count: number
  percentage: number
  category: 'structure' | 'tone' | 'cta' | 'content' | 'personalization'
}

export interface AnalyticsKPI {
  period: string
  emails_generated: number
  emails_sent: number
  reply_rate: number
  appointment_rate: number
  deal_rate: number
  success_factors: SuccessFactor[]
  top_personas: Array<{ persona: string; count: number }>
  top_ctas: Array<{ cta: string; count: number }>
  // Frontend aliases
  member?: string
  emailsGenerated?: number
  emailsReplied?: number
  replyRate?: number
  appointmentsSet?: number
  appointmentRate?: number
  dealsCreated?: number
  dealRate?: number
}
