export type HomeStory = { title: string; url: string; image: string; published: string };
export async function getHomeNews(): Promise<HomeStory[]> {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=5', { signal: AbortSignal.timeout(8000), next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data.articles) ? data.articles : []).slice(0,5).flatMap((a: any) => {
      const url = a.links?.web?.href;
      if (typeof url !== 'string' || !/^https:\/\/([a-z0-9-]+\.)*espn\.com\//i.test(url)) return [];
      return [{ title: String(a.headline || 'NFL report'), url, image: a.images?.[0]?.url || '', published: a.published || '' }];
    });
  } catch { return []; }
}
