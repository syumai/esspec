const SCRAPBOX_API_BASE_URL = 'https://scrapbox.io/api/pages';
const SCRAPBOX_PROJECT = 'esspec';

export class ScrapboxClient {
  /**
   * Build the text API URL for a given event number
   */
  buildTextApiUrl(eventNumber: number): string {
    const pageName = `ECMAScript仕様輪読会_#${eventNumber}`;
    const encodedPageName = encodeURIComponent(pageName);
    return `${SCRAPBOX_API_BASE_URL}/${SCRAPBOX_PROJECT}/${encodedPageName}/text`;
  }

  /**
   * Fetch the raw text of a Scrapbox page
   */
  async fetchPageText(eventNumber: number): Promise<string | null> {
    const url = this.buildTextApiUrl(eventNumber);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[WARN] Scrapbox API returned ${response.status} for event #${eventNumber}`);
        return null;
      }
      return await response.text();
    } catch (error) {
      console.warn(`[WARN] Failed to fetch Scrapbox page: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Extract content after the "今回のメモ" heading from Scrapbox text
   * Scrapbox headings use bracket-asterisk notation: [* heading], [** heading], etc.
   */
  extractMemoSection(pageText: string): string | null {
    const lines = pageText.split('\n');
    const memoHeadingPattern = /\[\*+\s*今回のメモ\s*\]/;

    const headingIndex = lines.findIndex((line) => memoHeadingPattern.test(line));
    if (headingIndex === -1) {
      return null;
    }

    const memoContent = lines.slice(headingIndex + 1).join('\n').trim();
    if (!memoContent) {
      return null;
    }

    return memoContent;
  }

  /**
   * Fetch and extract memo content for an event (best-effort)
   */
  async fetchMemoContent(eventNumber: number): Promise<string | null> {
    const pageText = await this.fetchPageText(eventNumber);
    if (!pageText) {
      return null;
    }
    return this.extractMemoSection(pageText);
  }
}
