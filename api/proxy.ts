
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing URL' }), { status: 400 });
    }

    // Fetch the target URL acting as a standard browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
       return new Response(JSON.stringify({ error: `Target URL returned status ${response.status}` }), { status: 502 });
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        // If target returns JSON (e.g. SerpApi), pass it through directly
        const jsonData = await response.json();
        return new Response(JSON.stringify({ content: JSON.stringify(jsonData) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const html = await response.text();

    // Lightweight cleaning to reduce token usage when passed to LLM
    // Remove scripts, styles, and SVGs
    const cleanedHtml = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
      .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gmi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 20000); // Limit to 20k chars

    return new Response(JSON.stringify({ content: cleanedHtml }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
