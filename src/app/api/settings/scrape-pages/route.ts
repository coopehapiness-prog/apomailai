import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-utils';

export const maxDuration = 300; // Requires Vercel Pro plan ($20/month)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---------- helpers ----------

/** Fetch a page with timeout */
async function fetchPage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store' as RequestCache,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Extract readable text from HTML (strip tags, collapse whitespace) */
function htmlToText(html: string): string {
  // Try to extract just the <body> content (skip <head> with all its meta/CSS/JS)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let clean = bodyMatch ? bodyMatch[1] : html;

  // Remove <head> if still present
  clean = clean.replace(/<head[\s\S]*?<\/head>/gi, '');
  // Remove script/style/nav/footer/header/noscript/iframe
  clean = clean
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Try to focus on article/main content area for better extraction
  const articleMatch = clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = clean.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const entryMatch = clean.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|article-body|single-content|case-content|voice-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (articleMatch && articleMatch[1].length > 200) {
    clean = articleMatch[1];
  } else if (mainMatch && mainMatch[1].length > 200) {
    clean = mainMatch[1];
  } else if (entryMatch && entryMatch[1].length > 200) {
    clean = entryMatch[1];
  }

  // Remove remaining script/style tags that might be nested
  clean = clean
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Line breaks for block-level
  clean = clean.replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n');
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  // Strip tags
  clean = clean.replace(/<[^>]*>/g, ' ');
  // Decode common entities
  clean = clean
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ');
  // Collapse whitespace
  clean = clean.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  // Filter out lines that look like CSS/JS/JSON garbage or UI noise
  const lines = clean.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Skip lines that are clearly CSS/JS (contain { } or var or function keywords)
    if (/^\s*[\{\}]/.test(trimmed)) return false;
    if (/^(var |function |window\.|document\.|if\(|for\()/.test(trimmed)) return false;
    // Skip lines that are CSS declarations
    if (/^[a-z-]+\s*:\s*[^;]+;/.test(trimmed) && trimmed.length < 200) return false;
    // Skip very short lines (likely noise) unless they contain Japanese
    if (trimmed.length < 5 && !/[\u3000-\u9FFF]/.test(trimmed)) return false;
    // Skip breadcrumb / share button / navigation noise
    if (/^(シェア|Share|TOP\s*>|ホーム\s*>|Home\s*>|トップ\s*>)\s*/i.test(trimmed)) return false;
    if (/^(シェア\s+){1,}シェア/.test(trimmed)) return false;
    // Skip breadcrumb-style lines: "TOP > カテゴリ > ページ名"
    if (/^(TOP|ホーム|HOME)\s*>\s*.+>\s*.+/i.test(trimmed)) return false;
    return true;
  });

  // Remove duplicate title at the beginning (often repeated in hero + h1)
  let result = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const resultLines = result.split('\n');
  if (resultLines.length > 5) {
    // If the first line appears again within the first 10 lines, remove the duplicate
    const first = resultLines[0].trim();
    if (first.length > 10) {
      for (let i = 1; i < Math.min(10, resultLines.length); i++) {
        if (resultLines[i].trim() === first) {
          resultLines.splice(i, 1);
          break;
        }
      }
    }
    result = resultLines.join('\n');
  }
  return result;
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Extract main content area HTML (for better link extraction from listing pages) */
function extractMainContent(html: string): string {
  // Try to find main content area: <main>, <article>, or common content class patterns
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) return mainMatch[0];

  // Try common content containers
  const patterns = [
    /<div[^>]*class="[^"]*(?:content|main|cases|voice|interview|customer)[^"]*"[\s\S]*?<\/div>/i,
    /<section[^>]*class="[^"]*(?:content|main|cases|voice|interview|customer)[^"]*"[\s\S]*?<\/section>/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[0].length > 500) return m[0];
  }

  // Fallback: strip nav/header/footer and use rest
  return html
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');
}

/** Extract all same-domain links from HTML */
function extractSubpageLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: string[] = [];
  const seen = new Set<string>();

  const regex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.hostname !== base.hostname) continue;
      const path = resolved.pathname;
      if (/\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|pdf|zip)$/i.test(path)) continue;
      if (path === '/' || path === base.pathname) continue;
      const canonical = `${resolved.origin}${resolved.pathname}`.replace(/\/+$/, '');
      if (!seen.has(canonical)) {
        seen.add(canonical);
        links.push(canonical);
      }
    } catch {
      // skip
    }
  }
  return links;
}

/** Extract pagination links (page/2, ?page=2, next page, etc.) */
function extractPaginationLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: string[] = [];
  const seen = new Set<string>();

  // Match <a> tags with pagination-like URLs
  const regex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.hostname !== base.hostname) continue;
      const path = resolved.pathname;
      const fullUrl = `${resolved.origin}${resolved.pathname}${resolved.search}`;

      // Match pagination patterns: /page/2, /page/3, ?page=2, ?p=2, ?paged=2
      const isPagination =
        /\/page\/\d+/i.test(path) ||
        /[?&](page|p|paged)=\d+/i.test(resolved.search) ||
        /\/\d+\/?$/.test(path); // trailing number like /voice/2/

      if (isPagination && !seen.has(fullUrl)) {
        seen.add(fullUrl);
        links.push(fullUrl);
      }
    } catch {
      // skip
    }
  }

  // Sort by page number and limit to 20 pages
  return links.slice(0, 20);
}

