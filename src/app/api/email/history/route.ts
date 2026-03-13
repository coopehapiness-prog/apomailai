import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  companyName: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const raw: Record<string, unknown> = {};
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const companyParam = searchParams.get('companyName');
    if (limitParam !== null) raw.limit = limitParam;
    if (offsetParam !== null) raw.offset = offsetParam;
    if (companyParam !== null) raw.companyName = companyParam;
    const validated = QuerySchema.parse(raw);

    let query = supabase
      .from('generated_emails')
      .select('id, company_name, patterns, sub_outputs, created_at, persona, source_type, cta_type', { count: 'exact' })
      .eq('user_id', userId);

    if (validated.companyName) {
      query = query.ilike('company_name', `%${validated.companyName}%`);
    }

    const { data: records, error, count } = await query
      .order('created_at', { ascending: false })
      .range(validated.offset, validated.offset + validated.limit - 1);

    if (error) {
      console.error('Error fetching email history:', error);
      return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 });
    }

    const history = (records || []).map((r) => ({
      id: r.id,
      companyName: r.company_name,
      patterns: r.patterns || [],
      subOutputs: r.sub_outputs || null,
      persona: r.persona || null,
      sourceType: r.source_type || null,
      ctaType: r.cta_type || null,
      createdAt: r.created_at,
    }));

    return NextResponse.json(
      {
        history,
        pagination: {
          limit: validated.limit,
          offset: validated.offset,
          total: count || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/email/history:', error);
    return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 });
  }
}
