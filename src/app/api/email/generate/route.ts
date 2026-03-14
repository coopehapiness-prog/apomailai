import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';
import { geminiService } from '@/lib/gemini-service';
import { researchService } from '@/lib/research-service';
import { PLAN_LIMITS, PlanType } from '@/lib/types';

export const maxDuration = 300; // Requires Vercel Pro plan

const GenerateEmailSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional(),
  contactDepartment: z.string().optional(),
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
  source: z.string().optional(),
  history: z.string().optional(),
  customization: z.object({
    personas: z.array(z.string()).optional(),
    news: z.array(z.string()).optional(),
    cta: z.string().optional(),
    freeText: z.string().optional(),
    chips: z.array(z.string()).optional(),
  }).optional(),
});

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = GenerateEmailSchema.parse(body);

    // ===== Usage Limit Check =====
    const currentMonth = getCurrentMonth();

    // Get user's plan
    const { data: userData } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    const plan: PlanType = (userData?.plan as PlanType) || 'free';
    const limit = PLAN_LIMITS[plan];

    // Get current month's usage
    const { data: usageData } = await supabase
      .from('usage_tracking')
      .select('email_count')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    const currentCount = usageData?.email_count || 0;

    if (currentCount >= limit) {
      return NextResponse.json(
        {
          error: `今月のメール生成上限（${limit}件）に達しました。プランをアップグレードしてください。`,
          code: 'USAGE_LIMIT_EXCEEDED',
          plan,
          emailCount: currentCount,
          emailLimit: limit,
          remaining: 0,
        },
        { status: 403 }
      );
    }

    // Use streaming to keep the connection alive on Vercel Hobby plan
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Get user settings
          const { data: dbSettings } = await supabase
            .from('custom_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

          const settings = dbSettings || {
            id: null,
            sender_name: '',
            sender_title: '',
            sender_company: '',
            sender_email: '',
            sender_phone: '',
            scheduling_url: '',
            service_name: '',
            service_description: '',
            service_benefit: '',
            tone: 'プロフェッショナルで親しみやすい',
          };

          send({ type: 'progress', message: '企業情報をリサーチ中...' });

          // Get or generate company research
          const research = await researchService.researchCompany(
            validated.companyName,
            userId
          );

          send({ type: 'progress', message: 'メールを生成中...' });

          // Merge freeText from top-level or customization object
          const effectiveFreeText = validated.freeText || validated.customization?.freeText || '';
          const effectivePersona = validated.persona;
          const effectiveCta = validated.customization?.cta || validated.ctaType;

          // Generate emails and sub outputs IN PARALLEL
          const [patterns, subOutputs] = await Promise.all([
            geminiService.generateEmails({
              companyName: validated.companyName,
              research,
              settings,
              persona: effectivePersona,
              sourceType: validated.sourceType,
              ctaType: effectiveCta,
              newsIdx: validated.newsIdx,
              freeText: effectiveFreeText,
              contactDepartment: validated.contactDepartment,
              leadSource: validated.source,
            }),
            geminiService.generateSubOutputs(
              validated.companyName,
              research,
              settings,
              validated.source
            ),
          ]);

          send({ type: 'progress', message: '保存中...' });

          // Increment usage count (UPSERT)
          const { error: upsertError } = await supabase
            .rpc('increment_usage', {
              p_user_id: userId,
              p_month: currentMonth,
            });

          // Fallback: if RPC doesn't exist, do manual upsert
          if (upsertError) {
            const { data: existingUsage } = await supabase
              .from('usage_tracking')
              .select('id, email_count')
              .eq('user_id', userId)
              .eq('month', currentMonth)
              .single();

            if (existingUsage) {
              await supabase
                .from('usage_tracking')
                .update({
                  email_count: existingUsage.email_count + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingUsage.id);
            } else {
              await supabase
                .from('usage_tracking')
                .insert({
                  user_id: userId,
                  month: currentMonth,
                  email_count: 1,
                });
            }
          }

          // Save to generated_emails table
          const { data: generatedEmail, error: saveError } = await supabase
            .from('generated_emails')
            .insert({
              user_id: userId,
              company_name: validated.companyName,
              patterns,
              company_research: research,
              settings_id: settings.id || null,
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
          }

          // Send final result
          send({
            type: 'result',
            message: 'Emails generated successfully',
            generatedEmail: {
              id: generatedEmail?.id || null,
              companyName: validated.companyName,
              patterns,
              research,
              subOutputs,
              createdAt: generatedEmail?.created_at || new Date().toISOString(),
            },
          });

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error generating emails:', errorMessage, error);
          send({ type: 'error', error: `メール生成に失敗しました: ${errorMessage}` });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating emails:', errorMessage, error);
    return NextResponse.json(
      { error: `メール生成に失敗しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}
