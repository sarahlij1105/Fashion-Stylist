
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

// --- PROFILE ANALYZER (Nano Banana Pro / Gemini 3 Pro) ---
export const analyzeProfilePhoto = async (dataUrl: string): Promise<Partial<UserProfile>> => {
    try {
        const { mimeType, data } = parseDataUrl(dataUrl);

        const prompt = `
        You are a physical profile analyzer for a fashion app.
        Analyze the person in this photo and return a detailed physical profile.

        **Your Tasks:**
        1. **Gender:** Detect the person's gender (Female / Male / Non-binary)
        2. **Age Range:** Estimate an age range (e.g., "18-24", "25-30", "31-40", "41-50", "50+")
        3. **Height Category:** Based on proportions, classify as: "Petite" (under 5'3" / 160cm), "Average" (5'3"-5'7" / 160-170cm), "Tall" (over 5'7" / 170cm)
        4. **Estimated Height:** Give a specific estimate (e.g., "165 cm" or "5'5\"")
        5. **Clothing Size:** Estimate standard clothing size: XS, S, M, L, XL, XXL
        6. **Shoe Size:** Estimate shoe size based on height/proportions (e.g., "US 7", "US 9")

        **Output Schema (Strict JSON):**
        \`\`\`json
        {
          "gender": "Female" | "Male" | "Non-binary",
          "age": "25-30",
          "heightCategory": "Average",
          "height": "165 cm",
          "estimatedSize": "M",
          "shoeSize": "US 7",
          "confidence": "high" | "medium" | "low"
        }
        \`\`\`

        Be practical and give your best estimate. If the image quality is poor, still give estimates with "low" confidence.
        `;

        const response = await generateContentWithRetry(
            'gemini-3-pro-preview',
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
            console.error("Profile Analyzer JSON Parse Error", e);
            return {};
        }

        return {
            gender: parsed.gender || 'Female',
            age: parsed.age || '',
            heightCategory: parsed.heightCategory || '',
            height: parsed.height || '',
            estimatedSize: parsed.estimatedSize || 'M',
            shoeSize: parsed.shoeSize || '',
        };
    } catch (error) {
        console.error("Profile Analyzer Error:", error);
        return {};
    }
};

// --- AGENT 1: The Vision Analyst ---
export const analyzeUserPhoto = async (dataUrl: string, purpose: FashionPurpose, height?: string): Promise<Partial<UserProfile>> => {
  try {
    // --- CACHE CHECK ---
    // Generate signature from last 50 chars of image data (to handle large strings safely)
    const imgSignature = dataUrl.slice(-50);
    const cacheKey = `vision_analyst_${await cacheManager.generateFastHash(imgSignature + purpose + (height || ''))}`;
    
    const cachedResult = await cacheManager.checkCache(cacheKey);
    if (cachedResult) {
        console.log(">> Agent 1 (Vision Analyst): Cache Hit");
        return cachedResult;
    }

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
    ${height ? `**User Height:** ${height}` : ''}

    **Your Tasks:**
    1. **Estimate User Attributes:**
       - Gender (Female/Male/Non-binary/Unknown)
       - Size: Use visual cues (body proportions, existing garment fit) ${height ? 'AND the provided height' : ''} to estimate clothing size. Output standard sizes: XS, S, M, L, XL, XXL
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

    const result = {
        gender: parsed.gender?.value || 'Female',
        estimatedSize: parsed.estimatedSize?.value || 'M',
        currentStyle: parsed.currentStyle?.value || '',
        keptItems: parsed.keptItems ? parsed.keptItems.map((k: any) => k.item) : []
    };

    // Cache the result
    await cacheManager.setCache(cacheKey, result, 7200); // 2 hour TTL

    return result;

  } catch (error) {
    console.error("Error analyzing photo:", error);
    throw error;
  }
};

