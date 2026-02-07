
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StylistResponse, FashionPurpose, StyleAnalysisResult } from "../types";
import { generateContentWithRetry } from "./geminiService";

// REMOVED LOCAL AI INITIALIZATION - using geminiService's instance via retry wrapper


// --- STEP 1: VERIFICATION (HEURISTIC TYPESCRIPT ENGINE) ---
// Replaces the previous LLM Agent to reduce latency from ~20s to ~5ms
export const runVerificationStep = async (
    procurementJson: any, // Accepts Object or String
    directorGuidance: string,
    preferences: Preferences,
    profile: UserProfile
): Promise<any> => {
    // Parse Input
    let itemsMap: Record<string, any[]> = {};
    try {
        const raw = typeof procurementJson === 'string' ? JSON.parse(procurementJson) : procurementJson;
        itemsMap = raw.foundItems || raw.validatedItems || raw;
    } catch (e) {
        return { validatedItems: {}, discardedCount: 0, discardedReasons: ["JSON Parse Error"] };
    }

    const validatedItems: Record<string, any[]> = {};
    const discardedReasons: string[] = [];
    let discardedCount = 0;
    const debugLogs: string[] = [];

    const BLACKLIST_DOMAINS = ['pinterest', 'polyvore', 'temu', 'shein'];
    
    const parsePrice = (p: string) => parseFloat((p || '').replace(/[^0-9.]/g, '')) || 0;
    const priceParts = preferences.priceRange.replace(/\$/g, '').split('-');
    const maxBudget = parseFloat(priceParts[1] || priceParts[0]) || 2000;
    const budgetCap = maxBudget * 1.3; // 30% buffer

    Object.entries(itemsMap).forEach(([category, items]) => {
        debugLogs.push(`[VerificationStep] Processing ${Array.isArray(items) ? items.length : 0} items for category '${category}'`);
        
        if (!Array.isArray(items)) return;

        validatedItems[category] = items.filter((item, idx) => {
            const url = (item.purchaseUrl || item.sourceUrl || '').toLowerCase();
            const itemName = item.name || 'Unknown';

            // A. Basic URL check (no CORS-dependent validation!)
            if (!url || url.length < 15) {
                const reason = `${itemName}: No URL or too short`;
                discardedReasons.push(reason);
                debugLogs.push(`[VerificationStep] Discarded item ${idx}: ${reason}`);
                discardedCount++;
                return false;
            }

            // B. Blacklist only
            if (BLACKLIST_DOMAINS.some(d => url.includes(d))) {
                const reason = `${itemName}: Blacklisted domain`;
                discardedReasons.push(reason);
                debugLogs.push(`[VerificationStep] Discarded item ${idx}: ${reason}`);
                discardedCount++;
                return false;
            }

            // C. Price check (generous)
            const price = parsePrice(item.price);
            if (price > budgetCap && price > 0) {
                const reason = `${itemName}: Over budget ($${price} > $${budgetCap})`;
                discardedReasons.push(reason);
                debugLogs.push(`[VerificationStep] Discarded item ${idx}: ${reason}`);
                discardedCount++;
                return false;
            }

            // D. DO NOT REJECT 'RISK' - too aggressive!
            // Only reject explicit 'UNAVAILABLE'
            if (item.stockStatus === 'UNAVAILABLE') {
                const reason = `${itemName}: Explicitly unavailable`;
                discardedReasons.push(reason);
                debugLogs.push(`[VerificationStep] Discarded item ${idx}: ${reason}`);
                discardedCount++;
                return false;
            }

            // Add fallback
            item.fallbackSearchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${item.brand || ''} ${item.name}`.trim())}`;
            item.validationNotes = 'Passed basic validation';
            if (!item.purchaseUrl) item.purchaseUrl = url;

            return true;
        });
        
        debugLogs.push(`[VerificationStep] Category '${category}' finished. Kept ${validatedItems[category].length} items.`);
    });

    return { status: "success", validatedItems, discardedCount, discardedReasons, debugLogs };
};

