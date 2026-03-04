import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';
import { SuccessFactor } from '@/lib/types';

function categorizeFactor(
  factor: string
): 'structure' | 'tone' | 'cta' | 'content' | 'personalization' {
  if (factor.includes('CTA')) return 'cta';
  if (factor.includes('Persona')) return 'personalization';
  if (factor.includes('層') || factor.includes('型')) return 'structure';
  return 'content';
}

export async function GET(request: NextRequest) {
  try {
    const userId = authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query emails with replies
    const { data: emails } = await supabase
      .from('generated_emails')
      .select('*')
      .eq('user_id', userId)
      .eq('reply_received', true);

    if (!emails || emails.length === 0) {
      return NextResponse.json(
        {
          message: 'No success data available yet',
          success_factors: [],
        },
        { status: 200 }
      );
    }

    // Analyze patterns from successful emails
    const factors: Record<string, number> = {};

    emails.forEach((email: any) => {
      if (email.patterns) {
        email.patterns.forEach((pattern: Record<string, unknown>) => {
          if (pattern.patternName) {
            const key = String(pattern.patternName);
            factors[key] = (factors[key] || 0) + 1;
          }
        });
      }

      if (email.persona) {
        factors[`Persona: ${email.persona}`] =
          (factors[`Persona: ${email.persona}`] || 0) + 1;
      }

      if (email.cta_type) {
        factors[`CTA: ${email.cta_type}`] =
          (factors[`CTA: ${email.cta_type}`] || 0) + 1;
      }
    });

    // Convert to success factors
    const successFactors: SuccessFactor[] = Object.entries(factors)
      .map(([factor, count]) => {
        const percentage = ((count / emails.length) * 100).toFixed(2);
        return {
          factor,
          count,
          percentage: parseFloat(percentage),
          category: categorizeFactor(factor),
        };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(
      {
        message: 'Success factors retrieved successfully',
        success_factors: successFactors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching success factors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch success factors' },
      { status: 500 }
    );
  }
}
