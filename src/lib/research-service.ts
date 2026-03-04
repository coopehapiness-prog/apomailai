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
        const cacheAge = (Date.now() - new Date(cached.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (cacheAge < 30) {
          console.log(`Using cached research for ${companyName}`);
          return cached.research_data as CompanyResearch;
        }
      }

      // Check if Google Search API is configured
      const hasSearchApi = process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX;

      if (!hasSearchApi) {
        // No search API - use Gemini to generate research based on its training data
        console.log(`No Google Search API configured, using Gemini knowledge for ${companyName}`);
        try {
          const research = await geminiService.analyzeResearch(
            companyName,
            `${companyName}について、あなたの知識に基づいて分析してください。`,
            [],
            []
          );

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
            overview: `${companyName}の企業情報`,
            news: [],
            pains: [
              `${companyName}の事業拡大に伴う組織課題`,
              '競合他社との差別化',
              '社内DX・業務プロセス改善',
            ],
            scraped_at: new Date().toISOString(),
          };
          return minimalResearch;
        }
      }

      // Perform categorized Google Custom Searches
      const newsResults = await this.searchSingle(`${companyName} 最新ニュース プレスリリース 2024 2025`);
      const serviceResults = await this.searchSingle(`${companyName} サービス 製品 ソリューション 事業内容`);
      const companyResults = await this.searchSingle(`${companyName} 会社概要 企業情報 コーポレートサイト`);

      const allResults = [...newsResults, ...serviceResults, ...companyResults];
      const searchSnippets = allResults.map((r) => r.snippet);

      // Scrape content from results
      const scrapedContent = await this.scrapeSearchResults(searchSnippets);

      // Parse news from search results
      const newsArticles = this.parseNewsArticles(searchSnippets);

      // Analyze with Gemini - pass categorized URLs for accurate linking
      const research = await geminiService.analyzeResearch(
        companyName,
        scrapedContent,
        newsArticles,
        allResults.map((r) => ({ title: r.title, url: r.url })),
        {
          newsUrls: newsResults.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
          serviceUrls: serviceResults.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
          companyUrls: companyResults.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
        }
      );

      // Cache the result
      await supabase.from('research_cache').insert({
        company_name: companyName,
        user_id: userId,
        research_data: research,
      });

      return research;
    } catch (error) {
      console.error('Error researching company:', error);
      // Return basic template on error
      return {
        company_name: companyName,
        overview: '企業情報を取得できませんでした',
        news: [],
        pains: [],
        scraped_at: new Date().toISOString(),
      };
    }
  }

  private async searchSingle(query: string): Promise<SearchResultWithUrl[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      console.warn('Google Search API credentials not configured');
      return [];
    }

    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('q', query);
      url.searchParams.append('key', apiKey);
      url.searchParams.append('cx', cx);
      url.searchParams.append('num', '5');

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.warn(`Google Search failed for query: ${query}`);
        return [];
      }

      const data = (await response.json()) as GoogleSearchResult;
      if (data.items) {
        return data.items.slice(0, 5).map((item) => ({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
        }));
      }
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
    }

    return [];
  }

  private async scrapeSearchResults(snippets: string[]): Promise<string> {
    const content: string[] = [];
    for (const snippet of snippets.slice(0, 15)) {
      if (snippet) {
        content.push(snippet.substring(0, 500));
      }
    }
    const combinedContent = content.join('\n');
    return combinedContent.substring(0, 5000);
  }

  private parseNewsArticles(searchResults: string[]): string[] {
    const newsKeywords = [
      'ニュース', '発表', '資金調達', '採用', 'イベント',
      '新サービス', '提携', 'プレスリリース', 'リリース', '開始',
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
