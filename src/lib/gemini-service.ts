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

  const url = baseUrl.endsWith('/generate') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
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
  try {
    console.log('[AI] Trying Cloud Run...');
    const result = await callCloudRun(prompt);
    console.log('[AI] Cloud Run succeeded');
    return result;
  } catch (cloudRunError) {
    console.warn('[AI] Cloud Run failed:', (cloudRunError as Error).message);
  }

  try {
    console.log('[AI] Trying Gemini API Direct...');
    const result = await callGeminiDirect(prompt);
    console.log('[AI] Gemini API Direct succeeded');
    return result;
  } catch (geminiError) {
    console.warn('[AI] Gemini API Direct failed:', (geminiError as Error).message);
  }

  throw new Error('All AI providers failed (Cloud Run + Gemini API Direct)');
}

// ============================================================
// Helper: extract settings fields safely
// ============================================================
function extractSettings(settings: CustomSettings) {
  const s = settings || ({} as CustomSettings);
  return {
    senderName: (s as any).sender_name || s.senderName || '',
    senderTitle: (s as any).sender_title || s.senderTitle || '',
    senderCompany: (s as any).sender_company || s.senderCompany || s.company || '',
    senderEmail: (s as any).sender_email || '',
    senderPhone: (s as any).sender_phone || s.phoneNumber || '',
    serviceName: (s as any).service_name || s.serviceInfo?.name || '',
    serviceDescription: (s as any).service_description || s.serviceInfo?.description || '',
    serviceBenefit: (s as any).service_benefit || s.serviceInfo?.strengths?.join('\n') || '',
    servicePrice: (s as any).service_price || s.serviceInfo?.price || '',
    serviceResults: (s as any).service_results || s.serviceInfo?.results || '',
    tone: (s as any).tone || s.promptSettings?.tone || '',
  };
}

// ============================================================
// Helper: extract research fields safely
// ============================================================
function extractResearch(research: CompanyResearch) {
  const r = research || ({} as CompanyResearch);
  return {
    companyName: r.company_name || r.companyName || '',
    overview: r.overview || '',
    business: r.business || (r as any).businessDescription || '',
    industry: r.industry || '',
    stage: r.stage || '',
    employees: r.employees || (r as any).employeeCount || '',
    pains: r.pains || (r as any).painPoints || [],
    hypothesis: r.hypothesis || '',
    news: (r.news || (r as any).latestNews || []).map((n: any) => ({
      title: n.title || '',
      url: n.url || '',
      date: n.date || '',
      summary: n.summary || '',
    })),
  };
}

