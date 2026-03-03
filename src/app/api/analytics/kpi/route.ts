import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';
import { AnalyticsKPI } from '@/lib/types';

const QuerySchema = z.object({
  period: z
    .enum(['week', 'month', 'quarter', 'year'])
    .optional()
    .default('month'),
  member: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const validated = QuerySchema.parse({
      period: searchParams.get('period'),
      member: searchParams.get('member'),
    });

    // Calculate date range
    const now = new Date();
    let dateFrom = new Date();

    switch (validated.period) {
      case 'week':
        dateFrom.setDate(now.getDate() - 7);
        break;
      case 'month':
        dateFrom.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        dateFrom.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        dateFrom.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Query generated emails
    let emailQuery = supabase
      .from('generated_emails')
      .select('*, leads(*)', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', dateFrom.toISOString());

    const { data: emails, count: emailCount } = await emailQuery;

    if (!emails) {
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    // Count replies and appointments
    let repliesCount = 0;
    let appointmentsCount = 0;
    let dealsCount = 0;

    emails.forEach((email: any) => {
      if (email.reply_received) repliesCount++;
      if (email.appointment_booked) appointmentsCount++;
      if (email.deal_won) dealsCount++;
    });

    const replyRate =
      emailCount && emailCount > 0
        ? ((repliesCount / emailCount) * 100).toFixed(2)
        : '0';
    const appointmentRate =
      emailCount && emailCount > 0
        ? ((appointmentsCount / emailCount) * 100).toFixed(2)
        : '0';
    const dealRate =
      emailCount && emailCount > 0
        ? ((dealsCount / emailCount) * 100).toFixed(2)
        : '0';

    const kpi: AnalyticsKPI = {
      period: validated.period,
      emails_generated: emailCount || 0,
      emails_sent: emailCount || 0,
      reply_rate: parseFloat(replyRate),
      appointment_rate: parseFloat(appointmentRate),
      deal_rate: parseFloat(dealRate),
      success_factors: [],
      top_personas: [],
      top_ctas: [],
    };

    // Calculate top personas
    const personaMap: Record<string, number> = {};
    emails.forEach((email: any) => {
      if (email.persona) {
        personaMap[email.persona] = (personaMap[email.persona] || 0) + 1;
      }
    });

    kpi.top_personas = Object.entries(personaMap)
      .map(([persona, count]) => ({ persona, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate top CTAs
    const ctaMap: Record<string, number> = {};
    emails.forEach((email: any) => {
      if (email.cta_type) {
        ctaMap[email.cta_type] = (ctaMap[email.cta_type] || 0) + 1;
      }
    });

    kpi.top_ctas = Object.entries(ctaMap)
      .map(([cta, count]) => ({ cta, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json(
      {
        message: 'KPI data retrieved successfully',
        kpi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching KPI:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPI data' },
      { status: 500 }
    );
  }
}