/** Paths commonly used for case study / voice / interview pages */
const CASE_STUDY_PATH_PATTERNS = [
  '/case/', '/cases/', '/voice/', '/voices/', '/interview/', '/interviews/',
  '/customer/', '/customers/', '/story/', '/stories/', '/success/',
  '/testimonial/', '/example/', '/examples/', '/usecase/', '/use-case/',
  '/works/', '/work/', '/portfolio/', '/result/',
];

/** Paths commonly used for service / product pages */
const SERVICE_PATH_PATTERNS = [
  '/service/', '/services/', '/product/', '/products/', '/solution/', '/solutions/',
  '/feature/', '/features/', '/platform/', '/plan/', '/pricing/',
  '/function/', '/functions/', '/tool/', '/tools/',
];

/** Paths to always exclude (navigation / utility pages) */
const EXCLUDE_PATH_PATTERNS = [
  '/inquiry', '/contact', '/privacy', '/terms', '/legal', '/cookie',
  '/login', '/signup', '/register', '/account', '/cart', '/checkout',
  '/tag/', '/category/', '/author/', '/page/', '/feed/', '/rss/',
  '/wp-admin', '/wp-content', '/wp-includes',
  '/sitemap', '/404', '/search',
];

/** Smart filtering: prioritize content pages, exclude noise */
function filterRelevantLinks(
  links: string[],
  listingPath: string,
  pageType: 'case_study' | 'service'
): string[] {
  const prefix = listingPath.replace(/\/+$/, '');

  // Always exclude utility pages
  const cleaned = links.filter((l) => {
    try {
      const p = new URL(l).pathname.toLowerCase();
      return !EXCLUDE_PATH_PATTERNS.some((ex) => p.includes(ex));
    } catch {
      return false;
    }
  });

  // Strategy 1: Direct sub-pages of the listing path
  const directSubPages = cleaned.filter((l) => {
    try {
      const p = new URL(l).pathname.replace(/\/+$/, '');
      return p.startsWith(prefix) && p !== prefix && p.split('/').length > prefix.split('/').length;
    } catch {
      return false;
    }
  });
  if (directSubPages.length >= 3) return directSubPages.slice(0, 100);

  // Strategy 2: Pages matching known content path patterns
  const targetPatterns = pageType === 'service' ? SERVICE_PATH_PATTERNS : CASE_STUDY_PATH_PATTERNS;
  const patternMatches = cleaned.filter((l) => {
    try {
      const p = new URL(l).pathname.toLowerCase();
      return targetPatterns.some((pat) => p.includes(pat));
    } catch {
      return false;
    }
  });
  if (patternMatches.length >= 3) return patternMatches.slice(0, 100);

  // Strategy 3: Deep-path pages (3+ segments = likely detail pages, not nav)
  const deepPages = cleaned.filter((l) => {
    try {
      const p = new URL(l).pathname.replace(/\/+$/, '');
      return p.split('/').filter(Boolean).length >= 3;
    } catch {
      return false;
    }
  });
  if (deepPages.length >= 3) return deepPages.slice(0, 100);

  // Strategy 4: 2+ segment pages as last resort
  return cleaned
    .filter((l) => {
      try {
        const p = new URL(l).pathname.replace(/\/+$/, '');
        return p.split('/').filter(Boolean).length >= 2;
      } catch {
        return false;
      }
    })
    .slice(0, 100);
}

// ---------- AI Summarization ----------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

