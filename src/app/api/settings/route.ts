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
          sender_email: '',
          sender_phone: '',
          service_name: '',
          service_description: '',
          service_benefit: '',
          service_price: '',
          service_results: '',
          signature: '',
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

    // Ensure all expected fields exist in response
    const result = {
      ...settings,
      sender_phone: settings.sender_phone || '',
      sender_email: settings.sender_email || '',
      signature: settings.signature || '',
      service_price: settings.service_price || '',
      service_results: settings.service_results || '',
      service_strengths: settings.service_strengths || [],
      persona_prompts: settings.persona_prompts || {},
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

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Sender profile fields
    if (validated.senderName !== undefined) updateData.sender_name = validated.senderName;
    if (validated.senderTitle !== undefined) updateData.sender_title = validated.senderTitle;
    if (validated.senderCompany !== undefined || validated.company !== undefined) {
      updateData.sender_company = validated.senderCompany || validated.company;
    }
    if (validated.phoneNumber !== undefined || validated.senderPhone !== undefined) {
      updateData.sender_phone = validated.phoneNumber || validated.senderPhone;
    }
    if (validated.senderEmail !== undefined) updateData.sender_email = validated.senderEmail;
    if (validated.signature !== undefined) updateData.signature = validated.signature;

    // Service info - direct fields
    if (validated.serviceName !== undefined) updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined) updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined) updateData.service_benefit = validated.serviceBenefit;
    if (validated.servicePrice !== undefined) updateData.service_price = validated.servicePrice;
    if (validated.serviceResults !== undefined) updateData.service_results = validated.serviceResults;
    if (validated.serviceStrengths !== undefined) updateData.service_strengths = validated.serviceStrengths;

    // Service info - nested object
    if (validated.serviceInfo) {
      if (validated.serviceInfo.name !== undefined) updateData.service_name = validated.serviceInfo.name;
      if (validated.serviceInfo.description !== undefined) updateData.service_description = validated.serviceInfo.description;
      if (validated.serviceInfo.price !== undefined) updateData.service_price = validated.serviceInfo.price;
      if (validated.serviceInfo.results !== undefined) updateData.service_results = validated.serviceInfo.results;
      if (validated.serviceInfo.strengths !== undefined) updateData.service_strengths = validated.serviceInfo.strengths;
    }

    // Prompt settings
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.personaPrompts !== undefined) updateData.persona_prompts = validated.personaPrompts;
    if (validated.promptSettings) {
      if (validated.promptSettings.basePrompt !== undefined) updateData.prompt = validated.promptSettings.basePrompt;
      if (validated.promptSettings.tone !== undefined) updateData.tone = validated.promptSettings.tone;
      if (validated.promptSettings.personaPrompts !== undefined) updateData.persona_prompts = validated.promptSettings.personaPrompts;
    }

    if (validated.knowledgeBaseIds !== undefined) updateData.knowledge_base_ids = validated.knowledgeBaseIds;

    // Try full update first
    const { data: settings, error } = await supabase
      .from('custom_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Full update error:', error.message);
      // Try removing potentially missing columns one by one
      const optionalCols = ['service_strengths', 'persona_prompts', 'service_price', 'service_results', 'signature', 'sender_phone', 'sender_email'];
      for (const col of optionalCols) {
        if (updateData[col] !== undefined) {
          delete updateData[col];
        }
      }
      const { data: fb, error: fbErr } = await supabase
        .from('custom_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (fbErr) {
        console.error('Fallback update error:', fbErr.message);
        return NextResponse.json({ error: 'Failed to update: ' + fbErr.message }, { status: 500 });
      }
      return NextResponse.json({ message: 'Settings updated (partial)', settings: fb }, { status: 200 });
    }

    return NextResponse.json({ message: 'Settings updated successfully', settings }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error in PATCH /settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
