
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, Preferences, RecommendationItem, StylistResponse, OutfitComponent, FashionPurpose, StyleAnalysisResult, SearchCriteria, RefinementChatMessage, ProfessionalStylistResponse, StylistOutfit } from "../types";
import { masterStyleGuide } from "./masterStyleGuide";
import { runCategoryMicroAgent } from "./agent2_procurement_temp";
import { runVerificationStep, runStylistScoringStep, runOutfitComposerStep } from "./agent3_curator_temp";
import { runDirectorFinalVerdict } from "./postorchestrator_temp";
import { runStyleExampleAnalyzer } from "./agent_style_analyzer";
import { cacheManager } from './cacheService';
import { fashionVocabularyDatabase } from "./fashionVocabulary";
import { fashionStyleLibrary } from "./fashionStyleLibrary";

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

// --- CONVERSATIONAL REFINEMENT AGENT (Gemini 3 Flash) ---
// Vocabulary-aware chat agent that updates structured SearchCriteria

// Build a lookup map from the fashion vocabulary for item recognition
const buildVocabularyMap = (): Record<string, string> => {
    const map: Record<string, string> = {};
    const db = fashionVocabularyDatabase.fashion_vocabulary_database;
    
    // Recursively extract all string values from a nested object/array
    const extractAllStrings = (obj: any): string[] => {
        const terms: string[] = [];
        if (Array.isArray(obj)) {
            obj.forEach(v => {
                if (typeof v === 'string') terms.push(v);
                else if (typeof v === 'object' && v !== null) {
                    if (v.name) terms.push(v.name);
                    terms.push(...extractAllStrings(v));
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(val => {
                terms.push(...extractAllStrings(val));
            });
        }
        return terms;
    };

    db.categories.forEach((cat: any) => {
        const catName = cat.name; // e.g. "tops", "bottoms", "dresses", "footwear"
        
        // v3.0 structure: cat.basics + cat.details (replaces cat.subcategories)
        if (cat.basics) {
            const basicsTerms = extractAllStrings(cat.basics);
            basicsTerms.forEach(term => { map[term.toLowerCase()] = catName; });
        }
        if (cat.details) {
            const detailsTerms = extractAllStrings(cat.details);
            detailsTerms.forEach(term => { map[term.toLowerCase()] = catName; });
        }
        // Fallback for older v1.0 structure (cat.subcategories)
        if (cat.subcategories) {
            const subTerms = extractAllStrings(cat.subcategories);
            subTerms.forEach(term => { map[term.toLowerCase()] = catName; });
        }
        
        // Also map the category name itself
        map[catName] = catName;
    });

    // Common aliases (handles both "shoes" and "footwear" naming)
    map['skirt'] = 'bottoms';
    map['pants'] = 'bottoms';
    map['jeans'] = 'bottoms';
    map['shorts'] = 'bottoms';
    map['shirt'] = 'tops';
    map['blouse'] = 'tops';
    map['top'] = 'tops';
    map['dress'] = 'dresses';
    map['gown'] = 'dresses';
    map['jacket'] = 'outerwear';
    map['coat'] = 'outerwear';
    map['blazer'] = 'outerwear';
    map['sneakers'] = 'footwear';
    map['heels'] = 'footwear';
    map['boots'] = 'footwear';
    map['sandals'] = 'footwear';
    map['shoes'] = 'footwear';
    map['flats'] = 'footwear';
    map['loafers'] = 'footwear';
    map['mules'] = 'footwear';
    map['bag'] = 'handbags';
    map['purse'] = 'handbags';
    map['clutch'] = 'handbags';
    map['backpack'] = 'handbags';
    map['necklace'] = 'jewelry';
    map['earrings'] = 'jewelry';
    map['bracelet'] = 'jewelry';
    map['ring'] = 'jewelry';
    map['hat'] = 'hair_accessories';
    map['headband'] = 'hair_accessories';
    map['scrunchie'] = 'hair_accessories';
    
    return map;
};

const vocabularyMap = buildVocabularyMap();

// Resolve a user's item term to its parent category
export const resolveItemCategory = (term: string): string => {
    const lower = term.toLowerCase().trim();
    return vocabularyMap[lower] || 'unknown';
};

export const runChatRefinement = async (
    currentCriteria: SearchCriteria,
    chatHistory: RefinementChatMessage[],
    userMessage: string,
    profile: UserProfile
): Promise<{ updatedCriteria: Partial<SearchCriteria>; assistantMessage: string }> => {
    try {
        // Build a compact vocabulary summary for the prompt
        const categoryNames = fashionVocabularyDatabase.fashion_vocabulary_database.categories.map((c: any) => c.name);
        
        const prompt = `
You are a friendly fashion assistant helping a user refine their search criteria for a shopping app.

**CURRENT SEARCH CRITERIA:**
${JSON.stringify(currentCriteria, null, 2)}

**USER PROFILE:**
- Gender: ${profile.gender}
- Size: ${profile.estimatedSize}
${profile.height ? `- Height: ${profile.height}` : ''}

**FASHION VOCABULARY CATEGORIES:** ${categoryNames.join(', ')}
Common item-to-category mappings:
- "skirt", "pants", "jeans", "shorts" → bottoms
- "shirt", "blouse", "camisole", "top" → tops  
- "dress", "gown" → dresses
- "jacket", "coat", "blazer" → outerwear
- "sneakers", "heels", "boots", "sandals" → footwear
- "bag", "purse", "clutch", "backpack" → handbags

**CONVERSATION HISTORY:**
${chatHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}

**USER'S NEW MESSAGE:** "${userMessage}"

**YOUR TASK:**
1. Understand what the user wants to change, replace, or add.
2. Return ONLY the fields that changed (not the whole criteria).
3. **CRITICAL: REPLACE vs ADD Logic:**
   - If user says "I want a skirt" or "make it a skirt" or "change to skirt" → this is a **REPLACE** operation. Remove ALL items in the same category (e.g., remove "jeans", "trousers", "pants" from bottoms) and replace with the new item ("skirt"). The includedItems should contain the new item AND all items from OTHER categories that were already there.
   - If user says "ADD a skirt" or "also include a skirt" → this is an **ADD** operation. Keep existing items and add the new one alongside them.
   - Default behavior (no explicit "add"): treat as REPLACE within the same category.
4. **CRITICAL for includedItems:** Use the user's SPECIFIC words. If they say "skirt", put "skirt" not "bottoms". If they say "silk camisole", put "silk camisole". These are search terms.
5. **CRITICAL for itemCategories:** Map each includedItem to its parent category for pipeline routing. "skirt" → "bottoms", "camisole" → "tops".
6. For excludedMaterials: If user says "no polyester" or "I don't like nylon", add those.
7. Be conversational and brief in your response.

**OUTPUT (Strict JSON):**
\`\`\`json
{
  "updatedCriteria": {
    // ONLY include fields that changed. Omit unchanged fields.
    // For REPLACE: return the FULL updated includedItems list (with the replacement applied)
    // For ADD: return the FULL updated includedItems list (with the new item appended)
    // "includedItems": ["skirt", "silk top"],  ← user's specific words
    // "itemCategories": ["bottoms", "tops"],    ← resolved categories  
    // "style": "Minimalist",
    // "colors": ["White", "Navy"],
    // "excludedMaterials": ["polyester"],
    // "occasion": "Date night",
    // "priceRange": "$50-$200",
    // "additionalNotes": "prefers flowy fabrics"
  },
  "assistantMessage": "Got it! Changed your bottoms to a skirt. Anything else?"
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

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        // Post-process: ensure itemCategories are resolved from vocabulary
        if (parsed.updatedCriteria?.includedItems) {
            const resolvedCategories = parsed.updatedCriteria.includedItems.map((item: string) => {
                const cat = resolveItemCategory(item);
                return cat !== 'unknown' ? cat : item; // Fallback to the item itself
            });
            // Deduplicate categories
            parsed.updatedCriteria.itemCategories = [...new Set(resolvedCategories)];
        }

        return {
            updatedCriteria: parsed.updatedCriteria || {},
            assistantMessage: parsed.assistantMessage || "I've updated your search criteria."
        };

    } catch (e) {
        console.error("Chat Refinement Agent Error:", e);
        return {
            updatedCriteria: {},
            assistantMessage: "Sorry, I had trouble understanding that. Could you rephrase?"
        };
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
/**
 * OCCASION-BASED OUTFIT PLANNER (Gemini 3 Flash)
 * Given an occasion, generates a quick recommendation for outfit composition,
 * style direction, color palette, and other features using fashion vocabulary.
 */
export const generateOccasionPlan = async (
    occasion: string,
    profile: UserProfile
): Promise<{
    items: string[];
    styles: string[];
    colors: string[];
    features: string[];
    summary: string;
}> => {
    // Build a compact vocabulary summary for the prompt
    const categories = fashionVocabularyDatabase.fashion_vocabulary_database.categories;
    const categoryNames = categories.map(c => c.name).join(', ');
    const styleLibrarySummary = fashionStyleLibrary.fashion_style_guide.styles
        .map(s => s.name).join(', ');

    const prompt = `
You are a fashion planning assistant. Based on the occasion below, recommend what a complete outfit should include.

**Occasion:** "${occasion}"
**User:** ${profile.gender || 'Not specified'}, Size ${profile.estimatedSize || 'Not specified'}${profile.age ? `, Age ${profile.age}` : ''}

**Available Clothing Categories:** ${categoryNames}
**Available Style Vibes:** ${styleLibrarySummary}

**Your Task:**
1. **Items**: Recommend which clothing categories to include for this occasion. Pick from the available categories. Usually 3-5 items (e.g., a top + bottom + footwear, or a dress + footwear + handbag). Use the exact category names.
2. **Styles**: Suggest 2-4 style vibes that suit this occasion. Use the exact style names from the list above when possible.
3. **Colors**: Suggest 3-5 color palettes appropriate for this occasion (e.g., "Pastels", "Navy Blue", "Jewel Tones", "Earth Tones", "Neutrals").
4. **Features**: Suggest 2-4 other notable features or fabric/detail keywords (e.g., "Flowy Fabric", "Structured Silhouette", "Statement Accessories", "Minimalist Hardware").
5. **Summary**: Write a one-sentence summary like: For "Wedding Guest", we would recommend: An outfit consisting of Dress, Heels, Clutch.

**Output (Strict JSON):**
{
  "items": ["dress", "footwear", "handbags"],
  "styles": ["Elegant", "Formal", "Romantic"],
  "colors": ["Pastels", "Jewel Tones", "Neutrals"],
  "features": ["Flowy Fabric", "Sophisticated Details", "Statement Accessories"],
  "summary": "For a wedding guest look, a flowing dress with elegant heels and a clutch bag creates the perfect ensemble."
}
`;

    try {
        const response = await generateContentWithRetry(
            'gemini-3-flash-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        return {
            items: parsed.items || [],
            styles: parsed.styles || [],
            colors: parsed.colors || [],
            features: parsed.features || [],
            summary: parsed.summary || '',
        };
    } catch (error) {
        console.error("Occasion Planner Error:", error);
        return { items: [], styles: [], colors: [], features: [], summary: '' };
    }
};

/**
 * PROFESSIONAL STYLIST AGENT (Gemini 3 Pro)
 * Uses master_style_guide_ai.json as source of truth.
 * Returns 3 complete outfit options with rule-based reasoning.
 */
export const generateStylistRecommendations = async (
    profile: UserProfile,
    preferences: Preferences,
    styleAnalysis: StyleAnalysisResult
): Promise<ProfessionalStylistResponse> => {
    try {
        const keptItems = profile.keptItems?.join(', ') || "No specific items identified";
        const targetItems = preferences.itemType;
        const styleVibe = styleAnalysis.suggestedStyles?.map(s => s.name).join(', ') || "Not specified";
        const detectedColors = styleAnalysis.detectedColors?.join(', ') || "Not detected";
        const keptItemDetails = styleAnalysis.detailDataset ? JSON.stringify(styleAnalysis.detailDataset) : "No structural details available";

        // Inject the full style guide as system context
        const styleGuideJson = JSON.stringify(masterStyleGuide.master_style_guide, null, 2);

        const prompt = `
**ROLE:** You are an elite Professional Stylist. You MUST follow the "Master Style Guide" below as your absolute source of truth.

**MASTER STYLE GUIDE (Source of Truth):**
${styleGuideJson}

**USER CONTEXT:**
- Gender: ${profile.gender}
- Size: ${profile.estimatedSize}
${profile.height ? `- Height: ${profile.height}` : ''}
${profile.heightCategory ? `- Build: ${profile.heightCategory}` : ''}
${profile.age ? `- Age: ${profile.age}` : ''}
- Current Outfit (Kept Items): ${keptItems}
- Kept Item Structural Details: ${keptItemDetails}
- Looking For: ${targetItems}
- Style Vibe: ${styleVibe}
- Detected Palette: ${detectedColors}
- Occasion: ${preferences.occasion || 'General / Not specified'}
- Budget: ${preferences.priceRange || 'Not specified'}
${preferences.colors ? `- Preferred Colors: ${preferences.colors}` : ''}

**YOUR TASK: Execute the 7-Step Recommendation Workflow**

Follow these steps IN ORDER for each of the 3 outfits you create:

1. **IDENTIFY & BASE:** Map the occasion to the guide's occasion rules. Establish a color palette using the 60-30-10 Rule (dominant neutral, secondary complement, accent pop). If the user has kept items, those items define part of your base — build around them.

2. **PROPORTION & TEXTURE:** Apply Proportion Balance (fitted vs. loose — NEVER balance equally). Apply Hard-Soft Contrast (pair a structured fabric with a fluid one).

3. **LAYERING & COMPLETION:** Add a "third piece" for polish (jacket, cardigan, vest, scarf). Ensure the outfit meets the Five-Piece Rule (top + bottom/dress + footwear + layer + accessory).

4. **FINAL VALIDATION:** Verify the One-Statement Rule (only 1 bold element). Check that no absolute rules are violated.

**CRITICAL OUTPUT RULES:**
- Create exactly **3 distinct outfit options** that the user can choose from.
- Each outfit should have a different personality (e.g., one classic, one trendy, one bold).
- **ONLY recommend items in the categories listed in "Looking For" above.** Do NOT add extra categories (e.g., if the user only wants "Bottom, Footwear", do NOT add outerwear, accessories, or handbags). Each outfit's recommendations array must ONLY contain items from the requested categories.
- For each item in the outfit, generate a **serp_query** — this is a Google Shopping search string. It must include: gender + color + material + item type + key feature. Example: "women's cream silk wide-leg trousers high-waisted".
- Each item's **style_reason** must cite a SPECIFIC rule from the guide (e.g., "60-30-10 Rule: charcoal is your 60% base", "Hard-Soft Rule: silk against your denim jacket").
- The **logic** field must walk through the 7-step workflow and explain the reasoning.
- If the user has kept items, those items should NOT appear in your recommendations (they already own them). Only recommend NEW items in the requested categories.

**OUTPUT FORMAT (Strict JSON):**
{
  "outfits": [
    {
      "name": "Creative outfit name (e.g. 'The Weekend Editor')",
      "logic": "Step-by-step reasoning (1-2 sentences per step, citing specific guide rules)",
      "body_type_notes": "How silhouette was adjusted for user's build (if applicable)",
      "recommendations": [
        {
          "category": "top/bottom/footwear/outerwear/accessories/jewelry/handbag",
          "item_name": "Specific item name (e.g. 'Cream Silk Wide-Leg Trousers')",
          "serp_query": "Google Shopping search query string",
          "style_reason": "Why this item, citing a specific guide rule",
          "color_role": "Specific color name(s), e.g. 'Navy Blue', 'Cream', 'Navy Blue with Yellow Patterns'"
        }
      ]
    }
  ],
  "refined_constraints": "Any additional notes for the procurement pipeline"
}
`;

        const response = await generateContentWithRetry(
            'gemini-3-pro-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const text = response.text || "{}";
        const parsed = JSON.parse(text);

        // Validate structure
        if (!parsed.outfits || !Array.isArray(parsed.outfits)) {
            console.error("Stylist Agent: Invalid output structure", parsed);
            return {
                outfits: [],
                refined_constraints: "Agent returned invalid structure"
            };
        }

        return {
            outfits: parsed.outfits,
            refined_constraints: parsed.refined_constraints || ""
        };

    } catch (e) {
        console.error("Professional Stylist Agent Failed:", e);
        return {
            outfits: [],
            refined_constraints: "Agent error: " + (e instanceof Error ? e.message : String(e))
        };
    }
};

/**
 * OUTFIT HERO IMAGE GENERATOR (Nano Banana - Gemini 2.5 Flash Image)
 * Generates a single flat-lay product photography composition for an outfit.
 * Uses the fast model for speed — 3 parallel calls = ~10-15s total.
 */
export const generateOutfitHeroImage = async (
    outfit: StylistOutfit
): Promise<string | null> => {
    try {
        const itemDescriptions = outfit.recommendations.map(rec => 
            `- ${rec.item_name} (${rec.category}${rec.color_role ? `, ${rec.color_role}` : ''})`
        ).join('\n');

        const prompt = `You are an expert fashion product photographer. Generate a high-fidelity, commercial flat-lay photograph of the following outfit items arranged together on a clean surface.

**Style Constraints (Strict):**
1. Background: Solid, neutral off-white/cream studio background. Seamless and clean.
2. Composition: Flat-lay arrangement of ALL items below, neatly organized as a complete outfit. Items should be arranged naturally as they would be worn — top above bottom, shoes below, accessories to the side.
3. Lighting: Soft, professional studio lighting highlighting fabric textures and true colors. No harsh shadows.
4. Vibe: Minimalist, high-end e-commerce aesthetic. Similar to Zara or COS lookbook flat-lays.
5. Do NOT show any human body, head, limbs, or mannequin. Items only.
6. Each item should be clearly visible and identifiable.

**Outfit: "${outfit.name}"**
Items to include:
${itemDescriptions}

Generate this flat-lay product photograph now.`;

        const response = await generateContentWithRetry(
            'gemini-2.5-flash-image',
            {
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio: '3:4' }
                }
            }
        );

        // Extract the image from the response parts
        const candidates = (response as any).candidates;
        if (candidates?.[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
            }
        }

        console.warn("Hero image generation returned no image data");
        return null;
    } catch (e) {
        console.error("Hero Image Generation Failed:", e);
        return null;
    }
};

/**
 * Generate hero images for all outfits in parallel.
 * Non-blocking — if any fails, that outfit just won't have an image.
 */
export const generateAllOutfitHeroImages = async (
    outfits: StylistOutfit[]
): Promise<StylistOutfit[]> => {
    console.log(`>> Generating ${outfits.length} hero images in parallel...`);
    const startTime = performance.now();

    const imagePromises = outfits.map(async (outfit) => {
        const imageBase64 = await generateOutfitHeroImage(outfit);
        return { ...outfit, heroImageBase64: imageBase64 || undefined };
    });

    const results = await Promise.all(imagePromises);
    const successCount = results.filter(o => o.heroImageBase64).length;
    console.log(`>> Hero images complete: ${successCount}/${outfits.length} succeeded (${(performance.now() - startTime).toFixed(0)}ms)`);
    
    return results;
};

/**
 * SEARCH QUERY GENERATOR (Gemini 3 Pro)
 * Takes a confirmed stylist outfit and generates optimized SerpApi search strings per item.
 */
export const generateSearchQueries = async (
    outfit: StylistOutfit,
    profile: UserProfile,
    preferences: Preferences
): Promise<Record<string, string>> => {
    try {
        const genderLabel = profile.gender === 'Female' ? "women's" : profile.gender === 'Male' ? "men's" : "unisex";
        const size = profile.estimatedSize || '';
        const budget = preferences.priceRange || '';

        const itemsSummary = outfit.recommendations.map(rec =>
            `- Category: ${rec.category}, Item: ${rec.item_name}, Color: ${rec.color_role || 'any'}, Reason: ${rec.style_reason}`
        ).join('\n');

        const prompt = `
**ROLE:** You are a Google Shopping search expert. Your job is to generate highly effective SerpApi search strings for fashion items.

**USER CONTEXT:**
- Gender: ${genderLabel}
- Size: ${size}
- Budget: ${budget}

**ITEMS TO SEARCH FOR:**
${itemsSummary}

**YOUR TASK:**
For each item above, generate a single optimized Google Shopping search query string.

**RULES:**
1. Include gender (e.g. "women's"), color, material/fabric if relevant, and item type.
2. Include a key feature or silhouette detail (e.g. "high-waisted", "oversized", "cropped").
3. Keep it concise (6-12 words). Do NOT include brand names unless specified.
4. Add "buy online" at the end of each query.
5. Do NOT include price or size in the query — SerpApi handles filters separately.
6. Exclude: -pinterest -polyvore -lyst

**OUTPUT FORMAT (Strict JSON):**
{
  "queries": {
    "<category>": "<search query string>"
  }
}

Example:
{
  "queries": {
    "bottom": "women's black high-waisted wide-leg trousers buy online -pinterest -polyvore -lyst",
    "footwear": "women's white chunky platform sneakers buy online -pinterest -polyvore -lyst"
  }
}
`;

        const response = await generateContentWithRetry(
            'gemini-3-pro-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const text = response.text || "{}";
        const parsed = JSON.parse(text);
        return parsed.queries || {};

    } catch (e) {
        console.error("Search Query Generator Failed:", e);
        // Fallback: use the serp_query from the stylist output directly
        const fallback: Record<string, string> = {};
        outfit.recommendations.forEach(rec => {
            if (rec.serp_query) {
                fallback[rec.category] = rec.serp_query + " buy online -pinterest -polyvore -lyst";
            }
        });
        return fallback;
    }
};

/**
 * SIMPLIFIED SEARCH PIPELINE
 * Flow: Gemini Pro queries → Parallel SerpApi procurement → Verification (URL/availability) → Top 3 per category
 * Disabled: Curator, PreOrchestrator, PostOrchestrator, Scoring, Composer
 */
export const searchWithStylistQueries = async (
    profile: UserProfile,
    preferences: Preferences,
    searchQueries: Record<string, string>
): Promise<StylistResponse> => {
    const startTimeTotal = performance.now();
    const timings: string[] = [];
    const logMessages: string[] = [];

    try {
        const categories = Object.keys(searchQueries);
        const today = new Date().toLocaleDateString();

        console.log("--- STARTING SIMPLIFIED SEARCH PIPELINE ---");
        console.log(`Categories: ${categories.join(', ')}`);

        // --- PARALLEL PROCUREMENT + VERIFICATION PER CATEGORY ---
        const pipelinePromises = categories.map(async (category) => {
            const catStart = performance.now();
            const query = searchQueries[category];

            logMessages.push(`[${category}] Search Query: "${query}"`);

            // 1. Procurement (SerpApi via micro-agent with pre-built query)
            const t0 = performance.now();
            const pathInstruction = `Search for: ${query}`;
            const loopPreferences = { ...preferences, stylePreference: query };
            const procurementResult = await runCategoryMicroAgent(
                category, profile, loopPreferences, pathInstruction, today, undefined
            );
            const t1 = performance.now();
            logMessages.push(`[${category}] Procurement: Found ${procurementResult.initialCandidateCount} candidates, ${procurementResult.items.length} after procurement filter (${(t1 - t0).toFixed(0)}ms)`);

            // 2. Verification (URL check, blacklist, price, availability — NO scoring, NO curator)
            const t2 = performance.now();
            const verificationResult = await runVerificationStep(
                { validatedItems: { [category]: procurementResult.items } },
                "None",
                preferences,
                profile
            );
            const t3 = performance.now();

            const verifiedItems = verificationResult.validatedItems?.[category] || [];
            logMessages.push(`[${category}] Verification: ${procurementResult.items.length} → ${verifiedItems.length} passed (${(t3 - t2).toFixed(0)}ms)`);

            // 3. Take Top 3 (by order — SerpApi already returns relevance-ranked results)
            const top3 = verifiedItems.slice(0, 3);
            
            const totalDuration = (performance.now() - catStart).toFixed(0);
            timings.push(`Pipeline (${category}): ${totalDuration}ms`);

            // Add debug logs
            const logs: string[] = [];
            if (procurementResult.debugLogs) logs.push(...procurementResult.debugLogs);
            if (verificationResult.debugLogs) logs.push(...verificationResult.debugLogs);

            return { category, topItems: top3, logs };
        });

        const pipelineResults = await Promise.all(pipelinePromises);

        // --- ASSEMBLE FINAL RESULTS ---
        const recommendations: RecommendationItem[] = [];

        pipelineResults.forEach(res => {
            logMessages.push(...res.logs);

            if (res.topItems.length > 0) {
                recommendations.push({
                    name: `Top Picks: ${res.category}`,
                    description: `Best matches from shopping search.`,
                    components: res.topItems.map((item: any) => ({
                        category: res.category,
                        name: item.name,
                        brand: item.source || "Unknown",
                        price: item.price,
                        purchaseUrl: item.purchaseUrl,
                        validationNote: `Verified ✓`,
                        fallbackSearchUrl: item.fallbackSearchUrl,
                        imageUrl: item.image || undefined
                    }))
                });
            }
        });

        const totalTime = (performance.now() - startTimeTotal).toFixed(0);
        const telemetry = `\n--- SEARCH PIPELINE TELEMETRY ---\n${timings.join('\n')}\nTotal Latency: ${totalTime}ms\n\n`;
        const reflectionNotes = logMessages.join('\n') + "\n\n" + telemetry;

        return { recommendations, reflectionNotes };

    } catch (error) {
        console.error("Error in Simplified Search Pipeline:", error);
        throw error;
    }
};

// --- LEGACY ORCHESTRATOR (kept for backward compatibility) ---
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
  providedStyleAnalysis?: StyleAnalysisResult,
  categorySpecificStyles?: Record<string, string>
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
        
        // Determine specific style/search preference for this category
        let loopPreferences = preferences;
        if (categorySpecificStyles && categorySpecificStyles[category]) {
            console.log(`>> Applying Category-Specific Search for [${category}]: ${categorySpecificStyles[category]}`);
            loopPreferences = { ...preferences, stylePreference: categorySpecificStyles[category] };
        }
        
        // 1. Procurement (Micro-Agent)
        const t0 = performance.now();
        // Path instruction is simple for Card 1
        const pathInstruction = `Find ${category} matching the analyzed style.`;
        const procurementResult = await runCategoryMicroAgent(category, profile, loopPreferences, pathInstruction, today, styleAnalysis);
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
