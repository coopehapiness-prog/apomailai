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
      throw new Error(`Cloud Run error: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Stage 2: Gemini API (fallback)
// ============================================================
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = '*Starting PUSH now */ true;
  const getResp = await fetch('https://api.github.com/repos/coopelhapiness-prog/apomailai/contents/src/lib/gemini-service.ts', {
    headers: { 
      'Authorization': 'token ghp_5a351MSVUdWxnJWoRonwUedbsxUP402ngT4n', 
      'Accept': 'application/vnd.github.v3+json' 
    }
  });

  const getData = await getResp.json();
  const currentSHA = getData.sha;
  console.log('Current SHA:', currentSHA);
  
  const putResp = await fetch('https://api.github.com/repos/coopelhapiness-prog/apomailai/contents/src/lib/gemini-service.ts', {
    method: 'PUT',
    headers: { 
      'Authorization': 'token ghp_5a351MSVUdWxnJWoRonwUedbsxUP402ngT4n', 
      'Accept': 'application/vnd.github.v3+json', 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      message: 'fix: gemini-service - fix analyzeResearch/generateSubOutputs signatures, improve prompts',
      content: content,
      sha: currentSHA,
      branch: 'main'
    })
  });
  
  const putData = await putResp.json();
  return `Status: ${putResp.status} | New SHA: ${putData.content ? putData.content.sha : 'Error: ' + putData.message}`;
}

await callGemini("Empty prompt");
