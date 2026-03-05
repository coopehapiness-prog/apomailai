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
  signature: z.string().optional(),
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceBenefit: z.string().optional(),
  tone: z.string().optional(),
  prompt: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
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
          sender_name: '',
          sender_title: '',
          sender_company: '',
          service_name: '',
          service_description: '',
          service_benefit: '',
          tone: '',
          prompt: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating settings:', createError);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }
      return NextResponse.json({ message: 'Settings created', settings: newSettings }, { status: 200 });
    }

    // Parse extended_data JSON if present
    let extendedData: Record<string, unknown> = {};
    try {
      if (settings.extended_data) {
        extendedData = typeof settings.extended_data === 'string'
          ? JSON.parse(settings.extended_data)
          : settings.extended_data;
      }
    } catch {}

    // Merge extended data into response
    const merged = {
      ...settings,
      sender_phone: extendedData.sender_phone || '',
      sender_email: extendedData.sender_email || '',
      signature: extendedData.signature || '',
      service_strengths: extendedData.service_strengths || [],
      service_price: extendedData.service_price || '',
      service_results: extendedData.service_results || '',
      persona_prompts: extendedData.persona_prompts || {},
    };

    return NextResponse.json({ message: 'Settings retrieved successfully', settings: merged }, { status: 200 });
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

    // First get existing extended_data
    const { data: existing } = await supabase
      .from('custom_settings')
      .select('extended_data')
      .eq('user_id', userId)
      .single();

    let extendedData: Record<string, unknown> = {};
    try {
      if (existing?.extended_data) {
        extendedData = typeof existing.extended_data === 'string'
          ? JSON.parse(existing.extended_data)
          : existing.extended_data;
      }
    } catch {}

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Sender profile - core DB columns
    if (validated.senderName !== undefined) updateData.sender_name = validated.senderName;
    if (validated.senderTitle !== undefined) updateData.sender_title = validated.senderTitle;
    if (validated.senderCompany !== undefined || validated.company !== undefined)
      updateData.sender_company = validated.senderCompany || validated.company;

    // Sender profile - extended fields stored in JSON
    if (validated.phoneNumber !== undefined) extendedData.sender_phone = validated.phoneNumber;
    if (validated.senderEmail !== undefined) extendedData.sender_email = validated.senderEmail;
    if (validated.signature !== undefined) extendedData.signature = validated.signature;

    // Service info - core DB columns
    if (validated.serviceName !== undefined) updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined) updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined) updateData.service_benefit = validated.serviceBenefit;

    // Service info - nested object
    if (validated.serviceInfo) {
      if (validated.serviceInfo.name !== undefined) updateData.service_name = validated.serviceInfo.name;
      if (validated.serviceInfo.description !== undefined) updateData.service_description = validated.serviceInfo.description;
      if (validated.serviceInfo.strengths !== undefined) extendedData.service_strengths = validated.serviceInfo.strengths;
      if (validated.serviceInfo.price !== undefined) extendedData.service_price = validated.serviceInfo.price;
      if (validated.serviceInfo.results !== undefined) extendedData.service_results = validated.serviceInfo.results;
    }

    // Prompt settings - core DB columns
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.promptSettings) {
      if (validated.promptSettings.basePrompt !== undefined) updateData.prompt = validated.promptSettings.basePrompt;
      if (validated.promptSettings.tone !== undefined) updateData.tone = validated.promptSettings.tone;
      if (validated.promptSettings.personaPrompts !== undefined) extendedData.persona_prompts = validated.promptSettings.personaPrompts;
    }

    if (validated.knowledgeBaseIds !== undefined) updateData.knowledge_base_ids = validated.knowledgeBaseIds;

    // Store extended data as JSON
    updateData.extended_data = extendedData;

    const { data: settings, error } = await supabase
      .from('custom_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      // If extended_data column doesn't exist, try without it
      delete updateData.extended_data;
      const { data: fallbackSettings, error: fallbackError } = await supabase
        .from('custom_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
        return NextResponse.json({ error: 'Failed to update settings: ' + fallbackError.message }, { status: 500 });
      }
      return NextResponse.json({ message: 'Settings updated (partial)', settings: fallbackSettings }, { status: 200 });
    }

    // Merge extended data into response
    let mergedExtended: Record<string, unknown> = {};
    try {
      if (settings.extended_data) {
        mergedExtended = typeof settings.extended_data === 'string'
          ? JSON.parse(settings.extended_data)
          : settings.extended_data;
      }
    } catch {}

    const merged = {
      ...settings,
      sender_phone: mergedExtended.sender_phone || '',
      sender_email: mergedExtended.sender_email || '',
      signature: mergedExtended.signature || '',
      service_strengths: mergedExtended.service_strengths || [],
      service_price: mergedExtended.service_price || '',
      service_results: mergedExtended.service_results || '',
      persona_prompts: mergedExtended.persona_prompts || {},
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
