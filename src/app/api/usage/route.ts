import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';
import { PLAN_LIMITS, PlanType, UsageInfo } from '@/lib/types';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const emailCount = usageData?.email_count || 0;

    const usage: UsageInfo = {
      plan,
      emailCount,
      emailLimit: limit,
      remaining: Math.max(0, limit - emailCount),
      currentMonth,
    };

    return NextResponse.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: '使用量の取得に失敗しました' },
      { status: 500 }
    );
  }
}
