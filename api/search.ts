
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!apiKey || !cx) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: Missing Search API keys' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Call Google Programmable Search JSON API
    // We request 10 results.
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&safe=active`;
    
    const res = await fetch(googleUrl);
    
    if (!res.ok) {
       const errText = await res.text();
       return new Response(JSON.stringify({ error: 'Google API Error', details: errText }), {
         status: res.status,
         headers: { 'Content-Type': 'application/json' },
       });
    }

    const data = await res.json();
    
    // Map standard Google JSON Response to our internal format
    const items = (data.items || []).map((item: any) => ({
        name: item.title,
        purchaseUrl: item.link,
        snippet: item.snippet,
        source: 'google_pse',
        image: item.pagemap?.cse_image?.[0]?.src || null
    }));

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
