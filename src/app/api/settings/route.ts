import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const UpdateSettingsSchema = z.object({
  senderName: z.string().optional(),
  senderTitle: z.string().optional(),
  senderCompany: z.string().optional(),
  phoneNumber: z.string().optional(),
  senderEmail: z.string().optional(),
  schedulingUrl: z.string().optional(),
  signature: z.string().optional(),
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceBenefit: z.string().optional(),
  servicePrice: z.string().optional(),
  serviceResults: z.string().optional(),
  caseStudies: z.string().optional(),
  tone: z.string().optional(),
  prompt: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
});

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
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from('custom_settings')
        .insert({
          user_id: userId,
          sender_name: '',
          sender_title: '',
          sender_company: '',
          sender_phone: '',
          sender_email: '',
          service_name: '',
          service_description: '',
          service_benefit: '',
          service_price: '',
          service_results: '',
          tone: 'プロフェッショナルで親しみやすい',
          prompt: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating default settings:', createError);
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: 'Settings created', settings: { ...newSettings, knowledgeBase: [] } }, { status: 200 });
    }

    // Fetch knowledge base items to include in settings response
    const { data: kbItems } = await supabase
      .from('knowledge_base')
      .select('id, title, content, category, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const settingsWithKB = {
      ...settings,
      knowledgeBase: kbItems || [],
    };

    return NextResponse.json({ message: 'Settings retrieved successfully', settings: settingsWithKB }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
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

    if (validated.senderName !== undefined) updateData.sender_name = validated.senderName;
    if (validated.senderTitle !== undefined) updateData.sender_title = validated.senderTitle;
    if (validated.senderCompany !== undefined) updateData.sender_company = validated.senderCompany;
    if (validated.phoneNumber !== undefined) updateData.sender_phone = validated.phoneNumber;
    if (validated.senderEmail !== undefined) updateData.sender_email = validated.senderEmail;
    if (validated.schedulingUrl !== undefined) updateData.scheduling_url = validated.schedulingUrl;
    if (validated.signature !== undefined) updateData.signature = validated.signature;
    if (validated.serviceName !== undefined) updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined) updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined) updateData.service_benefit = validated.serviceBenefit;
    if (validated.servicePrice !== undefined) updateData.service_price = validated.servicePrice;
    if (validated.serviceResults !== undefined) updateData.service_results = validated.serviceResults;
    if (validated.caseStudies !== undefined) updateData.case_studies = validated.caseStudies;
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.knowledgeBaseIds !== undefined) updateData.knowledge_base_ids = validated.knowledgeBaseIds;

    const { data: settings, error } = await supabase
      .from('custom_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    // Fetch knowledge base items to include in response
    const { data: kbItems } = await supabase
      .from('knowledge_base')
      .select('id, title, content, category, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ message: 'Settings updated successfully', settings: { ...settings, knowledgeBase: kbItems || [] } }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error in PATCH /settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
