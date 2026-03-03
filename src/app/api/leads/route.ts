import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const CreateLeadSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactTitle: z.string().optional(),
  status: z
    .enum(['prospect', 'contacted', 'interested', 'proposal', 'won', 'lost'])
    .default('prospect'),
  notes: z.string().optional(),
  source: z.string().optional(),
});

const QuerySchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.string().optional(),
  limit: z.coerce.number().int().min(1).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const validated = QuerySchema.parse({
      status: searchParams.get('status'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      sort: searchParams.get('sort'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (validated.status) {
      query = query.eq('status', validated.status);
    }

    if (validated.dateFrom) {
      query = query.gte('created_at', validated.dateFrom);
    }

    if (validated.dateTo) {
      query = query.lte('created_at', validated.dateTo);
    }

    const { data: leads, error, count } = await query
      .order(validated.sort || 'created_at', { ascending: false })
      .range(validated.offset, validated.offset + validated.limit - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Leads retrieved successfully',
        leads: leads || [],
        pagination: {
          limit: validated.limit,
          offset: validated.offset,
          total: count || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreateLeadSchema.parse(body);

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        company_name: validated.companyName,
        contact_name: validated.contactName || null,
        contact_email: validated.contactEmail || null,
        contact_phone: validated.contactPhone || null,
        contact_title: validated.contactTitle || null,
        status: validated.status,
        notes: validated.notes || null,
        source: validated.source || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json(
        { error: 'Failed to create lead' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Lead created successfully',
        lead,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error in POST /leads:', error);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
