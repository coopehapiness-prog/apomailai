import { supabase } from './supabase';
import { geminiService } from './gemini-service';
import { CompanyResearch } from './types';

interface GoogleSearchResult {
  items: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
}

interface SearchResultWithUrl {
  title: string;
  url: string;
  snippet: string;
}

export class ResearchService {
  async researchCompany(companyName: string, userId: string): Promise<CompanyResearch> {
    try {
      // Check cache
      const { data: cached } = await supabase
        .from('research_cache')
        .select('research_data, created_at')
        .eq('company_name', companyName)
        .eq('user_id', userId)
        .single();

      if (cached) {
        const cacheAge =
          (Date.now() - new Date(cached.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const data = cached.research_data as CompanyResearch;
        const hasContent = data.overview && data.overview !== '情報なし' && (data.pains?.length ?? 0) > 0;
        const isDirectUrl = (url?: string) => url && url.trim() !== '' && !url.includes('google.com/search');
        const hasUrls = !!(isDirectUrl(data.homepage_url) || isDirectUrl(data.business_url));
        const newsWithUrls = (data.news || []).filter((n) => n.url && n.url.trim() !== '' && !n.url.includes('google.com/search'));
        const hasEnoughNewsUrls = newsWithUrls.length >= 4 && (data.news || []).length >= 7;
        if (cacheAge < 7 && hasContent && hasUrls && hasEnoughNewsUrls) {
          console.log(`Using cached research for ${companyName}`);
          return data;
        }
        // Stale or incomplete cache - delete and re-fetch
        await supabase.from('research_cache').delete().eq('company_name', companyName).eq('user_id', userId);
        console.log(`Cache expired or incomplete for ${companyName}, re-fetching`);
      }

      // Check if Google Search API is configured
      const hasSearchApi = process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX;

      if (!hasSearchApi) {
        // No search API - use Gemini to generate research based on its training data
        console.log(`No Google Search API configured, using Gemini knowledge for ${companyName}`);
        try {
          const knowledgePrompt = `あなたはインサイドセールスのリサーチアナリストです。${companyName}について、営業アプローチのための調査分析を行ってください。

あなたの知識ベースにある情報を最大限活用し、以下の観点で分析してください：
- 企業の事業内容・主力サービス/製品
- 業界ポジション・競合環境
- 組織規模・事業段階
- 最近の事業動向（資金調達、新サービス、提携、採用拡大など）
- ${companyName}自体が組織として直面している経営課題・業務課題（顧客の課題ではなく、この企業自身の課題）

■ 重要：情報が不確かな場合でも、業界の一般的な傾向から合理的に推測し、具体的で有用な情報を出力してください。
■ 「pains」は必ず5つ以上出力してください。${companyName}の業界・規模・ビジネスモデルに応じた具体的な経営課題を記載してください。
■ 「overview」と「business」は必ず2-3文以上で具体的に記載してください。「情報なし」や「不明」は絶対に出力しないでください。
■ 「homepage_url」は${companyName}の会社概要ページの直接URLを記載してください（例：https://example.co.jp/about や https://example.co.jp/company）。ルートURL（https://example.co.jp/）ではなく、会社概要・企業情報ページの直接リンクを優先してください。URLにハッシュフラグメント（#company等）が必要な場合はそれも含めてください。確信がない場合は空文字""にしてください。
■ 「business_url」は${companyName}のサービス・製品紹介ページの直接URLを記載してください（例：https://example.co.jp/service や https://example.co.jp/products）。不明な場合は空文字""にしてください。`;
          const research = await geminiService.analyzeResearch(
            companyName,
            knowledgePrompt,
            [],
            []
          );

          // Knowledge-based research: Gemini may fabricate news URLs.
          // Validate each URL first — keep valid ones, replace only invalid ones with Google Search.
          if (research.news) {
            const newsUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            const checkNewsUrl = async (url: string): Promise<boolean> => {
              if (!url || url.trim() === '') return false;
              try {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(url, {
                  redirect: 'follow',
                  signal: controller.signal,
                  headers: { 'User-Agent': newsUA },
                  cache: 'no-store' as RequestCache,
                });
                clearTimeout(tid);
                return res.ok;
              } catch {
                return false;
              }
            };

            const newsValidation = research.news.map(async (item) => {
              if (item.url && item.url.trim() !== '') {
                const isValid = await checkNewsUrl(item.url);
                if (isValid) {
                  console.log(`[News URL] Gemini URL valid, keeping: ${item.url}`);
                  return item;
                }
                console.log(`[News URL] Gemini URL invalid: ${item.url}`);
              }
              // Invalid or empty → leave URL empty (UI won't show a link)
              return { ...item, url: '' };
            });

            // Race news validation against a 5s timeout
            research.news = await Promise.race([
              Promise.all(newsValidation),
              new Promise<CompanyResearch['news']>((resolve) =>
                setTimeout(() => {
                  console.warn('[News URL] Validation timed out after 5s, keeping existing URLs');
                  resolve(research.news || []);
                }, 5000)
              ),
            ]);
          }

          // Knowledge-based research: Gemini may also fabricate homepage_url/business_url.
          // Validate them with a quick fetch and replace with Google Search fallback if invalid.
          await this.validateKnowledgeUrls(research, companyName);

          // Cache result
          try {
            await supabase.from('research_cache').insert({
              company_name: companyName,
              user_id: userId,
              research_data: research,
            });
          } catch (_) {
            // Don't fail on cache error
          }

          return research;
        } catch (geminiError) {
          console.error('Gemini research failed, using minimal template:', geminiError);
          // Fallback to minimal template if Gemini also fails
          const minimalResearch: CompanyResearch = {
            company_name: companyName,
            overview: `${companyName}は、日本市場で事業を展開する企業です。詳細な企業情報はリサーチ中に取得できませんでしたが、業界の一般的な傾向に基づいて課題を推定しています。`,
            business: `${companyName}の具体的な事業内容については、追加のリサーチが必要です。`,
            news: [],
            pains: [
              `${companyName}の事業成長に伴う営業・マーケティング組織の拡大と効率化`,
              '競合他社との差別化戦略の強化',
              '社内DX推進と業務プロセスの自動化',
              '顧客獲得コスト（CAC）の最適化と営業生産性の向上',
              '人材採用・育成の課題と組織力の強化',
            ],
            hypothesis: `${companyName}は事業拡大フェーズにおいて、営業効率化やDX推進に課題を抱えている可能性があります。`,
            scraped_at: new Date().toISOString(),
          };
          return minimalResearch;
        }
      }

      // Perform Google Custom Search
      const searchResultsWithUrls = await this.googleSearchWithUrls(companyName);
      const searchResults = searchResultsWithUrls.map((r) => r.snippet);

      // Scrape content from results
      const scrapedContent = await this.scrapeSearchResults(searchResults);

      // Parse news from search results
      const newsArticles = this.parseNewsArticles(searchResults);

      // Analyze with Gemini (pass URLs for richer data)
      const research = await geminiService.analyzeResearch(
        companyName,
        scrapedContent,
        newsArticles,
        searchResultsWithUrls.map((r) => ({ title: r.title, url: r.url }))
      );

      // Post-process: validate news URLs against actual search result URLs.
      // Replace any invalid/fabricated URL with a best-match from search results.
      if (research.news && searchResultsWithUrls.length > 0) {
        // Normalize URLs for comparison (handle trailing slashes, protocol differences)
        const normalizeUrl = (url: string): string => {
          try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
          } catch { return url; }
        };
        const validUrlMap = new Map<string, string>();
        for (const r of searchResultsWithUrls) {
          validUrlMap.set(normalizeUrl(r.url), r.url);
        }
        const usedUrls = new Set<string>();

        research.news = research.news.map((item) => {
          // URL is valid (came from Google search results) - check with normalization
          if (item.url) {
            const normalized = normalizeUrl(item.url);
            const matchedOriginal = validUrlMap.get(normalized);
            if (matchedOriginal) {
              usedUrls.add(matchedOriginal);
              return { ...item, url: matchedOriginal };
            }
          }

          // Try to find a matching search result by title keyword overlap
          const itemTitle = (item.title || '').toLowerCase();
          // Japanese-aware keyword extraction: split on punctuation AND particles
          const rawSegments = itemTitle
            .split(/[\s　、。・「」『』（）()\[\]【】：:；;！!？?]+/)
            .filter((w) => w.length >= 2);
          const keywords: string[] = [];
          for (const seg of rawSegments) {
            keywords.push(seg);
            // Split on Japanese particles for finer-grained matching
            const subWords = seg.split(/[はがをにでとのもへよりからまで]/).filter((w) => w.length >= 2);
            if (subWords.length > 1) keywords.push(...subWords);
            // Extract year numbers (important for matching news dates)
            const years = seg.match(/\d{4}/g);
            if (years) keywords.push(...years);
          }

          // Score each search result by keyword overlap
          let bestMatch: SearchResultWithUrl | undefined;
          let bestScore = 0;
          for (const r of searchResultsWithUrls) {
            if (usedUrls.has(r.url)) continue;
            const rText = (r.title + ' ' + r.snippet).toLowerCase();
            const score = keywords.filter((kw) => rText.includes(kw)).length;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = r;
            }
          }

          if (bestMatch && bestScore >= 1) {
            usedUrls.add(bestMatch.url);
            return { ...item, url: bestMatch.url };
          }

          // Last resort 1: assign the first unused search result URL from news-like domains
          const newsDomains = ['prtimes.jp', 'nikkei.com', 'itmedia.co.jp', 'techcrunch.com', 'japan.zdnet.com', 'businessinsider.jp', 'toyokeizai.net', 'diamond.jp', 'ascii.jp', 'watch.impress.co.jp', 'atmarkit.itmedia.co.jp', 'news.yahoo.co.jp', 'mainichi.jp', 'asahi.com', 'yomiuri.co.jp', 'sankei.com', 'nhk.or.jp', 'kyodonews.net', 'jiji.com', 'reuters.com', 'bloomberg.co.jp'];
          const unusedNewsUrl = searchResultsWithUrls.find((r) => {
            if (usedUrls.has(r.url)) return false;
            try {
              const host = new URL(r.url).hostname;
              return newsDomains.some((d) => host.includes(d));
            } catch { return false; }
          });
          if (unusedNewsUrl) {
            usedUrls.add(unusedNewsUrl.url);
            return { ...item, url: unusedNewsUrl.url };
          }

          // Last resort 2: assign ANY unused search result URL that looks like a specific article page
          const anyUnusedUrl = searchResultsWithUrls.find((r) => {
            if (usedUrls.has(r.url)) return false;
            try {
              const parsed = new URL(r.url);
              const path = parsed.pathname.replace(/\/+$/, '');
              const segments = path.split('/').filter(Boolean);
              // Must be a deep path (specific article page, not a listing page)
              if (segments.length < 2) return false;
              // Skip company info pages
              const skipPaths = ['/about', '/company', '/corporate', '/service', '/product', '/contact', '/privacy', '/terms'];
              if (skipPaths.some((s) => path.includes(s))) return false;
              // Skip news INDEX/listing pages (e.g., /news/, /news, /press/, /press-releases/)
              // These are listing pages, not specific articles. Specific articles have deeper paths like /news/2024/article-slug
              const lastSegment = segments[segments.length - 1];
              const listingPages = ['news', 'press', 'press-releases', 'media', 'blog', 'topics', 'information', 'ir', 'investor'];
              if (listingPages.includes(lastSegment)) return false;
              return true;
            } catch { return false; }
          });
          if (anyUnusedUrl) {
            usedUrls.add(anyUnusedUrl.url);
            return { ...item, url: anyUnusedUrl.url };
          }

          // Last resort 3: reuse already-used news/press URLs only if they point to specific articles
          const anyNewsUrl = searchResultsWithUrls.find((r) => {
            try {
              const host = new URL(r.url).hostname;
              const path = new URL(r.url).pathname.replace(/\/+$/, '');
              const segments = path.split('/').filter(Boolean);
              const isNews = newsDomains.some((d) => host.includes(d));
              // Must be a specific article (deep path), not a listing page
              const isDeepPath = segments.length >= 2;
              if (!isDeepPath) return false;
              // Even for news domains, skip listing pages
              const lastSegment = segments[segments.length - 1];
              const listingPages = ['news', 'press', 'press-releases', 'media', 'blog', 'topics'];
              if (listingPages.includes(lastSegment)) return false;
              return isNews || isDeepPath;
            } catch { return false; }
          });
          if (anyNewsUrl) {
            return { ...item, url: anyNewsUrl.url };
          }

          // No match found - leave URL empty
          return { ...item, url: '' };
        });
      }

      // Post-process: fill remaining news items without URLs using Google news search
      if (research.news && research.news.some((n) => !n.url || n.url.trim() === '')) {
        const missingUrlItems = research.news.filter((n) => !n.url || n.url.trim() === '');
        console.log(`[News URL] ${missingUrlItems.length} news items still missing URLs, running targeted search...`);

        // Collect all already-used news URLs
        const alreadyUsed = new Set(research.news.filter((n) => n.url).map((n) => n.url));

        // Collect all news-domain URLs from search results that haven't been used yet
        const newsDomains = ['prtimes.jp', 'nikkei.com', 'itmedia.co.jp', 'techcrunch.com', 'japan.zdnet.com', 'businessinsider.jp', 'toyokeizai.net', 'diamond.jp', 'ascii.jp', 'watch.impress.co.jp', 'atmarkit.itmedia.co.jp', 'news.yahoo.co.jp', 'mainichi.jp', 'asahi.com', 'yomiuri.co.jp', 'sankei.com', 'nhk.or.jp', 'kyodonews.net', 'jiji.com', 'reuters.com', 'bloomberg.co.jp'];
        const allNewsUrls = searchResultsWithUrls
          .filter((r) => {
            try {
              const host = new URL(r.url).hostname;
              return newsDomains.some((d) => host.includes(d));
            } catch { return false; }
          })
          .map((r) => r.url);

        // Also collect deep-path URLs from the company domain as fallback
        const allDeepUrls = searchResultsWithUrls
          .filter((r) => {
            try {
              const path = new URL(r.url).pathname.replace(/\/+$/, '');
              const depth = path.split('/').filter(Boolean).length;
              return depth >= 2 && !path.includes('/about') && !path.includes('/company') && !path.includes('/corporate');
            } catch { return false; }
          })
          .map((r) => r.url);

        const candidateUrls = [...allNewsUrls, ...allDeepUrls];

        // Assign URLs to news items that are missing them
        research.news = research.news.map((item) => {
          if (item.url && item.url.trim() !== '') return item;

          // Find first unused candidate URL
          const unusedUrl = candidateUrls.find((u) => !alreadyUsed.has(u));
          if (unusedUrl) {
            alreadyUsed.add(unusedUrl);
            return { ...item, url: unusedUrl };
          }

          // If all are used, reuse any news URL (duplicates are better than no links)
          if (candidateUrls.length > 0) {
            return { ...item, url: candidateUrls[0] };
          }

          return item;
        });

        const filledCount = research.news.filter((n) => n.url && n.url.trim() !== '').length;
        console.log(`[News URL] After fill: ${filledCount}/${research.news.length} news items have URLs`);
      }

      // News items without URLs simply won't show a link in the UI
      // No Google Search fallback — only direct links are used
      if (research.news) {
        console.log(`[News URL] ${research.news.filter(n => n.url && n.url.trim() !== '').length}/${research.news.length} news items have direct URLs`);
      }

      // Post-process: extract homepage/business URLs from search results if AI didn't find them
      await this.ensureUrls(research, companyName, searchResultsWithUrls);

      // Post-process: verify homepage_url and business_url actually work (not 404/soft-404)
      await this.verifyAndFixUrls(research, searchResultsWithUrls);

      // Post-process: ensure research quality - never return empty critical fields
      this.ensureResearchQuality(research, companyName);

      // Cache the result (non-blocking)
      try {
        await supabase.from('research_cache').insert({
          company_name: companyName,
          user_id: userId,
          research_data: research,
        });
      } catch (_) {
        // Don't fail on cache error
      }

      return research;
    } catch (error) {
      console.error('Error researching company:', error);

      // Return enriched fallback template on error (never return empty fields)
      return {
        company_name: companyName,
        overview: `${companyName}は日本市場で事業を展開する企業です。リサーチ中に詳細情報の取得に一時的な問題が発生しましたが、業界の一般的な傾向に基づいて課題を推定しています。`,
        business: `${companyName}の事業内容については、企業名から推測される業界領域において、顧客に価値を提供するサービス・製品を展開していると考えられます。`,
        industry: '情報取得中',
        stage: '成長期',
        news: [],
        pains: [
          '事業成長に伴う営業組織の拡大と効率化',
          '競合環境の変化への迅速な対応',
          '社内DX推進とレガシー業務プロセスの改善',
          '顧客獲得コストの最適化と営業生産性の向上',
          '人材採用・定着と組織力の強化',
        ],
        hypothesis: `${companyName}は事業拡大に伴い、営業効率化やDX推進に課題を抱えている可能性があり、営業支援ツールの導入で改善が見込めます。`,
        scraped_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Verify that homepage_url and business_url return valid pages (not 404/soft-404).
   * If invalid, fall back to root domain URL.
   */
  private async verifyAndFixUrls(
    research: CompanyResearch,
    searchResults: SearchResultWithUrl[]
  ): Promise<void> {
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const soft404Indicators = ['not found', '404', 'ページが見つかりません', '見つかりませんでした', '見当たりません', 'page not found', 'ご指定のページ', 'お探しのページ', 'ページは存在しません', 'アクセスしようとしたページが見つかりません', '404エラー', '404 エラー', 'ページは削除', 'ページが削除', 'このページは削除、変更された可能性があります', '移動もしくは削除された可能性', 'アクセスができない状況'];

    const isUrlValid = async (url: string): Promise<boolean> => {
      if (!url) return false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': UA },
          cache: 'no-store' as RequestCache,
        });
        clearTimeout(timeoutId);
        if (!response.ok) return false;

        // Check for soft 404 in title AND body (first 20KB)
        const text = await response.text();
        const chunk = text.substring(0, 20000).toLowerCase();

        // Check <title> tag
        const titleMatch = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : '';
        if (soft404Indicators.some((ind) => title.includes(ind))) return false;

        // Check <h1>/<h2> and prominent body text for soft-404 patterns
        const headingMatches = chunk.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi) || [];
        const headingText = headingMatches.join(' ').replace(/<[^>]*>/g, '').toLowerCase();
        if (soft404Indicators.some((ind) => headingText.includes(ind))) return false;

        // Check breadcrumb / prominent text for "Not Found" patterns
        const bodyText = chunk.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        const notFoundPatterns = ['> not found', '> 404', '404 not found', '404エラー', '404 エラー', 'お探しのページが見つかり', 'お探しのページは見つかり', 'お探しのページは一時的にアクセスができない', 'ページは見つかりませんでした', 'ページが見つかりませんでした', 'ページが削除された', 'ページは削除、変更された', 'ページは削除され', 'このページは削除', 'このページは削除、変更された可能性があります', '移動もしくは削除された可能性', 'the requested document was not found', '申し訳ございません', 'ご指定のurlが変更', 'ご指定のページが見つかり', 'ページが見つかりません'];
        if (notFoundPatterns.some((p) => bodyText.includes(p))) return false;

        return true;
      } catch {
        return false;
      }
    };

