import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const UpdateLeadSchema = z.object({
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactTitle: z.string().optional(),
  status: z
    .enum(['prospect', 'contacted', 'interested', 'proposal', 'won', 'lost'])
    .optional(),
  notes: z.string().optional(),
  assignee: z.string().optional(),
  lastContactDate: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateLeadSchema.parse(body);
    const { id } = params;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.contactName !== undefined)
      updateData.contact_name = validated.contactName;
    if (validated.contactEmail !== undefined)
      updateData.contact_email = validated.contactEmail;
    if (validated.contactPhone !== undefined)
      updateData.contact_phone = validated.contactPhone;
    if (validated.contactTitle !== undefined)
      updateData.contact_title = validated.contactTitle;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.assignee !== undefined) updateData.assignee = validated.assignee;
    if (validated.lastContactDate !== undefined)
      updateData.last_contact_date = validated.lastContactDate;

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 500 }
      );
    }

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: 'Lead updated successfully',
        lead,
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

    console.error('Error in PATCH /leads/:id:', error);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Soft delete by marking is_deleted
    const { error } = await supabase
      .from('leads')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting lead:', error);
      return NextResponse.json(
        { error: 'Failed to delete lead' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Lead deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /leads/:id:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
