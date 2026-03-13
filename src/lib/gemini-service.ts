import { CompanyResearch, CustomSettings, EmailPattern } from './types';

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL || 'https://gemini-generate-fn-513563150820.asia-northeast1.run.app';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

/**
 * Stage 1: Call Cloud Run endpoint (25s timeout)
 */
async function callCloudRun(prompt: string): Promise<string> {
  const url = CLOUD_RUN_URL;
  if (!url) {
    throw new Error('CLOUD_RUN_URL is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Cloud Run returned ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as { ok?: boolean; result?: string };
    if (!json.ok || !json.result) {
      throw new Error('Cloud Run returned an error or empty result');
    }

    return json.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Stage 2: Call Gemini API directly (30s timeout)
 */
async function callGeminiDirect(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini API returned ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API returned empty content');
    }
    return text;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Call AI with retry logic: Cloud Run → Gemini Direct → retry once
 */
async function callAI(prompt: string): Promise<string> {
  const maxRetries = 2;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log(`[AI] Retry attempt ${attempt}/${maxRetries} after 2s delay...`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Stage 1: Try Cloud Run
    try {
      const result = await callAI(prompt);
      return result;
    } catch (cloudRunError) {
      lastError = `Cloud Run: ${(cloudRunError as Error).message}`;
      console.warn(`[AI] Cloud Run failed (attempt ${attempt}): ${lastError}`);
    }

    // Stage 2: Try Gemini API Direct
    try {
      const result = await callGeminiDirect(prompt);
      return result;
    } catch (geminiError) {
      lastError = `Gemini Direct: ${(geminiError as Error).message}`;
      console.warn(`[AI] Gemini Direct failed (attempt ${attempt}): ${lastError}`);
    }
  }

  throw new Error(`All AI providers failed after ${maxRetries} attempts. Last error: ${lastError}`);
}

export class GeminiService {
  async generateEmails(params: {
    companyName: string;
    research: CompanyResearch;
    settings: CustomSettings;
    persona?: string;
    sourceType?: string;
    ctaType?: string;
    newsIdx?: number;
    freeText?: string;
  }): Promise<EmailPattern[]> {
    try {
      const {
        companyName,
        research,
        settings,
        persona = 'executive',
        sourceType = 'web',
        ctaType = 'call',
        newsIdx = 0,
        freeText = '',
      } = params;

      const personaInstructions: Record<string, string> = {
        executive:
          '経営層向けのメール。ROI（投資対効果）と事業成長に焦点を当てる。数字や具体的な成果を強調する。',
        manager:
          '現場責任者向けのメール。業務効率化とプロセス改善に焦点を当てる。運用負荷軽減を強調する。',
        staff:
          '担当者向けのメール。個人の業務時間削減と作業効率化に焦点を当てる。日々の工数削減を強調する。',
      };

      const ctaInstructions: Record<string, string> = {
        call: 'CTA（行動喚起）は電話でのご相談を促す。30分の無料相談を提案する。',
        demo: 'CTA（行動喚起）は製品デモンストレーションへの参加を促す。簡単なデモ申し込みリンクを提案する。',
        meeting: 'CTA（行動喚起）はカレンダー予約ツール（Calendly等）を使用した時間設定を促す。',
        resource:
          'CTA（行動喚起）は関連リソースや資料ダウンロードを促す。価値のあるホワイトペーパーや業界レポートを提案する。',
      };

      const selectedPersonaInstructions =
        personaInstructions[persona] || personaInstructions.executive;
      const selectedCtaInstructions =
        ctaInstructions[ctaType] || ctaInstructions.call;

      const newsContext =
        research.news && research.news.length > newsIdx
          ? `参考情報：${research.news[newsIdx].title}`
          : '';

      const painPoints = research.pains?.slice(0, 3).join('、') || '';

      // Access settings with database field names (snake_case)
      const senderName = (settings as any).sender_name || settings.senderName || '';
      const senderTitle = (settings as any).sender_title || settings.senderTitle || '';
      const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '';
      const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
      const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';
      const serviceBenefit = (settings as any).service_benefit || settings.serviceInfo?.strengths?.join('、') || '';
      const tone = (settings as any).tone || settings.promptSettings?.tone || 'プロフェッショナルで親しみやすい';

      const prompt = `あなたは日本のインサイドセールス(IS)メール作成の専門家です。高度に個別化されたセールスメールを作成します。

【送信者情報】
氏名：${senderName}
職位：${senderTitle}
会社：${senderCompany}

【提供サービス】
サービス名：${serviceName}
説明：${serviceDescription}
利点：${serviceBenefit}

【会社調査情報】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
事業段階：${(research as any).stage || '不明'}
従業員数：${(research as any).employees || (research as any).employeeCount || '不明'}
事業内容：${(research as any).business || (research as any).businessDescription || ''}
概要：${(research as any).overview || ''}
主な課題：${painPoints}
${newsContext ? `最新情報：${newsContext}` : ''}

【ペルソナ指定】
${selectedPersonaInstructions}

【CTA指定】
${selectedCtaInstructions}

【メール作成のトーン】
${tone}

【追加カスタマイズ】
${freeText || 'なし'}

以下の5つのメールパターンを日本語で作成してください：

1. Pattern A - 経営層向け（ROI訴求）：CEOやCFO向け。投資対効果と事業成長を前面に。業績向上への具体的な貢献を示す。
2. Pattern B - 現場責任者向け（効率化訴求）：部門長向け。業務効率化とプロセス改善を前面に。チームの生産性向上を示す。
3. Pattern C - 担当者向け（時短訴求）：実務者向け。個人の時間削減と作業効率化を前面に。日々の工数削減を示す。
4. Pattern D - 短文ストレート型：簡潔で直接的。20-30秒で読める長さ。要点のみ。
5. Pattern E - 社内転送特化型：受信者が上司に転送しやすい形式。「このサービス、うちでも使えそうですね」と言いやすい表現。

各パターンについて、以下の形式で出力してください：
[PATTERN_A]
件名：＿＿＿＿＿＿＿＿＿
本文：＿＿＿＿＿＿＿＿＿

[PATTERN_B]
件名：＿＿＿＿＿＿＿＿＿
本文：＿＿＿＿＿＿＿＿＿

[PATTERN_C]
件名：＿＿＿＿＿＿＿＿＿
本文：＿＿＿＿＿＿＿＿＿

[PATTERN_D]
件名：＿＿＿＿＿＿＿＿＿
本文：＿＿＿＿＿＿＿＿＿

[PATTERN_E]
件名：＿＿＿＿＿＿＿＿＿
本文：＿＿＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);
      return this.parseEmailPatterns(responseText);
    } catch (error) {
      console.error('Error generating emails:', error);
      return this.getFallbackEmailPatterns();
    }
  }

  async generateSubOutputs(
    companyName: string,
    research: CompanyResearch,
    settings: CustomSettings
  ): Promise<{
    phone_script?: string;
    video_prompt?: string;
    follow_up_scenarios?: string[];
  }> {
    try {
      const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
      const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';

      const pains = (research as any).pains || research.painPoints || [];
      const painsText = pains.slice(0, 4).join('\n・') || '不明';
      const overview = (research as any).overview || '';
      const business = (research as any).business || '';
      const news = ((research as any).news || []).slice(0, 3).map((n: any) => n.title || n.summary || '').filter(Boolean).join('\n・');

      const prompt = `あなたはインサイドセールス(IS)の総合サポートアシスタントです。

【ターゲット企業情報】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
企業概要：${overview.substring(0, 300)}
事業内容：${business.substring(0, 300)}
推定される経営課題：
・${painsText}
${news ? `最近のニュース：\n・${news}` : ''}

【弊社サービス情報】
サービス名：${serviceName}
説明：${serviceDescription}

以下の3つのコンテンツを作成してください：

■ 1. 電話スクリプト
メール開封後の電話対応用。30秒で相手の関心を引くスクリプト。

■ 2. 追撃メール（3日後）
初回メール送付から3日後、返信がない場合のフォローメール。
- 件名と本文を含む完全なメール文面
- 初回メールの内容を軽く振り返りつつ、別角度の価値提案をする
- 短くシンプルに（150文字以内の本文）

■ 3. 追撃メール（1週間後）
初回メール送付から1週間後、まだ返信がない場合のフォローメール。
- 件名と本文を含む完全なメール文面
- ${companyName}の最近の動向やニュースに触れ、タイムリーな切り口で再アプローチ
- 新しい事例や具体的なデータを提示して関心を引く

■ 4. 掘り起こしメール（1ヶ月後）
リード流入から1ヶ月経過し、商談設定に至らなかった見込み客への再アプローチメール。
以下の要件を満たすこと：
- 件名と本文を含む完全なメール文面
- ${companyName}のことをしっかり調べた上で、推定される経営課題（上記の課題リスト参照）に具体的に言及する
- その課題に対して「${serviceName}」がどう貢献できるかを明確にアピールする
- 1ヶ月前のコンタクトを自然に振り返りつつ、押し売り感を出さない
- 「改めてお役に立てることがあるのではと思いご連絡しました」というスタンス
- 具体的な成果数値や事例があれば盛り込む
- 300〜400文字程度の本文

以下の形式で出力（各セクションの区切りを厳守）：
[PHONE_SCRIPT]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_1]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_2]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_3]
＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);

      const phoneScriptMatch = responseText.match(/\[PHONE_SCRIPT\]([\s\S]*?)(?=\[FOLLOWUP|$)/);
      const followupMatches = responseText.match(/\[FOLLOWUP_SCENARIO_\d\]([\s\S]*?)(?=\[FOLLOWUP_SCENARIO_\d\]|\[|$)/g);

      return {
        phone_script: phoneScriptMatch ? phoneScriptMatch[1].trim() : undefined,
        follow_up_scenarios: followupMatches
          ? followupMatches.map((m) => m.replace(/\[FOLLOWUP_SCENARIO_\d\]/, '').trim())
          : undefined,
      };
    } catch (error) {
      console.error('Error generating sub outputs:', error);
      return {
        phone_script: 'エラーが発生しました',
        follow_up_scenarios: [],
      };
    }
  }

  async analyzeResearch(
    companyName: string,
    scrapedContent: string,
    newsArticles: string[]
  ): Promise<CompanyResearch> {
    try {
      const newsContext = newsArticles.slice(0, 5).join('\n');

      const prompt = `以下の企業に関する情報を分析してください：

企業名：${companyName}

【スクレイプ内容】
${scrapedContent.substring(0, 5000)}

【ニュース記事】
${newsContext}

以下の情報を抽出して、JSON形式で出力してください：
{
  "company_name": "企業名",
  "overview": "企業の概要説明（2-3文）",
  "business": "主要な事業内容",
  "industry": "業界名",
  "stage": "事業段階（スタートアップ/成長期/成熟期など）",
  "employees": "従業員数（数値のみ、不明な場合はnull）",
  "news": [{"title": "ニュースタイトル", "summary": "要約"}],
  "pains": ["課題1", "課題2", "課題3"],
  "hypothesis": "このサービスが役に立つと思われる仮説（1文）"
}`;

      const responseText = await callAI(prompt);

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          company_name: parsed.company_name || companyName,
          overview: parsed.overview,
          business: parsed.business,
          industry: parsed.industry,
          stage: parsed.stage,
          employees: parsed.employees,
          news: parsed.news || [],
          pains: parsed.pains || [],
          hypothesis: parsed.hypothesis,
          scraped_at: new Date().toISOString(),
        };
      }

      return {
        company_name: companyName,
        news: [],
        pains: [],
        scraped_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error analyzing research:', error);
      return {
        company_name: companyName,
        news: [],
        pains: [],
        scraped_at: new Date().toISOString(),
      };
    }
  }

  private parseEmailPatterns(responseText: string): EmailPattern[] {
    const patterns: EmailPattern[] = [];

    const patternNames = [
      { key: 'PATTERN_A', name: '経営層向け（ROI訴求）' },
      { key: 'PATTERN_B', name: '現場責任者向け（効率化訴求）' },
      { key: 'PATTERN_C', name: '担当者向け（時短訴求）' },
      { key: 'PATTERN_D', name: '短文ストレート型' },
      { key: 'PATTERN_E', name: '社内転送特化型' },
    ];

    for (const { key, name } of patternNames) {
      const patternRegex = new RegExp(`\\[${key}\\]([\\s\\S]*?)(?=\\[PATTERN_|$)`, 'i');
      const match = responseText.match(patternRegex);

      if (match) {
        const content = match[1].trim();
        const subjectMatch = content.match(/件名[：:]\s*(.+?)(?:\n|$)/);
        const bodyMatch = content.match(/本文[：:]\s*([\s\S]+?)$/);

        if (subjectMatch && bodyMatch) {
          patterns.push({
            patternName: name,
            subject: subjectMatch[1].trim(),
            body: bodyMatch[1].trim(),
            targetPersona: name,
            description: name,
          });
        }
      }
    }

    if (patterns.length === 0) {
      return this.getFallbackEmailPatterns();
    }

    return patterns.length >= 5 ? patterns.slice(0, 5) : patterns;
  }

  private getFallbackEmailPatterns(): EmailPattern[] {
    return [
      {
        patternName: '経営層向け（ROI訴求）',
        subject: '貴社の業績向上について - 実績ベースのご提案',
        body: 'いつもお世話になっております。\n\n事業成長に向けた具体的なソリューションについてご案内させていただきたく、ご連絡いたしました。\n\n多くの業界企業様で導入実績がある当サービスは、業務効率化を通じた売上拡大に貢献いたします。\n\nぜひ一度、30分程度のお時間をいただき、詳しくご説明させていただきたいのですが、いかがでしょうか。\n\nよろしくお願いいたします。',
        targetPersona: 'executive',
      },
      {
        patternName: '現場責任者向け（効率化訴求）',
        subject: 'チーム生産性向上のための新しいアプローチ',
        body: 'いつもお疲れ様です。\n\nチームの業務効率化について、新しいソリューションをご紹介したいとご連絡いたしました。\n\n当サービスは、現場責任者様のチーム運用を大幅に効率化し、より戦略的な業務に時間を割くことができるようになります。\n\n短時間のデモンストレーションで、具体的な効果をお示しできます。\n\nご検討ください。',
        targetPersona: 'manager',
      },
      {
        patternName: '担当者向け（時短訴求）',
        subject: '日々の業務を1時間短縮する方法',
        body: 'お疲れ様です。\n\n毎日の業務を効率化するツールをご紹介いたします。\n\n当サービスを導入いただくと、日々の定型業務を自動化でき、1日あたり1時間程度の時間短縮が可能です。\n\nその時間を、より価値のある業務に充てることができます。\n\n簡単なデモを体験いただけます。いかがでしょうか？',
        targetPersona: 'staff',
      },
      {
        patternName: '短文ストレート型',
        subject: '新サービスのご紹介',
        body: 'お疲れ様です。\n\n業務効率化の新しいツールをご紹介させていただきたく、ご連絡いたしました。\n\n無料でお試しいただけますので、ぜひご検討ください。\n\nよろしくお願いいたします。',
        targetPersona: 'general',
      },
      {
        patternName: '社内転送特化型',
        subject: 'この新しいツール、ウチでも活用できそうですね',
        body: '各位\n\n業務を効率化するための新しいサービスをご紹介いただきました。\n\n当社の課題を直接解決できそうなソリューションです。\n\n詳細は以下よりご確認いただけます。ご検討のほど、よろしくお願いいたします。',
        targetPersona: 'general',
      },
    ];
  }
}

export const geminiService = new GeminiService();