// ============================================================
// Smart Template Fallbacks
// ============================================================
function getSmartEmailPatterns(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): EmailPattern[] {
  const r = extractResearch(research);
  const s = extractSettings(settings);
  const senderName = s.senderName || '\u3054\u62c5\u5f53';
  const senderCompany = s.senderCompany || '\u5f0a\u793e';
  const serviceName = s.serviceName ? `\u300c${s.serviceName}\u300d` : '\u5f0a\u793e\u30b5\u30fc\u30d3\u30b9';
  const pain1 = r.pains[0] || '\u696d\u52d9\u30d7\u30ed\u30bb\u30b9\u306e\u6539\u5584';
  const pain2 = r.pains[1] || '\u7d44\u7e54\u306e\u751f\u7523\u6027\u5411\u4e0a';
  const pain3 = r.pains[2] || '\u30b3\u30b9\u30c8\u6700\u9069\u5316';
  const industryMention = r.industry ? `${r.industry}\u696d\u754c\u306b\u304a\u3044\u3066` : '';
  const companyContext = r.overview
    ? `${companyName}\u69d8\u306e${r.overview.substring(0, 50)}\u306b\u95a2\u9023\u3057\u3066`
    : `${companyName}\u69d8\u306e\u4e8b\u696d\u306b\u95a2\u9023\u3057\u3066`;

  return [
    {
      patternName: '\u7d4c\u55b6\u5c64\u5411\u3051\uff08ROI\u8a34\u6c42\uff09',
      subject: `${companyName}\u69d8\u306e${pain1}\u306b\u95a2\u3059\u308b\u3054\u63d0\u6848`,
      body: `${companyName}\n\u3054\u62c5\u5f53\u8005\u69d8\n\n\u3044\u3064\u3082\u304a\u4e16\u8a71\u306b\u306a\u3063\u3066\u304a\u308a\u307e\u3059\u3002${senderCompany}\u306e${senderName}\u3067\u3059\u3002\n\n${industryMention}${companyContext}\u3001\u3054\u9023\u7d61\u3044\u305f\u3057\u307e\u3057\u305f\u3002\n\n${companyName}\u69d8\u306b\u304a\u304b\u308c\u307e\u3057\u3066\u306f\u300c${pain1}\u300d\u304c\u91cd\u8981\u306a\u7d4c\u55b6\u30c6\u30fc\u30de\u3067\u306f\u306a\u3044\u304b\u3068\u8003\u3048\u3066\u304a\u308a\u307e\u3059\u3002${serviceName}\u306f\u696d\u52d9\u52b9\u7387\u5316\u3068\u6210\u679c\u5411\u4e0a\u3092\u5b9f\u73fe\u3057\u307e\u3059\u3002\n\n\u5c0e\u5165\u4f01\u696d\u69d8\u3067\u306f\u5e73\u5747\u3057\u306620\uff5e30%\u306e\u696d\u52d9\u52b9\u7387\u6539\u5584\u3092\u5b9f\u73fe\u3055\u308c\u3066\u304a\u308a\u3001\u8cb4\u793e\u3067\u3082\u540c\u69d8\u306e\u6210\u679c\u304c\u671f\u5f85\u3067\u304d\u308b\u3068\u8003\u3048\u3066\u304a\u308a\u307e\u3059\u3002\n\n\u305c\u3072\u4e00\u5ea6\u300130\u5206\u7a0b\u5ea6\u306e\u304a\u6642\u9593\u3092\u3044\u305f\u3060\u304d\u3001\u5177\u4f53\u7684\u306a\u4e8b\u4f8b\u3068\u8cb4\u793e\u3078\u306e\u9069\u7528\u30a4\u30e1\u30fc\u30b8\u3092\u3054\u8aac\u660e\u3055\u305b\u3066\u3044\u305f\u3060\u3051\u308c\u3070\u5e78\u3044\u3067\u3059\u3002\n\n\u3054\u90fd\u5408\u306e\u3088\u308d\u3057\u3044\u65e5\u6642\u3092\u3054\u6559\u793a\u3044\u305f\u3060\u3051\u307e\u3059\u3067\u3057\u3087\u3046\u304b\u3002\n\n\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002`,
      targetPersona: 'executive',
      description: '\u7d4c\u55b6\u5c64\u5411\u3051\uff08ROI\u8a34\u6c42\uff09',
    },
    {
      patternName: '\u73fe\u5834\u8cac\u4efb\u8005\u5411\u3051\uff08\u52b9\u7387\u5316\u8a34\u6c42\uff09',
      subject: `${pain2}\u3092\u5b9f\u73fe\u3059\u308b\u65b0\u3057\u3044\u30a2\u30d7\u30ed\u30fc\u30c1\u306e\u3054\u7d39\u4ecb`,
      body: `${companyName}\n\u3054\u62c5\u5f53\u8005\u69d8\n\n\u304a\u75b2\u308c\u69d8\u3067\u3059\u3002${senderCompany}\u306e${senderName}\u3067\u3059\u3002\n\n${companyName}\u69d8\u306e${r.industry ? r.industry + '\u4e8b\u696d' : '\u4e8b\u696d'}\u306b\u304a\u3044\u3066\u3001\u300c${pain2}\u300d\u306f\u73fe\u5834\u30ec\u30d9\u30eb\u3067\u3082\u8ab2\u984c\u306b\u306a\u3063\u3066\u3044\u308b\u306e\u3067\u306f\u306a\u3044\u3067\u3057\u3087\u3046\u304b\u3002\n\n${serviceName}\u306f\u3001\u73fe\u5834\u306e\u30aa\u30da\u30ec\u30fc\u30b7\u30e7\u30f3\u3092\u52b9\u7387\u5316\u3057\u3001\u30c1\u30fc\u30e0\u5168\u4f53\u306e\u751f\u7523\u6027\u3092\u5927\u5e45\u306b\u5411\u4e0a\u3055\u305b\u308b\u30bd\u30ea\u30e5\u30fc\u30b7\u30e7\u30f3\u3067\u3059\u3002\n\n\u65e2\u5b58\u306e\u696d\u52d9\u30d5\u30ed\u30fc\u3092\u5927\u304d\u304f\u5909\u3048\u308b\u3053\u3068\u306a\u304f\u5c0e\u5165\u3044\u305f\u3060\u3051\u308b\u305f\u3081\u3001\u73fe\u5834\u3078\u306e\u8ca0\u62c5\u3092\u6700\u5c0f\u9650\u306b\u6291\u3048\u3089\u308c\u307e\u3059\u3002\n\n15\u5206\u7a0b\u5ea6\u306e\u7c21\u5358\u306a\u30c7\u30e2\u30f3\u30b9\u30c8\u30ec\u30fc\u30b7\u30e7\u30f3\u3067\u3001\u5177\u4f53\u7684\u306a\u52b9\u679c\u3092\u304a\u793a\u3057\u3067\u304d\u307e\u3059\u3002\u3054\u8208\u5473\u304c\u3054\u3056\u3044\u307e\u3057\u305f\u3089\u304a\u6c17\u8efd\u306b\u304a\u58f0\u304c\u3051\u304f\u3060\u3055\u3044\u3002\n\n\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002`,
      targetPersona: 'manager',
      description: '\u73fe\u5834\u8cac\u4efb\u8005\u5411\u3051\uff08\u52b9\u7387\u5316\u8a34\u6c42\uff09',
    },
    {
      patternName: '\u62c5\u5f53\u8005\u5411\u3051\uff08\u6642\u77ed\u8a34\u6c42\uff09',
      subject: `\u65e5\u3005\u306e${pain3.includes('\u30b3\u30b9\u30c8') ? '\u696d\u52d9\u5de5\u6570' : pain3}\u3092\u5927\u5e45\u306b\u524a\u6e1b\u3059\u308b\u65b9\u6cd5`,
      body: `${companyName}\n\u3054\u62c5\u5f53\u8005\u69d8\n\n\u304a\u75b2\u308c\u69d8\u3067\u3059\u3002${senderCompany}\u306e${senderName}\u3067\u3059\u3002\n\n\u65e5\u3005\u306e\u696d\u52d9\u306e\u4e2d\u3067\u3001\u7e70\u308a\u8fd4\u3057\u306e\u4f5c\u696d\u3084\u624b\u52d5\u306e\u30d7\u30ed\u30bb\u30b9\u306b\u6642\u9593\u3092\u53d6\u3089\u308c\u3066\u3044\u307e\u305b\u3093\u304b\uff1f\n\n${serviceName}\u3092\u5c0e\u5165\u3044\u305f\u3060\u304f\u3068\u3001\u5b9a\u578b\u696d\u52d9\u306e\u81ea\u52d5\u5316\u306b\u30881\u65e5\u3042\u305f\u308a\u7d041\u6642\u9593\u306e\u6642\u9593\u77ed\u7e2e\u304c\u53ef\u80fd\u3067\u3059\u3002\n\n\u305d\u306e\u5206\u306e\u6642\u9593\u3092\u3001\u3088\u308a\u4ed8\u52a0\u4fa1\u5024\u306e\u9ad8\u3044\u696d\u52d9\u306b\u5145\u3066\u308b\u3053\u3068\u304c\u3067\u304d\u307e\u3059\u3002\n\n\u7121\u6599\u30c8\u30e9\u30a4\u30a2\u30eb\u3082\u3054\u7528\u610f\u3057\u3066\u304a\u308a\u307e\u3059\u306e\u3067\u3001\u307e\u305a\u306f\u304a\u8a66\u3057\u3044\u305f\u3060\u3051\u308c\u3070\u3068\u601d\u3044\u307e\u3059\u3002\n\n\u3044\u304b\u304c\u3067\u3057\u3087\u3046\u304b\uff1f`,
      targetPersona: 'staff',
      description: '\u62c5\u5f53\u8005\u5411\u3051\uff08\u6642\u77ed\u8a34\u6c42\uff09',
    },
    {
      patternName: '\u77ed\u6587\u30b9\u30c8\u30ec\u30fc\u30c8\u578b',
      subject: `${companyName}\u69d8\u3078\uff5c${serviceName}\u306e\u3054\u7d39\u4ecb`,
      body: `${companyName}\n\u3054\u62c5\u5f53\u8005\u69d8\n\n\u304a\u4e16\u8a71\u306b\u306a\u3063\u3066\u304a\u308a\u307e\u3059\u3002${senderCompany}\u306e${senderName}\u3067\u3059\u3002\n\n${companyName}\u69d8\u306e\u300c${pain1}\u300d\u306b\u8ca2\u732e\u3067\u304d\u308b\u30b5\u30fc\u30d3\u30b9\u3092\u3054\u7d39\u4ecb\u3055\u305b\u3066\u304f\u3060\u3055\u3044\u3002\n\n${serviceName}\u306f\u591a\u304f\u306e\u4f01\u696d\u69d8\u3067\u696d\u52d9\u6539\u5584\u306e\u5b9f\u7e3e\u304c\u3054\u3056\u3044\u307e\u3059\u3002\n\n30\u5206\u306e\u30aa\u30f3\u30e9\u30a4\u30f3\u9762\u8ac7\u3067\u3001\u8cb4\u793e\u3078\u306e\u5177\u4f53\u7684\u306a\u30e1\u30ea\u30c3\u30c8\u3092\u304a\u4f1d\u3048\u3067\u304d\u307e\u3059\u3002\n\n\u3054\u691c\u8a0e\u3044\u305f\u3060\u3051\u307e\u3059\u3068\u5e78\u3044\u3067\u3059\u3002`,
      targetPersona: 'general',
      description: '\u77ed\u6587\u30b9\u30c8\u30ec\u30fc\u30c8\u578b',
    },
  ];
}

