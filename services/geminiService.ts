
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, Preferences, RecommendationItem, StylistResponse, OutfitComponent, FashionPurpose, StyleAnalysisResult } from "../types";
import { runCategoryMicroAgent } from "./agent2_procurement_temp";
import { runVerificationStep, runStylistScoringStep, runOutfitComposerStep } from "./agent3_curator_temp";
import { runDirectorFinalVerdict } from "./postorchestrator_temp";
import { runStyleExampleAnalyzer } from "./agent_style_analyzer";
import { cacheManager } from './cacheService';

const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
  console.error("API_KEY is missing from environment variables.");
}

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

/**
 * Wrapper for Gemini API calls with exponential backoff retry.
 * Handles 503 (Overloaded) and 429 (Rate Limit) errors.
 */
export const generateContentWithRetry = async (
    model: string,
    params: any,
    retries = 3,
    delay = 1000
): Promise<any> => {
    try {
        return await ai.models.generateContent({
            model,
            ...params
        });
    } catch (error: any) {
        const isTransient = error.status === 503 || error.code === 503 || 
                           error.status === 429 || error.code === 429 ||
                           (error.message && error.message.includes("overloaded"));
        
        if (isTransient && retries > 0) {
            console.warn(`[Gemini] ${model} overloaded/rate-limited. Retrying in ${delay}ms... (${retries} left)`);
            await new Promise(res => setTimeout(res, delay));
            return generateContentWithRetry(model, params, retries - 1, delay * 2);
        }
        throw error;
    }
};

// Helper to extract mimeType and base64 data from a Data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
};

// --- AGENT 1: The Vision Analyst ---
export const analyzeUserPhoto = async (dataUrl: string, purpose: FashionPurpose): Promise<Partial<UserProfile>> => {
  try {
    const { mimeType, data } = parseDataUrl(dataUrl);

    // Path A = Matching (Keep items), Path B = New Outfit (Ignore items)
    const isPathA = purpose === FashionPurpose.MATCHING;

    const keptItemsInstruction = isPathA 
      ? `2. **Identify Kept Items:**
       - List specific visible clothing items (e.g., "Light Blue Denim Jeans", "White Cotton T-Shirt", "Black Leather Jacket")
       - Include color, material (if visible), and garment type
       **NEW: Mark items as "definite" or "uncertain" based on visibility**`
      : `2. **Identify Kept Items:**
       - The user selected "Mannequin Mode" (Path B). 
       - **DO NOT** identify or list any clothing items currently worn.
       - Return an empty array \`[]\` for "keptItems".`;

    const prompt = `
    Analyze this image for the "Elite Forensic Stylist" app. 

    **Your Tasks:**
    1. **Estimate User Attributes:**
       - Gender (M/F/Non-binary/Unknown)
       - Size: Use visual cues (body proportions, existing garment fit). Output standard sizes: XS, S, M, L, XL, XXL
       - Current Style: Classify as one of: Casual, Formal, Streetwear, Boho, Minimalist, Sporty, Vintage, Other
       **NEW: Provide confidence score (0-100%) for each estimate**

    ${keptItemsInstruction}

    **Output Schema (STRICT JSON):**
    \`\`\`json
    {
      "status": "success" | "error" | "low_confidence",
      "gender": {
        "value": string,
        "confidence": number
      },
      "estimatedSize": {
        "value": string,
        "confidence": number,
        "reasoning": string
      },
      "currentStyle": {
        "value": string,
        "confidence": number,
        "keywords": string[]
      },
      "keptItems": [
        {
          "item": string,
          "category": "top" | "bottom" | "outerwear" | "footwear" | "accessory",
          "visibility": "definite" | "uncertain"
        }
      ],
      "errorMessage": string | null,
      "imageQuality": "high" | "medium" | "low" | "invalid"
    }
    \`\`\`

    **Error Handling:**
    - If image is blurry/dark: Set \`status: "low_confidence"\`, provide best estimates, note in \`errorMessage\`
    - If no person visible: Set \`status: "error"\`, return empty values, set \`errorMessage: "No person detected in image"\`
    - If invalid file: Set \`status: "error"\`, \`errorMessage: "Invalid image format"\`
    `;

    const response = await generateContentWithRetry(
      'gemini-3-flash-preview',
      {
        contents: {
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      }
    );

    const text = response.text || "{}";
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        console.error("Agent 1 JSON Parse Error", e);
        return {};
    }
    
    if (parsed.status === 'error') {
        console.warn("Agent 1 Analysis Error:", parsed.errorMessage);
        return {
             gender: 'Female', 
             estimatedSize: 'M',
             currentStyle: '',
             keptItems: []
        };
    }

    return {
        gender: parsed.gender?.value || 'Female',
        estimatedSize: parsed.estimatedSize?.value || 'M',
        currentStyle: parsed.currentStyle?.value || '',
        keptItems: parsed.keptItems ? parsed.keptItems.map((k: any) => k.item) : []
    };

  } catch (error) {
    console.error("Error analyzing photo:", error);
    throw error;
  }
};

