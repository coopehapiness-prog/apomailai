import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const CreateKnowledgeBaseSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: items, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge base items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch knowledge base items' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Knowledge base items retrieved successfully',
        items: items || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /knowledge-base:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreateKnowledgeBaseSchema.parse(body);

    const { data: item, error } = await supabase
      .from('knowledge_base')
      .insert({
        user_id: userId,
        title: validated.title,
        content: validated.content,
        category: validated.category || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating knowledge base item:', error);
      return NextResponse.json(
        { error: 'Failed to create knowledge base item' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Knowledge base item created successfully',
        item,
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

    console.error('Error in POST /knowledge-base:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base item' },
      { status: 500 }
    );
  }
}
