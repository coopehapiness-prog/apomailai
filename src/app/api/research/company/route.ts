import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-utils';
import { researchService } from '@/lib/research-service';

const ResearchCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = ResearchCompanySchema.parse(body);

    const research = await researchService.researchCompany(
      validated.companyName,
      userId
    );

    return NextResponse.json(
      {
        message: 'Company research completed',
        research,
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

    console.error('Error researching company:', error);
    return NextResponse.json(
      { error: 'Failed to research company' },
      { status: 500 }
    );
  }
}
