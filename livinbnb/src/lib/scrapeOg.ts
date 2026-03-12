/**
 * Fetches a listing URL and extracts og:title, og:image, and og:description
 * from the HTML <head>. Falls back gracefully on any error.
 */
export interface OgData {
  title: string;
  imageUrl: string | null;
  description: string | null;
}

export async function scrapeOg(url: string): Promise<OgData> {
  const fallback: OgData = { title: '', imageUrl: null, description: null };
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Livinbnb/1.0; +https://livinbnb.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return fallback;
    const html = await res.text();

    const get = (prop: string) => {
      const match = html.match(
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
      ) ?? html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i')
      );
      return match?.[1] ?? null;
    };

    return {
      title: get('title') ?? fallback.title,
      imageUrl: get('image'),
      description: get('description'),
    };
  } catch {
    return fallback;
  }
}
