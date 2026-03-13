import { CompanyResearch, CustomSettings, EmailPattern } from './types';

// ============================================================
// Utility: Strip Markdown formatting (bold markers: ***, **, *) from AI output
// ============================================================
function stripMarkdownFormatting(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')  // ***bold italic*** → text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold** → text
    .replace(/(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1')  // *italic* → text (avoid breaking bullets)
    .replace(/^[\s]*\*{2,}\s*$/gm, '')     // Lines that are just *** or ** → remove
    .replace(/^-{3,}\s*$/gm, '')           // Lines that are just --- or ---- → remove
    .replace(/\n{3,}/g, '\n\n');            // Collapse excessive newlines
}

// ============================================================
// Utility: Clean broken/garbled sentences from AI output
// ============================================================
function cleanBrokenSentences(text: string): string {
  if (!text) return text;
  let result = text;

  // Remove sales-template phrases that get unnaturally inserted
  const salesTemplatePatterns = [
    /それでは、?他社サービスと比較した、?弊社の優位性について簡単に紹介させていただきま[すせ]。?/g,
    /それでは、?他社サービスと比較した[^。]*?紹介させていただ[^。]*?。?/g,
    /一点目は、?[^。]*?体制の違いです。?/g,
    /簡単に(?:ご)?紹介させていただきます。?/g,
  ];
  for (const pattern of salesTemplatePatterns) {
    result = result.replace(pattern, '');
  }

  // Fix broken sentence patterns where two sentences got merged:
  // e.g., "「サービス名」でそれでは、" → "「サービス名」で"
  result = result.replace(/([」）])で(?:それでは|つきましては)、/g, '$1で');

  // Fix "〜させていただきまといった" (truncated + merged) → "〜といった"
  result = result.replace(/させていただきまといった/g, 'といった');

  // Fix "〜でしたらでそれでは" → "〜でしたら、"
  result = result.replace(/でしたら(?:で)?それでは/g, 'でしたら、');

  // Remove orphaned "それでは、" at the start of a sentence fragment mid-paragraph
  result = result.replace(/([。、])それでは、(?=[^「\n])/g, '$1');

  // Clean up any resulting double punctuation or extra spaces
  result = result.replace(/、、/g, '、');
  result = result.replace(/。。/g, '。');
  result = result.replace(/  +/g, ' ');

  return result;
}

// ============================================================
// Utility: Post-process email body to replace company name with 貴社
// ============================================================
function replaceCompanyNameInBody(body: string, companyName: string): string {
  if (!companyName) return body;
  const lines = body.split('\n');

  // Find the end of the addressee block (first few lines containing 様, 担当者, 御中, etc.)
  let addresseeEndIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (
      line.includes('担当者') ||
      line.includes('御中') ||
      line.includes('部長') ||
      line.includes('課長') ||
      line.endsWith('様') ||
      line.includes('営業部') ||
      line.includes('事業部') ||
      line.includes('人事部') ||
      line.includes('総務部') ||
      line.includes('経営企画')
    ) {
      addresseeEndIdx = i + 1;
    }
  }

  const addresseeLines = lines.slice(0, addresseeEndIdx);
  const bodyLines = lines.slice(addresseeEndIdx);
  const bodyText = bodyLines.join('\n');

  const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replaced = bodyText
    .replace(new RegExp(escaped + '様', 'g'), '貴社')
    .replace(new RegExp(escaped, 'g'), '貴社');

  return [...addresseeLines, replaced].join('\n');
}

// ============================================================
// Utility: Truncate subject line to reasonable length
// ============================================================
function normalizeSubject(subject: string): string {
  const s = subject.trim();
  if (s.length <= 35) return s;
  // Try natural cut points
  const cutPatterns = ['についてのご提案', 'に関するご提案', 'についてのご案内', 'に関するご案内', 'について', 'に関して'];
  for (const cut of cutPatterns) {
    const idx = s.indexOf(cut);
    if (idx > 8 && idx <= 33) return s.substring(0, idx + cut.length);
  }
  return s.substring(0, 33) + '…';
}

// ============================================================
// Utility: Build signature block from custom settings
// ============================================================
function buildSignatureBlock(settings: CustomSettings): string {
  const s = settings as any;
  const senderCompany = s.sender_company || s.senderCompany || s.company || '';
  const senderTitle = s.sender_title || s.senderTitle || '';
  const senderName = s.sender_name || s.senderName || '';
  const senderEmail = s.sender_email || '';
  const senderPhone = s.sender_phone || s.phoneNumber || '';

  if (!senderName && !senderCompany) return '';

  const lines: string[] = [];
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  if (senderCompany) lines.push(senderCompany);
  const nameTitle = [senderName, senderTitle].filter(Boolean).join(' / ');
  if (nameTitle) lines.push(nameTitle);
  if (senderEmail) lines.push(`Email: ${senderEmail}`);
  if (senderPhone) lines.push(`TEL: ${senderPhone}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  return '\n\n' + lines.join('\n');
}

// ============================================================
// Utility: Append signature to email body
// ============================================================
function appendSignature(body: string, settings: CustomSettings): string {
  const signature = buildSignatureBlock(settings);
  if (!signature) return body;
  // Remove trailing "よろしくお願いいたします。" duplicate if signature follows
  return body.trimEnd() + signature;
}

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL || 'https://gemini-generate-fn-513563150820.asia-northeast1.run.app';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// ============================================================
// Stage 1: Cloud Run (primary)
// ============================================================
async function callCloudRun(prompt: string): Promise<string> {
  if (!CLOUD_RUN_URL) {
    throw new Error('CLOUD_RUN_URL is not configured');
  }

  const endpoint = CLOUD_RUN_URL.replace(/\/+$/, '') + '/generate';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Cloud Run returned ${response.status}: ${errBody || response.statusText}`);
    }

    const json = (await response.json()) as { ok?: boolean; result?: string; error?: string };
    if (!json.ok || !json.result) {
      throw new Error(json.error || 'Cloud Run returned an error or empty result');
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
          maxOutputTokens: 8192,
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
// Unified AI caller: Cloud Run -> Gemini Direct
// ============================================================
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
      console.log(`[AI] [Attempt ${attempt}] Trying Cloud Run...`);
      const result = await callCloudRun(prompt);
      console.log('[AI] Cloud Run succeeded');
      return result;
    } catch (cloudRunError) {
      lastError = `Cloud Run: ${(cloudRunError as Error).message}`;
      console.warn(`[AI] Cloud Run failed:`, lastError);
    }

    // Stage 2: Try Gemini API Direct
    try {
      console.log(`[AI] [Attempt ${attempt}] Trying Gemini API Direct...`);
      const result = await callGeminiDirect(prompt);
      console.log('[AI] Gemini API Direct succeeded');
      return result;
    } catch (geminiError) {
      lastError = `Gemini Direct: ${(geminiError as Error).message}`;
      console.warn(`[AI] Gemini API Direct failed:`, lastError);
    }
  }

  // All retries exhausted - throw to let caller handle Stage 3 (smart templates)
  throw new Error(`All AI providers failed after ${maxRetries} attempts. Last error: ${lastError}`);
}

