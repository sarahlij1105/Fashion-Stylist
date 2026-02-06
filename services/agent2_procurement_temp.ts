
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult } from "../types";
import { generateContentWithRetry } from "./geminiService";

// REMOVED LOCAL AI INITIALIZATION - using geminiService's instance via retry wrapper


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
    
    // --- SETUP: EXTRACT SEARCH CRITERIA ---
    // User requested: Strict Search Criteria = gender (implicit in category usually) + size + category + color + style.
    // AND: Do NOT use the detailed 'vibe tags' for this strict search to avoid over-filtering.
    
    // 1. Base Search Context: Style + Category
    let searchContext = `${preferences.stylePreference} ${category}`.trim();

    // 2. Add Colors if available (High priority filter)
    // If style analysis provided specific colors for this category, use those.
    // Otherwise fallback to general preference colors.
    let searchColors = preferences.colors; 
    if (styleAnalysis?.detectedColors && styleAnalysis.detectedColors.length > 0) {
        // Use the detected colors from the Style Analyzer
         searchColors = styleAnalysis.detectedColors.join(' or ');
    }
    
    if (searchColors) {
        searchContext = `${searchColors} ${searchContext}`;
    }

    // 3. Add Gender/Size context (simplified for query string)
    if (profile.gender) {
        searchContext = `${profile.gender} ${searchContext}`;
    }

    // Ensure "shopping" intent in query and exclude known noise
    // REMOVED 'optimizationKeywords' (vibe tags) from the strict search query.
    const query = `${searchContext} buy online -pinterest -lyst -polyvore`.trim();

    // ==========================================
    // PHASE 1: DISCOVERY (via Gemini Grounding)
    // ==========================================
    console.log(`[${category}] Phase 1: Search via Gemini Grounding... Query: ${query}`);
    
    let candidates: any[] = [];
    
    try {
        // Use Gemini with Google Search Tool
        // This bypasses the need for GOOGLE_SEARCH_ENGINE_ID
        const searchPrompt = `Search for 10 shopping links for: ${query}`;
        
        const searchResponse = await generateContentWithRetry(
            'gemini-3-flash-preview',
            {
                contents: { parts: [{ text: searchPrompt }] },
                config: {
                    tools: [{ googleSearch: {} }],
                    // Note: Response might not be JSON, we rely on grounding metadata
                }
            }
        );
        
        // Extract URLs directly from Grounding Metadata
        // The API returns sources in `groundingChunks` or `groundingMetadata`
        // Inspect strict structure from the SDK response
        const groundingMetadata = searchResponse.candidates?.[0]?.groundingMetadata;
        const chunks = groundingMetadata?.groundingChunks || [];
        
        // Map chunks to our item format
        const rawCandidates = chunks
            .map((c: any) => c.web)
            .filter((web: any) => web && web.uri && web.title);

        // Deduplicate and basic filter
        const seenUrls = new Set();
        candidates = rawCandidates.filter((item: any) => {
            const url = item.uri;
            if (seenUrls.has(url)) return false;
            // Filter out obviously non-product pages
           if (url.includes('google.com') || url.includes('search?') || url.includes('youtube.com')) return false;
            
            seenUrls.add(url);
            return true;
        }).map((item: any) => ({
            name: item.title,
            purchaseUrl: item.uri,
            snippet: "Identified via Google Search Grounding", // Metadata often lacks snippets, we fetch content in Phase 2
            source: "gemini_grounding"
        }));

        console.log(`[${category}] Grounding found ${candidates.length} unique candidates.`);

    } catch (e) {
        console.error(`[${category}] Phase 1 Grounding Failed`, e);
    }

    // Fallback: If no API keys or backend, candidates is empty. 
    // The previous logic used Gemini Tooling which hallucinated. 
    // We strictly use the API results now for safety.

    if (candidates.length === 0) {
        console.warn(`[${category}] No results found via Grounding.`);
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

                const analysisRes = await generateContentWithRetry(
                    'gemini-3-flash-preview',
                    {
                        contents: { parts: [{ text: enrichmentPrompt }] },
                        config: { responseMimeType: 'application/json' }
                    }
                );

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
    // 1. Identify categories to search
    // Split by comma if multiple items selected
    const categories = preferences.itemType.split(',').map(s => s.trim()).filter(Boolean);
    
    // Default to "Outfit" if empty
    if (categories.length === 0) categories.push("Outfit");

    console.log(`>> Procurement Agent: Searching for ${categories.length} categories: [${categories.join(', ')}]`);

    const allResults: Record<string, any[]> = {};

    // 2. Run Micro-Agent for each category in parallel
    const promises = categories.map(async (category) => {
        try {
            const result = await runCategoryMicroAgent(
                category,
                profile,
                preferences,
                pathInstruction,
                new Date().toISOString(),
                styleAnalysis
            );
            allResults[category] = result.items;
        } catch (e) {
            console.error(`>> Procurement Agent: Failed for category '${category}'`, e);
            allResults[category] = [];
        }
    });

    await Promise.all(promises);

    // 3. Aggregate Results
    const report = {
        foundItems: allResults,
        status: "complete",
        timestamp: new Date().toISOString()
    };

    return JSON.stringify(report);
};
