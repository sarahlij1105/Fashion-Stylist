
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StylistResponse, FashionPurpose, StyleAnalysisResult } from "../types";

const API_KEY = process.env.API_KEY || '';
// Safety check for API_KEY
let ai: GoogleGenAI;
try {
    if (API_KEY) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    } else {
        console.warn("GoogleGenAI initialized without API_KEY. Some features will fail.");
        // Mock the client to prevent immediate crash, but calls will fail
        ai = { models: { generateContent: async () => { throw new Error("API_KEY missing"); } } } as any;
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenAI client:", e);
    ai = { models: { generateContent: async () => { throw new Error("GoogleGenAI initialization failed"); } } } as any;
}


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

    const BLACKLIST_DOMAINS = ['pinterest', 'lyst', 'shopstyle', 'polyvore', 'temu', 'shein'];
    
    const parsePrice = (p: string) => parseFloat((p || '').replace(/[^0-9.]/g, '')) || 0;
    const priceParts = preferences.priceRange.replace(/\$/g, '').split('-');
    const maxBudget = parseFloat(priceParts[1] || priceParts[0]) || 2000;
    const budgetCap = maxBudget * 1.3; // 30% buffer

    Object.entries(itemsMap).forEach(([category, items]) => {
        if (!Array.isArray(items)) return;

        validatedItems[category] = items.filter(item => {
            const url = (item.purchaseUrl || item.sourceUrl || '').toLowerCase();
            const itemName = item.name || 'Unknown';

            // A. Basic URL check (no CORS-dependent validation!)
            if (!url || url.length < 15) {
                discardedReasons.push(`${itemName}: No URL`);
                discardedCount++;
                return false;
            }

            // B. Blacklist only
            if (BLACKLIST_DOMAINS.some(d => url.includes(d))) {
                discardedReasons.push(`${itemName}: Blacklisted domain`);
                discardedCount++;
                return false;
            }

            // C. Price check (generous)
            const price = parsePrice(item.price);
            if (price > budgetCap && price > 0) {
                discardedReasons.push(`${itemName}: Over budget ($${price})`);
                discardedCount++;
                return false;
            }

            // D. DO NOT REJECT 'RISK' - too aggressive!
            // Only reject explicit 'UNAVAILABLE'
            if (item.stockStatus === 'UNAVAILABLE') {
                discardedReasons.push(`${itemName}: Explicitly unavailable`);
                discardedCount++;
                return false;
            }

            // Add fallback
            item.fallbackSearchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${item.brand || ''} ${item.name}`.trim())}`;
            item.validationNotes = 'Passed basic validation';
            if (!item.purchaseUrl) item.purchaseUrl = url;

            return true;
        });
    });

    return { status: "success", validatedItems, discardedCount, discardedReasons };
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

    if (styleAnalysis?.searchEnhancement) {
        scoringContext = `
        **Scoring Method:** Semantic Style Matching (High Precision).
        **Visual Anchors:** ${styleAnalysis.searchEnhancement.unifiedKeywords?.join(', ')}
        **Tech Specs:** Compare against detailed analysis: ${JSON.stringify(styleAnalysis.searchEnhancement.byCategory || {})}
        `;
    }

    const prompt = `
    **AGENT: Stylist Scorer**
    **Goal:** Score validated items (0-100) based on style fit.

    **Context:**
    ${scoringContext}

    **Items to Score:**
    ${JSON.stringify(validatedData.validatedItems)}

    **Your Task:**
    For EACH item, calculate a "visualMatchScore" (0-100).
    - **90-100:** Perfect match to Visual Anchors/Keywords.
    - **70-89:** Good match.
    - **< 60:** Poor match (mismatched style, wrong color).

    **Output Schema (Strict JSON):**
    Return the SAME structure as input, but add "visualMatchScore" and "scoreReason" to each item.
    \`\`\`json
    {
        "scoredItems": {
            "category_name": [
                 { ...item_fields, "visualMatchScore": 85, "scoreReason": "Matches 'Boho' vibe and 'Cream' color request." }
            ]
        }
    }
    \`\`\`
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' }
    });

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

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Use PRO for complex reasoning
        contents: { 
            parts: [
                ...imageParts, // Pass user photo for context
                { text: prompt }
            ] 
        },
        config: { responseMimeType: 'application/json' }
    });

    try {
        return JSON.parse(response.text || "{}");
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