// --- ORCHESTRATOR ---
export const searchAndRecommend = async (
  profile: UserProfile,
  preferences: Preferences,
  additionalContext: string = ""
): Promise<StylistResponse> => {
  const startTimeTotal = performance.now();
  const timings: string[] = [];
  const logMessages: string[] = [];

  try {
    const imageParts = [];
    if (profile.userImageBase64) {
      const { mimeType, data } = parseDataUrl(profile.userImageBase64);
      imageParts.push({ inlineData: { mimeType, data } });
    }

    // --- CACHE MANAGER AGENT ---
    console.log(">> Agent 0: Cache Manager checking...");
    const startCache = performance.now();
    const photoHash = cacheManager.generateFastHash(profile.userImageBase64);
    const exactKey = await cacheManager.generateCacheKey('exact', { preferences, profile, photoHash });
    const cachedExact = await cacheManager.checkCache(exactKey);
    const endCache = performance.now();
    timings.push(`Agent 0 (Cache): ${(endCache - startCache).toFixed(0)}ms`);

    if (cachedExact) {
        console.log(">> Cache Hit. Skipping pipeline.");
        cachedExact.reflectionNotes = `[⚡ CACHE HIT]\n\n` + cachedExact.reflectionNotes;
        return cachedExact;
    }

    // --- PIPELINE SETUP ---
    const isPathA = preferences.purpose === FashionPurpose.MATCHING;
    const pathInstruction = isPathA 
        ? `**Path A (Inventory Mode):** The user is currently wearing: [${profile.keptItems?.join(', ') || 'Unknown'}]. Search for items: [${preferences.itemType}] that complement these.`
        : `**Path B (Mannequin Mode):** Ignore current clothes. Build a fresh look based on: ${preferences.itemType}.`;
    
    const categories = preferences.itemType.split(',').map(t => t.trim()).filter(t => t);
    const today = new Date().toLocaleDateString();

    console.log("--- STARTING PARALLEL PIPELINES ---");

    // --- AGENT 1.5: Style Analyzer ---
    let styleAnalysis: StyleAnalysisResult | undefined;
    if (profile.idealStyleImages?.length > 0) {
        const startStyle = performance.now();
        styleAnalysis = await runStyleExampleAnalyzer(profile, preferences);
        timings.push(`Agent 1.5 (Style): ${(performance.now() - startStyle).toFixed(0)}ms`);
    }

    // --- PARALLEL PIPELINE ORCHESTRATION ---
    // Instead of waiting for all procurement to finish, we verify/score per category immediately
    const startPipeline = performance.now();
    
    // We Map over categories and launch a self-contained "Micro-Pipeline" for each
    const pipelinePromises = categories.map(async (category) => {
        const catStart = performance.now();
        
        // 1. Procurement (Micro-Agent)
        // Returns { items: [], ... }
        const procurementResult = await runCategoryMicroAgent(category, profile, preferences, pathInstruction, today, styleAnalysis);
        
        // Log detailed criteria
        const criteriaLog = `[${category}] Criteria: "${procurementResult.searchCriteria}" | Found: ${procurementResult.initialCandidateCount} | Kept: ${procurementResult.items.length}`;
        console.log(criteriaLog);
        logMessages.push(criteriaLog);
        
        // 2. Verification (Immediate Handoff)
        // Pass items directly to verifier. Skipping holistic Director Pre-Audit for speed.
        const verificationResult = await runVerificationStep(
            { validatedItems: { [category]: procurementResult.items } }, // Wrap in expected schema
            "None", // No Pre-Audit guidance for this fast path
            preferences,
            profile
        );

        // 3. Scoring (Immediate Handoff)
        const scoringResult = await runStylistScoringStep(verificationResult, preferences, styleAnalysis);
        
        const catEnd = performance.now();
        timings.push(`Pipeline (${category}): ${(catEnd - catStart).toFixed(0)}ms`);
        
        return { 
            category, 
            scoredItems: scoringResult.scoredItems?.[category] || [] 
        };
    });

    // Wait for all pipelines to complete and fill the pool
    const pipelineResults = await Promise.all(pipelinePromises);
    
    // Aggregate for Composer
    const aggregatedScoredItems: any = {};
    let totalItemsFound = 0;
    
    pipelineResults.forEach(res => {
        if (res.scoredItems.length > 0) {
            aggregatedScoredItems[res.category] = res.scoredItems;
            totalItemsFound += res.scoredItems.length;
        }
    });

    logMessages.push(`Pipelines Complete. Found ${totalItemsFound} valid items across ${categories.length} categories.`);

    // --- OUTFIT COMPOSER (Final Assembly) ---
    const startComposer = performance.now();
    const finalResponse = await runOutfitComposerStep(
        { scoredItems: aggregatedScoredItems },
        preferences,
        profile,
        imageParts
    );
    timings.push(`Composer: ${(performance.now() - startComposer).toFixed(0)}ms`);

    // --- DIRECTOR FINAL VERDICT ---
    const startVerdict = performance.now();
    const finalVerdict = await runDirectorFinalVerdict(finalResponse, preferences);
    timings.push(`Director Verdict: ${(performance.now() - startVerdict).toFixed(0)}ms`);

    // Final Polish
    const totalTime = (performance.now() - startTimeTotal).toFixed(0);
    const telemetry = `\n--- PIPELINE TELEMETRY ---\n${timings.join('\n')}\nTotal Latency: ${totalTime}ms\n\n`;
    
    // Add the logMessages to the top so user can see what was searched
    finalResponse.reflectionNotes = logMessages.join('\n') + "\n\n" + telemetry + finalResponse.reflectionNotes + finalVerdict;

    // Cache Result
    await cacheManager.setCache(exactKey, finalResponse, 6 * 3600);

    return finalResponse;

  } catch (error) {
    console.error("Error in Orchestrator:", error);
    throw error;
  }
};