function getSmartSubOutputs(
  companyName: string,
  research: CompanyResearch,
  settings: CustomSettings
): { phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] } {
  const r = extractResearch(research);
  const s = extractSettings(settings);
  const serviceName = s.serviceName || '\u5f53\u30b5\u30fc\u30d3\u30b9';
  const senderCompany = s.senderCompany || '\u5f0a\u793e';
  const pain1 = r.pains[0] || '\u696d\u52d9\u6539\u5584';

  return {
    phone_script: `\u304a\u5fd9\u3057\u3044\u3068\u3053\u308d\u6050\u308c\u5165\u308a\u307e\u3059\u3002${senderCompany}\u306e\u25cb\u25cb\u3068\u7533\u3057\u307e\u3059\u3002\u5148\u65e5\u304a\u9001\u308a\u3057\u305f\u30e1\u30fc\u30eb\u306e\u4ef6\u3067\u304a\u96fb\u8a71\u3044\u305f\u3057\u307e\u3057\u305f\u3002${companyName}\u69d8\u306e${pain1}\u306b\u3064\u3044\u3066\u3001\u4ed6\u793e\u69d8\u306e\u5c0e\u5165\u4e8b\u4f8b\u3092\u3082\u3068\u306b\u5177\u4f53\u7684\u306a\u3054\u63d0\u6848\u304c\u3067\u304d\u308c\u3070\u3068\u601d\u3063\u3066\u304a\u308a\u307e\u3059\u30023\u5206\u307b\u3069\u304a\u6642\u9593\u3088\u308d\u3057\u3044\u3067\u3057\u3087\u3046\u304b\uff1f`,
    video_prompt: `${r.industry ? r.industry + '\u696d\u754c\u3067\u6d3b\u8e8d\u3059\u308b' : ''}${companyName}\u306e\u30aa\u30d5\u30a3\u30b9\u3092\u30a4\u30e1\u30fc\u30b8\u3057\u305f\u80cc\u666f\u3002\u30c6\u30ad\u30b9\u30c8\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u3067\u300c${pain1}\u3092\u89e3\u6c7a\u300d\u3068\u8868\u793a\u3002${serviceName}\u306e\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u753b\u9762\u3092\u6620\u3057\u3001\u52b9\u7387\u5316\u306e\u30d3\u30d5\u30a9\u30fc\u30a2\u30d5\u30bf\u30fc\u3092\u8996\u899a\u7684\u306b\u8868\u73fe\u300230\u79d2\u3001\u30d7\u30ed\u30d5\u30a7\u30c3\u30b7\u30e7\u30ca\u30eb\u306a\u30c8\u30fc\u30f3\u3002`,
    follow_up_scenarios: [
      `\u30103\u65e5\u5f8c\u30fb\u672a\u8fd4\u4fe1\u6642\u3011\u4ef6\u540d\uff1a\u300c\u5148\u65e5\u306e\u3054\u63d0\u6848\u306e\u88dc\u8db3\u8cc7\u6599\u3092\u304a\u9001\u308a\u3057\u307e\u3059\u300d\n${companyName}\u69d8\u306e${pain1}\u306b\u95a2\u3057\u3066\u3001\u5c0e\u5165\u4e8b\u4f8b\u8cc7\u6599\u3092\u304a\u9001\u308a\u3057\u307e\u3059\u3002\u3054\u53c2\u8003\u306b\u306a\u308c\u3070\u5e78\u3044\u3067\u3059\u3002`,
      `\u30101\u9031\u9593\u5f8c\u30fb\u672a\u8fd4\u4fe1\u6642\u3011\u4ef6\u540d\uff1a\u300c${companyName}\u69d8\u5411\u3051\u306e\u7121\u6599\u8a3a\u65ad\u306e\u3054\u6848\u5185\u300d\n\u7121\u6599\u3067\u696d\u52d9\u52b9\u7387\u8a3a\u65ad\u3092\u5b9f\u65bd\u3057\u3066\u304a\u308a\u307e\u3059\u3002\u73fe\u72b6\u306e\u8ab2\u984c\u3092\u53ef\u8996\u5316\u3057\u3001\u6539\u5584\u30dd\u30a4\u30f3\u30c8\u3092\u30ec\u30dd\u30fc\u30c8\u3068\u3057\u3066\u304a\u6e21\u3057\u3057\u307e\u3059\u3002`,
      `\u3010\u8fd4\u4fe1\u3042\u308a\u30fb\u95a2\u5fc3\u3042\u308a\u3011\u4ef6\u540d\uff1a\u300c\u3054\u8fd4\u4fe1\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\uff5c\u65e5\u7a0b\u8abf\u6574\u306e\u3054\u76f8\u8ac7\u300d\n\u3054\u95a2\u5fc3\u3092\u3044\u305f\u3060\u304d\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002\u5177\u4f53\u7684\u306a\u30c7\u30e2\u3068\u4e8b\u4f8b\u7d39\u4ecb\u309230\u5206\u3067\u3054\u8aac\u660e\u3055\u305b\u3066\u304f\u3060\u3055\u3044\u3002`,
    ],
  };
}

// ============================================================
// GeminiService class
// ============================================================
export class GeminiService {

