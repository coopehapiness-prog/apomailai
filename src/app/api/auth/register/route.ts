import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, generateToken } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  name: z.string().optional(),
  company: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validated.email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create user in Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: validated.email,
        password_hash: passwordHash,
        name: validated.name || null,
        company: validated.company || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError || !user) {
      console.error('Error creating user:', userError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create default custom_settings
    await supabase.from('custom_settings').insert({
      user_id: user.id,
      sender_name: validated.name || 'ユーザー',
      sender_title: '営業担当者',
      sender_company: validated.company || '',
      service_name: '新規サービス',
      service_description: 'お客様の課題を解決するサービスです',
      service_benefit: '業務効率化と成果向上',
      tone: 'プロフェッショナル',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Generate JWT
    const token = generateToken(user.id);

    return NextResponse.json(
      {
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