    // Extract root domain from existing URLs or search results
    const getRootUrl = (): string | null => {
      for (const url of [research.homepage_url, research.business_url]) {
        if (url) {
          try { return `https://${new URL(url).hostname}`; } catch {}
        }
      }
      for (const r of searchResults) {
        try {
          const host = new URL(r.url).hostname;
          const skipDomains = ['google.com', 'wikipedia.org', 'youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'linkedin.com', 'prtimes.jp', 'nikkei.com'];
          if (!skipDomains.some((d) => host.includes(d))) return `https://${host}`;
        } catch {}
      }
      return null;
    };

    // Try common Japanese corporate site URL patterns to find a valid company overview page
    const findCompanyOverviewUrl = async (baseUrl: string): Promise<string | null> => {
      const candidatePaths = [
        '/company/',
        '/about/',
        '/about_us/',
        '/corporate/',
        '/corporate/overview/',
        '/about_us/corporate_data.html',
        '/company/overview/',
        '/company/overview.html',
        '/company/about/',
        '/company/profile/',
        '/company/profile.html',
        '/company/info/',
        '/corporate/profile/',
        '/corporate/profile.html',
        '/corporate/data/',
        '/corporate/info/',
        '/about/company/',
        '/about/overview/',
        '/ja/company/',
        '/ja/about/',
        '/ja/corporate/',
      ];
      // Also check search results for company-domain URLs with these path hints
      const companyHost = new URL(baseUrl).hostname;
      const searchCandidates = searchResults
        .filter((r) => {
          try { return new URL(r.url).hostname === companyHost; } catch { return false; }
        })
        .map((r) => r.url);

      // Merge: search result URLs first (higher confidence), then generated candidates
      const allCandidates = [
        ...searchCandidates,
        ...candidatePaths.map((p) => `${baseUrl.replace(/\/+$/, '')}${p}`),
      ];

      // Remove duplicates
      const seen = new Set<string>();
      const uniqueCandidates = allCandidates.filter((u) => {
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });

      // Check candidates in parallel batches of 4
      for (let i = 0; i < uniqueCandidates.length; i += 4) {
        const batch = uniqueCandidates.slice(i, i + 4);
        const results = await Promise.all(batch.map((u) => isUrlValid(u).then((ok) => ok ? u : null)));
        const validUrl = results.find((u) => u !== null);
        if (validUrl) return validUrl;
      }
      return null;
    };

    // Verify both URLs in parallel (with 12s total timeout to allow fallback probing)
    try {
      await Promise.race([
        (async () => {
          const [homepageValid, businessValid] = await Promise.all([
            research.homepage_url ? isUrlValid(research.homepage_url) : Promise.resolve(false),
            research.business_url ? isUrlValid(research.business_url) : Promise.resolve(false),
          ]);

          const rootUrl = getRootUrl();

          if (!homepageValid && research.homepage_url) {
            console.warn(`[URL Verify] homepage_url is invalid (404/soft-404): ${research.homepage_url}`);
            // Try to find a valid company overview page
            if (rootUrl) {
              const betterUrl = await findCompanyOverviewUrl(rootUrl);
              research.homepage_url = betterUrl || rootUrl;
              console.log(`[URL Verify] homepage_url fallback: ${research.homepage_url}`);
            } else {
              research.homepage_url = '';
            }
          }
          if (!businessValid && research.business_url) {
            console.warn(`[URL Verify] business_url is invalid (404/soft-404): ${research.business_url}`);
            // Fallback to homepage or root URL
            research.business_url = research.homepage_url || rootUrl || '';
            console.log(`[URL Verify] business_url fallback: ${research.business_url}`);
          }
        })(),
        new Promise<void>((resolve) => setTimeout(() => {
          console.warn('[URL Verify] Verification timed out after 6s, keeping existing URLs');
          resolve();
        }, 6000)),
      ]);
    } catch (error) {
      console.warn('[URL Verify] Verification failed:', error);
    }
  }

