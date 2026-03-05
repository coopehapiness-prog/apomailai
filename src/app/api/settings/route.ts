import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const UpdateSettingsSchema = z.object({
  senderName: z.string().optional(),
  senderTitle: z.string().optional(),
  senderCompany: z.string().optional(),
  company: z.string().optional(),
  phoneNumber: z.string().optional(),
  senderEmail: z.string().optional(),
  senderPhone: z.string().optional(),
  signature: z.string().optional(),
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceBenefit: z.string().optional(),
  servicePrice: z.string().optional(),
  serviceResults: z.string().optional(),
  serviceStrengths: z.array(z.string()).optional(),
  tone: z.string().optional(),
  prompt: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
  personaPrompts: z.record(z.string()).optional(),
  serviceInfo: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    price: z.string().optional(),
    results: z.string().optional(),
  }).optional(),
  promptSettings: z.object({
    basePrompt: z.string().optional(),
    tone: z.string().optional(),
    personaPrompts: z.record(z.string()).optional(),
  }).optional(),
}).passthrough();

// Extended data is stored as JSON in service_benefit column
// Format: {"__ext":true, "benefit":"...", "price":"...", "results":"...", ...}
interface ExtData {
  __ext: true;
  benefit: string;
  price: string;
  results: string;
  strengths: string[];
  signature: string;
  sender_phone: string;
  sender_email: string;
  persona_prompts: Record<string, string>;
}

function parseExtData(serviceBenefit: string | null): ExtData {
  const defaults: ExtData = {
    __ext: true, benefit: '', price: '', results: '',
    strengths: [], signature: '', sender_phone: '', sender_email: '',
    persona_prompts: {},
  };
  if (!serviceBenefit) return defaults;
  try {
    const parsed = JSON.parse(serviceBenefit);
    if (parsed && parsed.__ext) return { ...defaults, ...parsed };
  } catch {}
  // Not JSON - treat as plain benefit text
  return { ...defaults, benefit: serviceBenefit };
}

function serializeExtData(ext: ExtData): string {
  return JSON.stringify(ext);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from('custom_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from('custom_settings')
        .insert({
          user_id: userId,
          sender_name: '', sender_title: '', sender_company: '',
          service_name: '', service_description: '', service_benefit: '',
          tone: '', prompt: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating settings:', createError);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }
      const ext = parseExtData(newSettings?.service_benefit);
      return NextResponse.json({ message: 'Settings created', settings: {
        ...newSettings,
        service_benefit: ext.benefit,
        service_price: ext.price, service_results: ext.results,
        service_strengths: ext.strengths, signature: ext.signature,
        sender_phone: ext.sender_phone, sender_email: ext.sender_email,
        persona_prompts: ext.persona_prompts,
      }}, { status: 200 });
    }

    // Parse extended data from service_benefit
    const ext = parseExtData(settings.service_benefit);

    const result = {
      ...settings,
      service_benefit: ext.benefit,
      sender_phone: ext.sender_phone,
      sender_email: ext.sender_email,
      signature: ext.signature,
      service_price: ext.price,
      service_results: ext.results,
      service_strengths: ext.strengths,
      persona_prompts: ext.persona_prompts,
    };

    return NextResponse.json({ message: 'Settings retrieved successfully', settings: result }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateSettingsSchema.parse(body);

    // Get existing settings to read current ext data
    const { data: existing } = await supabase
      .from('custom_settings')
      .select('service_benefit')
      .eq('user_id', userId)
      .single();

    const ext = parseExtData(existing?.service_benefit || null);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Sender profile - core DB columns
    if (validated.senderName !== undefined) updateData.sender_name = validated.senderName;
    if (validated.senderTitle !== undefined) updateData.sender_title = validated.senderTitle;
    if (validated.senderCompany !== undefined || validated.company !== undefined) {
      updateData.sender_company = validated.senderCompany || validated.company;
    }

    // Sender profile - extended fields (stored in service_benefit JSON)
    if (validated.phoneNumber !== undefined || validated.senderPhone !== undefined) {
      ext.sender_phone = validated.phoneNumber || validated.senderPhone || '';
    }
    if (validated.senderEmail !== undefined) ext.sender_email = validated.senderEmail;
    if (validated.signature !== undefined) ext.signature = validated.signature;

    // Service info - core DB columns
    if (validated.serviceName !== undefined) updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined) updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined) ext.benefit = validated.serviceBenefit;
    if (validated.servicePrice !== undefined) ext.price = validated.servicePrice;
    if (validated.serviceResults !== undefined) ext.results = validated.serviceResults;
    if (validated.serviceStrengths !== undefined) ext.strengths = validated.serviceStrengths;

    // Service info - nested object
    if (validated.serviceInfo) {
      if (validated.serviceInfo.name !== undefined) updateData.service_name = validated.serviceInfo.name;
      if (validated.serviceInfo.description !== undefined) updateData.service_description = validated.serviceInfo.description;
      if (validated.serviceInfo.price !== undefined) ext.price = validated.serviceInfo.price;
      if (validated.serviceInfo.results !== undefined) ext.results = validated.serviceInfo.results;
      if (validated.serviceInfo.strengths !== undefined) ext.strengths = validated.serviceInfo.strengths;
    }

    // Prompt settings - core DB columns
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.personaPrompts !== undefined) ext.persona_prompts = validated.personaPrompts;
    if (validated.promptSettings) {
      if (validated.promptSettings.basePrompt !== undefined) updateData.prompt = validated.promptSettings.basePrompt;
      if (validated.promptSettings.tone !== undefined) updateData.tone = validated.promptSettings.tone;
      if (validated.promptSettings.personaPrompts !== undefined) ext.persona_prompts = validated.promptSettings.personaPrompts;
    }

    if (validated.knowledgeBaseIds !== undefined) updateData.knowledge_base_ids = validated.knowledgeBaseIds;

    // Always serialize ext data into service_benefit
    updateData.service_benefit = serializeExtData(ext);

    const { data: settings, error } = await supabase
      .from('custom_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error.message);
      return NextResponse.json({ error: 'Failed to update: ' + error.message }, { status: 500 });
    }

    // Parse ext data from saved settings for response
    const savedExt = parseExtData(settings.service_benefit);
    const merged = {
      ...settings,
      service_benefit: savedExt.benefit,
      sender_phone: savedExt.sender_phone,
      sender_email: savedExt.sender_email,
      signature: savedExt.signature,
      service_price: savedExt.price,
      service_results: savedExt.results,
      service_strengths: savedExt.strengths,
      persona_prompts: savedExt.persona_prompts,
    };

    return NextResponse.json({ message: 'Settings updated successfully', settings: merged }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error in PATCH /settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
