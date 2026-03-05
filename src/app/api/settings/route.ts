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
      // Create default settings for new user
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

    return NextResponse.json({ message: 'Settings retrieved successfully', settings }, { status: 200 });
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
    if (validated.senderCompany !== undefined || validated.company !== undefined)
      updateData.sender_company = validated.senderCompany || validated.company;
    if (validated.phoneNumber !== undefined) updateData.sender_phone = validated.phoneNumber;
    if (validated.signature !== undefined) updateData.signature = validated.signature;

    // Service info - flat fields
    if (validated.serviceName !== undefined) updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined) updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined) updateData.service_benefit = validated.serviceBenefit;

    // Service info - nested object
    if (validated.serviceInfo) {
      if (validated.serviceInfo.name !== undefined) updateData.service_name = validated.serviceInfo.name;
      if (validated.serviceInfo.description !== undefined) updateData.service_description = validated.serviceInfo.description;
      if (validated.serviceInfo.strengths !== undefined) updateData.service_strengths = validated.serviceInfo.strengths;
      if (validated.serviceInfo.price !== undefined) updateData.service_price = validated.serviceInfo.price;
      if (validated.serviceInfo.results !== undefined) updateData.service_results = validated.serviceInfo.results;
    }

    // Prompt settings
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.promptSettings) {
      if (validated.promptSettings.basePrompt !== undefined) updateData.prompt = validated.promptSettings.basePrompt;
      if (validated.promptSettings.tone !== undefined) updateData.tone = validated.promptSettings.tone;
      if (validated.promptSettings.personaPrompts !== undefined) updateData.persona_prompts = validated.promptSettings.personaPrompts;
    }

    if (validated.knowledgeBaseIds !== undefined) updateData.knowledge_base_ids = validated.knowledgeBaseIds;

    const { data: settings, error } = await supabase
      .from('custom_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
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
