import { CompanyResearch, CustomSettings, EmailPattern } from './types';

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL || 'https://gemini-generate-fn-513563150820.asia-northeast1.run.app';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ============================================================
// Stage 1: Cloud Run (primary)
// ============================================================
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

  // Both failed - throw to let caller handle Stage 3 (smart templates)
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

  // Build context-aware snippets
  const industryMention = industry ? `${industry}業界において` : '';
  const companyContext = overview
    ? `${companyName}様の${overview.substring(0, 50)}に関連して`
    : `${companyName}様の事業に関連して`;
  const serviceIntro = serviceName !== '当サービス'
    ? `「${serviceName}」`
    : '弊社サービス';
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
    {
      patternName: '社内転送特化型',
      subject: `【ご参考】${pain1}に役立ちそうなサービスを見つけました`,
      body: `各位\n\n${industryMention}注目されている${serviceIntro}についてご共有します。\n\n■ 特徴\n${benefitLine}\n\n■ 当社との関連\n${companyName}で課題となっている「${pain1}」「${pain2}」の改善に活用できそうです。\n\n■ 次のステップ\n30分の無料相談が可能とのことです。ご興味がありましたら、返信にてお知らせください。\n\n取り急ぎ、情報共有まで。`,
      targetPersona: 'general',
      description: '社内転送特化型',
    },
  ];
}

