export class Utils {
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static ensureUrlScheme(url: string): string {
    return /^https?:\/\//.test(url) ? url : `https://${url}`;
  }

  static safeParseUrl(url: string): URL | null {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  static hostnameFromUrl(url: string): string {
    return this.safeParseUrl(url)?.hostname.replace(/^www\./, "") ?? url;
  }

  static stripCodeFences(html: string): string {
    return html.replace(/```html?/gi, "").replace(/```/g, "").trim();
  }
}
