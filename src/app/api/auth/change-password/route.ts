import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, hashPassword, verifyPassword } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: z.string().min(8, '新しいパスワードは8文字以上で入力してください'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = ChangePasswordSchema.parse(body);

    // Get current user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(validated.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 400 });
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(validated.newPassword);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ error: 'パスワードの更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ message: 'パスワードを変更しました' }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error in POST /auth/change-password:', error);
    return NextResponse.json({ error: 'パスワード変更に失敗しました' }, { status: 500 });
  }
}