function getSmartSubOutputs(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): { phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] } {
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
      research,
      settings,
      persona = 'executive',
      sourceType = 'web',
      ctaType = 'call',
      newsIdx = 0,
      freeText = '',
    } = params;

    try {
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

      // Stage 1 & 2: Try AI providers
      const responseText = await callAI(prompt);
      return this.parseEmailPatterns(responseText, companyName, research, settings);
    } catch (error) {
      // Stage 3: Smart template fallback
      console.warn('[AI] All providers failed, using smart templates:', (error as Error).message);
      return getSmartEmailPatterns(companyName, research, settings);
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

      const prompt = `あなたはインサイドセールス(IS)の総合サポートアシスタントです。

【会社情報】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
課題：${(research as any).pains?.slice(0, 2).join('、') || research.painPoints?.slice(0, 2).join('、') || ''}

【サービス情報】
サービス名：${serviceName}
説明：${serviceDescription}

以下の3つのコンテンツを作成してください：

1. 電話スクリプト：メール開封後の電話対応用。30秒で相手の関心を引く。
2. ビデオプロンプト：Sora等の動画生成AIで使用。パーソナライズされた30秒動画のプロンプト。
3. フォローアップシナリオ：返信なし時、返信あり時のフォローアップメール方針（3パターン）。

以下の形式で出力：
[PHONE_SCRIPT]
＿＿＿＿＿＿＿

[VIDEO_PROMPT]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_1]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_2]
＿＿＿＿＿＿＿

[FOLLOWUP_SCENARIO_3]
＿＿＿＿＿＿＿`;

      const responseText = await callAI(prompt);

      const phoneScriptMatch = responseText.match(/\[PHONE_SCRIPT\]([\s\S]*?)(?=\[|$)/);
      const videoPromptMatch = responseText.match(/\[VIDEO_PROMPT\]([\s\S]*?)(?=\[|$)/);
      const followupMatches = responseText.match(/\[FOLLOWUP_SCENARIO_\d\]([\s\S]*?)(?=\[|$)/g);

      return {
        phone_script: phoneScriptMatch ? phoneScriptMatch[1].trim() : undefined,
        video_prompt: videoPromptMatch ? videoPromptMatch[1].trim() : undefined,
        follow_up_scenarios: followupMatches
          ? followupMatches.map((m) => m.replace(/\[FOLLOWUP_SCENARIO_\d\]/, '').trim())
          : undefined,
      };
    } catch (error) {
      // Stage 3: Smart sub-output fallback
      console.warn('[AI] Sub-output generation failed, using smart templates:', (error as Error).message);
      return getSmartSubOutputs(companyName, research, settings);
    }
  }

  async analyzeResearch(
    companyName: string,
    scrapedContent: string,
    newsArticles: string[],
    searchUrls?: Array<{ title: string; url: string }>
  ): Promise<CompanyResearch> {
    try {
      const newsContext = newsArticles.slice(0, 10).join('\n');
      const urlContext = searchUrls
        ? searchUrls.map((u) => `${u.title}: ${u.url}`).join('\n')
        : '';

      const prompt = `あなたはインサイドセールス（IS）のリサーチアナリストです。以下の企業について営業アプローチのための調査分析を行ってください。

企業名：${companyName}

【スクレイプ内容】
${scrapedContent.substring(0, 5000)}

【ニュース記事】
${newsContext}

${urlContext ? `【検索結果URL】\n${urlContext}` : ''}

以下の情報を抽出して、JSON形式で出力してください。

■ URL出力に関する重要ルール：
1. homepage_url: 企業の公式HP（コーポレートサイト）のURLを必ず出力してください。検索結果URLから企業HPを特定するか、「https://www.{企業ドメイン}.co.jp」等の一般的なURLパターンから推測してください。
2. business_url: 企業の事業・サービス・製品紹介ページのURLを必ず出力してください。検索結果URLから「/services」「/products」「/business」「/solutions」等のページを探してください。見つからない場合はhomepage_urlと同じURLを入れてください。
3. ニュース(news)の各項目にはurlを必ず含めてください。検索結果URLからニュース記事のURLを特定してください。

■ ニュース出力に関する重要ルール：
- newsは【必ず5件以上】出力してください。これは絶対条件です。
- 各ニュースにはtitle, summary, url, dateの4項目を含めてください。
- 検索結果からニュースを5件以上抽出できない場合は、企業の業界動向、プレスリリース、IR情報、採用情報なども含めて5件以上にしてください。
- 各ニュースのurlには実際の記事URLを入れてください。URLが不明な場合はhomepage_urlのnewsページやpress等のURLを推測して入れてください。

■ 重要な注意事項：「pains」について
「pains」には【${companyName}自体が直面していると推測される経営課題・業務課題】を記載してください。
${companyName}が提供するサービスの顧客の課題ではありません。
${companyName}という企業組織が、日々の事業運営において抱えているであろう課題です。

例えば:
- 「人材採用・定着の課題」「DX推進の遅れ」「レガシーシステムの刷新」「営業効率の改善」「海外展開の障壁」など
- その企業の業界・規模・事業段階に応じた具体的な課題を推測してください
- 一般的すぎる課題（「業務効率化」など）は避け、その企業の状況に合った具体的な課題を挙げてください

{
  "company_name": "企業名",
  "overview": "企業の概要説明（2-3文）",
  "business": "主要な事業内容の詳細説明（3-5文）",
  "industry": "業界名",
  "stage": "事業段階（スタートアップ/成長期/成熟期など）",
  "employees": "従業員数（数値のみ、不明な場合はnull）",
  "homepage_url": "企業の公式ホームページURL（必須。不明でも推測して出力）",
  "business_url": "企業の事業・サービス・製品紹介ページURL（必須。不明な場合はhomepage_urlと同じ）",
  "news": [{"title": "ニュースタイトル", "summary": "要約（1文）", "url": "ニュース記事のURL（必須）", "date": "日付（あれば）"}],
  "pains": ["${companyName}自体が直面する経営課題1", "${companyName}自体が直面する業務課題2", "課題3", "課題4", "課題5"],
  "hypothesis": "このサービスが${companyName}の上記課題解決に役立つと思われる仮説（1-2文）"
}

【再確認】
- homepage_url, business_url は必ず有効なURLを出力（空文字不可）
- newsは必ず5件以上（各項目にurl必須）`;

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
          homepage_url: parsed.homepage_url || '',
          business_url: parsed.business_url || '',
          news: (parsed.news || []).map((n: any, idx: number) => ({
            title: n.title || '',
            summary: n.summary || '',
            url: n.url || '',
            date: n.date || '',
          })),
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

  private parseEmailPatterns(
    responseText: string,
    companyName?: string,
    research?: CompanyResearch,
    settings?: CustomSettings
  ): EmailPattern[] {
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
      // If AI returned something but it couldn't be parsed, use smart templates
      if (companyName && research && settings) {
        return getSmartEmailPatterns(companyName, research, settings);
      }
      return this.getLegacyFallbackPatterns();
    }

    return patterns.length >= 5 ? patterns.slice(0, 5) : patterns;
  }

  // Legacy fallback (only used if no research/settings context available)
  private getLegacyFallbackPatterns(): EmailPattern[] {
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
