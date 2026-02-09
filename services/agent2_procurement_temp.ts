
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
): Promise<{ category: string, items: any[], rawResponse: string, searchCriteria: string, initialCandidateCount: number, debugLogs?: string[] }> => {
    
    // --- SETUP: EXTRACT SEARCH CRITERIA ---
    // The Style Analyzer now returns `detailDataset` with `basics` and `details`.
    // We use `basics` for the strict search criteria.
    
    // 1. Sanitize Colors
    let searchColors = preferences.colors; 
    
    if (styleAnalysis?.detectedColors && styleAnalysis.detectedColors.length > 0) {
        const validColors: string[] = [];
        const currentCategory = category.toLowerCase().trim();
        
        styleAnalysis.detectedColors.forEach(c => {
            if (c.includes(':')) {
                const [catPrefix, colorVal] = c.split(':').map(s => s.trim());
                if (catPrefix.toLowerCase().includes(currentCategory) || currentCategory.includes(catPrefix.toLowerCase())) {
                    validColors.push(colorVal);
                }
            } else {
                validColors.push(c);
            }
        });
        
        if (validColors.length > 0) {
            searchColors = validColors.join(' OR ');
        }
    }

    // 2. Extract Basics for Search Criteria
    // If styleAnalysis has detailDataset, try to find basics for this category
    let basicsKeywords = "";
    if (styleAnalysis?.detailDataset) {
        // Map category to the key in detailDataset (e.g. "Dress" -> "dresses")
        // The analyzer output schema uses keys like "tops", "bottoms", "dresses"
        // We need a simple mapper or fuzzy match
        const catKey = Object.keys(styleAnalysis.detailDataset).find(k => k.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(k.toLowerCase()));
        
        if (catKey && styleAnalysis.detailDataset[catKey]) {
            const catData = styleAnalysis.detailDataset[catKey];
            // Collect all values from the "basics" object if it exists, or just flat values
            // The analyzer returns a flat object for the category with keys like "types", "sleeves", etc.
            // We join them with OR logic where appropriate, but for search string we just list them.
            // Wait, user asked for OR logic for features from different photos.
            // The analyzer *already* aggregates them.
            // We just need to join them into the search string.
            
            // Collect all string arrays from the category data
            const features: string[] = [];
            Object.values(catData).forEach((val: any) => {
                if (Array.isArray(val)) {
                    features.push(val.join(' OR ')); // Join alternatives with OR
                }
            });
            basicsKeywords = features.join(' ');
        }
    }

    // 3. Base Search Context
    const constructQuery = (includeStyle: boolean) => {
        let parts = [];
        
        if (searchColors) {
            parts.push(searchColors);
        }

        // Add Basics Keywords (e.g. "blouse OR shirt", "long sleeve")
        if (basicsKeywords) {
            parts.push(basicsKeywords);
        } else {
             // Fallback to category if no basics found
             // But we always need category anyway
        }
        
        if (profile.gender) {
            const genderMap: Record<string, string> = {
                'Female': "Women's",
                'Male': "Men's",
                'F': "Women's",
                'M': "Men's",
                'Non-Binary': "Unisex"
            };
            parts.push(genderMap[profile.gender] || profile.gender);
        }
        
        // Always include category name as a base anchor
        parts.push(category);

        // Add Style Preference (if requested)
        // User said: "{basics} to strict search... instead of 'white, top, women'"
        // But didn't explicitly say to remove stylePreference. 
        // However, usually "Style" is Vibe. "Basics" is Structure.
        // Let's keep Style Preference as it adds flavor ("Boho", "Minimalist").
        if (includeStyle && preferences.stylePreference) {
            parts.push(preferences.stylePreference);
        }
        
        return parts.join(' ');
    };

    const strictContext = constructQuery(true);
    const strictQuery = `${strictContext} buy online -pinterest -lyst -polyvore`.trim();

    // ==========================================
    // PHASE 1: DISCOVERY (via SerpApi)
    // ==========================================
    console.log(`[${category}] Phase 1: Search via SerpApi... Query: ${strictQuery}`);
    
    let candidates: any[] = [];
    let finalQueryUsed = strictQuery;
    
    const cleanSerpUrl = (url: string): string => {
        if (url && url.includes('google.com/url')) {
            try {
                const urlObj = new URL(url);
                const q = urlObj.searchParams.get('q'); // 'q' usually holds the target
                if (q) return q;
                
                const urlParam = urlObj.searchParams.get('url'); // Sometimes it's 'url'
                if (urlParam) return urlParam;
            } catch (e) {
                // If parsing fails, return original
            }
        }
        return url;
    };

    const performSearch = async (q: string) => {
        try {
            const serpApiKey = process.env.SERPAPI_KEY;
            if (!serpApiKey) {
                console.warn("SERPAPI_KEY is missing. Falling back to empty results.");
                return [];
            }

            // Use a cors proxy or backend if needed, but for now we try direct fetch if allowed or via proxy
            // SerpApi usually requires backend, but we can try via our local proxy if we set it up,
            // or just use the direct URL if we accept exposing key (not recommended for prod but ok for prototype)
            // Ideally, we should route this through /api/proxy/serpapi to hide the key.
            // For this implementation, I will assume we can call it directly for now or use a proxy.
            // Let's use the existing /api/proxy to fetch the SerpApi JSON to avoid CORS issues.
            
            const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&engine=google_shopping&api_key=${serpApiKey}&num=15`;
            
            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: serpUrl })
            });

            if (!res.ok) {
                console.error(`SerpApi fetch failed: ${res.status}`);
                return [];
            }

            const data = await res.json();
            // The proxy returns { content: string, ... }. We need to parse the content if it's stringified JSON.
            // Wait, our proxy returns cleaned HTML text usually. 
            // If we use the proxy for JSON, it might try to "clean" it.
            // We might need a dedicated endpoint or just try to parse `data.content`.
            
            let searchResults: any = {};
            try {
                searchResults = JSON.parse(data.content);
            } catch (e) {
                console.error("Failed to parse SerpApi response via proxy", e);
                return [];
            }

            const shoppingResults = searchResults.shopping_results || [];
            
            return shoppingResults.map((item: any) => ({
                name: item.title,
                purchaseUrl: cleanSerpUrl(item.link || item.product_link), // SerpApi provides direct link or google link
                snippet: item.snippet || item.source,
                price: item.price,
                image: item.thumbnail,
                source: "serpapi_shopping"
            }));

        } catch (e) {
            console.error(`[${category}] SerpApi Search Failed for query: "${q}"`, e);
            return [];
        }
    };

    // Attempt 1: Strict Search
    candidates = await performSearch(strictQuery);

    // Attempt 2: Fallback Strategy (Relaxed Search)
    // DISABLED FOR DEBUGGING
    /*
    if (candidates.length === 0) {
        console.warn(`[${category}] Strict search yielded 0 results. Retrying with relaxed criteria...`);
        
        // Relaxed: Remove Style Preference, keep Color + Category + Gender
        // This handles cases where "Goth" + "Black" + "Dress" is too narrow, but "Black Dress" is fine.
        const relaxedContext = constructQuery(false); // includeStyle = false
        const relaxedQuery = `${relaxedContext} buy online -pinterest -lyst -polyvore`.trim();
        
        finalQueryUsed = relaxedQuery;
        candidates = await performSearch(relaxedQuery);
        console.log(`[${category}] Relaxed search found ${candidates.length} candidates.`);
    }
    */

    if (candidates.length === 0) {
        const msg = `[${category}] Phase 1 Search returned 0 organic results for query: "${finalQueryUsed}". Potential causes: Ad dominance, strict keywords, or API filtering.`;
        console.warn(msg);
        return { 
            category, 
            items: [], 
            rawResponse: "[]", 
            searchCriteria: finalQueryUsed, 
            initialCandidateCount: 0,
            debugLogs: [msg] // Ensure this is returned
        };
    }

    // --- HELPER: Process Candidates Batch ---
    const processCandidates = async (candidatesToProcess: any[]): Promise<{ validated: any[], debugLogs: string[] }> => {
        // 1. Basic URL Filter
        const liveCandidates = candidatesToProcess.filter(c => 
            c.purchaseUrl && 
            c.purchaseUrl.startsWith('http') &&
            !c.purchaseUrl.includes('pinterest.') &&
            !c.purchaseUrl.includes('instagram.')
        ).slice(0, 15); // Limit to 15 items max for performance
        
        const validated: any[] = [];
        const debugLogs: string[] = [];
        
        console.log(`[${category}] Processing ${liveCandidates.length} candidates after basic filtering (from ${candidatesToProcess.length} raw).`);
        debugLogs.push(`[${category}] Processing ${liveCandidates.length} candidates after basic filtering (from ${candidatesToProcess.length} raw).`);

        // Process in Parallel Batches
        const BATCH_SIZE = 5;
        const batches = [];
        
        for (let i = 0; i < liveCandidates.length; i += BATCH_SIZE) {
            batches.push(liveCandidates.slice(i, i + BATCH_SIZE));
        }

        const batchPromises = batches.map(async (batch, batchIdx) => {
            // 1. Pre-fetch content for the batch (Parallel is fine for our proxy)
            const batchWithContent = await Promise.all(batch.map(async (candidate) => {
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
                return { ...candidate, pageContent, fetchSource };
            }));

            try {
                // 2. Batch LLM Verification (Single API Call per Batch)
                const enrichmentPrompt = `
                **PHASE 2: BATCH VERIFICATION AUDIT**
                **Category:** ${category}
                **Style:** ${preferences.stylePreference || "General"}
                
                **Task:** Verify the following ${batchWithContent.length} items.
                
                **Items:**
                ${batchWithContent.map((item, idx) => `
                [ITEM ${idx}]
                Name: ${item.name}
                Source: ${item.fetchSource}
                Listed Price: ${item.price || "Unknown"}
                Content Sample: "${(item.pageContent || "").slice(0, 400).replace(/\n/g, ' ')}"
                `).join('\n\n')}
                
                **Rules:**
                - stockStatus: "UNAVAILABLE" if page says "sold out", "out of stock".
                - stockStatus: "LIKELY_AVAILABLE" if "add to cart" or price visible.
                - stockStatus: "UNCERTAIN" if unclear (DEFAULT TO THIS if unsure).
                
                **CRITICAL:**
                - Be LENIENT. If it looks like a product page, assume it is valid unless EXPLICITLY "sold out".
                - For price: Use the price found in the page content if available. If not found in content, use the "Listed Price" from the search results. Only set price to "Check Site" if no price is available at all.
                - Do NOT reject items just because you can't see the price in the snippet.

                **Output Schema (Strict JSON Array):**
                [
                  {
                    "index": 0, // Must match [ITEM 0]
                    "isValidProductPage": boolean,
                    "detectedCategory": string,
                    "stockStatus": "UNAVAILABLE" | "LIKELY_AVAILABLE" | "UNCERTAIN",
                    "price": string,
                    "matchScore": number (0-100),
                    "reason": string,
                    "debugRawStatus": string // NEW: Return raw status for debugging
                  }
                ]
                `;

                const analysisRes = await generateContentWithRetry(
                    'gemini-3-flash-preview',
                    {
                        contents: { parts: [{ text: enrichmentPrompt }] },
                        config: { responseMimeType: 'application/json' }
                    }
                );

                const results = JSON.parse(analysisRes.text || "[]");
                
                const batchValidated: any[] = [];
                const batchLogs: string[] = [];

                if (Array.isArray(results)) {
                    results.forEach((analysis: any) => {
                        const candidate = batchWithContent[analysis.index];
                        
                        // DEBUG LOGGING
                        const logMsg = `[${category}] Item ${analysis.index + (batchIdx * BATCH_SIZE)} Verification: Status=${analysis.stockStatus}, Reason="${analysis.reason}", RawStatus="${analysis.debugRawStatus}"`;
                        console.log(logMsg);
                        batchLogs.push(logMsg);

                        if (candidate && analysis.isValidProductPage && analysis.stockStatus !== 'UNAVAILABLE') {
                             batchValidated.push({
                                ...candidate,
                                brand: candidate.name.split(' ')[0], 
                                price: analysis.price || candidate.price || "Check Site",
                                description: analysis.reason || candidate.snippet,
                                stockStatus: analysis.stockStatus === 'LIKELY_AVAILABLE' ? 'IN STOCK' : 'RISK',
                                matchScore: analysis.matchScore || 50,
                                category: analysis.detectedCategory || category,
                                id: `${category}_${validated.length + batchValidated.length + 1}`,
                                validationSource: candidate.fetchSource,
                                debugReason: analysis.reason // Store reason for potential debugging
                            });
                        } else if (candidate) {
                            const rejectMsg = `[${category}] Rejected Item ${analysis.index + (batchIdx * BATCH_SIZE)}: ${candidate.name} - ${analysis.reason}`;
                            console.warn(rejectMsg);
                            batchLogs.push(rejectMsg);
                        }
                    });
                }
                return { batchValidated, batchLogs };
            } catch (err) {
                console.error(`[${category}] Batch Verification Failed`, err);
                return { batchValidated: [], batchLogs: [`[${category}] Batch Verification Failed: ${err}`] };
            }
        });

        // Wait for all batches to complete
        const results = await Promise.all(batchPromises);
        
        // Flatten results
        results.forEach(res => {
            validated.push(...res.batchValidated);
            debugLogs.push(...res.batchLogs);
        });

        return { validated, debugLogs };
    };

    // ==========================================
    // PHASE 2: ENRICHMENT & VERIFICATION (Backend Proxy)
    // ==========================================
    console.log(`[${category}] Phase 2: Enrichment for candidates...`);

    // 1. Process Strict Candidates
    let { validated: finalItems, debugLogs } = await processCandidates(candidates);

    // 2. Fallback Logic: If Strict Search yielded 0 valid items, try Relaxed Search
    // DISABLED FOR DEBUGGING
    /*
    if (finalItems.length === 0) {
        console.warn(`[${category}] Strict search verified 0 items. Triggering Relaxed Search fallback...`);
        
        // Relaxed: Remove Style Preference, keep Color + Category + Gender
        const relaxedContext = constructQuery(false); // includeStyle = false
        const relaxedQuery = `${relaxedContext} buy online -pinterest -lyst -polyvore`.trim();
        
        finalQueryUsed = relaxedQuery;
        const relaxedCandidates = await performSearch(relaxedQuery);
        console.log(`[${category}] Relaxed search found ${relaxedCandidates.length} candidates.`);
        
        if (relaxedCandidates.length > 0) {
            const relaxedResult = await processCandidates(relaxedCandidates);
            finalItems = relaxedResult.validated;
            debugLogs.push(...relaxedResult.debugLogs);
            // Update initialCandidateCount to reflect the successful search
            candidates = relaxedCandidates;
        }
    }
    */

    // Sort by Match Score and limit to 7
    finalItems = finalItems
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 7);

    return { 
        category, 
        items: finalItems, 
        rawResponse: JSON.stringify(finalItems),
        searchCriteria: finalQueryUsed,
        initialCandidateCount: candidates.length,
        debugLogs // Return logs to orchestrator
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
