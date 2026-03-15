import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/settings/share
 * Returns the list of same-domain users and their sharing status.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user email
    const { data: currentUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!currentUser?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract domain
    const domain = currentUser.email.split('@')[1];
    if (!domain) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Exclude free email domains (these are personal, not company)
    const freeEmailDomains = ['gmail.com', 'yahoo.co.jp', 'yahoo.com', 'hotmail.com', 'outlook.com', 'outlook.jp', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'mail.com', 'protonmail.com', 'zoho.com'];
    if (freeEmailDomains.includes(domain.toLowerCase())) {
      return NextResponse.json({
        message: 'フリーメールアドレスでは設定共有機能は利用できません。会社ドメインのメールアドレスでログインしてください。',
        domain,
        isFreeEmail: true,
        teammates: [],
      }, { status: 200 });
    }

    // Find same-domain users
    const { data: domainUsers } = await supabase
      .from('users')
      .select('id, email')
      .like('email', `%@${domain}`)
      .neq('id', userId);

    return NextResponse.json({
      domain,
      isFreeEmail: false,
      currentUserEmail: currentUser.email,
      teammates: domainUsers || [],
    }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /settings/share:', error);
    return NextResponse.json({ error: 'Failed to fetch sharing info' }, { status: 500 });
  }
}

/**
 * POST /api/settings/share
 * Copy current user's settings to all same-domain users, or import from a teammate.
 * Body: { action: 'export' | 'import', fromUserId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, fromUserId } = body;

    // Get current user email
    const { data: currentUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!currentUser?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const domain = currentUser.email.split('@')[1];

    // Block free emails
    const freeEmailDomains = ['gmail.com', 'yahoo.co.jp', 'yahoo.com', 'hotmail.com', 'outlook.com', 'outlook.jp', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'mail.com', 'protonmail.com', 'zoho.com'];
    if (freeEmailDomains.includes(domain.toLowerCase())) {
      return NextResponse.json({ error: 'フリーメールアドレスでは設定共有機能は利用できません' }, { status: 400 });
    }

    if (action === 'export') {
      // Export: Copy my settings to all same-domain users
      const { data: mySettings } = await supabase
        .from('custom_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!mySettings) {
        return NextResponse.json({ error: '共有する設定がありません' }, { status: 400 });
      }

      // Find same-domain users
      const { data: domainUsers } = await supabase
        .from('users')
        .select('id')
        .like('email', `%@${domain}`)
        .neq('id', userId);

      if (!domainUsers || domainUsers.length === 0) {
        return NextResponse.json({ error: '同じドメインの他のユーザーが見つかりません' }, { status: 400 });
      }

      // Copy shared fields (not sender personal info)
      const sharedFields = {
        sender_company: mySettings.sender_company,
        service_name: mySettings.service_name,
        service_description: mySettings.service_description,
        service_benefit: mySettings.service_benefit,
        service_price: mySettings.service_price,
        service_results: mySettings.service_results,
        case_studies: mySettings.case_studies,
        tone: mySettings.tone,
        prompt: mySettings.prompt,
        scheduling_url: mySettings.scheduling_url,
        service_document_url: mySettings.service_document_url,
        updated_at: new Date().toISOString(),
      };

      // Update each teammate's settings
      let updatedCount = 0;
      for (const user of domainUsers) {
        const { error } = await supabase
          .from('custom_settings')
          .update(sharedFields)
          .eq('user_id', user.id);
        if (!error) updatedCount++;
      }

      return NextResponse.json({
        message: `${updatedCount}人のチームメンバーに設定を共有しました`,
        updatedCount,
      }, { status: 200 });

    } else if (action === 'import' && fromUserId) {
      // Import: Copy settings from a teammate to me
      // Verify the teammate is same-domain
      const { data: teammate } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', fromUserId)
        .single();

      if (!teammate || teammate.email.split('@')[1] !== domain) {
        return NextResponse.json({ error: '同じドメインのユーザーではありません' }, { status: 400 });
      }

      const { data: theirSettings } = await supabase
        .from('custom_settings')
        .select('*')
        .eq('user_id', fromUserId)
        .single();

      if (!theirSettings) {
        return NextResponse.json({ error: 'インポート元の設定が見つかりません' }, { status: 400 });
      }

      // Copy shared fields (not personal sender info like name/title/email)
      const sharedFields = {
        sender_company: theirSettings.sender_company,
        service_name: theirSettings.service_name,
        service_description: theirSettings.service_description,
        service_benefit: theirSettings.service_benefit,
        service_price: theirSettings.service_price,
        service_results: theirSettings.service_results,
        case_studies: theirSettings.case_studies,
        tone: theirSettings.tone,
        prompt: theirSettings.prompt,
        scheduling_url: theirSettings.scheduling_url,
        service_document_url: theirSettings.service_document_url,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('custom_settings')
        .update(sharedFields)
        .eq('user_id', userId);

      if (updateError) {
        return NextResponse.json({ error: '設定のインポートに失敗しました' }, { status: 500 });
      }

      return NextResponse.json({
        message: `${teammate.email}の設定をインポートしました`,
      }, { status: 200 });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in POST /settings/share:', error);
    return NextResponse.json({ error: '設定共有に失敗しました' }, { status: 500 });
  }
}
