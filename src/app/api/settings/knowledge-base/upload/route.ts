import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';
import { supabase } from '@/lib/supabase';

// Supported binary file extensions and their categories
const SUPPORTED_TYPES: Record<string, string> = {
  // Documents
  pdf: 'document',
  docx: 'document',
  doc: 'document',
  epub: 'document',
  // Spreadsheets
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  // Presentations
  pptx: 'presentation',
  ppt: 'presentation',
  // Images
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  tif: 'image',
  tiff: 'image',
  heic: 'image',
  heif: 'image',
  avif: 'image',
  ico: 'image',
  // Audio/Video
  mp3: 'audio',
  mp4: 'video',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  aac: 'audio',
  '3gp': 'video',
  avi: 'video',
  mpeg: 'video',
};

// ============================================================
// Lightweight text extraction helpers (no heavy deps)
// ============================================================

/**
 * Extract text from PDF using Gemini AI
 * Since pdf-parse has issues on Vercel serverless,
 * we use the Gemini API to extract text from the file.
 */
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL || '';
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // Try Gemini API Direct first (supports multimodal)
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: `このファイル（${fileName}）の内容をテキストとして抽出してください。表やリストがある場合はテキスト形式で構造を保持してください。画像の場合はOCR（文字認識）を行い、含まれるテキストを全て抽出してください。音声/動画ファイルの場合は、ファイル名と形式情報を記載してください。余計な説明は不要で、抽出したコンテンツのみを出力してください。`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.warn('[KB Upload] Gemini API extraction failed:', (e as Error).message);
    }
  }

  // Fallback: Try Cloud Run with a text prompt about the file
  if (CLOUD_RUN_URL) {
    try {
      const url = CLOUD_RUN_URL.endsWith('/generate') ? CLOUD_RUN_URL : `${CLOUD_RUN_URL.replace(/\/$/, '')}/generate`;
      const CLOUD_RUN_API_KEY = process.env.CLOUD_RUN_API_KEY || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (CLOUD_RUN_API_KEY) headers['x-api-key'] = CLOUD_RUN_API_KEY;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `ファイル「${fileName}」（形式: ${mimeType}）がアップロードされました。このファイルはバイナリ形式のため、テキスト抽出ができませんでした。ファイル名と形式から推測できる情報を簁潔にまとめてください。`,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.ok && json.result) return json.result;
      }
    } catch (e) {
      console.warn('[KB Upload] Cloud Run extraction failed:', (e as Error).message);
    }
  }

  // Final fallback: store metadata only
  return `[ファイル: ${fileName}]\n形式: ${mimeType}\nサイズ: バイナリファイル\n\n※ テキスト抽出にはGemini API Keyの設定が必要です。Vercel環境変数にGEMINI_API_KEYを追加してください。`;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    epub: 'application/epub+zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    '3gp': 'video/3gpp',
    avi: 'video/x-msvideo',
    mpeg: 'video/mpeg',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// ============================================================
// POST handler: Accept FormData file upload
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズは20MB以下にしてください' },
        { status: 400 }
      );
    }

    // Get file extension and category
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const category = SUPPORTED_TYPES[ext] || 'other';

    if (!SUPPORTED_TYPES[ext]) {
      return NextResponse.json(
        { error: `未対応のファイル形式です: .${ext}` },
        { status: 400 }
      );
    }

    // Read file as ArrayBuffer → base64
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    // Get MIME type
    const mimeType = getMimeType(ext);

    // Extract text content using Gemini AI
    console.log(`[KB Upload] Extracting text from ${file.name} (${mimeType}, ${(file.size / 1024).toFixed(1)}KB)...`);
    const extractedText = await extractWithGemini(base64Data, mimeType, file.name);
    console.log(`[KB Upload] Extracted ${extractedText.length} chars from ${file.name}`);

    // Save to knowledge_base table
    const { data: item, error: dbError } = await supabase
      .from('knowledge_base')
      .insert({
        user_id: userId,
        title: file.name,
        content: extractedText.substring(0, 50000),
        category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving knowledge base item:', dbError);
      return NextResponse.json(
        { error: 'ナレッジベースへの保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'ファイルを登録しました',
        item,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /knowledge-base/upload:', error);
    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