// --- AGENT 2B: STYLIST (Card 2 Recommendation) ---
export const generateStylistRecommendations = async (
    profile: UserProfile,
    preferences: Preferences,
    styleAnalysis: StyleAnalysisResult
): Promise<{ userMessage: string; searchQueries: Record<string, string> }> => {
    try {
        const keptItems = profile.keptItems?.join(', ') || "No specific items identified";
        const targetItems = preferences.itemType;
        const styleVibe = styleAnalysis.suggestedStyles?.map(s => s.name).join(' OR ') || "General Style";
        const detectedColors = styleAnalysis.detectedColors?.join(', ') || "No specific colors";
        
        // Extract structural details for kept items if available
        const keptItemDetails = styleAnalysis.detailDataset ? JSON.stringify(styleAnalysis.detailDataset) : "No structural details";

        const prompt = `
        **AGENT: Personal Stylist**
        **Goal:** Recommend specific items to complete the user's outfit and generate precise search queries for them.

        **User Context:**
        - **Current Outfit (Kept Items):** ${keptItems}
        - **Kept Item Details:** ${keptItemDetails}
        - **Target Items (To Buy):** ${targetItems}
        - **User Vibe:** ${styleVibe}
        - **Palette:** ${detectedColors}
        - **User Stats:** Gender: ${profile.gender}, Size: ${profile.estimatedSize}

        **Instructions:**
        1. Analyze the "Kept Items" and their style/color.
        2. Suggest **3 distinct options** for EACH target item category that would perfectly match the kept items.
        3. For each option, specify: Color, Type, Features, Why.
        4. **CRITICAL:** Generate a "Search Query" for EACH target category. This query will be used by a procurement bot to find the items. It should be a string of keywords including color, material, item name, and key details (e.g. "White Silk Camisole V-neck").

        **Output Format (JSON):**
        \`\`\`json
        {
          "userMessage": "Markdown string containing the friendly recommendations list (e.g. ### Top Recommendations...)",
          "searchQueries": {
            "CategoryName (e.g. Top)": "keywords for search",
            "CategoryName (e.g. Shoes)": "keywords for search"
          }
        }
        \`\`\`
        `;

        const response = await generateContentWithRetry(
            'gemini-3-pro-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const text = response.text || "{}";
        // Clean markdown code blocks
        const cleanText = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(cleanText);

    } catch (e) {
        console.error("Stylist Agent Failed:", e);
        return { 
            userMessage: "I couldn't generate recommendations at this time.", 
            searchQueries: {} 
        };
    }
};

// --- ORCHESTRATOR ---
export const searchAndRecommend = async (
  profile: UserProfile,
  preferences: Preferences,
  additionalContext: string = "",
  providedStyleAnalysis?: StyleAnalysisResult,
  categorySpecificStyles?: Record<string, string>
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
    // Include provided analysis in cache key to ensure we don't return stale results if analysis changed
    const analysisHash = providedStyleAnalysis ? JSON.stringify(providedStyleAnalysis).length : 0; 
    const exactKey = await cacheManager.generateCacheKey('exact', { preferences, profile, photoHash, analysisHash });
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
    // Use provided analysis if available (from Confirmation step), otherwise run it now if images exist
    let styleAnalysis: StyleAnalysisResult | undefined = providedStyleAnalysis;
    
    if (!styleAnalysis && profile.idealStyleImages?.length > 0) {
        console.log(">> Running Style Analyzer (Lazy Load)...");
        const startStyle = performance.now();
        styleAnalysis = await runStyleExampleAnalyzer(profile, preferences);
        timings.push(`Agent 1.5 (Style - Lazy): ${(performance.now() - startStyle).toFixed(0)}ms`);
    } else if (styleAnalysis) {
        timings.push(`Agent 1.5 (Style - Pre-Computed): 0ms`);
    }

    // --- PARALLEL PIPELINE ORCHESTRATION ---
    // Instead of waiting for all procurement to finish, we verify/score per category immediately
    const startPipeline = performance.now();
    
    // We Map over categories and launch a self-contained "Micro-Pipeline" for each
    const pipelinePromises = categories.map(async (category) => {
        const catStart = performance.now();
        const catTimings: string[] = [];
        
        // Determine specific style preference for this category if available
        // This allows "Search Query Translation" from Stylist Agent to Procurement Agent
        let loopPreferences = preferences;
        if (categorySpecificStyles && categorySpecificStyles[category]) {
             console.log(`>> Applying Category-Specific Style for [${category}]: ${categorySpecificStyles[category]}`);
             loopPreferences = { ...preferences, stylePreference: categorySpecificStyles[category] };
        }

        // 1. Procurement (Micro-Agent)
        const t0 = performance.now();
        const procurementResult = await runCategoryMicroAgent(category, profile, loopPreferences, pathInstruction, today, styleAnalysis);
        const t1 = performance.now();
        const procDuration = (t1 - t0).toFixed(0);
        
        const procLog = `[${category}] Criteria: "${procurementResult.searchCriteria}" | Found: ${procurementResult.initialCandidateCount} | Verified: ${procurementResult.items.length} (${procDuration}ms)`;
        
        // 2. Verification (Immediate Handoff)
        const t2 = performance.now();
        const verificationResult = await runVerificationStep(
            { validatedItems: { [category]: procurementResult.items } }, 
            "None", 
            preferences,
            profile
        );
        const t3 = performance.now();
        const verDuration = (t3 - t2).toFixed(0);
        
        const verItems = verificationResult.validatedItems?.[category] || [];
        const verLog = `[${category}] Verification: Input ${procurementResult.items.length} -> Kept ${verItems.length} (${verDuration}ms)`;

        // 3. Scoring (Immediate Handoff)
        const t4 = performance.now();
        const scoringResult = await runStylistScoringStep(verificationResult, preferences, styleAnalysis);
        const t5 = performance.now();
        const scoreDuration = (t5 - t4).toFixed(0);
        
        const scoredItems = scoringResult.scoredItems?.[category] || [];
        const scoreLog = `[${category}] Scoring: Input ${verItems.length} -> Scored ${scoredItems.length} (${scoreDuration}ms)`;
        
        const catEnd = performance.now();
        const totalCatDuration = (catEnd - catStart).toFixed(0);
        
        // Collect detailed logs for this category
        const logs = [procLog, verLog, scoreLog];
        
        // Add debug logs from procurement if available
        if (procurementResult.debugLogs) {
            logs.push(...procurementResult.debugLogs);
        }
        // Add debug logs from verification if available
        if (verificationResult.debugLogs) {
            logs.push(...verificationResult.debugLogs);
        }

        return { 
            category, 
            scoredItems: scoredItems,
            logs,
            timing: `Pipeline (${category}): ${totalCatDuration}ms`
        };
    });

    // Wait for all pipelines to complete and fill the pool
    const pipelineResults = await Promise.all(pipelinePromises);
    
    // Aggregate for Composer
    const aggregatedScoredItems: any = {};
    let totalItemsFound = 0;
    
    pipelineResults.forEach(res => {
        logMessages.push(...res.logs);
        timings.push(res.timing);
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

/**
 * SPECIALIZED PIPELINE FOR CARD 1 (Style Clone)
 * - Disables Verification Agent (Curator)
 * - Disables Composer Agent
 * - Returns Top 3 Items per Category
 */
export const searchAndRecommendCard1 = async (
  profile: UserProfile,
  preferences: Preferences,
  providedStyleAnalysis?: StyleAnalysisResult
): Promise<StylistResponse> => {
  const startTimeTotal = performance.now();
  const timings: string[] = [];
  const logMessages: string[] = [];

  try {
    const categories = preferences.itemType.split(',').map(t => t.trim()).filter(t => t);
    const today = new Date().toLocaleDateString();
    
    // Use provided analysis (should be available from Page 1C)
    const styleAnalysis = providedStyleAnalysis;

    console.log("--- STARTING CARD 1 PIPELINE (No Verification, No Composer) ---");

    const pipelinePromises = categories.map(async (category) => {
        const catStart = performance.now();
        
        // 1. Procurement (Micro-Agent)
        const t0 = performance.now();
        // Path instruction is simple for Card 1
        const pathInstruction = `Find ${category} matching the analyzed style.`;
        const procurementResult = await runCategoryMicroAgent(category, profile, preferences, pathInstruction, today, styleAnalysis);
        const t1 = performance.now();
        const procDuration = (t1 - t0).toFixed(0);
        
        const procLog = `[${category}] Criteria: "${procurementResult.searchCriteria}" | Found: ${procurementResult.initialCandidateCount} | Verified (Procurement): ${procurementResult.items.length} (${procDuration}ms)`;
        
        // 2. SKIP Verification (Curator) - As requested
        // We just pass procurement items as "validated"
        const verItems = procurementResult.items;
        const verLog = `[${category}] Verification (Curator): SKIPPED (Testing Mode)`;

        // 3. Scoring
        const t4 = performance.now();
        // Wrap in expected structure for scorer
        const inputForScorer = { validatedItems: { [category]: verItems } };
        const scoringResult = await runStylistScoringStep(inputForScorer, preferences, styleAnalysis);
        const t5 = performance.now();
        const scoreDuration = (t5 - t4).toFixed(0);
        
        const scoredItems = scoringResult.scoredItems?.[category] || [];
        
        // Sort by score descending and take top 3
        const top3 = scoredItems
            .sort((a: any, b: any) => (b.visualMatchScore || 0) - (a.visualMatchScore || 0))
            .slice(0, 3);

        const scoreLog = `[${category}] Scoring: Input ${verItems.length} -> Scored ${scoredItems.length} -> Top 3 Kept (${scoreDuration}ms)`;
        
        const catEnd = performance.now();
        const totalCatDuration = (catEnd - catStart).toFixed(0);
        
        const logs = [procLog, verLog, scoreLog];
        if (procurementResult.debugLogs) logs.push(...procurementResult.debugLogs);

        return { 
            category, 
            topItems: top3,
            logs,
            timing: `Pipeline (${category}): ${totalCatDuration}ms`
        };
    });

    const pipelineResults = await Promise.all(pipelinePromises);
    
    // Construct Recommendations (1 per category)
    const recommendations: RecommendationItem[] = [];
    
    pipelineResults.forEach(res => {
        logMessages.push(...res.logs);
        timings.push(res.timing);
        
        if (res.topItems.length > 0) {
            recommendations.push({
                name: `Top Picks: ${res.category}`,
                description: `Best matches for your style analysis.`,
                components: res.topItems.map((item: any) => ({
                    category: res.category,
                    name: item.name,
                    brand: item.source || "Unknown",
                    price: item.price,
                    purchaseUrl: item.purchaseUrl,
                    validationNote: `Score: ${item.visualMatchScore}`,
                    fallbackSearchUrl: item.fallbackSearchUrl
                }))
            });
        }
    });

    const totalTime = (performance.now() - startTimeTotal).toFixed(0);
    const telemetry = `\n--- CARD 1 TELEMETRY ---\n${timings.join('\n')}\nTotal Latency: ${totalTime}ms\n\n`;
    const reflectionNotes = logMessages.join('\n') + "\n\n" + telemetry;

    return {
        recommendations,
        reflectionNotes
    };

  } catch (error) {
    console.error("Error in Card 1 Orchestrator:", error);
    throw error;
  }
};