/** Summarize a case study using Gemini API */
async function summarizeCaseStudy(title: string, content: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const prompt = `以下の導入事例の記事を、営業メールで活用しやすい形式で要約してください。

【要約フォーマット】
・導入企業：（企業名・業界）
・課題：（導入前の課題を簡潔に）
・導入内容：（何をどう導入したか）
・効果・成果：（具体的な数値や改善点）
・ポイント：（営業トークで使える要点）

800〜1200文字程度で、事実に基づいて要約してください。記事に書かれていない情報は追加しないでください。

【記事タイトル】${title}

【記事本文】
${content.substring(0, 15000)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  } catch {
    return null;
  }
}

/** Summarize multiple pages in batches with time budget */
async function summarizePagesWithBudget(
  pages: Array<{ url: string; title: string; content: string }>,
  startTime: number,
  globalTimeoutMs: number
): Promise<Array<{ url: string; title: string; content: string }>> {
  const summarized: Array<{ url: string; title: string; content: string }> = [];
  const batchSize = 10; // larger batches for parallel processing

  for (let i = 0; i < pages.length; i += batchSize) {
    const elapsed = Date.now() - startTime;
    if (elapsed > globalTimeoutMs - 3000) {
      // Not enough time left — return remaining pages with truncated raw text
      console.log(`[Scrape] Time budget exceeded at page ${i}, returning ${pages.length - i} unsummarized`);
      for (let j = i; j < pages.length; j++) {
        summarized.push({
          url: pages[j].url,
          title: pages[j].title,
          content: pages[j].content.substring(0, 5000),
        });
      }
      break;
    }

    const batch = pages.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (page) => {
        const summary = await summarizeCaseStudy(page.title, page.content);
        return {
          url: page.url,
          title: page.title,
          content: summary || page.content.substring(0, 5000),
        };
      })
    );
    summarized.push(...results);
  }

  return summarized;
}

// ---------- API ----------

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, type } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 });
    }

    const pageType: 'case_study' | 'service' = type === 'service' ? 'service' : 'case_study';

    console.log(`[Scrape] Starting scrape of listing page: ${url} (type: ${pageType})`);

    // 1. Fetch the listing page (+ pagination pages)
    const listingHtml = await fetchPage(url);
    if (!listingHtml) {
      return NextResponse.json({ error: 'ページの取得に失敗しました。URLを確認してください。' }, { status: 400 });
    }

    // Collect all listing page HTMLs (handle pagination)
    const listingPages = [listingHtml];
    const paginationUrls = extractPaginationLinks(listingHtml, url);
    if (paginationUrls.length > 0) {
      console.log(`[Scrape] Found ${paginationUrls.length} pagination pages, fetching...`);
      for (let i = 0; i < paginationUrls.length; i += 5) {
        const batch = paginationUrls.slice(i, i + 5);
        const pages = await Promise.all(batch.map((u) => fetchPage(u, 6000)));
        for (const p of pages) {
          if (p) listingPages.push(p);
        }
      }
    }

    // 2. Extract links from all listing pages
    const allLinksSet = new Set<string>();
    for (const html of listingPages) {
      const mainContent = extractMainContent(html);
      let links = extractSubpageLinks(mainContent, url);
      if (links.length < 3) {
        links = extractSubpageLinks(html, url);
      }
      for (const l of links) allLinksSet.add(l);
    }
    const allLinks = Array.from(allLinksSet);

    const listingPath = new URL(url).pathname;
    const relevantLinks = filterRelevantLinks(allLinks, listingPath, pageType);

    console.log(`[Scrape] Found ${allLinks.length} total links, ${relevantLinks.length} relevant sub-pages`);

    if (relevantLinks.length === 0) {
      // No sub-pages found – scrape the listing page itself
      const text = htmlToText(listingHtml).substring(0, 50000);
      const title = extractTitle(listingHtml);
      return NextResponse.json({
        pages: [{ url, title: title || url, content: text }],
        count: 1,
      });
    }

    // 3. Scrape each sub-page (parallel, max 10 concurrent)
    const startTime = Date.now();
    const GLOBAL_TIMEOUT_MS = 270000; // 270s safety margin for 300s maxDuration (Pro plan)
    const results: Array<{ url: string; title: string; content: string }> = [];
    const scrapeBatchSize = 10;

    for (let i = 0; i < relevantLinks.length; i += scrapeBatchSize) {
      if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) {
        console.log(`[Scrape] Global timeout reached during scraping at page ${i}`);
        break;
      }
      const batch = relevantLinks.slice(i, i + scrapeBatchSize);
      const batchResults = await Promise.all(
        batch.map(async (pageUrl) => {
          const html = await fetchPage(pageUrl, 8000);
          if (!html) return null;
          const title = extractTitle(html);
          const text = htmlToText(html).substring(0, 50000);
          if (text.length < 50) return null;
          return { url: pageUrl, title: title || pageUrl, content: text };
        })
      );
      for (const r of batchResults) {
        if (r) results.push(r);
      }
    }

    console.log(`[Scrape] Successfully scraped ${results.length} pages in ${Date.now() - startTime}ms`);

    // 4. Summarize each page using AI (case studies only, with time budget)
    let finalPages = results;
    const remainingMs = GLOBAL_TIMEOUT_MS - (Date.now() - startTime);

    if (pageType === 'case_study' && GEMINI_API_KEY && remainingMs > 20000) {
      console.log(`[Scrape] Summarizing ${results.length} case studies with AI (${Math.round(remainingMs / 1000)}s remaining)...`);
      finalPages = await summarizePagesWithBudget(results, startTime, GLOBAL_TIMEOUT_MS);
      console.log(`[Scrape] Summarization complete: ${finalPages.length} pages`);
    }

    return NextResponse.json({
      pages: finalPages,
      count: finalPages.length,
    });
  } catch (error) {
    console.error('[Scrape] Error:', error);
    return NextResponse.json(
      { error: 'スクレイピングに失敗しました' },
      { status: 500 }
    );
  }
}