  // --------------------------------------------------------
  // analyzeResearch: called from research-service.ts
  // Signature matches: (companyName, content, newsArticles, urls)
  // Returns: CompanyResearch
  // --------------------------------------------------------
  async analyzeResearch(
    companyName: string,
    content: string,
    newsArticles: string[],
    urls: Array<{ title: string; url: string }>
  ): Promise<CompanyResearch> {
    try {
      const newsContext = newsArticles.length > 0
        ? newsArticles.slice(0, 10).join('\n')
        : '';
      const urlContext = urls.length > 0
        ? urls.slice(0, 10).map((u) => `- ${u.title}: ${u.url}`).join('\n')
        : '';

      const prompt = `\u3042\u306a\u305f\u306f\u4f01\u696d\u8abf\u67fb\u306e\u5c02\u9580\u5bb6\u3067\u3059\u3002\u4ee5\u4e0b\u306e\u60c5\u5831\u3092\u3082\u3068\u306b\u3001${companyName}\u306b\u3064\u3044\u3066\u8a73\u7d30\u306a\u8abf\u67fb\u30ec\u30dd\u30fc\u30c8\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002

\u3010\u53ce\u96c6\u6e08\u307f\u60c5\u5831\u3011
${content || `${companyName}\u306b\u3064\u3044\u3066\u3001\u3042\u306a\u305f\u306e\u77e5\u8b58\u306b\u57fa\u3065\u3044\u3066\u5206\u6790\u3057\u3066\u304f\u3060\u3055\u3044\u3002`}

${newsContext ? `\u3010\u95a2\u9023\u30cb\u30e5\u30fc\u30b9\u3011\n${newsContext}` : ''}

${urlContext ? `\u3010\u53c2\u7167URL\u3011\n${urlContext}` : ''}

\u4ee5\u4e0b\u306e\u5f62\u5f0f\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u5404\u30bb\u30af\u30b7\u30e7\u30f3\u306f\u5fc5\u305a\u5177\u4f53\u7684\u306a\u60c5\u5831\u3092\u542b\u3081\u3066\u304f\u3060\u3055\u3044\u3002\u300c\u60c5\u5831\u306a\u3057\u300d\u3084\u300c\u4e0d\u660e\u300d\u3068\u306f\u66f8\u304b\u305a\u3001\u3042\u306a\u305f\u306e\u77e5\u8b58\u304b\u3089\u63a8\u6e2c\u3057\u3066\u5177\u4f53\u7684\u306b\u8a18\u8f09\u3057\u3066\u304f\u3060\u3055\u3044\u3002

[OVERVIEW]
${companyName}\u306e\u4f01\u696d\u6982\u8981\u3092100-200\u6587\u5b57\u3067\u8a18\u8f09\u3002\u8a2d\u7acb\u5e74\u3001\u672c\u793e\u6240\u5728\u5730\u3001\u4e3b\u306a\u4e8b\u696d\u9818\u57df\u3001\u5e02\u5834\u3067\u306e\u30dd\u30b8\u30b7\u30e7\u30f3\u3092\u542b\u3081\u308b\u3002

[INDUSTRY]
\u696d\u754c\u540d\u3092\u7c21\u6f54\u306b\u8a18\u8f09\uff08\u4f8b\uff1aIT\u30fb\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2\u3001\u88fd\u9020\u696d\u3001\u4e0d\u52d5\u7523\u306a\u3069\uff09

[BUSINESS]
\u4e3b\u306a\u4e8b\u696d\u5185\u5bb9\u30fb\u30b5\u30fc\u30d3\u30b9\u30fb\u88fd\u54c1\u3092150-300\u6587\u5b57\u3067\u8a18\u8f09\u3002\u53ce\u76ca\u6e90\u3001\u4e3b\u8981\u30b5\u30fc\u30d3\u30b9\u3001\u30bf\u30fc\u30b2\u30c3\u30c8\u5e02\u5834\u3092\u542b\u3081\u308b\u3002

[STAGE]
\u4f01\u696d\u306e\u6210\u9577\u30b9\u30c6\u30fc\u30b8\uff08\u4f8b\uff1a\u30b9\u30bf\u30fc\u30c8\u30a2\u30c3\u30d7\u3001\u6210\u9577\u671f\u3001\u6210\u719f\u671f\u3001\u4e0a\u5834\u4f01\u696d\u306a\u3069\uff09

[EMPLOYEES]
\u5f93\u696d\u54e1\u6570\u306e\u63a8\u5b9a\uff08\u6570\u5024\u306e\u307f\u3002\u4e0d\u660e\u306a\u5834\u5408\u306f\u63a8\u5b9a\u5024\u3092\u8a18\u8f09\uff09

[NEWS_1]
\u30bf\u30a4\u30c8\u30eb\uff1a\uff08\u6700\u65b0\u30cb\u30e5\u30fc\u30b9\u306e\u30bf\u30a4\u30c8\u30eb\uff09
\u8981\u7d04\uff1a\uff08\u30cb\u30e5\u30fc\u30b9\u306e\u8981\u7d04\u30011-2\u6587\uff09
URL\uff1a\uff08\u3042\u308c\u3070URL\uff09
\u30bd\u30fc\u30b9\uff1a\uff08\u60c5\u5831\u6e90\uff09

[NEWS_2]
\u30bf\u30a4\u30c8\u30eb\uff1a\uff08\u6b21\u306e\u30cb\u30e5\u30fc\u30b9\uff09
\u8981\u7d04\uff1a\uff08\u8981\u7d04\uff09
URL\uff1a\uff08URL\uff09
\u30bd\u30fc\u30b9\uff1a\uff08\u60c5\u5831\u6e90\uff09

[NEWS_3]
\u30bf\u30a4\u30c8\u30eb\uff1a\uff08\u6b21\u306e\u30cb\u30e5\u30fc\u30b9\uff09
\u8981\u7d04\uff1a\uff08\u8981\u7d04\uff09
URL\uff1a\uff08URL\uff09
\u30bd\u30fc\u30b9\uff1a\uff08\u60c5\u5831\u6e90\uff09

[PAIN_1]
\u8ab2\u984c\u4eee\u8aac1\uff1a${companyName}\u304c\u76f4\u9762\u3057\u3066\u3044\u308b\u3068\u63a8\u6e2c\u3055\u308c\u308b\u7d4c\u55b6\u30fb\u696d\u52d9\u8ab2\u984c\u30021-2\u6587\u3067\u5177\u4f53\u7684\u306b\u8a18\u4f09\u3002

[PAIN_2]
\u8ab2\u984c\u4eee\u8aac2\uff1a\u5225\u306e\u89d2\u5ea6\u304b\u3089\u306e\u8ab2\u984c\u3002

[PAIN_3]
\u8ab2\u984c\u4eee\u8aac3\uff1a\u3055\u3089\u306b\u5225\u306e\u89d2\u5ea6\u304b\u3089\u306e\u8ab2\u984c\u3002

[HYPOTHESIS]
\u4e0a\u8a18\u306e\u8ab2\u984c\u3092\u7dcf\u5408\u3057\u305f\u30a2\u30d7\u30ed\u30fc\u30c1\u63d0\u6848\u30021-2\u6587\u3067\u3002`;

      const responseText = await callAI(prompt);
      return this.parseResearchResponse(companyName, responseText, urls);
    } catch (error) {
      console.error('[AI] Research analysis failed:', (error as Error).message);
      return {
        company_name: companyName,
        overview: `${companyName}\u306e\u4f01\u696d\u60c5\u5831`,
        news: [],
        pains: [`${companyName}\u306e\u4e8b\u696d\u62e1\u5927\u306b\u4f34\u3046\u7d44\u7e54\u8ab2\u984c`],
        scraped_at: new Date().toISOString(),
      };
    }
  }