  private ensureResearchQuality(research: CompanyResearch, companyName: string): void {
    // Ensure overview is never empty or "情報なし"
    if (!research.overview || research.overview === '情報なし' || research.overview.length < 10) {
      research.overview = `${companyName}は、${research.industry || '日本市場'}で事業を展開する企業です。${research.business ? research.business.substring(0, 80) + 'を主な事業としています。' : ''}`;
    }

    // Ensure business is never empty
    if (!research.business || research.business === '情報なし' || research.business.length < 10) {
      research.business = research.overview || `${companyName}の事業内容は、${research.industry || '複数の領域'}において顧客に価値を提供するサービスを展開しています。`;
    }

    // Ensure pains are never empty
    if (!research.pains || research.pains.length === 0) {
      research.pains = [
        '事業成長に伴う営業組織の拡大と効率化',
        '競合環境の変化への迅速な対応',
        '社内DX推進と業務プロセスの改善',
        '顧客獲得コストの最適化',
        '人材採用・定着と組織力の強化',
      ];
    }

    // Ensure hypothesis is not empty
    if (!research.hypothesis) {
      const pain1 = research.pains[0] || '業務効率化';
      research.hypothesis = `${companyName}は「${pain1}」などの課題を抱えており、営業支援サービスの導入により改善が期待できます。`;
    }
  }

