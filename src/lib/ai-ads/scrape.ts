// Lightweight product-page scraper: pulls Open Graph (and fallback) title,
// description, and image from a URL's HTML. Server-only.

function decodeEntities(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .trim();
}

export async function scrapeProduct(
  url: string,
): Promise<{ title: string; description: string; imageUrl: string | null }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AwtoadsBot/1.0; +https://awtoads.app) AppleWebKit/537.36",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not load the page (${res.status})`);
  const html = (await res.text()).slice(0, 600000);

  const meta = (prop: string): string | null => {
    const a = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const b = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    );
    return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
  };

  const title =
    decodeEntities(meta("og:title")) ||
    decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null) ||
    "Product";
  const description = decodeEntities(meta("og:description")) || decodeEntities(meta("description"));

  let imageUrl = meta("og:image") || meta("og:image:url") || meta("twitter:image");
  if (imageUrl) {
    try {
      imageUrl = new URL(decodeEntities(imageUrl), url).href;
    } catch {
      imageUrl = null;
    }
  }

  return { title, description, imageUrl };
}