  private parseResearchResponse(
    companyName: string,
    text: string,
    urls: Array<{ title: string; url: string }>
  ): CompanyResearch {
    const extract = (tag: string): string => {
      const regex = new RegExp(`\\[${tag}\\]\\s*([\\s\\S]*?)(?=\\[|$)`);
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const overview = extract('OVERVIEW') || `${companyName}\u306e\u4f01\u696d\u60c5\u5831`;
    const industry = extract('INDUSTRY') || '';
    const business = extract('BUSINESS') || '';
    const stage = extract('STAGE') || '';
    const employeesStr = extract('EMPLOYEES') || '';
    const employees = employeesStr.replace(/[^0-9]/g, '') || '';
    const hypothesis = extract('HYPOTHESIS') || '';

    const news: Array<{ title: string; summary?: string; url?: string; date?: string; source?: string; type?: string }> = [];
    for (let i = 1; i <= 5; i++) {
      const newsBlock = extract(`NEWS_${i}`);
      if (!newsBlock) continue;
      const titleMatch = newsBlock.match(/\u30bf\u30a4\u30c8\u30eb\uff1a\s*(.+)/);
      const summaryMatch = newsBlock.match(/\u8981\u7d04\uff1a\s*(.+)/);
      const urlMatch = newsBlock.match(/URL\uff1a\s*(.+)/);
      const sourceMatch = newsBlock.match(/\u30bd\u30fc\u30b9\uff1a\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      if (title && title !== '\uff08\u306a\u3057\uff09' && title !== '\u306a\u3057') {
        news.push({
          title,
          summary: summaryMatch ? summaryMatch[1].trim() : '',
          url: urlMatch ? urlMatch[1].trim().replace(/[\uff08\uff09\(\)]/g, '') : '',
          source: sourceMatch ? sourceMatch[1].trim() : '',
        });
      }
    }

    if (news.length === 0 && urls.length > 0) {
      for (const u of urls.slice(0, 3)) {
        news.push({ title: u.title, url: u.url });
      }
    }

    const pains: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const painBlock = extract(`PAIN_${i}`);
      if (painBlock) {
        const cleaned = painBlock.replace(/^\u8ab2\u984c\u4eee\u8aac\d+\uff1a\s*/, '').trim();
        if (cleaned && cleaned !== '\uff08\u306a\u3057\uff09' && cleaned !== '\u306a\u3057') {
          pains.push(cleaned);
        }
      }
    }

    return {
      company_name: companyName,
      overview,
      industry,
      business,
      stage,
      employees: employees ? parseInt(employees, 10) : undefined,
      news,
      pains: pains.length > 0 ? pains : [`${companyName}\u306e\u4e8b\u696d\u62e1\u5927\u306b\u4f34\u3046\u7d44\u7e54\u8ab2\u984c`],
      hypothesis,
      scraped_at: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------
  // generateEmails: called from route.ts via params object
  // --------------------------------------------------------
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
      ctaType = 'call',
      newsIdx = 0,
      freeText = '',
    } = params;
    const research = rawResearch || ({} as CompanyResearch);
    const settings = rawSettings || ({} as CustomSettings);

    try {
      const r = extractResearch(research);
      const s = extractSettings(settings);

      const personaInstructions: Record<string, string> = {
        executive: '\u7d4c\u55b6\u5c64\u5411\u3051\u306e\u30e1\u30fc\u30eb\u3002ROI\uff08\u6295\u8cc7\u5bfe\u52b9\u679c\uff09\u3068\u4e8b\u696d\u6210\u9577\u306b\u7126\u70b9\u3092\u5f53\u3066\u308b\u3002\u6570\u5b57\u3084\u5177\u4f53\u7684\u306a\u6210\u679c\u3092\u5f37\u8abf\u3059\u308b\u3002',
        manager: '\u73fe\u5834\u8cac\u4efb\u8005\u5411\u3051\u306e\u30e1\u30fc\u30eb\u3002\u696d\u52d9\u52b9\u7387\u5316\u3068\u30d7\u30ed\u30bb\u30b9\u6539\u5584\u306b\u7126\u70b9\u3092\u5f53\u3066\u308b\u3002\u904b\u7528\u8ca0\u8377\u8efd\u6e1b\u3092\u5f37\u8abf\u3059\u308b\u3002',
        staff: '\u62c5\u5f53\u8005\u5411\u3051\u306e\u30e1\u30fc\u30eb\u3002\u500b\u4eba\u306e\u696d\u52d9\u6642\u9593\u524a\u6e1b\u3068\u4f5c\u696d\u52b9\u7387\u5316\u306b\u7126\u70b9\u3092\u5f53\u3066\u308b\u3002\u65e5\u3005\u306e\u5de5\u6570\u524a\u6e1b\u3092\u5f37\u8abf\u3059\u308b\u3002',
      };

      const ctaInstructions: Record<string, string> = {
        call: 'CTA\u306f\u96fb\u8a71\u3067\u306e\u3054\u76f8\u8ac7\u3092\u4fc3\u3059\u300230\u5206\u306e\u7121\u6599\u76f8\u8ac7\u3092\u63d0\u6848\u3059\u308b\u3002',
        demo: 'CTA\u306f\u88fd\u54c1\u30c7\u30e2\u3078\u306e\u53c2\u52a0\u3092\u4fc3\u3059\u3002',
        meeting: 'CTA\u306f\u30ab\u30ec\u30f3\u30c0\u30fc\u4e88\u7d04\u306b\u3088\u308b\u65e5\u7a0b\u8abf\u6574\u3092\u4fc3\u3059\u3002',
        resource: 'CTA\u306f\u8cc7\u6599\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3092\u4fc3\u3059\u3002',
      };

      const selectedPersonaInstructions = personaInstructions[persona] || personaInstructions.executive;
      const selectedCtaInstructions = ctaInstructions[ctaType] || ctaInstructions.call;
      const newsContext = r.news.length > newsIdx ? `\u53c2\u8003\u60c5\u5831\uff1a${r.news[newsIdx].title}` : '';
      const painPoints = r.pains.slice(0, 3).join('\u3001') || '';

      const serviceContextForPrompt = this.buildServiceContext(s, r);

      const prompt = `\u3042\u306a\u305f\u306f\u65e5\u672c\u306e\u30a4\u30f3\u30b5\u30a4\u30c9\u30bb\u30fc\u30eb\u30ba(IS)\u30e1\u30fc\u30eb\u4f5c\u6210\u306e\u5c02\u9580\u5bb6\u3067\u3059\u3002\u5404\u4f01\u696d\u306e\u8abf\u67fb\u7d50\u679c\u3092\u6df1\u304f\u5206\u6790\u3057\u3001\u305d\u306e\u4f01\u696d\u306b\u3057\u304b\u901a\u7528\u3057\u306a\u3044\u3001\u9ad8\u5ea6\u306b\u500b\u5225\u5316\u3055\u308c\u305f\u30bb\u30fc\u30eb\u30b9\u30e1\u30fc\u30eb\u3092\u4f5c\u6210\u3057\u307e\u3059\u3002

\u3010\u9001\u4fe1\u8005\u60c5\u5831\u3011
\u6c0f\u540d\uff1a${s.senderName}
\u8077\u4f4d\uff1a${s.senderTitle}
\u4f1a\u793e\uff1a${s.senderCompany}

\u3010\u63d0\u4f9b\u30b5\u30fc\u30d3\u30b9\u306e\u6982\u8981\uff08\u8981\u7d04\u6e08\u307f\uff09\u3011
${serviceContextForPrompt}

\u3010\u9001\u4fe1\u5148\u4f01\u696d\u306e\u8abf\u67fb\u60c5\u5831\u3011
\u4f1a\u793e\u540d\uff1a${companyName}
\u696d\u754c\uff1a${r.industry || '\u4e0d\u660e'}
\u4e8b\u696d\u6bb5\u968e\uff1a${r.stage || '\u4e0d\u660e'}
\u5f93\u696d\u54e1\u6570\uff1a${r.employees || '\u4e0d\u660e'}
\u4e8b\u696d\u5185\u5bb9\uff1a${r.business || ''}
\u4f01\u696d\u6982\u8981\uff1a${r.overview || ''}
\u63a8\u5b9a\u3055\u308c\u308b\u8ab2\u984c\uff1a${painPoints}
${r.hypothesis ? `\u30a2\u30d7\u30ed\u30fc\u30c1\u4eee\u8aac\uff1a${r.hypothesis}` : ''}
${newsContext ? `\u6700\u65b0\u60c5\u5831\uff1a${newsContext}` : ''}

\u3010\u91cd\u8981\u306a\u6307\u793a\u3011
1. \u30e1\u30fc\u30eb\u6587\u9762\u306b\u306f\u3001\u4e0a\u8a18\u306e\u8abf\u67fb\u60c5\u5831\u304b\u3089\u5f97\u3089\u308c\u305f${companyName}\u56fa\u6709\u306e\u60c5\u5831\u3092\u5fc5\u305a\u7e54\u308a\u8fbc\u3093\u3067\u304f\u3060\u3055\u3044\u3002
2. \u300c\u696d\u52d9\u6539\u5584\u300d\u300c\u52b9\u7387\u5316\u300d\u306a\u3069\u306e\u6c4e\u7528\u7684\u306a\u8868\u73fe\u3067\u306f\u306a\u304f\u3001${companyName}\u306e\u5177\u4f53\u7684\u306a\u4e8b\u696d\u5185\u5bb9\u3084\u8ab2\u984c\u306b\u89e6\u308c\u3066\u304f\u3060\u3055\u3044\u3002
3. \u30ab\u30b9\u30bf\u30e0\u8a2d\u5b9a\u306e\u30b5\u30fc\u30d3\u30b9\u60c5\u5831\u306f\u4e0a\u8a18\u300c\u63d0\u4f9b\u30b5\u30fc\u30d3\u30b9\u306e\u6982\u8981\u300d\u3068\u3057\u3066\u8981\u7d04\u6e08\u307f\u3067\u3059\u3002\u3053\u308c\u3092\u305d\u306e\u307e\u307e\u8cbc\u308a\u4ed8\u3051\u305a\u3001${companyName}\u306e\u8ab2\u984c\u306b\u5408\u308f\u305b\u3066\u30d4\u30f3\u30dd\u30a4\u30f3\u30c8\u3067\u6d3b\u7528\u3057\u3066\u304f\u3060\u3055\u3044\u3002
4. \u30b5\u30fc\u30d3\u30b9\u306e\u5168\u6a5f\u80fd\u3092\u5217\u6319\u3059\u308b\u306e\u3067\u306f\u306a\u304f\u3001${companyName}\u306e\u8ab2\u984c\u306b\u6700\u3082\u95a2\u9023\u3059\u308b1-2\u3064\u306e\u30dd\u30a4\u30f3\u30c8\u306b\u7d5e\u3063\u3066\u8a34\u6c42\u3057\u3066\u304f\u3060\u3055\u3044\u3002
5. \u30e1\u30fc\u30eb\u306f\u81ea\u7136\u306a\u65e5\u672c\u8a9e\u3067\u3001\u55b6\u696d\u30e1\u30fc\u30eb\u3068\u3057\u3066\u9055\u548c\u611f\u306e\u306a\u3044\u6587\u4f53\u3067\u66f8\u3044\u3066\u304f\u3060\u3055\u3044\u3002

\u3010\u30da\u30eb\u30bd\u30ca\u6307\u5b9a\u3011
${selectedPersonaInstructions}

\u3010CTA\u6307\u5b9a\u3011
${selectedCtaInstructions}

\u3010\u30c8\u30fc\u30f3\u3011
${s.tone || '\u30d7\u30ed\u30d5\u30a7\u30c3\u30b7\u30e7\u30ca\u30eb\u3067\u89aa\u3057\u307f\u3084\u3059\u3044'}

\u3010\u8ffd\u52a0\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u3011
${freeText || '\u306a\u3057'}

\u4ee5\u4e0b\u306e4\u3064\u306e\u30e1\u30fc\u30eb\u30d1\u30bf\u30fc\u30f3\u3092\u65e5\u672c\u8a9e\u3067\u4f5c\u6210\u3057\u3066\u304b\u3060\u3055\u3044\uff1a
1. Pattern A - \u7d4c\u55b6\u5c64\u5411\u3051\uff08ROI\u8a34\u6c42\uff09\uff1aCEO\u3084CFO\u5411\u3051\u3002\u6295\u8cc7\u5bfe\u52b9\u679c\u3068\u4e8b\u696d\u6210\u9577\u3092\u524d\u9762\u306b\u3002\u696d\u7e3e\u5411\u4e0a\u3078\u306e\u5177\u4f53\u7684\u306a\u8ca2\u732e\u3092\u793a\u3059\u3002
2. Pattern B - \u73fe\u5834\u8cac\u4efb\u8005\u5411\u3051\uff08\u52b9\u7387\u5316\u8a34\u6c42\uff09\uff1a\u90e8\u9580\u9577\u5411\u3051\u3002\u696d\u52d9\u52b9\u7387\u5316\u3068\u30d7\u30ed\u30bb\u30b9\u6539\u5584\u3092\u524d\u9762\u306b\u3002\u30c1\u30fc\u30e0\u306e\u751f\u7523\u6027\u5411\u4e0a\u3092\u793a\u3059\u3002
3. Pattern C - \u62c5\u5f53\u8005\u5411\u3051\uff08\u6642\u77ed\u8a34\u6c42\uff09\uff1a\u5b9f\u52d9\u8005\u5411\u3051\u3002\u500b\u4eba\u306e\u6642\u9593\u524a\u6e1b\u3068\u4f5c\u696d\u52b9\u7387\u5316\u3092\u524d\u9762\u306b\u3002
4. Pattern D - \u77ed\u6587\u30b9\u30c8\u30ec\u30fc\u30c8\u578b\uff1a\u7c21\u6f54\u3067\u76f4\u63a5\u7684\u300220-30\u79d2\u3067\u8aad\u308b\u9577\u3055\u3002\u8981\u70b9\u306e\u307f\u3002

\u5404\u30d1\u30bf\u30fc\u30f3\u306b\u3064\u3044\u3066\u3001\u4ee5\u4e0b\u306e\u5f62\u5f0f\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff1a
[PATTERN_A]
\u4ef6\u540d\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
\u672c\u6587\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
[PATTERN_B]
\u4ef6\u540d\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
\u672c\u6587\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
[PATTERN_C]
\u4ef6\u540d\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
\u672c\u6587\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
[PATTERN_D]
\u4ef6\u540d\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f
\u672c\u6587\uff1a\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f`;

      const responseText = await callAI(prompt);
      return this.parseEmailPatterns(responseText, companyName, research, settings);
    } catch (error) {
      console.warn('[AI] All providers failed, using smart templates:', (error as Error).message);
      return getSmartEmailPatterns(companyName, research, settings);
    }
  }

  private buildServiceContext(s: ReturnType<typeof extractSettings>, r: ReturnType<typeof extractResearch>): string {
    const parts: string[] = [];
    if (s.serviceName) parts.push(`\u30b5\u30fc\u30d3\u30b9\u540d\uff1a${s.serviceName}`);
    if (s.serviceDescription) {
      const desc = s.serviceDescription.length > 200
        ? s.serviceDescription.substring(0, 200) + '...'
        : s.serviceDescription;
      parts.push(`\u6982\u8981\uff1a${desc}`);
    }
    if (s.serviceBenefit) {
      const benefits = s.serviceBenefit.split('\n').filter((b: string) => b.trim());
      if (benefits.length > 3) {
        const relevantBenefits = this.selectRelevantBenefits(benefits, r.pains);
        parts.push(`${r.companyName}\u306e\u8ab2\u984c\u306b\u95a2\u9023\u3059\u308b\u5f37\u307f\uff1a${relevantBenefits.join('\u3001')}`);
      } else {
        parts.push(`\u5f37\u307f\uff1a${benefits.join('\u3001')}`);
      }
    }
    if (s.serviceResults) {
      parts.push(`\u5b9f\u7e3e\uff1a${s.serviceResults.substring(0, 100)}`);
    }
    return parts.length > 0 ? parts.join('\n') : '\u30b5\u30fc\u30d3\u30b9\u60c5\u5831\u306a\u3057';
  }

  private selectRelevantBenefits(benefits: string[], pains: string[]): string[] {
    if (pains.length === 0) return benefits.slice(0, 3);
    const scored = benefits.map((benefit) => {
      let score = 0;
      for (const pain of pains) {
        const painWords = pain.split(/[\u3000\u3001\u3002\s\u30fb]+/).filter((w) => w.length > 1);
        for (const word of painWords) {
          if (benefit.includes(word)) score += 2;
        }
      }
      return { benefit, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.benefit);
  }

  // --------------------------------------------------------
  // generateSubOutputs: called from route.ts
  // Signature matches: (companyName, research, settings)
  // --------------------------------------------------------
  async generateSubOutputs(
    companyName: string,
    research: CompanyResearch,
    settings: CustomSettings
  ): Promise<{ phone_script?: string; video_prompt?: string; follow_up_scenarios?: string[] }> {
    const r = extractResearch(research || ({} as CompanyResearch));
    const s = extractSettings(settings || ({} as CustomSettings));

    try {
      const painPoints = r.pains.slice(0, 3).join('\u3001') || '';
      const serviceContextForPrompt = this.buildServiceContext(s, r);

      const prompt = `\u3042\u306a\u305f\u306f\u65e5\u672c\u306e\u30bb\u30fc\u30eb\u30b9\u30e1\u30fc\u30eb\u4f5c\u6210\u3068\u30d5\u30a9\u30ed\u30fc\u30a2\u30c3\u30d7\u306e\u5c02\u9580\u5bb6\u3067\u3059\u3002${companyName}\u306e\u8abf\u67fb\u7d50\u679c\u3092\u3082\u3068\u306b\u3001\u5b9f\u7528\u7684\u3067\u52b9\u679c\u7684\u306a\u30d5\u30a9\u30ed\u30fc\u30a2\u30c3\u30d7\u30c4\u30fc\u30eb\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002

\u3010\u9001\u4fe1\u8005\u60c5\u5831\u3011
\u6c0f\u540d\uff1a${s.senderName}
\u4f1a\u793e\uff1a${s.senderCompany}

\u3010\u9001\u4fe1\u5148\u4f01\u696d\u306e\u8abf\u67fb\u60c5\u5831\u3011
\u4f1a\u793e\u540d\uff1a${companyName}
\u696d\u754c\uff1a${r.industry}
\u4e8b\u696d\u5185\u5bb9\uff1a${r.business}
\u4f01\u696d\u6982\u8981\uff1a${r.overview}
\u63a8\u5b9a\u3055\u308c\u308b\u8ab2\u984c\uff1a${painPoints}
${r.news.length > 0 ? `\u6700\u65b0\u30cb\u30e5\u30fc\u30b9\uff1a${r.news[0].title}` : ''}

\u3010\u30b5\u30fc\u30d3\u30b9\u6982\u8981\u3011
${serviceContextForPrompt}

\u4ee5\u4e0b\u306e3\u3064\u306e\u88dc\u52a9\u51fa\u529b\u3092\u65e5\u672c\u8a9e\u3067\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u5404\u51fa\u529b\u306f\u5341\u5206\u306a\u5185\u5bb9\u91cf\u3092\u542b\u3081\u3066\u304f\u3060\u3055\u3044\u3002

1. **\u96fb\u8a71\u30b9\u30af\u30ea\u30d7\u30c8**\uff0830\u79d2\u7248\uff09\uff1a
   - \u30e1\u30fc\u30eb\u9001\u4fe1\u5f8c\u306e\u96fb\u8a71\u30d5\u30a9\u30ed\u30fc\u30a2\u30c3\u30d7\u7528\u306e\u5b8c\u5168\u306a\u30b9\u30af\u30ea\u30d7\u30c8
   - \u5c0e\u5165\u90e8\u5206\uff08\u540d\u4e57\u308a\u30fb\u7528\u4ef6\uff09\u3001\u8ab2\u984c\u63d0\u8d77\u90e8\u5206\u3001\u30b5\u30fc\u30d3\u30b9\u63d0\u6848\u90e8\u5206\u3001\u30af\u30ed\u30fc\u30b8\u30f3\u30b0\u90e8\u5206\u3092\u542b\u3081\u308b
   - ${companyName}\u306e\u5177\u4f53\u7684\u306a\u8ab2\u984c\u306b\u8a00\u53ca\u3059\u308b
   - \u60f3\u5b9a\u3055\u308c\u308b\u53cd\u8ad6\u3078\u306e\u5207\u308a\u8fd4\u3057\u3082\u542b\u3081\u308b
   - \u5408\u8a08200-300\u6587\u5b57\u7a0b\u5ea6

2. **\u52d5\u753b\u30d7\u30ed\u30f3\u30d7\u30c8**\uff08Sora\u7528\uff09\uff1a
   - \u30b7\u30fc\u30f31\uff1a\u30aa\u30fc\u30d7\u30cb\u30f3\u30b0\uff08${companyName}\u306e\u8ab2\u984c\u3092\u8996\u899a\u5316\uff09
   - \u30b7\u30fc\u30f32\uff1a\u30bd\u30ea\u30e5\u30fc\u30b7\u30e7\u30f3\u63d0\u793a\uff08\u30b5\u30fc\u30d3\u30b9\u306e\u6d3b\u7528\u30a4\u30e1\u30fc\u30b8\uff09
   - \u30b7\u30fc\u30f33\uff1a\u6210\u679c\u30fb\u30d3\u30d5\u30a9\u30fc\u30a2\u30d5\u30bf\u30fc
   - \u30b7\u30fc\u30f34\uff1aCTA\uff08\u884c\u52d5\u559a\u8d77\uff09
   - \u5408\u8a08200-300\u6587\u5b57\u7a0b\u5ea6

3. **\u30d5\u30a9\u30ed\u30fc\u30a2\u30c3\u30d7\u30b7\u30ca\u30ea\u30aa**\uff08\u8ffd\u6483\u30e1\u30fc\u30eb3\u901a\uff09\uff1a
   - \u30103\u65e5\u5f8c\u30fb\u672a\u8fd4\u4fe1\u6642\u3011\u4ef6\u540d\u3068\u672c\u6587\uff085-8\u884c\uff09\u3002\u4ed8\u52a0\u4fa1\u5024\u3092\u63d0\u4f9b\u3059\u308b\u5185\u5bb9\u3002
   - \u30101\u9031\u9593\u5f8c\u30fb\u672a\u8fd4\u4fe1\u6642\u3011\u4ef6\u540d\u3068\u672c\u6587\uff085-8\u884c\uff09\u3002\u5225\u306e\u89d2\u5ea6\u304b\u3089\u306e\u30a2\u30d7\u30ed\u30fc\u30c1\u3002
   - \u3010\u63a0\u308a\u8d77\u3053\u3057\u30fb\u9577\u671f\u672a\u8fd4\u4fe1\u6642\u3011\u4ef6\u540d\u3068\u672c\u6587\uff085-8\u884c\uff09\u3002\u65b0\u3057\u3044\u60c5\u5831\u3084\u4e8b\u4f8b\u3092\u63d0\u4f9b\u3002
   - \u5404\u30b7\u30ca\u30ea\u30aa\u306f${companyName}\u306e\u8ab2\u984c\u306b\u5177\u4f53\u7684\u306b\u8a00\u53ca\u3059\u308b\u3053\u3068

\u4ee5\u4e0b\u306e\u5f62\u5f0f\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff1a
[PHONE_SCRIPT]
\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f

[VIDEO_PROMPT]
\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f

[FOLLOW_UP_SCENARIOS]
\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f\uff3f`;

      const responseText = await callAI(prompt);
      return this.parseSubOutputs(responseText);
    } catch (error) {
      console.warn('[AI] Sub-outputs generation failed, using smart templates:', (error as Error).message);
      return getSmartSubOutputs(companyName, research, settings);
    }
  }

  private parseEmailPatterns(
    responseText: string,
    companyName: string,
    research: CompanyResearch,
    settings: CustomSettings
  ): EmailPattern[] {
    const patternNames = [
      { key: 'PATTERN_A', name: '\u7d4c\u55b6\u5c64\u5411\u3051\uff08ROI\u8a34\u6c42\uff09' },
      { key: 'PATTERN_B', name: '\u73fe\u5834\u8cac\u4efb\u8005\u5411\u3051\uff08\u52b9\u7387\u5316\u8a34\u6c42\uff09' },
      { key: 'PATTERN_C', name: '\u62c5\u5f53\u8005\u5411\u3051\uff08\u6642\u77ed\u8a34\u6c42\uff09' },
      { key: 'PATTERN_D', name: '\u77ed\u6587\u30b9\u30c8\u30ec\u30fc\u30c8\u578b' },
    ];

    const extractPattern = (text: string, patternKey: string): { subject: string; body: string } => {
      const regex = new RegExp(`\\[${patternKey}\\]([\\s\\S]*?)(?=\\[PATTERN_|$)`);
      const match = text.match(regex);
      if (!match) return { subject: '', body: '' };

      const content = match[1];
      const subjectMatch = content.match(/\u4ef6\u540d\uff1a\s*(.+?)(?:\n|\u672c\u6587)/);
      const bodyMatch = content.match(/\u672c\u6587\uff1a\s*([\s\S]+?)$/);

      return {
        subject: subjectMatch ? subjectMatch[1].trim() : '',
        body: bodyMatch ? bodyMatch[1].trim() : '',
      };
    };

    const patterns = patternNames.map((pattern) => {
      const extracted = extractPattern(responseText, pattern.key);
      return {
        patternName: pattern.name,
        subject: extracted.subject || `${companyName}\u69d8\u3078\u306e\u3054\u63d0\u6848`,
        body: extracted.body || '\u30dc\u30c7\u30a3\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f',
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
    const phoneMatch = responseText.match(/\[PHONE_SCRIPT\]([\s\S]*?)(?=\[VIDEO_PROMPT\]|$)/);
    const videoMatch = responseText.match(/\[VIDEO_PROMPT\]([\s\S]*?)(?=\[FOLLOW_UP_SCENARIOS\]|$)/);
    const followUpMatch = responseText.match(/\[FOLLOW_UP_SCENARIOS\]([\s\S]*?)$/);

    const phoneScript = phoneMatch ? phoneMatch[1].trim() : undefined;
    const videoPrompt = videoMatch ? videoMatch[1].trim() : undefined;

    let followUpScenarios: string[] = [];
    if (followUpMatch) {
      const rawText = followUpMatch[1].trim();
      const scenarios = rawText
        .split(/\n(?=\u3010)/g)
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
}

export const geminiService = new GeminiService();
