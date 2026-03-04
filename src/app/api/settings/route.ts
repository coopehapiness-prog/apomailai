import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const UpdateSettingsSchema = z.object({
  senderName: z.string().optional(),
  senderTitle: z.string().optional(),
  senderCompany: z.string().optional(),
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceBenefit: z.string().optional(),
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

    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Settings retrieved successfully',
        settings,
      },
      { status: 200 }
    );
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

    if (validated.senderName !== undefined)
      updateData.sender_name = validated.senderName;
    if (validated.senderTitle !== undefined)
      updateData.sender_title = validated.senderTitle;
    if (validated.senderCompany !== undefined)
      updateData.sender_company = validated.senderCompany;
    if (validated.serviceName !== undefined)
      updateData.service_name = validated.serviceName;
    if (validated.serviceDescription !== undefined)
      updateData.service_description = validated.serviceDescription;
    if (validated.serviceBenefit !== undefined)
      updateData.service_benefit = validated.serviceBenefit;
    if (validated.tone !== undefined) updateData.tone = validated.tone;
    if (validated.prompt !== undefined) updateData.prompt = validated.prompt;
    if (validated.knowledgeBaseIds !== undefined)
      updateData.knowledge_base_ids = validated.knowledgeBaseIds;

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

    return NextResponse.json(
      {
        message: 'Settings updated successfully',
        settings,
      },
      { status: 200 }
    );
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