// --- STEP 2: STYLIST SCORER AGENT ---
export const runStylistScoringStep = async (
    validatedData: any,
    preferences: Preferences,
    styleAnalysis?: StyleAnalysisResult
): Promise<any> => {
    // If no validated items, skip
    if (!validatedData.validatedItems || Object.keys(validatedData.validatedItems).length === 0) {
        return validatedData;
    }

    let scoringContext = `
    **Scoring Method:** Text-Based Style Matching.
    **Keywords:** ${preferences.stylePreference}, ${preferences.colors}, ${preferences.occasion}.
    `;

    // NEW: Holistic Vibe Dataset Scoring
    if (styleAnalysis?.suggestedStyles || styleAnalysis?.detailDataset) {
        
        // Prepare the Vibe Dataset
        const vibes = styleAnalysis.suggestedStyles?.map((s: any) => `${s.name} (${s.description})`).join(' OR ') || "Custom Style";
        
        // Prepare the Detail Dataset (Structural features)
        const details = styleAnalysis.detailDataset ? JSON.stringify(styleAnalysis.detailDataset) : "No specific details.";

        scoringContext = `
        **Scoring Method:** Holistic Vibe & Detail Matching (OR Logic).
        
        **1. THE VIBE DATASET (General Aesthetic):**
        The item should match ONE OF these styles:
        ${vibes}

        **2. THE DETAIL DATASET (Specific Features):**
        The item should possess features found in this dataset for its category:
        ${details}
        
        **SCORING RULES:**
        1. **OR Logic is Key:** The user provided multiple examples. An item matches if it fits *ANY* of the suggested styles or *ANY* of the structural details.
        2. **Do not penalize** an item for missing a feature if it matches a *different* valid feature from the dataset.
        3. **Color Check:** If the item's color is explicitly listed in detected colors (${styleAnalysis.detectedColors?.join(', ')}), give a significant score boost.
        `;
    } else if (styleAnalysis?.searchEnhancement) {
        // Fallback to old logic if new data structure is missing
        scoringContext = `
        **Scoring Method:** Feature Bracket Scoring (OR Logic).
        
        **THE BRACKET (Acceptable Features):**
        The user provided example photos. We extracted the following "Feature Bracket":
        ${JSON.stringify(styleAnalysis.searchEnhancement.byCategory || {}, null, 2)}
        
        **SCORING RULES:**
        1. **Accumulation:** The more features an item has from the Bracket, the HIGHER the score.
        2. **OR Logic for Conflicts:** The Bracket may contain conflicting values (e.g. Sleeves: ["Long", "Short"]). 
           - This means BOTH are acceptable. 
           - If an item matches *either* "Long" OR "Short", it gets points.
           - Do not penalize an item for having "Long" just because another example had "Short".
        3. **Visual Anchors:** Boost score if item description matches: ${styleAnalysis.searchEnhancement.unifiedKeywords?.join(', ')}
        `;
    }

    const prompt = `
    **AGENT: Stylist Scorer**
    **Goal:** Score validated items (0-100) based on style fit against the Feature Bracket.

    **Context:**
    ${scoringContext}

    **Items to Score:**
    ${JSON.stringify(validatedData.validatedItems)}

    **Your Task:**
    For EACH item, calculate a "visualMatchScore" (0-100).
    - **90-100:** Matches multiple features in the Bracket and fits the Vibe.
    - **70-89:** Good match (matches at least one major feature like Silhouette or Color).
    - **< 60:** Poor match (mismatched style, wrong color, no Bracket features found).

    **Output Schema (Strict JSON):**
    Return the SAME structure as input, but add "visualMatchScore" and "scoreReason" to each item.
    \`\`\`json
    {
        "scoredItems": {
            "category_name": [
                 { ...item_fields, "visualMatchScore": 85, "scoreReason": "High Score: Matches 'Boho' vibe and 'Long Sleeve' feature from bracket." }
            ]
        }
    }
    \`\`\`
    `;

    const response = await generateContentWithRetry(
        'gemini-3-flash-preview',
        {
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        }
    );

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Scorer Agent Failed:", e);
        // Fallback: Return original items with default scores
        return { scoredItems: validatedData.validatedItems };
    }
};

    // --- STEP 3: OUTFIT COMPOSER AGENT ---
    export const runOutfitComposerStep = async (
        scoredData: any,
        preferences: Preferences,
        profile: UserProfile,
        imageParts: any[]
    ): Promise<StylistResponse> => {
        const categories = Object.keys(scoredData.scoredItems || {});
        
        // DEBUG: Log input URLs
        console.log(">> Composer Input Items:", JSON.stringify(scoredData.scoredItems, null, 2));

        // Check if we have enough items
    let totalItems = 0;
    categories.forEach(c => totalItems += scoredData.scoredItems[c].length);
    
    if (totalItems < 2) {
        return {
            reflectionNotes: "Verification & Scoring filtered out too many items. Please broaden criteria.",
            recommendations: []
        };
    }

    const prompt = `
    **AGENT: Outfit Composer**
    **Goal:** Create 3 cohesive "Looks" (Outfits) from the scored inventory.

    **Inventory (Scored):**
    ${JSON.stringify(scoredData.scoredItems)}

    **Constraints:**
    - Create exactly 3 distinct Looks (if enough items).
    - Each Look MUST contain one item from each available category (e.g. 1 Top + 1 Bottom + 1 Shoe).
    - **Budget:** Total price of the Look must be within ${preferences.priceRange}.
    - **Cohesion:** Items in a Look must work together visually (color/style).
    - **Priority:** Prefer items with higher 'visualMatchScore'.
    - **CRITICAL:** DO NOT modify URLs. Copy them EXACTLY as provided in the input. Do NOT invent placeholders like "example.com". If a URL is missing, leave it empty.

    **Output Schema (STRICT JSON):**
    Match the 'StylistResponse' interface.
    \`\`\`json
    {
      "recommendations": [
        {
          "name": "Look 1: [Creative Name]",
          "description": "Why this works...",
          "totalPrice": "$XX",
          "components": [
             // Copy full item object here
             { "category": "...", "name": "...", "price": "...", "purchaseUrl": "...", "validationNote": "...", "visualMatchScore": 90, "fallbackSearchUrl": "..." }
          ]
        }
      ],
      "reflectionNotes": "Summary of how outfits were composed..."
    }
    \`\`\`
    `;

    const response = await generateContentWithRetry(
        'gemini-3-pro-preview', // Use PRO for complex reasoning
        { 
            contents: { 
                parts: [
                    ...imageParts, // Pass user photo for context
                    { text: prompt }
                ] 
            },
            config: { responseMimeType: 'application/json' }
        }
    );

    try {
        const result = JSON.parse(response.text || "{}");
        
        // --- POST-PROCESS: URL MERGE FIX ---
        // The LLM often breaks URLs. We must force the original valid URLs back into the result.
        if (result.recommendations && Array.isArray(result.recommendations)) {
            // 1. Build a Lookup Map from the original Scored Items
            const itemLookup = new Map<string, string>(); // Name -> URL
            
            // Log for debugging
            console.log(">> Starting URL Merge...");

            Object.values(scoredData.scoredItems).forEach((items: any) => {
                items.forEach((item: any) => {
                    if (item.name && item.purchaseUrl) {
                        itemLookup.set(item.name.toLowerCase().trim(), item.purchaseUrl);
                    }
                });
            });

            // 2. Overwrite URLs in Recommendations
            result.recommendations.forEach((outfit: any) => {
                if (outfit.components && Array.isArray(outfit.components)) {
                    outfit.components.forEach((comp: any) => {
                        const key = comp.name?.toLowerCase().trim();
                        // Try exact match
                        if (itemLookup.has(key)) {
                            comp.purchaseUrl = itemLookup.get(key);
                        } else {
                            // Try fuzzy match (if LLM slightly altered the name)
                            for (const [origName, origUrl] of itemLookup.entries()) {
                                if (origName.includes(key) || key.includes(origName)) {
                                    comp.purchaseUrl = origUrl;
                                    break;
                                }
                            }
                        }
                    });
                }
            });
            console.log(">> URL Merge Complete. Final Result:", JSON.stringify(result.recommendations, null, 2));
        }
        
        return result;

    } catch (e) {
        console.error("Composer Agent Failed:", e);
        return { reflectionNotes: "Composer Error", recommendations: [] };
    }
};

// --- LEGACY ORCHESTRATOR FOR BACKWARD COMPAT ---
export const runCuratorAgent = async (
    profile: UserProfile, 
    preferences: Preferences, 
    procurementReport: string,
    directorGuidance: string,
    imageParts: any[],
    styleAnalysis?: StyleAnalysisResult
): Promise<StylistResponse> => {
    const verificationResult = await runVerificationStep(procurementReport, directorGuidance, preferences, profile);
    const scoringResult = await runStylistScoringStep(verificationResult, preferences, styleAnalysis);
    return await runOutfitComposerStep(scoringResult, preferences, profile, imageParts);
};
