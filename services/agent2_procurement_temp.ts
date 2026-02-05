
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult } from "../types";

const API_KEY = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * MICRO-AGENT: Category Specialist
 * Runs a dedicated search thread for a single category using a 2-Phase Process.
 */
export const runCategoryMicroAgent = async (
    category: string,
    profile: UserProfile,
    preferences: Preferences,
    pathInstruction: string,
    today: string,
    styleAnalysis?: StyleAnalysisResult
): Promise<{ category: string, items: any[], rawResponse: string, searchCriteria: string, initialCandidateCount: number }> => {
    
    // --- SETUP: EXTRACT STYLE INSIGHTS ---
    let visualAnchors = "";
    let optimizationKeywords = "";

    if (styleAnalysis && styleAnalysis.searchEnhancement) {
        if (styleAnalysis.searchEnhancement.unifiedKeywords) {
            optimizationKeywords = styleAnalysis.searchEnhancement.unifiedKeywords.join(' ');
        }
        if (styleAnalysis.searchEnhancement.byCategory) {
            const analysisCatKey = Object.keys(styleAnalysis.searchEnhancement.byCategory).find(
                k => k.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(k.toLowerCase())
            );
            if (analysisCatKey) {
                const data = styleAnalysis.searchEnhancement.byCategory[analysisCatKey];
                const keywords = data.enhancedKeywords || data.visual_anchors || [];
                if (keywords.length > 0) visualAnchors = keywords.join(' ');
            }
        }
    }

    const searchContext = `${preferences.stylePreference} ${category} ${visualAnchors} ${optimizationKeywords}`.trim();
    // Ensure "shopping" intent in query
    const query = `${searchContext} buy online -pinterest -lyst -polyvore`.trim();

    // ==========================================
    // PHASE 1: DISCOVERY (via Backend API)
    // ==========================================
    console.log(`[${category}] Phase 1: Search via API... Query: ${query}`);
    
    let candidates: any[] = [];
    
    try {
        // Use local proxy if in dev/prod environment
        const apiPath = '/api/search'; 
        
        // We append "site:revolve.com OR site:nordstrom.com OR site:farfetch.com OR site:ssense.com" etc. could be done here
        // But for now we rely on the generic query.
        
        const response = await fetch(`${apiPath}?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            console.warn(`[${category}] Search API failed: ${response.status}`);
             // If API fails (e.g. no keys), fall back to empty list, handled below
        } else {
             const data = await response.json();
             candidates = data.items || [];
        }
    } catch (e) {
        console.error(`[${category}] Phase 1 API Call Failed`, e);
    }

    // Fallback: If no API keys or backend, candidates is empty. 
    // The previous logic used Gemini Tooling which hallucinated. 
    // We strictly use the API results now for safety.

    if (candidates.length === 0) {
        console.warn(`[${category}] No results found via API.`);
        return { category, items: [], rawResponse: "[]", searchCriteria: query, initialCandidateCount: 0 };
    }

    // ==========================================
    // PHASE 2: ENRICHMENT & VERIFICATION (Backend Proxy)
    // ==========================================
    console.log(`[${category}] Phase 2: Enrichment for ${candidates.length} candidates...`);

    // 1. Basic URL Filter
    const liveCandidates = candidates.filter(c => 
        c.purchaseUrl && 
        c.purchaseUrl.startsWith('http') &&
        !c.purchaseUrl.includes('pinterest.') &&
        !c.purchaseUrl.includes('instagram.')
    );
    
    const validatedItems: any[] = [];
    
    // Process in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < liveCandidates.length; i += BATCH_SIZE) {
        const batch = liveCandidates.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (candidate) => {
            try {
                // 2. Fetch Content via Backend Proxy (Solves CORS)
                let pageContent = candidate.snippet || "";
                let fetchSource = "snippet";

                try {
                    const res = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: candidate.purchaseUrl })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        if (data.content) {
                            pageContent = data.content; // Already cleaned on server
                            fetchSource = "live_page";
                        }
                    }
                } catch (proxyErr) {
                    // Fallback to snippet if proxy fails
                }

                // 3. LLM Verification
                const enrichmentPrompt = `
                **PHASE 2: VERIFICATION AUDIT**
                **Candidate:** ${candidate.name}
                **Category:** ${category}
                **Style:** ${preferences.stylePreference}
                
                **Content Source:** ${fetchSource}
                **Content Sample:** "${pageContent.slice(0, 1500)}"

                **Task:** Verify this product.
                
                **Rules:**
                - stockStatus: "UNAVAILABLE" if page says "sold out", "out of stock".
                - stockStatus: "LIKELY_AVAILABLE" if "add to cart" or price visible.
                - stockStatus: "UNCERTAIN" if unclear.

                **Output Schema (JSON):**
                {
                  "isValidProductPage": boolean,
                  "detectedCategory": string,
                  "stockStatus": "UNAVAILABLE" | "LIKELY_AVAILABLE" | "UNCERTAIN",
                  "price": string,
                  "matchScore": number (0-100),
                  "reason": string
                }
                `;

                const analysisRes = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: [{ text: enrichmentPrompt }] },
                    config: { responseMimeType: 'application/json' }
                });

                const analysis = JSON.parse(analysisRes.text || "{}");

                if (analysis.isValidProductPage && analysis.stockStatus !== 'UNAVAILABLE') {
                    validatedItems.push({
                        ...candidate,
                        brand: candidate.name.split(' ')[0], // Heuristic if brand missing
                        price: analysis.price || "Check Site",
                        description: analysis.reason || candidate.snippet,
                        stockStatus: analysis.stockStatus === 'LIKELY_AVAILABLE' ? 'IN STOCK' : 'RISK',
                        matchScore: analysis.matchScore || 50,
                        category: analysis.detectedCategory || category,
                        id: `${category}_${validatedItems.length + 1}`,
                        validationSource: fetchSource
                    });
                }
            } catch (err) {
                // Skip item on analysis failure
            }
        });

        await Promise.all(batchPromises);
    }

    // Sort by Match Score and limit to 7
    const finalItems = validatedItems
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 7);

    return { 
        category, 
        items: finalItems, 
        rawResponse: JSON.stringify(finalItems),
        searchCriteria: query,
        initialCandidateCount: candidates.length
    };
};

/**
 * Legacy wrapper
 */
export const runProcurementAgent = async (
    profile: UserProfile, 
    preferences: Preferences, 
    pathInstruction: string,
    styleAnalysis?: StyleAnalysisResult
): Promise<string> => {
    // This is a compatibility shim, actual logic is in runCategoryMicroAgent
    return "{}"; 
};