  /**
   * Extract homepage_url and business_url from search results when AI didn't find them.
   * Looks for the company's own domain (e.g., example.co.jp) in search result URLs.
   */
  private async ensureUrls(
    research: CompanyResearch,
    companyName: string,
    searchResults: SearchResultWithUrl[]
  ): Promise<void> {
    if (searchResults.length === 0) return;

    // Helper: check if a URL looks like a company homepage (short path, no deep nesting)
    const isHomepageCandidate = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/\/+$/, '');
        return (
          path === '' ||
          path === '/company' ||
          path === '/about' ||
          path === '/about-us' ||
          path === '/corporate' ||
          path === '/corporate/about' ||
          path === '/company/about' ||
          path === '/company/overview' ||
          path === '/company-info' ||
          path === '/company-profile' ||
          path === '/corporate-profile' ||
          /^\/[a-z]{2}\/?$/.test(path) // language prefix like /ja/
        );
      } catch {
        return false;
      }
    };

    const isServiceCandidate = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.toLowerCase();
        return (
          path.includes('/service') ||
          path.includes('/product') ||
          path.includes('/solution') ||
          path.includes('/business') ||
          path.includes('/offering') ||
          path.includes('/platform') ||
          path.includes('/feature') ||
          path.includes('/lp') ||
          path.includes('/plan') ||
          path.includes('/pricing')
        );
      } catch {
        return false;
      }
    };

    // Skip URLs from known non-company domains
    const skipDomains = [
      'google.com', 'wikipedia.org', 'youtube.com', 'twitter.com', 'x.com',
      'facebook.com', 'linkedin.com', 'amazon.co.jp', 'rakuten.co.jp',
      'prtimes.jp', 'nikkei.com', 'itmedia.co.jp', 'techcrunch.com',
    ];
    const isCompanyUrl = (url: string): boolean => {
      try {
        const host = new URL(url).hostname;
        return !skipDomains.some((d) => host.includes(d));
      } catch {
        return false;
      }
    };

    // Helper: check if URL is a "company info" page (e.g. /company, /about) – NOT root
    const isCompanyInfoPage = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/\/+$/, '');
        return (
          path === '/company' ||
          path === '/about' ||
          path === '/about-us' ||
          path === '/corporate' ||
          path === '/corporate/about' ||
          path === '/company/about' ||
          path === '/company/overview' ||
          path === '/company/profile' ||
          path === '/corporate/profile' ||
          path === '/corporate/overview' ||
          path === '/info' ||
          path === '/company-info'
        );
      } catch {
        return false;
      }
    };

    // Find homepage URL: prioritize /company, /about pages over root domain
    if (!research.homepage_url) {
      // Priority 1: company info page (e.g. example.co.jp/company/)
      const companyInfoCandidate = searchResults.find(
        (r) => isCompanyUrl(r.url) && isCompanyInfoPage(r.url)
      );
      if (companyInfoCandidate) {
        research.homepage_url = companyInfoCandidate.url;
      } else {
        // Priority 2: any homepage candidate (including root)
        const homepageCandidate = searchResults.find(
          (r) => isCompanyUrl(r.url) && isHomepageCandidate(r.url)
        );
        if (homepageCandidate) {
          research.homepage_url = homepageCandidate.url;
        } else {
          // Priority 3: derive root URL from first company-domain URL
          const firstCompanyUrl = searchResults.find((r) => isCompanyUrl(r.url));
          if (firstCompanyUrl) {
            try {
              const parsed = new URL(firstCompanyUrl.url);
              research.homepage_url = `${parsed.protocol}//${parsed.hostname}`;
            } catch {
              // ignore
            }
          }
        }
      }
    } else {
      // homepage_url already set by AI — try to upgrade to company info page if available
      try {
        const currentPath = new URL(research.homepage_url).pathname.replace(/\/+$/, '');
        if (currentPath === '' || currentPath === '/') {
          // Currently root URL → check if a more specific company info page exists
          const betterCandidate = searchResults.find(
            (r) => isCompanyUrl(r.url) && isCompanyInfoPage(r.url)
          );
          if (betterCandidate) {
            research.homepage_url = betterCandidate.url;
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // Find business/service URL if missing
    if (!research.business_url) {
      const serviceCandidate = searchResults.find(
        (r) => isCompanyUrl(r.url) && isServiceCandidate(r.url)
      );
      if (serviceCandidate) {
        research.business_url = serviceCandidate.url;
      } else if (research.homepage_url) {
        // Fallback: use homepage URL (company sites usually have business info)
        research.business_url = research.homepage_url;
      }
    }

    // URL Probing: verify and upgrade URLs by checking actual company domain pages
    const companyDomain = this.extractCompanyDomain(research, searchResults);
    if (companyDomain) {
      try {
        // Check if homepage_url is missing or just a root URL that could be upgraded
        let needsAboutUpgrade = !research.homepage_url;
        if (!needsAboutUpgrade && research.homepage_url) {
          try {
            const p = new URL(research.homepage_url).pathname.replace(/\/+$/, '');
            needsAboutUpgrade = p === '' || p === '/';
          } catch { needsAboutUpgrade = true; }
        }
        const needsBusinessUpgrade = !research.business_url ||
          research.business_url === research.homepage_url;

        if (needsAboutUpgrade || needsBusinessUpgrade) {
          // Wrap entire probing in a 15-second timeout to prevent slowing down the main flow
          const probeWithTimeout = async () => {
            console.log(`[URL Probe] Probing ${companyDomain} for about/business pages...`);
            const probed = await this.probeCompanyPages(companyDomain);

            if (probed.aboutUrl && needsAboutUpgrade) {
              console.log(`[URL Probe] Found about page: ${probed.aboutUrl}`);
              research.homepage_url = probed.aboutUrl;
            }
            if (probed.businessUrl && needsBusinessUpgrade) {
              console.log(`[URL Probe] Found business page: ${probed.businessUrl}`);
              research.business_url = probed.businessUrl;
            }

            // Fallback: site-specific Google Search for pages probing couldn't find
            // (handles non-standard URL structures like Sony's /ja/SonyInfo/products/)
            const stillNeedsAbout = needsAboutUpgrade && !probed.aboutUrl;
            const stillNeedsBusiness = needsBusinessUpgrade && !probed.businessUrl;
            if (stillNeedsAbout || stillNeedsBusiness) {
              console.log(`[Site Search] Probing incomplete, trying site-specific search for ${companyDomain}...`);
              const [aboutSearchUrl, businessSearchUrl] = await Promise.all([
                stillNeedsAbout ? this.siteSpecificSearch(companyDomain, 'about') : Promise.resolve(null),
                stillNeedsBusiness ? this.siteSpecificSearch(companyDomain, 'business') : Promise.resolve(null),
              ]);
              if (aboutSearchUrl) {
                console.log(`[Site Search] Found about page: ${aboutSearchUrl}`);
                research.homepage_url = aboutSearchUrl;
              }
              if (businessSearchUrl) {
                console.log(`[Site Search] Found business page: ${businessSearchUrl}`);
                research.business_url = businessSearchUrl;
              }
            }
          };

          // Race probing against an 8-second timeout
          await Promise.race([
            probeWithTimeout(),
            new Promise<void>((resolve) => setTimeout(() => {
              console.warn('[URL Probe] Probing timed out after 8s, using existing URLs');
              resolve();
            }, 8000)),
          ]);
        }
      } catch (error) {
        console.warn('[URL Probe] Probing failed, using existing URLs:', error);
      }
    }
  }

  /**
   * Extract the company's primary domain from research data or search results.
   */
  private extractCompanyDomain(
    research: CompanyResearch,
    searchResults: SearchResultWithUrl[]
  ): string | null {
    const skipDomains = [
      'google.com', 'wikipedia.org', 'youtube.com', 'twitter.com', 'x.com',
      'facebook.com', 'linkedin.com', 'amazon.co.jp', 'rakuten.co.jp',
      'prtimes.jp', 'nikkei.com', 'itmedia.co.jp', 'techcrunch.com',
      'toyokeizai.net', 'diamond.jp', 'businessinsider.jp', 'ascii.jp',
      'watch.impress.co.jp', 'japan.zdnet.com', 'atmarkit.itmedia.co.jp',
    ];
    const isCompanyDomain = (host: string) => !skipDomains.some((d) => host.includes(d));

    // Try from existing URLs
    for (const url of [research.homepage_url, research.business_url]) {
      if (url) {
        try {
          const host = new URL(url).hostname;
          if (isCompanyDomain(host)) return host;
        } catch {}
      }
    }
    // Try from search results
    for (const r of searchResults) {
      try {
        const host = new URL(r.url).hostname;
        if (isCompanyDomain(host)) return host;
      } catch {}
    }
    return null;
  }

  /**
   * Probe common URL paths on the company domain to find /about, /company, /business pages.
   * Uses parallel GET requests with User-Agent (some sites block HEAD requests).
   * Includes soft 404 detection via page title check.
   */
  private async probeCompanyPages(domain: string): Promise<{
    aboutUrl?: string;
    businessUrl?: string;
  }> {
    const result: { aboutUrl?: string; businessUrl?: string } = {};
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const tryUrl = async (url: string): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': UA },
          cache: 'no-store' as RequestCache, // Prevent Next.js fetch caching
        });
        clearTimeout(timeoutId);
        if (!response.ok) return null;

        const finalUrl = response.url || url;

        // Skip if redirected to an error page URL
        const lowerFinalUrl = finalUrl.toLowerCase();
        if (lowerFinalUrl.includes('/error') || lowerFinalUrl.includes('/404') || lowerFinalUrl.includes('not-found') || lowerFinalUrl.includes('not_found')) {
          return null;
        }

        // Skip if redirected to a completely different domain (e.g., electronics.sony.com from www.sony.com)
        try {
          const origHost = new URL(url).hostname.replace(/^www\./, '');
          const finalHost = new URL(finalUrl).hostname.replace(/^www\./, '');
          if (origHost !== finalHost) return null;
        } catch { /* ignore parse errors */ }

        // Soft 404 detection: check first 15KB of page for title, headings, and body text
        const text = await response.text();
        const chunk = text.substring(0, 15000).toLowerCase();
        const titleMatch = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = (titleMatch ? titleMatch[1] : '');
        const soft404Words = ['not found', '404', 'ページが見つかりません', '見つかりませんでした', '見当たりません', 'page not found', '404エラー', 'ページは削除', 'ページが削除'];
        if (soft404Words.some((ind) => title.includes(ind))) return null;

        // Also check headings and prominent body text
        const headingMatches = chunk.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi) || [];
        const headingText = headingMatches.join(' ').replace(/<[^>]*>/g, '');
        if (soft404Words.some((ind) => headingText.includes(ind))) return null;

        const bodyText = chunk.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        const bodyNotFoundPatterns = ['404エラー', '404 エラー', 'ページが見つかりませんでした', 'ページが見つかりません', 'ページは削除、変更された', 'このページは削除', 'このページは削除、変更された可能性があります', 'お探しのページが見つかり', 'お探しのページは見つかり', 'お探しのページは一時的にアクセスができない', '移動もしくは削除された可能性'];
        if (bodyNotFoundPatterns.some((p) => bodyText.includes(p))) return null;

        return finalUrl;
      } catch {
        return null;
      }
    };

    // Japanese locale paths first (more specific), then generic, then English
    // Includes /jp/ja/ country+language prefix (used by Mitsubishi Corp, etc.)
    const aboutPaths = [
      '/jp/ja/about/', '/jp/ja/company/', '/jp/ja/corporate/',
      '/ja/about/', '/ja/company/', '/ja/corporate/',
      '/about/', '/company/', '/about', '/company', '/corporate/', '/corporate',
      '/company-info', '/company-info/', '/about-us', '/about-us/',
      '/company-profile', '/company-profile/', '/corporate-profile',
      '/jp/about/', '/jp/company/',
      '/en/about/', '/en/company/',
    ];
    const businessPaths = [
      '/jp/ja/about/business-group/', '/jp/ja/business/', '/jp/ja/service/', '/jp/ja/services/', '/jp/ja/product/', '/jp/ja/products/',
      '/ja/business/', '/ja/service/', '/ja/services/', '/ja/product/', '/ja/products/',
      '/business/', '/service/', '/services/', '/product/', '/products/', '/solution/', '/solutions/',
      '/service-info', '/service-info/', '/product-info', '/product-info/',
      '/jp/business/', '/jp/products/', '/jp/services/',
      '/en/business/', '/en/products/', '/en/services/',
    ];

    // Run all probes in parallel for speed
    const [aboutResults, businessResults] = await Promise.all([
      Promise.all(aboutPaths.map((p) => tryUrl(`https://${domain}${p}`))),
      Promise.all(businessPaths.map((p) => tryUrl(`https://${domain}${p}`))),
    ]);

    // Filter: reject root/home page URLs for business (e.g., redirect /product → /en/)
    const isRootPage = (url: string): boolean => {
      try {
        const path = new URL(url).pathname.replace(/\/+$/, '');
        return path === '' || /^\/[a-z]{2}$/.test(path); // root or locale prefix only
      } catch { return false; }
    };

    result.aboutUrl = aboutResults.find((u) => u !== null) ?? undefined;
    result.businessUrl = businessResults.find((u) => u !== null && !isRootPage(u)) ?? undefined;

    return result;
  }

  /**
   * Site-specific Google Search: find /about or /business pages directly.
   * Used as fallback when generic URL probing fails (e.g., Sony's /ja/SonyInfo/products/).
   */
  private async siteSpecificSearch(
    domain: string,
    type: 'about' | 'business'
  ): Promise<string | null> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    if (!apiKey || !cx) return null;

    const query = type === 'about'
      ? `site:${domain} 会社概要 OR 企業情報 OR 会社情報 OR corporate info OR about us`
      : `site:${domain} 事業グループ OR 事業紹介 OR 事業内容 OR 製品一覧 OR サービス一覧 OR products OR services`;

    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('q', query);
      url.searchParams.append('key', apiKey);
      url.searchParams.append('cx', cx);
      url.searchParams.append('num', '3');

      const response = await fetch(url.toString(), { cache: 'no-store' as RequestCache });
      if (!response.ok) return null;

      const data = (await response.json()) as GoogleSearchResult;
      if (data.items && data.items.length > 0) {
        // Return the first result URL (most relevant)
        return data.items[0].link;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate homepage_url and business_url generated from Gemini knowledge (no Google Search API).
   * Gemini often fabricates URLs (e.g., bakuzan.jp for LayerX). Quick-check each URL
   * and replace invalid ones with a Google Search fallback.
   * Also upgrades root URLs to specific company info pages when possible.
   */
  private async validateKnowledgeUrls(
    research: CompanyResearch,
    companyName: string
  ): Promise<void> {
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const quickCheck = async (url: string): Promise<boolean> => {
      if (!url || url.trim() === '') return false;
      try {
        const parsed = new URL(url);
        if (!parsed.hostname || parsed.hostname.length < 3) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': UA },
          cache: 'no-store' as RequestCache,
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch {
        return false;
      }
    };

    // Check if URL is a root/top page (not a specific company info page)
    const isRootUrl = (url: string): boolean => {
      try {
        const path = new URL(url).pathname.replace(/\/+$/, '');
        return path === '' || /^\/[a-z]{2}$/.test(path);
      } catch { return true; }
    };

    // Probe common company info paths on a domain
    const probeCompanyInfoUrl = async (domain: string): Promise<string | null> => {
      const paths = [
        '/company-info', '/company-info/', '/company', '/company/',
        '/about', '/about/', '/about-us', '/about-us/',
        '/corporate', '/corporate/', '/company-profile', '/company-profile/',
        '/company/overview', '/company/profile',
        '/corporate/overview', '/corporate/profile',
        '/ja/company/', '/ja/about/', '/ja/corporate/',
      ];
      // Check in batches of 6 for speed
      for (let i = 0; i < paths.length; i += 5) {
        const batch = paths.slice(i, i + 5);
        const results = await Promise.all(
          batch.map(async (p) => {
            const url = `https://${domain}${p}`;
            const ok = await quickCheck(url);
            return ok ? url : null;
          })
        );
        const found = results.find((u) => u !== null);
        if (found) return found;
      }
      return null;
    };

    // Never use Google Search fallback URLs — they are not direct links.
    // When a URL can't be found, leave it empty so the UI won't show a broken link.

    try {
      // Overall 6s timeout for validation + probing
      await Promise.race([
        (async () => {
          // Step 1: Check if URLs are reachable at all
          const [homepageValid, businessValid] = await Promise.all([
            research.homepage_url ? quickCheck(research.homepage_url) : Promise.resolve(false),
            research.business_url ? quickCheck(research.business_url) : Promise.resolve(false),
          ]);

          // Step 2: Extract domain from Gemini URLs for probing (even if URL itself is invalid)
          let probeDomain: string | null = null;
          for (const url of [research.homepage_url, research.business_url]) {
            if (url) {
              try {
                const host = new URL(url).hostname;
                if (host && host.length >= 3 && !host.includes('google.com')) {
                  probeDomain = host;
                  break;
                }
              } catch {}
            }
          }

          // Step 3: Handle invalid/valid URLs with domain probing
          if (!homepageValid) {
            const oldUrl = research.homepage_url || '(empty)';
            console.log(`[Knowledge URL] homepage_url invalid: ${oldUrl}`);

            // Try to probe the domain for a valid company page before falling back to Google Search
            if (probeDomain) {
              const domainReachable = await quickCheck(`https://${probeDomain}`);
              if (domainReachable) {
                console.log(`[Knowledge URL] Domain ${probeDomain} reachable, probing for company page...`);
                const betterUrl = await probeCompanyInfoUrl(probeDomain);
                research.homepage_url = betterUrl || `https://${probeDomain}`;
                console.log(`[Knowledge URL] homepage_url → ${research.homepage_url}`);
              } else {
                research.homepage_url = '';
                console.log(`[Knowledge URL] Domain unreachable → Google Search fallback`);
              }
            } else {
              research.homepage_url = '';
            }
          } else if (research.homepage_url && isRootUrl(research.homepage_url)) {
            // Valid but root URL → try to find a more specific company info page
            try {
              const domain = new URL(research.homepage_url).hostname;
              console.log(`[Knowledge URL] homepage_url is root URL, probing ${domain} for company info page...`);
              const betterUrl = await probeCompanyInfoUrl(domain);
              if (betterUrl) {
                console.log(`[Knowledge URL] Found company info page: ${betterUrl}`);
                research.homepage_url = betterUrl;
              }
            } catch {
              // Keep existing URL on probe failure
            }
          }

          if (!businessValid) {
            const oldUrl = research.business_url || '(empty)';
            console.log(`[Knowledge URL] business_url invalid: ${oldUrl}`);

            // Try domain probing for service/business page
            const bDomain = probeDomain || (research.homepage_url ? (() => { try { const h = new URL(research.homepage_url!).hostname; return h.includes('google.com') ? null : h; } catch { return null; } })() : null);
            if (bDomain) {
              const servicePaths = [
                '/service', '/service/', '/services', '/services/',
                '/product', '/product/', '/products', '/products/',
                '/solution', '/solution/', '/solutions', '/solutions/',
                '/business', '/business/', '/service-info', '/service-info/',
                '/ja/service/', '/ja/business/', '/ja/products/',
              ];
              let foundBusiness = false;
              for (let i = 0; i < servicePaths.length; i += 5) {
                const batch = servicePaths.slice(i, i + 5);
                const results = await Promise.all(
                  batch.map(async (p) => {
                    const url = `https://${bDomain}${p}`;
                    const ok = await quickCheck(url);
                    return ok ? url : null;
                  })
                );
                const found = results.find((u) => u !== null);
                if (found) {
                  research.business_url = found;
                  console.log(`[Knowledge URL] Found business page: ${found}`);
                  foundBusiness = true;
                  break;
                }
              }
              if (!foundBusiness) {
                // Use homepage_url as fallback if it's a direct link, otherwise Google Search
                if (research.homepage_url && !research.homepage_url.includes('google.com/search')) {
                  research.business_url = research.homepage_url;
                } else {
                  research.business_url = '';
                }
              }
            } else {
              research.business_url = '';
            }
          }

          // Step 4: If business_url is same as homepage or root, try to find service/business page
          if (businessValid && research.business_url && (
            research.business_url === research.homepage_url || isRootUrl(research.business_url)
          )) {
            try {
              const domain = new URL(research.business_url).hostname;
              const servicePaths = [
                '/service', '/service/', '/services', '/services/',
                '/product', '/product/', '/products', '/products/',
                '/solution', '/solution/', '/solutions', '/solutions/',
                '/business', '/business/', '/service-info', '/service-info/',
                '/ja/service/', '/ja/business/', '/ja/products/',
              ];
              for (let i = 0; i < servicePaths.length; i += 5) {
                const batch = servicePaths.slice(i, i + 5);
                const results = await Promise.all(
                  batch.map(async (p) => {
                    const url = `https://${domain}${p}`;
                    const ok = await quickCheck(url);
                    return ok ? url : null;
                  })
                );
                const found = results.find((u) => u !== null);
                if (found) {
                  console.log(`[Knowledge URL] Found service page: ${found}`);
                  research.business_url = found;
                  break;
                }
              }
            } catch {
              // Keep existing URL on probe failure
            }
          }
        })(),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            console.warn('[Knowledge URL] Validation timed out after 10s, keeping current URLs');
            // Only set Google Search fallback if URL is still empty or clearly invalid
            if (!research.homepage_url || research.homepage_url.trim() === '') {
              research.homepage_url = '';
            }
            if (!research.business_url || research.business_url.trim() === '') {
              research.business_url = '';
            }
            resolve();
          }, 10000)
        ),
      ]);
    } catch (error) {
      console.warn('[Knowledge URL] Validation failed:', error);
      research.homepage_url = '';
      research.business_url = '';
    }
  }

  private async googleSearchWithUrls(companyName: string): Promise<SearchResultWithUrl[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      console.warn('Google Search API credentials not configured, returning empty results');
      return [];
    }

    // Queries: all news-focused with dateRestrict for freshness (m6 = last 6 months)
    const currentYear = new Date().getFullYear();
    const queries: Array<{ q: string; dateRestrict?: string; sort?: string }> = [
      { q: `${companyName} 最新ニュース ${currentYear - 1} ${currentYear}`, dateRestrict: 'm6', sort: 'date' },
      { q: `${companyName} プレスリリース 新サービス 発表`, dateRestrict: 'm6', sort: 'date' },
      { q: `${companyName} 資金調達 提携 事業拡大`, dateRestrict: 'm6', sort: 'date' },
      { q: `${companyName} IR 決算 業績 経営`, dateRestrict: 'm6', sort: 'date' },
      { q: `${companyName} プレスリリース site:prtimes.jp`, dateRestrict: 'm6', sort: 'date' },
    ];

    const results: SearchResultWithUrl[] = [];

    for (const { q, dateRestrict, sort } of queries) {
      try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.append('q', q);
        url.searchParams.append('key', apiKey);
        url.searchParams.append('cx', cx);
        url.searchParams.append('num', '10');
        if (dateRestrict) url.searchParams.append('dateRestrict', dateRestrict);
        if (sort) url.searchParams.append('sort', sort);

        const response = await fetch(url.toString(), { cache: 'no-store' as RequestCache });
        if (!response.ok) {
          console.warn(`Google Search failed for query: ${q}`);
          continue;
        }

        const data = (await response.json()) as GoogleSearchResult;
        if (data.items) {
          for (const item of data.items.slice(0, 10)) {
            results.push({
              title: item.title || '',
              url: item.link || '',
              snippet: item.snippet || '',
            });
          }
        }
      } catch (error) {
        console.error(`Error searching for ${q}:`, error);
      }
    }

    return results;
  }

  private async scrapeSearchResults(snippets: string[]): Promise<string> {
    const content: string[] = [];

    for (const snippet of snippets.slice(0, 10)) {
      if (snippet) {
        content.push(snippet.substring(0, 500));
      }
    }

    const combinedContent = content.join('\n');
    return combinedContent.substring(0, 5000);
  }

  private parseNewsArticles(searchResults: string[]): string[] {
    const newsKeywords = [
      'ニュース',
      '発表',
      '資金調達',
      '採用',
      'イベント',
      '新サービス',
      '提携',
    ];
    const news: string[] = [];

    for (const result of searchResults) {
      if (newsKeywords.some((keyword) => result.includes(keyword))) {
        news.push(result);
      }
    }

    return news.slice(0, 10);
  }
}

export const researchService = new ResearchService();
