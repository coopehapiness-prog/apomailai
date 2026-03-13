import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting knowledge base item:', error);
      return NextResponse.json(
        { error: 'Failed to delete knowledge base item' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Knowledge base item deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /knowledge-base/:id:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base item' },
      { status: 500 }
    );
  }
}
