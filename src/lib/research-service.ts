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
        if (cacheAge < 30) {
          console.log(`Using cached research for ${companyName}`);
          return cached.research_data as CompanyResearch;
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

  private async googleSearchWithUrls(companyName: string): Promise<SearchResultWithUrl[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      console.warn('Google Search API credentials not configured, returning empty results');
      return [];
    }

    const queries = [
      `${companyName} 最新ニュース`,
      `${companyName} 資金調達 採用`,
      `${companyName} 会社概要 事業内容`,
    ];

    const results: SearchResultWithUrl[] = [];

    for (const query of queries) {
      try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.append('q', query);
        url.searchParams.append('key', apiKey);
        url.searchParams.append('cx', cx);
        url.searchParams.append('num', '5');

        const response = await fetch(url.toString());
        if (!response.ok) {
          console.warn(`Google Search failed for query: ${query}`);
          continue;
        }

        const data = (await response.json()) as GoogleSearchResult;
        if (data.items) {
          for (const item of data.items.slice(0, 5)) {
            results.push({
              title: item.title || '',
              url: item.link || '',
              snippet: item.snippet || '',
            });
          }
        }
      } catch (error) {
        console.error(`Error searching for ${query}:`, error);
      }
    }

    return results;
  }

  private async googleSearch(companyName: string): Promise<string[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      console.warn('Google Search API credentials not configured, returning empty results');
      return [];
    }

    const queries = [
      `${companyName} 最新ニュース`,
      `${companyName} 資金調達 採用`,
      `${companyName} 会社概要 事業内容`,
    ];

    const results: string[] = [];

    for (const query of queries) {
      try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.append('q', query);
        url.searchParams.append('key', apiKey);
        url.searchParams.append('cx', cx);
        url.searchParams.append('num', '3');

        const response = await fetch(url.toString());
        if (!response.ok) {
          console.warn(`Google Search failed for query: ${query}`);
          continue;
        }

        const data = (await response.json()) as GoogleSearchResult;
        if (data.items) {
          for (const item of data.items.slice(0, 3)) {
            results.push(item.snippet || '');
            results.push(item.title || '');
          }
        }
      } catch (error) {
        console.error(`Error searching for ${query}:`, error);
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
