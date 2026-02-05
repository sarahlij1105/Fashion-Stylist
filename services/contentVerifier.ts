import { GoogleGenAI } from "@google/genai";

interface ContentVerification {
    url: string;
    claimedCategory: string;
    actualCategory: string | null;
    isMatch: boolean;
    inStock: boolean;
    price: string | null;
    title: string | null;
}

export const verifyProductContent = async (
    items: Array<{url: string, category: string, name: string}>,
    aiClient: GoogleGenAI
): Promise<Map<string, ContentVerification>> => {
    const results = new Map<string, ContentVerification>();
    
    // Batch fetch with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (item) => {
            try {
                // Fetch page content (with timeout)
                // Note: CORS policies in browsers may restrict access to many e-commerce sites.
                // This generally works best in backend environments or with CORS proxies.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(item.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 Fashion-Stylist-Bot/1.0' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const html = await response.text();
                
                // Extract key signals using lightweight parsing
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                const title = titleMatch?.[1] || '';
                
                // Check for sold-out signals
                const soldOutSignals = [
                    /sold\s*out/i,
                    /out\s*of\s*stock/i,
                    /currently\s*unavailable/i,
                    /notify\s*me\s*when/i,
                    /waitlist/i
                ];
                const inStock = !soldOutSignals.some(regex => regex.test(html));
                
                // Use LLM to classify the actual product category (lightweight prompt)
                const classificationPrompt = `
                Page title: "${title}"
                First 500 chars of body: "${html.replace(/<[^>]+>/g, ' ').slice(0, 500)}"
                
                Question: What type of fashion item is this page selling?
                Options: top, bottom, dress, shoes, outerwear, accessory, bag, jewelry, unknown, not_a_product_page
                
                Reply with ONLY the category name, nothing else.
                `;
                
                const classificationResp = await aiClient.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: [{ text: classificationPrompt }] }
                });
                
                const actualCategory = classificationResp.text?.trim().toLowerCase() || 'unknown';
                
                results.set(item.url, {
                    url: item.url,
                    claimedCategory: item.category,
                    actualCategory,
                    isMatch: actualCategory.includes(item.category.toLowerCase()) || item.category.toLowerCase().includes(actualCategory) || actualCategory === 'unknown',
                    inStock,
                    price: null, // Could extract with regex
                    title
                });
            } catch (error) {
                // Fallback for fetch errors (CORS, network, etc.)
                // We default to "Unknown/Pass" so we don't block valid items just because we can't scrape them client-side
                results.set(item.url, {
                    url: item.url,
                    claimedCategory: item.category,
                    actualCategory: null,
                    isMatch: true, // Benefit of the doubt
                    inStock: true, // Benefit of the doubt
                    price: null,
                    title: null
                });
            }
        });
        
        await Promise.all(batchPromises);
    }
    
    return results;
};