// ============================================================
// Stage 3: Smart Template Engine
// ============================================================
function getSmartEmailPatterns(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): EmailPattern[] {
  const senderName = (settings as any).sender_name || settings.senderName || '担当';
  const senderCompany = (settings as any).sender_company || (settings as any).senderCompany || (settings as any).company || '弊社';
  const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
  const serviceBenefit = (settings as any).service_benefit || settings.serviceInfo?.strengths?.join('、') || '';
  const schedulingUrl = (settings as any).scheduling_url || '';

  const industry = (research as any).industry || '';
  const painPoints = research.pains?.slice(0, 3) || [];
  const pain1 = painPoints[0] || '業務プロセスの改善';
  const pain2 = painPoints[1] || '組織の生産性向上';
  const pain3 = painPoints[2] || '競合環境への対応';
  const overview = (research as any).overview || '';
  const business = (research as any).business || (research as any).businessDescription || '';
  const latestNews = research.news?.[0]?.title || '';

  // Strip company name from overview/business snippets to avoid duplication in body
  const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const overviewClean = overview
    .replace(new RegExp(escaped + '様?は?、?', 'g'), '')
    .replace(/^[\s、。]+/, '')
    .substring(0, 50);
  const businessClean = business
    .replace(new RegExp(escaped + '様?は?、?', 'g'), '')
    .replace(/^[\s、。]+/, '')
    .substring(0, 50);

  // Build research-based context for email body (after thank-you opening)
  const researchContext = latestNews
    ? `貴社の「${latestNews.substring(0, 30)}」に関するニュースを拝見し、ご連絡いたしました。`
    : overviewClean
    ? `貴社のお取り組みを拝見し、お力になれる部分があるのではないかと考えご連絡いたしました。`
    : industry
    ? `${industry}業界の企業様とお話しする中で、お力になれる部分があるのではないかと考えご連絡いたしました。`
    : '';

  const serviceIntro = serviceName ? `「${serviceName}」` : '弊社サービス';
  const industryLabel = industry ? `${industry}業界の` : '';
  const ctaBlock = schedulingUrl
    ? `ご都合のよい日時を以下のURLからお選びいただけますと幸いです。\n${schedulingUrl}`
    : 'お気軽にご返信いただければ幸いです。';

  const rawPatterns = [
    {
      patternName: '経営層向け（ROI訴求）',
      subject: `資料ご請求のお礼と${pain1.substring(0, 8)}のご案内`,
      body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\nこの度は弊社の資料をご請求いただき、誠にありがとうございます。${researchContext}\n\n${industryLabel}企業様とお話しする中で、「${pain1}」が重要な経営テーマになっているケースが多いと感じております。もし貴社でも同様の課題をお持ちでしたら、${serviceIntro}で${serviceBenefit ? serviceBenefit.substring(0, 40) + 'といった改善' : '具体的な改善'}を実現できる可能性がございます。\n\n資料の内容についてご不明点やご質問がございましたら、お気軽にお申し付けください。貴社の状況に合わせた具体的な活用イメージもご説明可能です。\n\n${ctaBlock}\n\nよろしくお願いいたします。`,
      targetPersona: 'executive',
      description: '経営層向け（ROI訴求）',
    },
    {
      patternName: '現場責任者向け（効率化訴求）',
      subject: `ご請求資料のご案内と${pain2.substring(0, 8)}について`,
      body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\nこの度は弊社サービスにご関心をお寄せいただき、ありがとうございます。${researchContext}\n\n${industryLabel}企業の現場責任者の方から「${pain2}」に関するご相談をいただくことが多く、貴社でも同様のテーマをお持ちではないかと推測しております。\n\n${serviceIntro}は、既存の業務フローを大きく変えることなく導入でき、同業界のA社様では現場の工数を約30%削減された事例がございます。\n\n資料だけではお伝えしきれない部分もございますので、ご興味がございましたら15分程度のデモもご用意しております。\n\n${ctaBlock}\n\nよろしくお願いいたします。`,
      targetPersona: 'manager',
      description: '現場責任者向け（効率化訴求）',
    },
    {
      patternName: '担当者向け（時短訴求）',
      subject: `資料のお礼と${industry || '業務'}効率化のご案内`,
      body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\nこの度は弊社の資料をご覧いただき、ありがとうございます。\n\n${industryLabel}企業の現場ご担当者様から「${pain1}」に関連して、定型業務に時間を取られるというお声をよくいただきます。もし貴社でも同様の状況がございましたら、${serviceIntro}で1日あたり1時間程度の時間短縮が見込めます。\n\n資料の内容でご不明な点がございましたら、お気軽にご質問ください。簡単なデモもご用意しておりますので、ご希望の際はお申し付けください。\n\n${ctaBlock}\n\nよろしくお願いいたします。`,
      targetPersona: 'staff',
      description: '担当者向け（時短訴求）',
    },
    {
      patternName: '短文ストレート型',
      subject: `資料ご請求のお礼`,
      body: `${companyName}\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\nこの度は資料をご請求いただきありがとうございます。${researchContext}\n\n${industryLabel}企業様で${serviceIntro}をご活用いただき、成果を出されている事例が増えております。貴社でもお力になれる部分があるのではないかと考えております。\n\n${schedulingUrl ? `ご興味がございましたら、以下のURLからお気軽にご相談日時をお選びください。\n${schedulingUrl}` : '資料についてご不明点がございましたら、お気軽にご返信ください。'}\n\nよろしくお願いいたします。`,
      targetPersona: 'general',
      description: '短文ストレート型',
    },
  ];

  // Post-process: normalize subjects + replace company name with 貴社 in body + append signature
  return rawPatterns.map((p) => ({
    ...p,
    subject: normalizeSubject(p.subject),
    body: appendSignature(replaceCompanyNameInBody(p.body, companyName), settings),
  }));
}

function getSmartSubOutputs(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): { phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] } {
  const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '当サービス';
  const senderName = (settings as any).sender_name || settings.senderName || '○○';
  const senderCompany = (settings as any).sender_company || (settings as any).senderCompany || (settings as any).company || '弊社';
  const schedulingUrl = (settings as any).scheduling_url || '';
  const industry = (research as any).industry || '';
  const overview = (research as any).overview || '';
  const business = (research as any).business || (research as any).businessDescription || '';
  const pain1 = research.pains?.[0] || '業務プロセスの効率化';
  const pain2 = research.pains?.[1] || '組織の生産性向上';
  const latestNews = research.news?.[0]?.title || '';

  // Build a contextual research note for phone script
  const researchNote = latestNews
    ? `あと、御社の「${latestNews.substring(0, 30)}」のニュースも拝見していまして、非常に興味深く感じました。`
    : overview
    ? `御社の${overview.substring(0, 40)}という取り組みも拝見しておりまして。`
    : '';

  const apoClosing = schedulingUrl
    ? `もしよろしければ、30分くらいで具体的な事例をお見せできるんですけど、日程調整のURLをメールでお送りしてもいいですか？ご都合のいい日時を選んでいただけるので。\n\n→（了承を得たら）\n\nありがとうございます！それじゃあ、日程調整のURLをメールでお送りしますね。本日はお時間いただきありがとうございました。`
    : `もしよろしければ、30分くらいでオンラインで具体的な事例をお見せできるんですが、来週あたりお時間いかがですか？火曜か木曜の午後とかどうですか？\n\n→（日程調整）\n\nありがとうございます！それじゃあ、改めてメールでZoomリンクをお送りしますね。本日はお時間いただきありがとうございました。`;

  const followUpCta = schedulingUrl
    ? `以下のURLからご都合のよい日時をお選びいただけますと幸いです。\n${schedulingUrl}`
    : 'お気軽にご返信いただければ幸いです。';

  return {
    phone_script: `お忙しいところすみません、${senderCompany}の${senderName}と申します。先ほど弊社の資料をご請求いただいたかと思いまして、お礼のお電話をさせていただきました。\n\n→（相手の反応を待つ）\n\nありがとうございます。ちなみに、どういったきっかけで弊社の資料にご興味をお持ちいただけましたか？\n\n→（相手の反応を聞く）\n\nなるほど、ありがとうございます。${researchNote}\n\nそれで、ちょっとだけ2〜3分お時間いただけたりしますか？\n\n→（許可を得たら）\n\nありがとうございます。実は${industry ? industry + '業界の' : ''}他の企業さんとお話ししてると、「${pain1}」っていう課題をよく聞くんですけど、御社ではそのあたりいかがですか？\n\n→（相手の反応を聞く）\n\nなるほど、そうなんですね。やっぱりそうですよね。実は、${industry ? industry + '業界の' : '同業の'}A社さんで${serviceName}を使っていただいたら、同じような課題が3ヶ月くらいで改善されて、工数が約30%減ったっていう事例がありまして。\n\n${pain2 !== pain1 ? `あと「${pain2}」についても、結構お役に立てる部分があるんですけど、` : ''}${apoClosing}`,
    video_prompt: `${companyName}様専用にお作りした10秒動画のプロンプトです。貴社のリサーチ結果・最新ニュース・お問い合わせ内容をもとに構成しています。\n\n【シーン1 (0-3秒)】${companyName}様へ — ${latestNews ? '「' + latestNews.substring(0, 25) + '」のニュースを拝見しました' : 'お問い合わせありがとうございます'}。画面上部に「${companyName}様専用のご提案」のテキストがフェードイン。背景は${industry ? industry + '業界' : 'ビジネス'}をイメージした落ち着いたネイビー&ホワイトのオフィス空間。プロフェッショナルで軽快なBGM。\n\n【シーン2 (3-7秒)】貴社リサーチから見えた課題「${pain1}」のテキストが画面中央にボールド白文字でフェードイン。背景は暗めのグラデーション。下部に「${serviceName}なら、この課題をこう解決します」のサブテキスト。${business ? business.substring(0, 25) + 'の現場' : 'オフィス'}がスムーズに動いている映像にトランジション。\n\n【シーン3 (7-10秒)】「${companyName}様だけにお伝えしたいことがあります」のCTAテキスト。${schedulingUrl ? '日程調整ボタンがアニメーションで出現。' : '「詳しくはメールをご確認ください」のテキスト。'}${senderName}（${senderCompany}）の名前とロゴをフェードイン。最後に「${companyName}様のために調査・作成しました」の一文を表示。`,
    follow_up_scenarios: [
      `【3日後・未返信時】\n件名：ご請求資料の補足と${industry || '同業'}業界の事例について\n\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\n先日は弊社の資料をご請求いただき、ありがとうございました。${overview ? '貴社の' + overview.substring(0, 30) + 'に関連して、' : ''}1つだけ補足でお伝えしたいことがございましたのでご連絡いたしました。\n\n${industry ? industry + '業界の' : '同業の'}A社様（従業員数約200名）でも、貴社と同じく「${pain1}」が経営課題でした。${serviceName}を導入された結果、3ヶ月で業務工数を35%削減し、コア業務に集中できる体制を構築されました。\n\n資料の内容と合わせて、15分程度で貴社に特化した活用イメージをお見せできます。\n\n${followUpCta}\n\nお電話でのご相談も歓迎です。`,
      `【1週間後・未返信時】\n件名：貴社の「${pain1.substring(0, 15)}」に関する無料診断のご案内\n\nご担当者様\n\n先日は資料をご請求いただきありがとうございました。${senderCompany}の${senderName}です。\n\nお忙しいところ恐れ入ります。今回は売り込みではなく、貴社のお役に立てる情報提供としてご案内いたします。\n\n30分のオンラインヒアリングで、以下を無料でお渡しします：\n・「${pain1}」の現状分析レポート\n・${industry || '同業'}業界の平均ベンチマークデータとの比較\n・改善余地のROI試算（コスト削減見込み額を具体的に算出）\n\n費用・導入義務は一切ございません。\n\n${industry ? industry + '業界' : '同業界'}の平均改善効果は工数削減30%・コスト削減20%です。\n\n${followUpCta}\n\nよろしくお願いいたします。`,
      `【1ヶ月後・掘り起こし】\n件名：改めてのご提案｜${industry || '同業'}業界の最新活用事例\n\nご担当者様\n\nお世話になっております。${senderCompany}の${senderName}です。\n\n以前ご連絡させていただいた際はお忙しい中ありがとうございました。改めて、貴社のお役に立てることがあるのではと思いご連絡いたしました。\n\n${overview ? '貴社の' + overview.substring(0, 40) + 'について改めて拝見し、' : '貴社の事業について改めて調べさせていただき、'}「${pain1}」という課題に対して、${serviceName}で具体的にお力になれる部分があると感じております。\n\n実際に${industry ? industry + '業界の' : ''}同規模のB社様では、${serviceName}を活用いただいた結果、${pain1}に関連する業務工数が大幅に改善されました。${pain2 !== pain1 ? `また「${pain2}」についても、実績のある改善手法をお持ちしております。` : ''}\n\n以前とは異なる切り口でのご提案も可能ですので、もしよろしければ15〜30分ほどお時間をいただけませんでしょうか。\n\n${followUpCta}\n\n何卒よろしくお願いいたします。`,
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
    contactDepartment?: string;
    leadSource?: string;
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
      contactDepartment = '',
      leadSource = '',
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

      // Get scheduling URL from settings
      const schedulingUrl = (settings as any).scheduling_url || '';

      const ctaInstructions: Record<string, string> = {
        call: schedulingUrl
          ? `CTA（行動喚起）は以下の日程調整URLからオンライン相談の予約を促す。\n日程調整URL：${schedulingUrl}\n「以下のURLからご都合のよい日時をお選びいただけますと幸いです」のように自然に誘導する。`
          : 'CTA（行動喚起）は電話でのご相談を促す。30分の無料相談を提案する。',
        demo: schedulingUrl
          ? `CTA（行動喚起）は製品デモンストレーションへの参加を促す。以下の日程調整URLからデモ予約を誘導する。\n日程調整URL：${schedulingUrl}`
          : 'CTA（行動喚起）は製品デモンストレーションへの参加を促す。簡単なデモ申し込みリンクを提案する。',
        meeting: schedulingUrl
          ? `CTA（行動喚起）は以下の日程調整URLを使用した時間設定を促す。\n日程調整URL：${schedulingUrl}\n「以下のURLからご都合のよい日時をお選びください」と案内する。`
          : 'CTA（行動喚起）はカレンダー予約ツール（Calendly等）を使用した時間設定を促す。',
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

      const painPoints = research.pains?.slice(0, 5).join('、') || '';

      // Access settings with database field names (snake_case)
      const senderName = (settings as any).sender_name || settings.senderName || '';
      const senderTitle = (settings as any).sender_title || settings.senderTitle || '';
      const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '';
      const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
      const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';
      const serviceBenefit = (settings as any).service_benefit || settings.serviceInfo?.strengths?.join('、') || '';
      const tone = (settings as any).tone || settings.promptSettings?.tone || 'プロフェッショナルで親しみやすい';
      const caseStudiesRaw = (settings as any).case_studies || settings.case_studies || '';

      // Build service summary with enough detail for AI to craft relevant proposals
      const serviceSummaryParts: string[] = [];
      if (serviceName) serviceSummaryParts.push(`サービス名：${serviceName}`);
      if (serviceDescription) serviceSummaryParts.push(`概要：${serviceDescription.substring(0, 500)}`);
      if (serviceBenefit) serviceSummaryParts.push(`強み：${serviceBenefit.substring(0, 300)}`);
      const serviceSummary = serviceSummaryParts.join('\n');

      // Build case studies context with enough room for detailed matching
      const caseStudiesContext = caseStudiesRaw
        ? `\n【導入事例データ（★事例活用の厳格ルール★）】\n${caseStudiesRaw.substring(0, 30000)}\n\n★★★ 事例をメールで使う条件（厳守） ★★★\n事例は以下の2条件のいずれかを満たす場合のみメール本文に反映すること。条件を満たさない事例は絶対に使わないこと。\n条件1：同じ業界の事例 → 「${companyName}と同じ${(research as any).industry || ''}業界のA社様では〜」と業界の一致を明示した上で言及\n条件2：同じ課題を持つ事例 → 「貴社と同様に○○という課題をお持ちだったB社様では〜」と課題の共通点を明示した上で言及\n★条件を満たさない（異業界かつ課題も異なる）事例は、メール本文に入れてはならない。事例なしでサービスの強み・概要ベースで提案すること。`
        : '';

      // Build department-specific context
      const departmentContext = contactDepartment
        ? `\n【送信先担当者の所属部署】\n${contactDepartment}\n※この部署が日常的に抱えやすい課題（例：${contactDepartment}であれば、その部署特有の業務課題やKPI）を推測し、リサーチ結果と組み合わせて、担当者が「自分ごと」として読めるメール文を作成すること。`
        : '';

      // Build lead source context for inbound stance
      const leadSourceLabel = leadSource || '資料ダウンロード';
      const isReferral = leadSourceLabel === '紹介';
      const leadSourceContext = isReferral
        ? `\n【リードソース（このメールを送るきっかけ）】\n紹介（リファラル）\n※このリードは「紹介」経由です。弊社のことを知っている方、または両者の共通の知り合いが${companyName}に弊社を紹介してくれたケースです。新規開拓のコールドメールではありません。\n※メール冒頭では「ご紹介いただいた方の存在」に触れ、「○○様よりご紹介いただき、ご連絡いたしました」のようなスタンスで書くこと。\n※「弊社サービスをご紹介いただき」は誤り。紹介されたのは「弊社」であり「サービス」ではない。`
        : `\n【リードソース（このメールを送るきっかけ）】\n${leadSourceLabel}\n※このリードは${companyName}側から自発的にアクション（${leadSourceLabel}）があった「インバウンドリード」です。新規開拓のコールドメールではありません。`;

      const prompt = `あなたは日本のインサイドセールス(IS)メール作成の専門家です。リサーチした企業情報を徹底的に活用し、「この企業のことをよく調べている」と感じさせる、高度に個別化されたフォローアップメールを作成します。

★★★ 最重要：このメールの前提 ★★★
このメールは「新規開拓のアウトバウンド営業メール」ではありません。
${isReferral
  ? `弊社のことを知っている方、または両者の共通の知り合いが${companyName}に弊社を紹介してくれた「紹介リード」に対する初回コンタクトメールです。
したがって以下を厳守すること：
- メール冒頭で「○○様よりご紹介いただき、ご連絡いたしました」「ご紹介を通じてご連絡差し上げました」等、紹介経由である旨を伝えること
- 紹介者の名前が不明な場合は「ご紹介いただきまして」「お繋ぎいただきまして」のように紹介者を特定せずに表現すること
- 「弊社サービスをご紹介いただき」は絶対NG（紹介されたのは「弊社」であり「サービス」ではない）
- 「${leadSourceLabel}いただきありがとうございます」は絶対NG（相手が資料ダウンロード等をしたわけではない）
- 「突然のご連絡失礼します」「初めてご連絡いたします」等のコールドメール表現は絶対NG
- 紹介経由なので相手に一定の信頼がある前提で、押し売り感のない丁寧なトーンで書くこと
- 「ぜひ一度ご挨拶の機会をいただければ幸いです」のような、紹介経由らしい丁寧な表現を使うこと`
  : `相手企業（${companyName}）が弊社のホームページで${leadSourceLabel}をしてくれた「インバウンドリード」に対するフォローアップメールです。
したがって以下を厳守すること：
- メール冒頭で「${leadSourceLabel}いただきありがとうございます」等、相手のアクションへのお礼から始めること
- 「突然のご連絡失礼します」「初めてご連絡いたします」等のコールドメール表現は絶対NG
- 相手が既に興味を示している前提で、押し売り感のない自然なトーンで書くこと
- 「ぜひ一度お話しさせてください」ではなく「ご不明点やご質問があればお気軽にお申し付けください」のようなスタンス`}

【送信者情報】
氏名：${senderName}
職位：${senderTitle}
会社：${senderCompany}

【提供サービス概要（※メールには要約して自然に組み込む。設定内容をそのまま貼り付けないこと。サービスの具体的な強みや特徴を相手の課題に合わせて言い換えること）】
${serviceSummary}${caseStudiesContext}

★★★ 学習データの活用ルール（厳守） ★★★
1. 上記の「導入事例データ」と「提供サービス概要」は、カスタム設定で学習した自社の商材・サービス情報です。
2. リサーチした${companyName}の業界（${(research as any).industry || '不明'}）・課題仮説と照合し、事例を選定すること。
3. 【同業界の事例のみ使用可】${companyName}と同じ業界の事例がある場合のみ：「${(research as any).industry || '同業'}業界のA社様では○○という課題に対し、弊社サービスの導入により△△の改善が見られました」のように業界の一致を明示して言及する。
4. 【同じ課題の事例のみ使用可】業界は異なるが、${companyName}が抱えていそうな課題と同じ課題を持つ事例がある場合のみ：「貴社と同様に○○の課題をお持ちだったB社様では〜」と課題の共通点を明示した上で言及する。
5. 【条件外の事例は絶対不使用】上記3・4のいずれにも該当しない事例（異業界かつ課題も異なる）は、メール本文に入れてはならない。
6. マッチする事例がない場合：事例には一切触れず、サービスの概要・強みベースのみで提案する。
${leadSourceContext}
${departmentContext}

【送信先企業のリサーチ結果（※メール作成で最も重要な情報源）】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
事業段階：${(research as any).stage || '不明'}
従業員数：${(research as any).employees || (research as any).employeeCount || '不明'}
事業内容：${(research as any).business || (research as any).businessDescription || ''}
企業概要：${(research as any).overview || ''}
${companyName}が直面する経営・業務課題（※顧客の課題ではなく、${companyName}自体の課題）：${painPoints}
${contactDepartment ? `担当者部署から推測される課題：${contactDepartment}部門が特に関心を持ちそうな課題にフォーカスすること` : ''}
${newsContext ? `最新ニュース：${newsContext}` : ''}

【ペルソナ指定】
${selectedPersonaInstructions}

【CTA指定】
${selectedCtaInstructions}
${schedulingUrl ? `\n★日程調整URLが設定されています：${schedulingUrl}\nメールの結び部分で、このURLへの誘導を自然に組み込んでください。例：「以下のURLからご都合のよい日時をお選びいただけますと幸いです。\\n${schedulingUrl}」` : ''}

【メール作成のトーン】
${tone}

【追加カスタマイズ】
${freeText || 'なし'}

■ 宛名の書き方（絶対ルール）：
- メール冒頭の宛名は必ず「${companyName}」（正式な会社名）で始めること
- 宛名に「貴社」を使うのは絶対NG。「貴社」は本文のみで使用
- 担当者情報がある場合の宛名例：「${companyName}\n営業部 田中太郎 様」
- 担当者情報がない場合の宛名例：「${companyName}\nご担当者様」

■ 署名について：
- メール末尾に署名（送信者の会社名・氏名・連絡先など）は書かないでください。署名はシステムが自動挿入します。
- メールは「よろしくお願いいたします。」で終えてください。

■ 件名（Subject Line）の絶対ルール【最重要】：
- 件名は【必ず35文字以内】の簡潔な表現にすること（絶対条件）
- 課題の文章をそのまま件名にしてはいけない
- 良い例：「貴社のDX推進についてのご提案」「営業効率向上のご案内」「採用課題のご支援について」
- 悪い例（NG）：「製品が高機能・高価格帯であるため、コストを重視する中小企業...に関するご提案」（絶対に避ける）

■ 重要な作成ルール：
1. 【冒頭の書き方】${isReferral
  ? `メール冒頭は必ず「ご紹介いただき、ご連絡いたしました」「お繋ぎいただきまして、ご連絡差し上げました」等、紹介経由である旨を伝えること。「${leadSourceLabel}いただきありがとうございます」は不適切（相手がアクションを取ったわけではない）。「弊社サービスをご紹介いただき」も絶対NG。`
  : `メール冒頭は必ず「${leadSourceLabel}いただきありがとうございます」「${leadSourceLabel}のお礼とともにご連絡いたしました」等、相手のアクションへの感謝から始めること。`}
2. 【相手が既に知っていることを書かない（最重要）】
   ★絶対NG：「貴社の主力事業は○○です」「貴社は△△業界で事業を展開されています」のような、相手が当然知っている自社の事実をそのまま述べること。これは「調べました」アピールにしかならず、相手に失礼な印象を与える。
   ★正しいアプローチ：リサーチで判明した事実から「この企業はこういう課題を抱えているのではないか」と推測し、その課題に対して「弊社はこう貢献できます」という流れにすること。
   - OK例：「${companyName.substring(0, 4)}様と同業界の企業様では、○○という課題を抱えていらっしゃるケースが多く、弊社でもお力になれる部分があるのではないかと推測しております。」
   - OK例：「貴社の△△に関するニュースを拝見し、○○の領域でお力になれるのではないかと考えご連絡いたしました。」
   - NG例：「貴社の主力事業は中途採用支援サービスの開発・運営です。」（←相手は自分の事業を知っている）
   - NG例：「貴社は○○業界で事業を展開されていると認識しております。」（←当たり前のことを述べている）
3. 【課題仮説→ニーズマッチング（最重要）】
   リサーチ結果から${companyName}が抱えていそうな課題を「仮説」として柔らかく提示し、その課題に対して送信者のサービスがどう役立つかを簡潔にマッチングすること。
   ★サービス説明文・強みの文章をそのままコピー＆ペーストすることは絶対禁止。
   ★営業トークのテンプレ表現を使わないこと。以下のような表現は絶対NG：
   - 「他社サービスと比較した弊社の優位性」
   - 「簡単に紹介させていただきます」
   - 「一点目は〜、二点目は〜」のような箇条書き的プレゼン文体
   - 「それでは」で始まるサービス紹介の段落
   ★正しい書き方：サービスの強みや特徴を「自分の言葉」で要約し、相手の課題に合わせて1〜2文で提案する。
   - OK例：「もし○○にお悩みでしたら、弊社の△△で□□のような改善が見込めます。」
   - OK例：「同業界のA社様では、弊社サービスの導入により○○が30%改善された事例がございます。」
4. 【柔らかい表現・断定を避ける】
   「認識しております」「存じ上げております」のような断定的な表現ではなく、「推測しております」「〜ではないかと考えております」「〜のケースが多いと伺っております」のような、相手に逃げ道を残す柔らかい表現を使うこと。
   - OK：「○○の課題をお持ちではないかと推測しております」「〜に関心をお持ちなのではないかと存じます」
   - NG：「○○が課題であると認識しております」「貴社は○○に取り組んでいると把握しております」
5. 【ニュース活用】最新ニュースがある場合は、お礼の後に自然な形で活用する（「〜のニュースも拝見し」「〜のお取り組みについても関心を持っております」など）。ただしニュースの事実を長々と述べず、1文で触れてすぐに課題仮説・提案に繋げること。
6. 【具体性】「業務効率化」「コスト削減」など抽象的な表現ではなく、${companyName}の事業に即した具体的な効果・メリットを記載する。
7. 【企業名の表記ルール（最重要）】
   ■ 宛名行（メール冒頭1〜3行目）：必ず「${companyName}」を正式名称で記載すること。絶対に「貴社」を宛名に使わないこと。
     - 正しい例：「${companyName}\nご担当者様」「${companyName}\n営業部 田中太郎 様」
     - NG例：「貴社\n営業部 田中太郎 様」「貴社\nご担当者様」（宛名に「貴社」は絶対NG）
   ■ メール本文（宛名行より後の文章）：企業名「${companyName}」を直接記載せず、必ず「貴社」と表現すること。
8. 【文章品質の厳守（最重要）】
   ★各文は必ず文法的に正しく完結させること。途中で別の文が挿入されて意味が通らなくなることは絶対NG。
   ★生成後に全文を読み返し、以下をチェックすること：
   - 1つの文の中に2つの異なる文が混在していないか（例：「〜でしたら、「サービス名」でそれでは、〜について紹介させていただきまといった改善を〜」のような文の破綻）
   - 「〜でそれでは」「〜させていただきまといった」のような不自然な接続がないか
   - サービス名の後に続く文が自然に読めるか
   ★文が長くなりすぎる場合は、無理に1文にまとめず2文に分けること

以下の4つのメールパターンを日本語で作成してください（すべてインバウンドリードへのフォローアップメールです）：

${isReferral
  ? `1. Pattern A - 経営層向け（ROI訴求）：CEOやCFO向け。紹介経由のご挨拶→同業界の企業が抱える課題仮説を柔らかく提示→その課題に対して弊社サービスがもたらすROI・数値効果を簡潔に紹介→ご挨拶の機会打診。相手が知っている自社情報の羅列は不要。★導入事例データに同業界or類似課題の事例があれば「同業界のA社様では〜」と自然に言及すること。
2. Pattern B - 現場責任者向け（効率化訴求）：部門長向け。紹介経由のご挨拶→「同業界の企業様では○○という課題をよく伺います」のように課題仮説を提示→弊社サービスでの具体的改善イメージを1-2文で提案。${contactDepartment ? `特に${contactDepartment}が抱えやすい課題にフォーカスすること。` : ''}★導入事例データから現場レベルの効率改善事例を引用できれば説得力が増す。
3. Pattern C - 担当者向け（時短訴求）：実務者向け。紹介経由のご挨拶→現場担当者が日々感じていそうな課題を仮説として提示→弊社サービスによる時短効果を具体的な数字で示す。${contactDepartment ? `${contactDepartment}の業務フローに即した提案をすること。` : '業界特有の業務フローに触れること。'}★導入事例データの具体的な数値（○○%削減、○○時間短縮等）があれば活用。
4. Pattern D - 短文ストレート型：簡潔な紹介経由のご挨拶メール。紹介いただいた旨→ニュースか課題仮説を1文だけ触れ→「お力になれる部分があると考えております」で締める。20-30秒で読める長さ。事例は不要。`
  : `1. Pattern A - 経営層向け（ROI訴求）：CEOやCFO向けフォローアップ。${leadSourceLabel}のお礼→同業界の企業が抱える課題仮説を柔らかく提示→その課題に対して弊社サービスがもたらすROI・数値効果を簡潔に紹介→アポ打診。相手が知っている自社情報の羅列は不要。★導入事例データに同業界or類似課題の事例があれば「同業界のA社様では〜」と自然に言及すること。
2. Pattern B - 現場責任者向け（効率化訴求）：部門長向けフォローアップ。${leadSourceLabel}のお礼→「同業界の企業様では○○という課題をよく伺います」のように課題仮説を提示→弊社サービスでの具体的改善イメージを1-2文で提案。${contactDepartment ? `特に${contactDepartment}が抱えやすい課題にフォーカスすること。` : ''}★導入事例データから現場レベルの効率改善事例を引用できれば説得力が増す。
3. Pattern C - 担当者向け（時短訴求）：実務者向けフォローアップ。${leadSourceLabel}のお礼→現場担当者が日々感じていそうな課題を仮説として提示→弊社サービスによる時短効果を具体的な数字で示す。${contactDepartment ? `${contactDepartment}の業務フローに即した提案をすること。` : '業界特有の業務フローに触れること。'}★導入事例データの具体的な数値（○○%削減、○○時間短縮等）があれば活用。
4. Pattern D - 短文ストレート型：簡潔なフォローアップ。${leadSourceLabel}のお礼→ニュースか課題仮説を1文だけ触れ→「お力になれる部分があると考えております」で締める。20-30秒で読める長さ。事例は不要。`}

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
    settings: CustomSettings,
    leadSource?: string
  ): Promise<{
    phone_script?: string;
    video_prompt?: string;
    follow_up_scenarios?: string[];
  }> {
    try {
      const serviceName = (settings as any).service_name || settings.serviceInfo?.name || '';
      const serviceDescription = (settings as any).service_description || settings.serviceInfo?.description || '';

      const senderCompany = (settings as any).sender_company || settings.senderCompany || settings.company || '';
      const senderName = (settings as any).sender_name || settings.senderName || '';
      const serviceBenefit = (settings as any).service_benefit || settings.serviceInfo?.strengths?.join('、') || '';
      const painPoints = (research as any).pains?.slice(0, 3).join('、') || research.painPoints?.slice(0, 3).join('、') || '';
      const overview = (research as any).overview || '';
      const business = (research as any).business || (research as any).businessDescription || '';

      const caseStudiesRaw = (settings as any).case_studies || settings.case_studies || '';
      const caseStudiesNote = caseStudiesRaw
        ? `\n【導入事例データ】\n${caseStudiesRaw.substring(0, 30000)}\n★事例活用の厳格ルール：同じ業界（${(research as any).industry || '不明'}）の事例、または同じ課題を持つ事例のみ使用可。条件を満たさない事例は絶対に使わないこと。マッチする事例がない場合は事例に一切触れないこと。`
        : '';

      const schedulingUrl = (settings as any).scheduling_url || '';
      const schedulingUrlNote = schedulingUrl
        ? `\n★日程調整URL：${schedulingUrl}\nアポ打診や日程提案の際には、このURLへの誘導を自然に組み込むこと。`
        : '';

      const leadSourceLabel = leadSource || '資料ダウンロード';
      const isReferral = leadSourceLabel === '紹介';

      const prompt = `あなたは年間1000件以上のアポを獲得しているトップインサイドセールスです。${companyName}について事前にしっかりリサーチした上で連絡しているプロフェッショナルとして、各コンテンツを作成してください。

★★★ 最重要前提 ★★★
このコンテンツは「新規開拓のアウトバウンド営業」ではありません。
${isReferral
  ? `弊社のことを知っている方、または両者の共通の知り合いが${companyName}に弊社を紹介してくれた「紹介リード」に対するフォローです。
- 紹介経由なので、相手には一定の信頼がある前提
- 「突然のご連絡」「初めまして」等のコールドコール表現は絶対NG
- 「資料をご請求いただいた」「お問い合わせいただいた」等のインバウンド表現も絶対NG（相手は資料DLや問い合わせをしたわけではない）
- 「ご紹介いただきまして」「○○様よりお繋ぎいただきまして」等、紹介経由である旨に言及してから本題に入ること`
  : `${companyName}が弊社のホームページで「資料ダウンロード」や「問い合わせ」等のアクションを起こした「インバウンドリード」に対するフォローです。
- 相手は既に弊社に興味を示している前提
- 「突然のご連絡」「初めまして」等のコールドコール表現は絶対NG
- 「先ほど資料をご請求いただいた」「先ほどお問い合わせいただいた」等、直近のアクション（約10分前）に言及してから本題に入ること。「先日」「以前」等の時間が経った表現は使わないこと`}
${schedulingUrlNote}

【あなたがリサーチした${companyName}の情報】
会社名：${companyName}
業界：${(research as any).industry || '不明'}
企業概要：${overview}
事業内容：${business}
${companyName}が直面していると推測される課題：${painPoints}
最新ニュース・動向：${research.news?.slice(0, 3).map((n: any) => n.title).join('、') || '特になし'}

【あなた自身の情報】
会社名：${senderCompany}
氏名：${senderName}
提供サービス：${serviceName}
サービス概要：${serviceDescription ? serviceDescription.substring(0, 500) : ''}
サービスの強み：${serviceBenefit ? serviceBenefit.substring(0, 300) : ''}
${caseStudiesNote}

■ 全コンテンツ共通の絶対ルール：
1. 「${companyName}のことをしっかり調べて連絡している」ことが相手に伝わる内容にすること
2. ${companyName}の具体的な事業内容・業界・課題・ニュースに必ず言及すること
3. 汎用的なテンプレート表現（「業務効率化のご提案」「御社の発展に」等）は使わず、${companyName}固有の文脈に即した表現を使うこと
4. サービス説明をそのまま貼り付けず、${companyName}の課題に合わせてピンポイントで言及すること
5. フォローアップメールでは企業名「${companyName}」を直接記載せず「貴社」と表現すること
6. 【リードソース前提】${isReferral ? 'すべてのコンテンツは、紹介経由で連絡している前提で書くこと。「資料DL」「問い合わせ」等のインバウンド表現は使わないこと' : 'すべてのコンテンツは、相手が先にアクション（資料DL・問い合わせ等）を起こした前提で書くこと'}
7. 【導入事例の活用（厳格ルール）】上記に導入事例データがある場合、以下の条件を厳守すること：
   - 【条件1】同じ業界（${(research as any).industry || '不明'}）の事例のみ使用可：「${(research as any).industry || '同'}業界のA社様では〜」と業界一致を明示して言及
   - 【条件2】同じ課題を持つ事例のみ使用可：「貴社と同様に○○の課題をお持ちだったB社様では〜」と課題の共通点を明示して言及
   - 【厳禁】条件1・2のいずれにも該当しない事例（異業界かつ課題も異なる）は絶対に使わないこと
   - マッチする事例がない場合：事例には一切触れず、サービス概要・強みベースで提案
   - 事例URLがある場合はフォローアップメールに含めてもよい
8. 【サービス範囲の厳守（最重要）】提案内容は必ず上記「提供サービス」「サービス概要」「サービスの強み」に記載された範囲内に限定すること。サービスが提供していない機能・領域（例：サプライチェーン管理、サステナビリティ報告、データ分析プラットフォーム等）を勝手に提案するのは絶対NG。
   - サービスの実際の内容を正確に理解し、そのサービスで${companyName}のどの課題を解決できるかを具体的にマッチングすること
   - 導入事例の数値（○○%削減、○○時間短縮等）を捏造しないこと。言及する場合は「同業界のA社様では〜といった改善が見られました」程度の柔らかい表現に留めること
   - 「無料診断」「ROI試算」「ベンチマーク」等のサービスメニューに存在しない提案は避けること。サービスの実際の提供内容に基づいた提案をすること
   - 過大な提案・大風呂敷を広げないこと。サービスで実現可能な具体的かつ現実的な貢献ポイントに絞って提案すること

以下の2つのコンテンツを作成してください：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 架電スクリプト（${isReferral ? '紹介リードへのフォロー電話' : 'インバウンドリードへのフォロー電話'}）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isReferral ? '紹介経由のフォロー電話用' : '資料ダウンロード・問い合わせ後のフォロー電話用'}。【600〜800文字】で作成。

★最重要：実際に電話で話す「話し言葉」で書くこと。書き言葉は絶対にNG。
- 良い例：「〜なんですけど」「〜でして」「〜っていうお話なんですが」「〜じゃないですか」「なるほど、そうなんですね」
- 悪い例（NG）：「〜について」「〜に関しまして」「〜を実現いたします」（←書き言葉すぎて不自然）

${isReferral
  ? `★紹介経由の導入を必ず使うこと：
- 正しい例：「○○様からご紹介いただきまして、お電話させていただきました」「ご紹介を通じてご連絡させていただいたんですけど」
- NG例：「突然のお電話で恐縮です」「初めてお電話いたします」（←コールドコール表現は絶対NG）
- NG例：「先ほど弊社の資料をご請求いただいたかと思いまして」（←紹介リードなので資料DL前提はNG）`
  : `★即時フォロー前提の導入を必ず使うこと（問い合わせ・資料DLから約10分後に電話する想定）：
- 正しい例：「先ほど弊社の資料をご請求いただいたかと思いまして」「先ほどお問い合わせいただいた件でお電話しました」
- NG例：「突然のお電話で恐縮です」「初めてお電話いたします」（←コールドコール表現は絶対NG）
- NG例：「先日、資料をご請求いただいたかと思うんですけど、ご覧いただけましたでしょうか？」（←時間が経った前提はNG。まだ資料を見ていない可能性が高い）`}

以下の会話の流れに沿って、（）内のト書き・相手の反応待ちも含めて台本形式で書くこと：

${isReferral
  ? `【導入（紹介経由前提）】
「お忙しいところすみません、${senderCompany}の${senderName}と申します。○○様からご紹介いただきまして、お電話させていただきました。」
→（相手の反応を待つ）

【紹介の経緯確認】
紹介者との関係や、どのような文脈で紹介されたかを確認する。
例：「○○さんから、御社が最近〇〇に取り組まれているってお聞きしまして」
例：「ちなみに○○さんからはどんなふうにお聞きになってますか？」`
  : `【導入（即時フォロー前提）】
「お忙しいところすみません、${senderCompany}の${senderName}と申します。先ほど弊社の資料をご請求いただいたかと思いまして、お礼のお電話をさせていただきました。」
→（相手の反応を待つ）

【関心ポイントの確認】
相手がまだ資料を見ていない前提で、何に関心があったかを確認する。
例：「ちなみに、どういったきっかけで弊社の資料にご興味をお持ちいただけましたか？」
例：「資料は後ほどゆっくりご覧いただければと思うんですが、何かお調べになっていたことがあれば教えていただけますか？」`}

【リサーチに基づく共感】
${companyName}のニュース・事業内容・業界動向に具体的に触れ、理解を示す。
例：「御社の〇〇っていう取り組みも拝見していまして、まさにそういった領域でお役に立てるかなと」
例：「${(research as any).industry || ''}業界だと最近〇〇が課題になってるじゃないですか。御社もそのあたりどうですか？」

【課題への共感・深掘り】
${companyName}の課題に具体的に触れ、「あるある」感を出す。
「${(research as any).industry || '同業'}業界の他の企業さんとお話ししてると、〇〇っていう課題をよく聞くんですけど、御社ではいかがですか？」
→（相手の反応を聞く。共感が得られたら深掘り）

【サービス紹介（1-2文で簡潔に）】
課題に対して${serviceName || '弊社サービス'}がどう役立つかを端的に伝える。
★重要：サービスの実際の提供内容（上記「提供サービス」「サービス概要」「サービスの強み」）の範囲内で提案すること。サービスが提供していない機能を勝手に追加しないこと。数値は捏造せず「改善が見られました」程度の柔らかい表現に留めること。

【アポ打診】
${schedulingUrl
  ? `「もしよろしければ、30分くらいで具体的な事例をお見せできるんですけど、日程調整のURLをメールでお送りしてもいいですか？ご都合のいい日時を選んでいただけるので」`
  : `「もしよろしければ、30分くらいでオンラインで具体的な事例をお見せできるんですけど、来週あたりお時間いかがですか？火曜か木曜の午後とかどうですか？」`}
→（日程調整して終話）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. フォローアップシナリオ（追撃メール3パターン）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
各パターン【件名＋本文10〜15行】を、実際にそのまま送信できるレベルの完成度で書くこと。
※本文中の企業名は「貴社」と表現すること
※各メールで${companyName}のリサーチ情報（業界・課題・ニュース）に必ず具体的に言及すること
※すべて${isReferral ? '紹介リードへのフォローアップ前提で書くこと。「資料DL」「問い合わせ」等のインバウンド表現は使わないこと' : 'インバウンドリード（資料DL・問い合わせ済み）へのフォローアップ前提で書くこと'}
★★★ 最重要：サービス範囲の厳守 ★★★
- 提案内容は「提供サービス：${serviceName}」「サービス概要：${serviceDescription ? serviceDescription.substring(0, 100) : ''}」の範囲内に限定すること
- サービスが提供していない機能・ソリューション（例：専用プラットフォーム、コンサルティング、データ分析基盤等）を勝手に追加提案しないこと
- 箇条書きで改善ポイントを挙げる場合も、必ずサービスの実際の提供内容に基づくこと
- 導入事例の数値は捏造せず「改善が見られました」程度の柔らかい表現に留めること
- 「無料診断」「ROI試算」「ベンチマーク」等、サービスメニューに存在しない提案は避け、サービスの実際の機能・強みに基づいた提案をすること

${isReferral
  ? `パターン1【3日後・未返信時】：
件名例：「ご紹介の御礼と${(research as any).industry || '同業'}業界の活用事例について」
本文：「先日はご紹介を通じてご連絡させていただきました」から始める→${companyName}の課題に対して${serviceName || '弊社サービス'}がどう貢献できるかの具体例を1つ紹介（サービスの実際の提供範囲内で。企業名はA社で伏せる）→${schedulingUrl ? `日程調整URL（${schedulingUrl}）への誘導` : '「15分だけでもお話しできませんか」と低いハードルで再提案'}→「お電話でもお気軽に」で締める

パターン2【1週間後・未返信時】：
件名例：「${(research as any).industry || '同業'}業界での${serviceName || '弊社サービス'}活用のご提案」
本文：「先日はご紹介を通じてご連絡させていただきました。お忙しいところ恐れ入ります」→今回は売り込みではなく${serviceName || '弊社サービス'}で貴社の業務にどう貢献できるかの具体的なポイントを2〜3つ箇条書き（サービスの実際の提供内容に基づくこと）→${schedulingUrl ? `日程調整URL（${schedulingUrl}）から予約可能と伝える` : 'メール返信だけでOKと伝える'}`
  : `パターン1【3日後・未返信時】：
件名例：「ご請求資料の補足と${(research as any).industry || '同業'}業界の活用事例について」
本文：「先日は資料をご請求いただきありがとうございました」から始める→${companyName}の課題に対して${serviceName || '弊社サービス'}がどう貢献できるかの具体例を1つ紹介（サービスの実際の提供範囲内で。企業名はA社で伏せる）→${schedulingUrl ? `日程調整URL（${schedulingUrl}）への誘導` : '「15分だけでもお話しできませんか」と低いハードルで再提案'}→「お電話でもお気軽に」で締める

パターン2【1週間後・未返信時】：
件名例：「${(research as any).industry || '同業'}業界での${serviceName || '弊社サービス'}活用のご提案」
本文：「先日は資料をご請求いただきありがとうございました。お忙しいところ恐れ入ります」→今回は売り込みではなく${serviceName || '弊社サービス'}で貴社の業務にどう貢献できるかの具体的なポイントを2〜3つ箇条書き（サービスの実際の提供内容に基づくこと）→${schedulingUrl ? `日程調整URL（${schedulingUrl}）から予約可能と伝える` : 'メール返信だけでOKと伝える'}`}

パターン3【1ヶ月後・掘り起こし】：
件名例：「改めてのご提案｜${(research as any).industry || '同業'}業界の最新活用事例」
本文：1ヶ月前のコンタクトを自然に振り返る（押し売り感を出さない）→「改めてお役に立てることがあるのではと思いご連絡しました」というスタンス→${companyName}の推定される経営課題に具体的に言及→その課題に対して${serviceName || '弊社サービス'}がどう貢献できるかを具体的にアピール（サービスの実際の提供内容に基づくこと）→${schedulingUrl ? `日程調整URL（${schedulingUrl}）への誘導` : 'メール返信だけでOKと伝える'}→300〜400文字程度

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

      const phoneScriptMatch = responseText.match(/\[PHONE_SCRIPT\]([\s\S]*?)(?=\[|$)/);
      const followupMatches = responseText.match(/\[FOLLOWUP_SCENARIO_\d\]([\s\S]*?)(?=\[|$)/g);

      return {
        phone_script: phoneScriptMatch ? cleanBrokenSentences(stripMarkdownFormatting(phoneScriptMatch[1].trim())) : undefined,
        follow_up_scenarios: followupMatches
          ? followupMatches.map((m) => cleanBrokenSentences(stripMarkdownFormatting(m.replace(/\[FOLLOWUP_SCENARIO_\d\]/, '').trim())))
          : undefined,
      };
    } catch (error) {
      // Stage 3: Smart sub-output fallback
      console.warn('[AI] Sub-output generation failed, using smart templates:', (error as Error).message);
      return getSmartSubOutputs(companyName, research, settings);
    }
  }

  private getSixMonthsAgoLabel(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}年${m}月`;
  }

  async analyzeResearch(
    companyName: string,
    scrapedContent: string,
    newsArticles: string[],
    searchUrls?: Array<{ title: string; url: string }>
  ): Promise<CompanyResearch> {
    try {
      const newsContext = newsArticles.slice(0, 10).join('\n');
      const hasSearchUrls = searchUrls && searchUrls.length > 0;
      const urlContext = hasSearchUrls
        ? searchUrls!.map((u, i) => `${i + 1}. ${u.title}\n   URL: ${u.url}`).join('\n')
        : '';

      const sixMonthsAgo = this.getSixMonthsAgoLabel();
      const todayStr = new Date().toISOString().slice(0, 10);

      const prompt = `あなたはインサイドセールス（IS）のリサーチアナリストです。以下の企業について営業アプローチのための調査分析を行ってください。

★本日の日付：${todayStr}

企業名：${companyName}

【スクレイプ内容・検索スニペット】
${scrapedContent.substring(0, 5000)}

【ニュース記事スニペット】
${newsContext}

${urlContext ? `【確認済み検索結果URL一覧（このリストのURLのみ使用すること）】\n${urlContext}` : '【注意】検索結果URLは提供されていません。'}

以下の情報を抽出して、JSON形式で出力してください。

■ URL出力に関する厳守ルール（最重要 — URLが空だとリンクが表示されないため、必ず埋めること）：
1. homepage_url: 上記【確認済み検索結果URL一覧】から企業の「会社概要」ページURLを最優先で特定してください。会社概要ページとは、従業員数・資本金・設立年・所在地などの企業基本情報が載っているページです（例: https://smarthr.co.jp/company/ のようなURL）。パスが "/company", "/about", "/corporate", "/company/overview" 等のURLを優先してください。そのようなURLが見つからない場合はルートURL（例: https://example.co.jp）でも構いません。リストに企業ドメインが1つもない場合のみ "" にしてください。
2. business_url: 上記リストから事業・サービス・製品ページURL（パスに /service, /product, /solution, /platform 等を含むURL）を特定してください。見つからない場合はhomepage_urlと同じ値にしてください。絶対に空にしないこと。
3. newsのurl: 【上記【確認済み検索結果URL一覧】に記載のURLのみ使用すること】。各ニュース項目に最も関連性の高いURLを割り当ててください。★最重要：7件すべてにURLを割り当てること（url: ""は極力避ける）。タイトルと完全一致しなくても、関連性があればURLを割り当ててOKです（例：同じ企業のプレスリリースURLなら関連ニュースに割り当てて良い）。7件すべてにURLを割り当てることが絶対条件です。どうしてもURLが見つからない最後の1件のみurl: ""を許容します。

■ ニュース出力に関する重要ルール：
- newsは【必ず7件】出力してください。これは絶対条件です。7件ちょうど出力すること。
- 各ニュースにはtitle, summary, url, dateの4項目を含めてください。
- 【鮮度の最重要ルール】直近6ヶ月以内（${sixMonthsAgo}以降）のニュースのみを採用してください。2024年以前や半年より古いニュースは絶対に使わないこと。直近6ヶ月のニュースが7件見つからない場合は、企業の最新プレスリリース、IR情報、決算発表、採用情報、業界動向なども含めて7件にしてください。
- 検索結果から7件抽出できない場合でも、必ず7件出力すること。足りない分は業界の最新トレンドや企業の事業展開に関する最新情報で補完してください。
- 各ニュースのurlは【確認済み検索結果URL一覧】のURLのみ使用し、URLが不明な場合は必ずurl: ""に設定すること。URLを作り上げることは厳禁。★ただし、7件すべてにURLを割り当てることを最優先で試みること。
- 各ニュースのdateは「YYYY-MM-DD」形式（例: "2025-03-15"）または「YYYY-MM」形式で出力してください。年のみの場合は「YYYY」でもOKです。スニペットや検索結果から日付を推定してください。

■ 最重要注意事項：「pains」について ※ここを間違えると意味のない出力になります
「pains」には【${companyName}という企業自体が組織として直面していると推測される経営課題・業務課題】を記載してください。

★ よくある間違い（絶対に避けること）：
${companyName}が「サービスを提供している企業」の場合、${companyName}の顧客が抱える課題を書いてしまうケースがあります。
例えば${companyName}がHRテックサービスを提供している場合、「採用業務の非効率」は${companyName}の顧客の課題であり、${companyName}自身の課題ではありません。

★ 正しい「pains」の考え方：
${companyName}の中の人（経営者・従業員）が日々の事業運営で困っていることは何か？を考えてください。
- 事業成長に伴う組織拡大の課題（採用難、組織文化の維持、マネジメント体制）
- 競合環境の変化への対応（新規参入者、価格競争、技術革新への追従）
- 事業拡大の壁（新規市場開拓、海外展開、顧客単価向上、チャーン防止）
- 社内オペレーションの課題（部門間連携、レガシーシステム、データ活用）
- 収益構造の課題（利益率改善、コスト構造の最適化、投資判断）
など、${companyName}の業界・規模・事業段階・ビジネスモデルに応じた具体的な課題を5つ挙げてください。

{
  "company_name": "企業名",
  "overview": "企業の概要説明（2-3文）",
  "business": "主要な事業内容の詳細説明（3-5文）",
  "industry": "業界名",
  "stage": "事業段階（スタートアップ/成長期/成熟期など）",
  "employees": "従業員数（数値のみ、不明な場合はnull）",
  "homepage_url": "企業の会社概要ページURL（/company, /about等を優先。なければルートURL。不明な場合は空文字\"\"）",
  "business_url": "企業の事業・サービス・製品紹介ページURL（検索結果URLリストから特定。不明な場合はhomepage_urlと同じ）",
  "news": [{"title": "ニュースタイトル", "summary": "要約（1文）", "url": "検索結果URLリストのURL（リストにない場合は必ず\"\"）", "date": "YYYY-MM-DD形式（例:2024-03-15）"}],
  "pains": ["${companyName}自体が直面する経営課題1", "${companyName}自体が直面する業務課題2", "課題3", "課題4", "課題5"],
  "hypothesis": "このサービスが${companyName}の上記課題解決に役立つと思われる仮説（1-2文）"
}

【最終確認】
- newsのurlは【確認済み検索結果URL一覧】にあるURLのみ使用。リスト外URLは捏造禁止。不明なら""に設定。
- newsは必ず7件ちょうど出力すること（7件未満は不可、8件以上も不要）
- 7件すべてのnewsにURLを割り当てること（最優先事項）
- dateは必ずYYYY-MM-DD形式（またはYYYY-MM、YYYY）で出力
- 直近6ヶ月以内（${sixMonthsAgo}以降）のニュースのみ採用すること。それより古い情報は絶対に使わない。dateが${sixMonthsAgo}より前のニュースは出力禁止`;

      const responseText = await callAI(prompt);

      // Strip markdown code fences if present, then extract JSON
      const cleanedText = responseText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '');
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
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
    ];

    for (const { key, name } of patternNames) {
      const patternRegex = new RegExp(`\\[${key}\\]([\\s\\S]*?)(?=\\[PATTERN_|$)`, 'i');
      const match = responseText.match(patternRegex);

      if (match) {
        const content = match[1].trim();
        const subjectMatch = content.match(/件名[：:]\s*(.+?)(?:\n|$)/);
        const bodyMatch = content.match(/本文[：:]\s*([\s\S]+?)$/);

        if (subjectMatch && bodyMatch) {
          const rawSubject = stripMarkdownFormatting(subjectMatch[1].trim());
          let rawBody = stripMarkdownFormatting(bodyMatch[1].trim());
          rawBody = cleanBrokenSentences(rawBody);
          if (companyName) rawBody = replaceCompanyNameInBody(rawBody, companyName);
          if (settings) rawBody = appendSignature(rawBody, settings);
          patterns.push({
            patternName: name,
            subject: normalizeSubject(rawSubject),
            body: rawBody,
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

    return patterns.length >= 4 ? patterns.slice(0, 4) : patterns;
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
    ];
  }
}

export const geminiService = new GeminiService();
