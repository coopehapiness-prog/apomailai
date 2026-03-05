import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';
import { geminiService } from '@/lib/gemini-service';
import { researchService } from '@/lib/research-service';

const GenerateEmailSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  persona: z
    .enum(['executive', 'manager', 'staff'])
    .optional()
    .default('executive'),
  sourceType: z.enum(['web', 'email', 'call', 'event']).optional(),
  ctaType: z
    .enum(['call', 'demo', 'meeting', 'resource'])
    .optional()
    .default('call'),
  newsIdx: z.number().int().min(0).optional().default(0),
  freeText: z.string().optional(),
});

// Parse extended data stored as JSON in service_benefit column
function parseExtendedSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const result = { ...settings };
  const sb = settings.service_benefit as string;
  if (sb) {
    try {
      const parsed = JSON.parse(sb);
      if (parsed && parsed.__ext) {
        // Replace service_benefit with actual benefit text
        result.service_benefit = parsed.benefit || '';
        // Add extended fields
        result.service_price = parsed.price || '';
        result.service_results = parsed.results || '';
        result.service_strengths = parsed.strengths || [];
        result.signature = parsed.signature || '';
        result.sender_phone = parsed.sender_phone || '';
        result.sender_email = parsed.sender_email || '';
        result.persona_prompts = parsed.persona_prompts || {};
      }
    } catch {
      // Not JSON, use as-is
    }
  }
  return result;
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = GenerateEmailSchema.parse(body);

    // Get user settings
    const { data: rawSettings, error: settingsError } = await supabase
      .from('custom_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError || !rawSettings) {
      return NextResponse.json(
        { error: 'User settings not found' },
        { status: 404 }
      );
    }

    // Parse extended data from service_benefit JSON
    const settings = parseExtendedSettings(rawSettings);

    // Get or generate company research
    let research = await researchService.researchCompany(
      validated.companyName,
      userId
    );

    // Generate emails and sub outputs IN PARALLEL to avoid timeout
    const [patterns, subOutputs] = await Promise.all([
      geminiService.generateEmails({
        companyName: validated.companyName,
        research,
        settings,
        persona: validated.persona,
        sourceType: validated.sourceType,
        ctaType: validated.ctaType,
        newsIdx: validated.newsIdx,
        freeText: validated.freeText,
      }),
      geminiService.generateSubOutputs(
        validated.companyName,
        research,
        settings
      ),
    ]);

    // Save to generated_emails table (non-blocking error handling)
    const { data: generatedEmail, error: saveError } = await supabase
      .from('generated_emails')
      .insert({
        user_id: userId,
        company_name: validated.companyName,
        patterns,
        company_research: research,
        settings_id: rawSettings.id,
        persona: validated.persona,
        source_type: validated.sourceType,
        cta_type: validated.ctaType,
        news_idx: validated.newsIdx,
        sub_outputs: subOutputs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving generated emails:', saveError);
      return NextResponse.json(
        {
          message: 'Emails generated (save warning)',
          generatedEmail: {
            id: null,
            companyName: validated.companyName,
            patterns,
            research,
            subOutputs,
            createdAt: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: 'Emails generated successfully',
        generatedEmail: {
          id: generatedEmail.id,
          companyName: generatedEmail.company_name,
          patterns: generatedEmail.patterns,
          research: generatedEmail.company_research,
          subOutputs: generatedEmail.sub_outputs,
          createdAt: generatedEmail.created_at,
        },
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
    console.error('Error generating emails:', error);
    return NextResponse.json(
      { error: 'Failed to generate emails' },
      { status: 500 }
    );
  }
}
