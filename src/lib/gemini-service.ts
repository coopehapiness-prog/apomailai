import { CompanyResearch, CustomSettings, EmailPattern } from './types';

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL || 'https://gemini-generate-fn-513563150820.asia-northeast1.run.app';
const CLOUD_RUN_API_KEY = process.env.CLOUD_RUN_API_KEY || '';
const CLOUD_RUN_USER_EMAIL = process.env.CLOUD_RUN_USER_EMAIL || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ============================================================
// Stage 1: Cloud Run (primary)
// Per spec: POST <CLOUD_RUN_URL>/generate with x-api-key header
// ============================================================
async function callCloudRun(prompt: string): Promise<string> {
  const baseUrl = CLOUD_RUN_URL;
  if (!baseUrl) {
    throw new Error('CLOUD_RUN_URL is not configured');
  }

  // Ensure /generate path is appended (per API spec)
  const url = baseUrl.endsWith('/generate') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    // Build headers per spec: Content-Type + x-api-key (if set) + x-user-email (if set)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (CLOUD_RUN_API_KEY) {
      headers['x-api-key'] = CLOUD_RUN_API_KEY;
    }
    if (CLOUD_RUN_USER_EMAIL) {
      headers['x-user-email'] = CLOUD_RUN_USER_EMAIL;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Cloud Run returned ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as { ok?: boolean; result?: string };

    if (!json.ok || !json.result) {
      throw new Error('Cloud Run returned an error or empty result');
    }

    return json.result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Stage 2: Gemini API Direct (Google AI Studio free tier)
// ============================================================
async function callGeminiDirect(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Gemini API returned ${response.status}: ${errorBody}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini API returned empty response');
    }

    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Unified AI caller: Cloud Run → Gemini Direct
// ============================================================
async function callAI(prompt: string): Promise<string> {
  // Stage 1: Try Cloud Run
  try {
    console.log('[AI] Trying Cloud Run...');
    const result = await callCloudRun(prompt);
    console.log('[AI] Cloud Run succeeded');
    return result;
  } catch (cloudRunError) {
    console.warn('[AI] Cloud Run failed:', (cloudRunError as Error).message);
  }

  // Stage 2: Try Gemini API Direct
  try {
    console.log('[AI] Trying Gemini API Direct...');
    const result = await callGeminiDirect(prompt);
    console.log('[AI] Gemini API Direct succeeded');
    return result;
  } catch (geminiError) {
    console.warn('[AI] Gemini API Direct failed:', (geminiError as Error).message);
  }

  // Both failed
  throw new Error('All AI providers failed (Cloud Run + Gemini API Direct)');
}

// ============================================================
// Stage 3: Smart Template Engine
// ============================================================
function getSmartEmailPatterns(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): EmailPattern[] {
  research = research || ({} as CompanyResearch);
  settings = settings || ({} as CustomSettings);
  const senderName = (settings as any).sender_name || settings.senderName || 'ご担当';
  const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '弊社';
  const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '当サービス';
  const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';
  const serviceBenefit = (settings as any).service_benefit || settings.serviceInfo?.strengths?.join('、') || '';
  const industry = (research as any).industry || '';
  const painPoints = research.pains?.slice(0, 3) || [];
  const pain1 = painPoints[0] || '業務プロセスの改善';
  const pain2 = painPoints[1] || '組織の生産性向上';
  const pain3 = painPoints[2] || 'コスト最適化';
  const overview = (research as any).overview || '';
  const business = (research as any).business || '';

  const industryMention = industry ? `${industry}業界において` : '';
  const companyContext = overview
    ? `${companyName}様の${overview.substring(0, 50)}に関連して`
    : `${companyName}様の事業に関連して`;
  const serviceIntro = serviceName !== '当サービス' ? `「${serviceName}」` : '弊社サービス';
  const benefitLine = serviceBenefit
    ? `${serviceIntro}は${serviceBenefit}を実現します。`
    : `${serviceIntro}は多くの企業様で業務改善の実績がございます。`;

  return [
    {
      patternName: '経営層向け（ROI訴求）',
      subject: `${companyName}様の${pain1}に関するご提案`,
      body: `${companyName}\nご担当者様\n\nいつもお世話になっております。${senderCompany}の${senderName}です。\n\n${industryMention}${companyContext}、ご連絡いたしました。\n\n${companyName}様におかれましては「${pain1}」が重要な経営テーマではないかと考えております。${benefitLine}\n\n導入企業様では平均して20〜30%の業務効率改善を実現されており、貴社でも同様の成果が期待できると考えております。\n\nぜひ一度、30分程度のお時間をいただき、具体的な事例と貴社への適用イメージをご説明させていただければ幸いです。\n\nご都合のよろしい日時をご教示いただけますでしょうか。\n\nよろしくお願いいたします。`,
      targetPersona: 'executive',
      description: '経営層向け（ROI訴求）',
    },
    {
      patternName: '現場責任者向け（効率化訴求）',
      subject: `${pain2}を実現する新しいアプローチのご紹介`,
      body: `${companyName}\nご担当者様\n\nお疲れ様です。${senderCompany}の${senderName}です。\n\n${companyName}様の${industry ? industry + '事業' : '事業'}において、「${pain2}」は現場レベルでも課題になっているのではないでしょうか。\n\n${serviceIntro}は、現場のオペレーションを効率化し、チーム全体の生産性を大幅に向上させるソリューションです。${serviceDescription ? '\n\n' + serviceDescription : ''}\n\n既存の業務フローを大きく変えることなく導入いただけるため、現場への負担を最小限に抑えられます。\n\n15分程度の簡単なデモンストレーションで、具体的な効果をお示しできます。ご興味がございましたらお気軽にお声がけください。\n\nよろしくお願いいたします。`,
      targetPersona: 'manager',
      description: '現場責任者向け（効率化訴求）',
    },
    {
      patternName: '担当者向け（時短訴求）',
      subject: `日々の${pain3.includes('コスト') ? '業務工数' : pain3}を大幅に削減する方法`,
      body: `${companyName}\nご担当者様\n\nお疲れ様です。${senderCompany}の${senderName}です。\n\n日々の業務の中で、繰り返しの作業や手動のプロセスに時間を取られていませんか？\n\n${serviceIntro}を導入いただくと、定型業務の自動化により1日あたり約1時間の時間短縮が可能です。\n\nその分の時間を、より付加価値の高い業務に充てることができます。${serviceBenefit ? `\n\n具体的には${serviceBenefit}が可能です。` : ''}\n\n無料トライアルもご用意しておりますので、まずはお試しいただければと思います。\n\nいかがでしょうか？`,
      targetPersona: 'staff',
      description: '担当者向け（時短訴求）',
    },
    {
      patternName: '短文ストレート型',
      subject: `${companyName}様へ｜${serviceIntro}のご紹介`,
      body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\n${companyName}様の「${pain1}」に貢献できるサービスをご紹介させてください。\n\n${benefitLine}\n\n30分のオンライン面談で、貴社への具体的なメリットをお伝えできます。\n\nご検討いただけますと幸いです。`,
      targetPersona: 'general',
      description: '短文ストレート型',
    },
  ];
}

function getSmartSubOutputs(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): { phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] } {
  research = research || ({} as CompanyResearch);
  settings = settings || ({} as CustomSettings);
  const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '当サービス';
  const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '弊社';
  const industry = (research as any).industry || '';
  const pain1 = research.pains?.[0] || '業務改善';

  return {
    phone_script: `お忙しいところ恐れ入ります。${senderCompany}の○○と申します。先日お送りしたメールの件でお電話いたしました。${companyName}様の${pain1}について、${industry ? industry + '業界の' : ''}他社様の導入事例をもとに、具体的なご提案ができればと思っております。3分ほどお時間よろしいでしょうか？`,
    video_prompt: `${industry ? industry + '業界で活躍する' : ''}${companyName}のオフィスをイメージした背景。テキストオーバーレイで「${pain1}を解決」と表示。${serviceName}のダッシュボード画面を映し、効率化のビフォーアフターを視覚的に表現。最後に「30分の無料相談」のCTAを表示。30秒、プロフェッショナルなトーン。`,
    follow_up_scenarios: [
      `【3日後・未返信時】件名：「先日のご提案の補足資料をお送りします」\n${companyName}様の${pain1}に関して、${industry ? industry + '業界の' : ''}導入事例資料をお送りします。ご参考になれば幸いです。`,
      `【1週間後・未返信時】件名：「${companyName}様向けの無料診断のご案内」\n無料で業務効率診断を実施しております。現状の課題を可視化し、改善ポイントをレポートとしてお渡しします。`,
      `【返信あり・関心あり】件名：「ご返信ありがとうございます｜日程調整のご相談」\nご関心をいただきありがとうございます。具体的なデモと事例紹介を30分でご説明させてください。以下の日程でご都合はいかがでしょうか。`,
    ],
  };
}

// ============================================================
// GeminiService class
// ============================================================
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
    const {
      companyName,
      research: rawResearch,
      settings: rawSettings,
      persona = 'executive',
      sourceType = 'web',
      ctaType = 'call',
      newsIdx = 0,
      freeText = '',
    } = params;
    const research = rawResearch || ({} as CompanyResearch);
    const settings = rawSettings || ({} as CustomSettings);

    try {
      const personaInstructions: Record<string, string> = {
        executive: '経営層向けのメール。ROI（投資対効果）と事業成長に焦点を当てる。数字や具体的な成果を強調する。',
        manager: '現場責任者向けのメール。業務効率化とプロセス改善に焦点を当てる。運用負荷軽減を強調する。',
        staff: '担当者向けのメール。個人の業務時間削減と作業効率化に焦点を当てる。日々の工数削減を強調する。',
      };

      const ctaInstructions: Record<string, string> = {
        call: 'CTA（行動喚起）は電話でのご相談を促す。30分の無料相談を提案する。',
        demo: 'CTA（行動喚起）は製品デモンストレーションへの参加を促す。簡単なデモ申し込みリンクを提案する。',
        meeting: 'CTA（行動喚起）はカレンダー予約ツール（Calendly等）を使用した時間設定を促す。',
        resource: 'CTA（行動喚起）は関連リソースや資料ダウンロードを促す。価値のあるホワイトペーパーや業界レポートを提案する。',
      };

      const selectedPersonaInstructions = personaInstructions[persona] || personaInstructions.executive;
      const selectedCtaInstructions = ctaInstructions[ctaType] || ctaInstructions.call;
      const newsContext = research.news && research.news.length > newsIdx
        ? `参考情報：${research.news[newsIdx].title}`
        : '';
      const painPoints = research.pains?.slice(0, 3).join('、') || '';

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

【送信先企業の調査情報】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
事業段階：${(research as any).stage || '不明'}
従業員数：${(research as any).employees || (research as any).employeeCount || '不明'}
事業内容：${(research as any).business || (research as any).businessDescription || ''}
概要：${(research as any).overview || ''}
${companyName}が直面する経営・業務課題（※顧客の課題ではなく、${companyName}自体の課題）：${painPoints}
${newsContext ? `最新情報：${newsContext}` : ''}

【ペルソナ指定】
${selectedPersonaInstructions}

【CTA指定】
${selectedCtaInstructions}

【メール作成のトーン】
${tone}

【追加カスタマイズ】
${freeText || 'なし'}

以下の4つのメールパターンを日本語で作成してください：
1. Pattern A - 経営層向け（ROI訴求）：CEOやCFO向け。投資対効果と事業成長を前面に。業績向上への具体的な貢献を示す。
2. Pattern B - 現場責任者向け（効率化訴求）：部門長向け。業務効率化とプロセス改善を前面に。チームの生産性向上を示す。
3. Pattern C - 担当者向け（時短訴求）：実務者向け。個人の時間削減と作業効率化を前面に。日々の工数削減を示す。
4. Pattern D - 短文ストレート型：簡潔で直接的。20-30秒で読める長さ。要点のみ。

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
本文：＿＿＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);
      return this.parseEmailPatterns(responseText, companyName, research, settings);
    } catch (error) {
      console.warn('[AI] All providers failed, using smart templates:', (error as Error).message);
      return getSmartEmailPatterns(companyName, research, settings);
    }
  }

  async generateSubOutputs(params: {
    companyName: string;
    research: CompanyResearch;
    settings: CustomSettings;
    selectedPattern?: string;
  }): Promise<{ phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] }> {
    const { companyName, research: rawResearch, settings: rawSettings, selectedPattern } = params;
    const research = rawResearch || ({} as CompanyResearch);
    const settings = rawSettings || ({} as CustomSettings);

    try {
      const senderName = (settings as any).sender_name || settings.senderName || '';
      const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '';
      const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
      const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';
      const industry = (research as any).industry || '';
      const painPoints = research.pains?.slice(0, 3).join('、') || '';

      const prompt = `あなたは日本のセールスメール作成とフォローアップの専門家です。

【送信者情報】
氏名：${senderName}
会社：${senderCompany}

【送信先企業】
会社名：${companyName}
業界：${industry}
課題：${painPoints}

【サービス情報】
サービス名：${serviceName}
説明：${serviceDescription}

【選択されたパターン】
${selectedPattern || 'Pattern A'}

以下の3つの補助出力を日本語で作成してください：

1. **電話スクリプト**：メール送信後の電話フォローアップ用のスクリプト。30-50秒で話せる内容。自然で、相手に圧迫感を与えない。

2. **動画スクリプト**：LinkedIn動画やYouTube短編用のビジュアル・ナレーション指示。30秒程度。${companyName}と${serviceName}に特化した内容。

3. **フォローアップシナリオ**：メール未返信時のフォローアップメール（3日後、1週間後）と、返信来訪時のメール。各シナリオについて、件名と簡潔な本文を提供。

以下の形式で出力してください：
[PHONE_SCRIPT]
＿＿＿＿＿＿＿＿＿

[VIDEO_PROMPT]
＿＿＿＿＿＿＿＿＿

[FOLLOW_UP_SCENARIOS]
＿＿＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);
      return this.parseSubOutputs(responseText);
    } catch (error) {
      console.warn('[AI] Sub-outputs generation failed, using smart templates:', (error as Error).message);
      return getSmartSubOutputs(companyName, research, settings);
    }
  }

  async analyzeResearch(params: {
    companyName: string;
    research: CompanyResearch;
  }): Promise<{ summary: string; keyInsights: string[] }> {
    const { companyName, research: rawResearch } = params;
    const research = rawResearch || ({} as CompanyResearch);

    try {
      const industry = (research as any).industry || '';
      const painPoints = research.pains?.slice(0, 3) || [];
      const employees = (research as any).employees || (research as any).employeeCount || '';
      const business = (research as any).business || '';
      const news = research.news?.slice(0, 3).map((n) => n.title).join('、') || '';

      const prompt = `${companyName}について、以下の情報が与えられています。

【基本情報】
業界：${industry}
従業員数：${employees}
事業内容：${business}

【課題】
${painPoints.join('\n')}

【最新ニュース】
${news}

この企業について、インサイドセールスの観点から3-4つのキーインサイトを生成してください。各インサイトは1-2文で、アクショナブルで具体的である必要があります。

形式：
[KEY_INSIGHT_1]
＿＿＿＿＿＿＿＿＿

[KEY_INSIGHT_2]
＿＿＿＿＿＿＿＿＿

[KEY_INSIGHT_3]
＿＿＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);
      const insights = this.parseKeyInsights(responseText);

      return {
        summary: `${companyName}は${industry}業界で展開する企業です。${painPoints[0]}などが主要な課題となっており、今後の事業成長に向けて解決が急務と考えられます。`,
        keyInsights: insights,
      };
    } catch (error) {
      console.warn('[AI] Research analysis failed:', (error as Error).message);
      return {
        summary: `${companyName}について詳しい分析ができませんでした。`,
        keyInsights: [],
      };
    }
  }

  private parseEmailPatterns(
    responseText: string,
    companyName: string,
    research: CompanyResearch,
    settings: CustomSettings
  ): EmailPattern[] {
    const patternNames = [
      { key: 'PATTERN_A', name: '経営層向け（ROI訴求）' },
      { key: 'PATTERN_B', name: '現場責任者向け（効率化訴求）' },
      { key: 'PATTERN_C', name: '担当者向け（時短訴求）' },
      { key: 'PATTERN_D', name: '短文ストレート型' },
    ];

    const extractPattern = (text: string, patternKey: string): { subject: string; body: string } => {
      const regex = new RegExp(`\\[${patternKey}\\](.*?)(?=\\[|$)`, 's');
      const match = text.match(regex);
      if (!match) return { subject: '', body: '' };

      const content = match[1];
      const subjectMatch = content.match(/件名：\s*(.+?)(?:\n|本文)/);
      const bodyMatch = content.match(/本文：\s*([\s\S]+?)$/);

      return {
        subject: subjectMatch ? subjectMatch[1].trim() : '',
        body: bodyMatch ? bodyMatch[1].trim() : '',
      };
    };

    const patterns = patternNames.map((pattern) => {
      const extracted = extractPattern(responseText, pattern.key);
      return {
        patternName: pattern.name,
        subject: extracted.subject || `${companyName}様へのご提案`,
        body: extracted.body || 'ボディ取得に失敗しました',
        targetPersona: pattern.key.toLowerCase().replace('pattern_', ''),
        description: pattern.name,
      };
    });

    return patterns.length >= 4 ? patterns.slice(0, 4) : patterns;
  }

  private parseSubOutputs(responseText: string): {
    phone_script?: string;
    video_prompt?: string;
    follow_up_scenarios?: string[];
  } {
    const phoneMatch = responseText.match(/\[PHONE_SCRIPT\](.*?)(?=\[|$)/s);
    const videoMatch = responseText.match(/\[VIDEO_PROMPT\](.*?)(?=\[|$)/s);
    const followUpMatch = responseText.match(/\[FOLLOW_UP_SCENARIOS\](.*?)$/s);

    const phoneScript = phoneMatch ? phoneMatch[1].trim() : undefined;
    const videoPrompt = videoMatch ? videoMatch[1].trim() : undefined;

    let followUpScenarios: string[] = [];
    if (followUpMatch) {
      const scenarios = followUpMatch[1]
        .split(/\n(?=【|\d\.)/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      followUpScenarios = scenarios;
    }

    return {
      phone_script: phoneScript,
      video_prompt: videoPrompt,
      follow_up_scenarios: followUpScenarios.length > 0 ? followUpScenarios : undefined,
    };
  }

  private parseKeyInsights(responseText: string): string[] {
    const insights: string[] = [];
    const insightRegex = /\[KEY_INSIGHT_\d+\]\s*([\s\S]*?)(?=\[KEY_INSIGHT_\d+\]|$)/g;
    let match;

    while ((match = insightRegex.exec(responseText)) !== null) {
      const insight = match[1].trim();
      if (insight.length > 0) {
        insights.push(insight);
      }
    }

    return insights;
  }

  private getLegacyFallbackPatterns(
    companyName: string,
    research: CompanyResearch,
    settings: CustomSettings
  ): EmailPattern[] {
    research = research || ({} as CompanyResearch);
    settings = settings || ({} as CustomSettings);
    const senderName = (settings as any).sender_name || settings.senderName || 'ご担当';
    const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '弊社';
    const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '当サービス';
    const industry = (research as any).industry || '';
    const painPoints = research.pains?.slice(0, 3) || [];
    const pain1 = painPoints[0] || '業務改善';
    const pain2 = painPoints[1] || '効率化';
    const pain3 = painPoints[2] || 'コスト削減';

    return [
      {
        patternName: '経営層向け（ROI訴求）',
        subject: `${companyName}様の経営課題に関するご提案`,
        body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\n${companyName}様の${pain1}について、具体的なご提案がございます。\n\n${serviceName}は、多くの企業様で20-30%の効率改善を実現しています。\n\n30分のご面談で、貴社への適用イメージをご説明させていただけます。\n\nご検討ください。`,
        targetPersona: 'executive',
        description: '経営層向け（ROI訴求）',
      },
      {
        patternName: '現場責任者向け（効率化訴求）',
        subject: `${pain2}を実現するソリューションのご紹介`,
        body: `${companyName}\nご担当者様\n\nお疲れ様です。${senderCompany}の${senderName}です。\n\n${companyName}様の現場で「${pain2}」が重要テーマになっているのではないでしょうか。\n\n${serviceName}は、プロセス改善を通じて、チーム全体の生産性を向上させます。\n\nデモンストレーションをご希望でしたら、お気軽にお声がけください。`,
        targetPersona: 'manager',
        description: '現場責任者向け（効率化訴求）',
      },
      {
        patternName: '担当者向け（時短訴求）',
        subject: `日々の業務負担を軽減する方法`,
        body: `${companyName}\nご担当者様\n\nお疲れ様です。${senderCompany}の${senderName}です。\n\n手動業務に時間を取られていませんか？\n\n${serviceName}は、定型業務の自動化により、1日あたり約1時間の削減が可能です。\n\n無料トライアルのご案内もございます。`,
        targetPersona: 'staff',
        description: '担当者向け（時短訴求）',
      },
      {
        patternName: '短文ストレート型',
        subject: `${serviceName}のご紹介`,
        body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\n${companyName}様の「${pain1}」に貢献するサービスをご紹介します。\n\n30分の面談で、具体的なメリットをお伝え可能です。\n\nご検討をお願いいたします。`,
        targetPersona: 'general',
        description: '短文ストレート型',
      },
    ];
  }
}

export const geminiService = new GeminiService();
