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

export async function POST(request: NextRequest) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = GenerateEmailSchema.parse(body);

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('custom_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: 'User settings not found' },
        { status: 404 }
      );
    }

    // Get or generate company research
    let research = await researchService.researchCompany(
      validated.companyName,
      userId
    );

    // Generate emails
    const patterns = await geminiService.generateEmails({
      companyName: validated.companyName,
      research,
      settings,
      persona: validated.persona,
      sourceType: validated.sourceType,
      ctaType: validated.ctaType,
      newsIdx: validated.newsIdx,
      freeText: validated.freeText,
    });

    // Generate sub outputs
    const subOutputs = await geminiService.generateSubOutputs(
      validated.companyName,
      research,
      settings
    );

    // Save to generated_emails table
    const { data: generatedEmail, error: saveError } = await supabase
      .from('generated_emails')
      .insert({
        user_id: userId,
        company_name: validated.companyName,
        patterns,
        company_research: research,
        settings_id: settings.id,
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
        { error: 'Failed to save generated emails' },
        { status: 500 }
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
