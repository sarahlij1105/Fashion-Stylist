
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
        2. **Estimated Height:** Give a specific estimate in feet and inches format (e.g., "5'5\"", "5'10\"")
        3. **Clothing Size:** Estimate standard clothing size: XS, S, M, L, XL, XXL
        4. **Shoe Size:** Estimate shoe size based on height/proportions (e.g., "US 7", "US 9")

        **Output Schema (Strict JSON):**
        \`\`\`json
        {
          "gender": "Female" | "Male" | "Non-binary",
          "height": "5'5\"",
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
7. **CRITICAL: USER PREFERENCE PRIORITY for colors:**
   - The user's explicitly stated color preferences ALWAYS take priority over AI-suggested colors.
   - If user says "I like pink" or "I want pink", the colors array must have "Pink" as the FIRST color. Replace the AI-suggested colors that conflict or are least compatible, keeping colors that complement the user's choice.
   - If user says "change to pink" or "make it pink", replace ALL existing colors with a pink-based palette (e.g., ["Pink", "Blush", "Rose Gold", "Cream"]).
   - If user says "add pink" or "also pink", add pink as the FIRST color and keep existing colors that complement it.
   - This same priority rule applies to styles, items, and all other preferences — user's explicit wishes always come first.
8. Be conversational and brief in your response.

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
export interface OccasionPlanContext {
    culture?: string;       // e.g. "Chinese", "Mexican", "Indian"
    role?: string;          // e.g. "bride", "bridesmaid", "guest", "host"
    season?: string;        // e.g. "summer", "winter", "spring"
    weather?: string;       // e.g. "hot and humid", "cold", "rainy"
    venue?: string;         // e.g. "outdoor garden", "rooftop bar", "office"
    formality?: string;     // e.g. "black tie", "semi-formal", "casual"
    ageGroup?: string;      // e.g. "young professional", "mature"
    bodyConsiderations?: string; // e.g. "pregnant", "postpartum", "petite"
    activityLevel?: string; // e.g. "lots of dancing", "seated dinner", "walking tour"
    timeOfDay?: string;     // e.g. "evening", "morning", "all day"
    location?: string;      // e.g. "New York", "beach town", "Tokyo"
    companions?: string;    // e.g. "with kids", "date", "girls' night"
    dressCode?: string;     // e.g. "cocktail attire", "white party", "all black"
}

export type OccasionPlanResult = {
    occasion: string;
    items: string[];
    styles: string[];
    colors: string[];
    features: string[];
    context: OccasionPlanContext;
    summary: string;
    extracted: { occasion: boolean; items: boolean; styles: boolean; colors: boolean; features: boolean; context: boolean };
    suggestedAdditionalItems: string[];
};

export const generateOccasionPlan = async (
    userInput: string,
    profile: UserProfile
): Promise<OccasionPlanResult> => {
    // Build a compact vocabulary summary for the prompt
    const categories = fashionVocabularyDatabase.fashion_vocabulary_database.categories;
    const categoryNames = categories.map(c => c.name).join(', ');
    const styleLibrarySummary = fashionStyleLibrary.fashion_style_guide.styles
        .map(s => s.name).join(', ');

    console.log(`[Occasion Planner] Planning for gender: ${profile.gender}, input: "${userInput}"`);

    // --- CACHE CHECK ---
    const normalizedInput = userInput.trim().toLowerCase().replace(/\s+/g, ' ');
    const planCacheKey = `occasion_plan_${cacheManager.generateFastHash(
        normalizedInput + '|' + (profile.gender || '') + '|' + (profile.estimatedSize || '')
    )}`;
    const cachedPlan = await cacheManager.checkCache(planCacheKey);
    if (cachedPlan) {
        console.log(`[Occasion Planner] Cache HIT for "${normalizedInput}" (${profile.gender})`);
        return cachedPlan;
    }
    console.log(`[Occasion Planner] Cache MISS for "${normalizedInput}" (${profile.gender})`);

    const prompt = `
You are a smart fashion planning assistant. A user typed a free-text request. Your job is to:
1. **Extract** any specific criteria the user already mentioned (occasion, items, styles, colors, features).
2. **Extract contextual signals** — culture, role, season/weather, venue, formality, time of day, location, activity level, dress code, companions, body considerations, and any other relevant detail the user mentioned or strongly implied.
3. **Recommend** suitable values for any criteria the user did NOT mention. Use the extracted context to make smarter recommendations (e.g., a Chinese wedding guest needs very different clothing than a Mexican beach wedding).
4. **Suggest additional items** the user might need for a complete outfit.

**User Input:** "${userInput}"
**User Gender:** ${profile.gender || 'Not specified'} (IMPORTANT: all recommendations must be gender-appropriate for a ${profile.gender || 'Not specified'} person)
**User Size:** ${profile.estimatedSize || 'Not specified'}

**Available Clothing Categories:** ${categoryNames}
**Available Style Vibes:** ${styleLibrarySummary}

**STEP 1 — EXTRACT CONTEXT (do this FIRST before anything else):**
Read the user's input carefully and extract ALL contextual signals. These are NOT separate questions to ask — infer them from what the user wrote. Only include fields where the user explicitly stated or strongly implied a value. Examples:
- "Chinese wedding" → culture: "Chinese"
- "I'm a bridesmaid" → role: "Bridesmaid"
- "outdoor summer wedding" → season: "Summer", venue: "Outdoor", weather: "Warm"
- "black tie gala in NYC" → formality: "Black Tie", location: "New York City"
- "beach party at night" → venue: "Beach", timeOfDay: "Evening"
- "going hiking then dinner" → activityLevel: "Active then seated"
- "I'm 6 months pregnant" → bodyConsiderations: "Pregnant"
- "girls night out" → companions: "Friends (girls' night)"
- "cocktail dress code" → dressCode: "Cocktail"

**STEP 2 — EXTRACTION RULES (standard fields):**
- **occasion**: Infer the occasion from the user's input. Map casual phrases to standard occasions (e.g., "wedding in May" → "Wedding Guest", "job interview" → "Interview", "going out tonight" → "Night Out / Party"). If no occasion is mentioned, set to "" and extracted.occasion = false.
- **items**: If the user mentions specific clothing (e.g., "dress", "pants", "shoes"), extract those as category names. Use exact category names from the available list. If user says "dress", map to "dresses". If user says "top" or "shirt", map to "tops". If no items mentioned, extracted.items = false.
- **styles**: If the user mentions style/vibe words (e.g., "elegant", "casual", "bohemian"), extract them. If not mentioned, extracted.styles = false.
- **colors**: If the user mentions colors (e.g., "red", "navy", "pastel"), extract them. If not mentioned, extracted.colors = false.
- **features**: If the user mentions fabric, fit, or detail preferences (e.g., "silk", "fitted", "flowy"), extract them. If not mentioned, extracted.features = false.

**STEP 3 — USE CONTEXT FOR SMARTER RECOMMENDATIONS:**
When recommending styles, colors, features, and items for non-extracted fields, USE the extracted context heavily:
- **Culture**: Chinese weddings → red/gold tones, qipao-inspired, avoid all-white/all-black. Indian weddings → rich jewel tones, embroidery, saree/lehenga consideration. Mexican weddings → vibrant colors, floral patterns.
- **Role**: Bride → white/ivory, show-stopping silhouette. Bridesmaid → coordinate with wedding party. Guest → elegant but not upstaging. Host → polished and approachable.
- **Season/Weather**: Summer → lightweight, breathable fabrics, lighter colors. Winter → layered, heavier fabrics, rich tones. Rainy → water-resistant, practical footwear.
- **Venue**: Outdoor garden → flowy, nature-inspired. Rooftop/lounge → sleek, modern. Beach → casual, sand-friendly shoes. Office → structured, professional.
- **Formality**: Black tie → floor-length, luxury fabrics. Semi-formal → cocktail length, refined. Casual → comfortable yet put-together.
- **Time of Day**: Morning/brunch → lighter tones, relaxed. Evening → deeper tones, sparkle/shimmer acceptable.
- **Activity Level**: Dancing → flexible, secure. Walking → comfortable footwear priority. Seated dinner → structured silhouette fine.
- **Body Considerations**: Pregnant → empire waist, stretchy, supportive. Petite → elongating lines.

**STEP 4 — suggestedAdditionalItems Rules:**
- ONLY populate this if the user EXPLICITLY mentioned specific clothing items (extracted.items = true) AND mentioned only 1-2 items. In that case, suggest complementary items to complete the look (e.g., user said "dress" → suggest ["footwear", "handbags"]).
- If the user did NOT mention any specific items (extracted.items = false), you MUST set suggestedAdditionalItems to []. In this case, put the full recommended outfit in "items" instead — the user asked for a complete outfit, so recommend everything directly.
- If the user already requested 3+ items, return [].

**summary**: Write a one-sentence summary that incorporates the context (e.g., "For an outdoor summer Chinese wedding as a guest, a flowing red-accented dress with elegant sandals...").

**Output (Strict JSON):**
{
  "occasion": "Wedding Guest",
  "items": ["dresses", "footwear", "handbags"],
  "styles": ["Elegant", "Romantic"],
  "colors": ["Red", "Gold", "Champagne"],
  "features": ["Lightweight Fabric", "Elegant Draping"],
  "context": {
    "culture": "Chinese",
    "role": "Guest",
    "season": "Summer",
    "weather": "Warm",
    "venue": "Outdoor Garden",
    "formality": "Semi-Formal",
    "timeOfDay": "Afternoon",
    "location": null,
    "activityLevel": null,
    "bodyConsiderations": null,
    "companions": null,
    "dressCode": null,
    "ageGroup": null
  },
  "summary": "For an outdoor summer Chinese wedding as a guest, a flowing dress in red and gold tones with elegant heels and a coordinating clutch.",
  "extracted": {
    "occasion": true,
    "items": false,
    "styles": false,
    "colors": false,
    "features": false,
    "context": true
  },
  "suggestedAdditionalItems": []
}

**IMPORTANT:** Only include context fields that the user mentioned or strongly implied. Set all others to null. If NO context was detected at all, set "context" to {} and extracted.context to false.
`;

    try {
        const response = await generateContentWithRetry(
            'gemini-3-flash-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json', temperature: 0 }
            }
        );

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        // Clean context: remove null/undefined values
        const rawContext = parsed.context || {};
        const cleanContext: OccasionPlanContext = {};
        for (const [k, v] of Object.entries(rawContext)) {
            if (v !== null && v !== undefined && v !== '') {
                (cleanContext as any)[k] = v;
            }
        }

        const result: OccasionPlanResult = {
            occasion: parsed.occasion || '',
            items: parsed.items || [],
            styles: parsed.styles || [],
            colors: parsed.colors || [],
            features: parsed.features || [],
            context: cleanContext,
            summary: parsed.summary || '',
            extracted: parsed.extracted || { occasion: false, items: false, styles: false, colors: false, features: false, context: false },
            suggestedAdditionalItems: parsed.suggestedAdditionalItems || [],
        };

        console.log(`[Occasion Planner] Extracted context:`, cleanContext);

        // Cache the result (2 hour TTL)
        await cacheManager.setCache(planCacheKey, result, 7200);
        console.log(`[Occasion Planner] Cached result for "${normalizedInput}" (${profile.gender})`);

        return result;
    } catch (error) {
        console.error("Occasion Planner Error:", error);
        return { occasion: '', items: [], styles: [], colors: [], features: [], context: {}, summary: '', extracted: { occasion: false, items: false, styles: false, colors: false, features: false, context: false }, suggestedAdditionalItems: [] };
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
    styleAnalysis: StyleAnalysisResult,
    occasionContext?: OccasionPlanContext
): Promise<ProfessionalStylistResponse> => {
    try {
        const keptItems = profile.keptItems?.join(', ') || "No specific items identified";
        const targetItems = preferences.itemType;
        const styleVibe = styleAnalysis.suggestedStyles?.map(s => s.name).join(', ') || "Not specified";
        const detectedColors = styleAnalysis.detectedColors?.join(', ') || "Not detected";
        const keptItemDetails = styleAnalysis.detailDataset ? JSON.stringify(styleAnalysis.detailDataset) : "No structural details available";

        // Build context string for prompt and cache
        const contextStr = occasionContext && Object.keys(occasionContext).length > 0
            ? Object.entries(occasionContext).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
            : '';

        // --- CACHE CHECK ---
        const recCacheSignature = [
            profile.gender || '',
            profile.estimatedSize || '',
            targetItems,
            styleVibe,
            detectedColors,
            preferences.occasion || '',
            preferences.priceRange || '',
            preferences.colors || '',
            keptItems,
            contextStr,
        ].join('|').toLowerCase().replace(/\s+/g, ' ');
        const recCacheKey = `stylist_recs_${cacheManager.generateFastHash(recCacheSignature)}`;
        const cachedRecs = await cacheManager.checkCache(recCacheKey);
        if (cachedRecs) {
            console.log(`[Stylist Agent] Cache HIT for recs (${profile.gender}, ${targetItems})`);
            return cachedRecs;
        }
        console.log(`[Stylist Agent] Cache MISS — generating fresh recommendations`);

        // Inject the full style guide as system context
        const styleGuideJson = JSON.stringify(masterStyleGuide.master_style_guide, null, 2);

        console.log(`[Stylist Agent] Generating recommendations for gender: ${profile.gender}`);
        const genderLabel = profile.gender?.toLowerCase() === 'male' ? "men's" : profile.gender?.toLowerCase() === 'female' ? "women's" : (profile.gender || "unisex");

        const prompt = `
**ROLE:** You are an elite Professional Stylist. You MUST follow the "Master Style Guide" below as your absolute source of truth.

**MASTER STYLE GUIDE (Source of Truth):**
${styleGuideJson}

**CRITICAL: GENDER CONTEXT**
The user is **${profile.gender}**. ALL recommendations MUST be gender-appropriate for a **${profile.gender}** person. Every item name and serp_query MUST use the prefix "${genderLabel}" (e.g., "${genderLabel} navy silk blouse"). Do NOT recommend clothing intended for a different gender.

**USER CONTEXT:**
- Gender: ${profile.gender} (IMPORTANT: all items must be ${genderLabel} clothing)
- Size: ${profile.estimatedSize}
${profile.height ? `- Height: ${profile.height}` : ''}
- Current Outfit (Kept Items): ${keptItems}
- Kept Item Structural Details: ${keptItemDetails}
- Looking For: ${targetItems}
- Style Vibe: ${styleVibe}
- Detected Palette: ${detectedColors}
- Occasion: ${preferences.occasion || 'General / Not specified'}
- Budget: ${preferences.priceRange || 'Not specified'}
${preferences.colors ? `- Preferred Colors: ${preferences.colors}` : ''}
${contextStr ? `
**OCCASION CONTEXT (use this to fine-tune your recommendations):**
${contextStr}
These details significantly affect appropriate clothing choices. For example:
- Cultural context affects acceptable colors/styles (e.g., avoid white at Chinese weddings, embrace red/gold)
- Role affects how prominent the outfit should be (bride vs guest)
- Season/weather affects fabric weight and coverage
- Venue affects formality and practicality (e.g., no stilettos for beach)
- Formality/dress code directly constrains outfit choices
Apply ALL relevant context when selecting items, colors, fabrics, and silhouettes.` : ''}

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
- For each item in the outfit, generate a **serp_query** — this is a Google Shopping search string. It MUST start with "${genderLabel}" followed by color + material + item type + key feature. Example: "${genderLabel} cream silk wide-leg trousers high-waisted".
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
                config: { responseMimeType: 'application/json', temperature: 0.2 }
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

        const result = {
            outfits: parsed.outfits,
            refined_constraints: parsed.refined_constraints || ""
        };

        // Cache the result (2 hour TTL)
        await cacheManager.setCache(recCacheKey, result, 7200);
        console.log(`[Stylist Agent] Cached recommendations (${profile.gender}, ${targetItems})`);

        return result;

    } catch (e) {
        console.error("Professional Stylist Agent Failed:", e);
        return {
            outfits: [],
            refined_constraints: "Agent error: " + (e instanceof Error ? e.message : String(e))
        };
    }
};

/**
 * SINGLE OUTFIT REFINER (Gemini 3 Pro)
 * Takes an existing outfit + user adjustment request and returns ONE updated outfit.
 * Used when the user picks a favorite and wants tweaks (e.g., "make the dress blue").
 */
export const refineSingleOutfit = async (
    baseOutfit: StylistOutfit,
    userAdjustment: string,
    profile: UserProfile,
    preferences: Preferences
): Promise<StylistOutfit> => {
    try {
        const styleGuideJson = JSON.stringify(masterStyleGuide.master_style_guide, null, 2);
        const baseOutfitJson = JSON.stringify(baseOutfit, null, 2);

        const genderLabel = profile.gender?.toLowerCase() === 'male' ? "men's" : profile.gender?.toLowerCase() === 'female' ? "women's" : (profile.gender || "unisex");

        const prompt = `
**ROLE:** You are an elite Professional Stylist refining a specific outfit based on the user's request.

**MASTER STYLE GUIDE (Source of Truth):**
${styleGuideJson}

**CRITICAL: GENDER CONTEXT**
The user is **${profile.gender}**. ALL recommendations MUST be gender-appropriate for a **${profile.gender}** person. Every serp_query MUST use "${genderLabel}" prefix.

**USER CONTEXT:**
- Gender: ${profile.gender} (all items must be ${genderLabel} clothing)
- Size: ${profile.estimatedSize}
${profile.height ? `- Height: ${profile.height}` : ''}
- Occasion: ${preferences.occasion || 'General / Not specified'}
- Budget: ${preferences.priceRange || 'Not specified'}

**EXISTING OUTFIT TO REFINE:**
${baseOutfitJson}

**USER'S ADJUSTMENT REQUEST:** "${userAdjustment}"

**YOUR TASK:**
Take the existing outfit above and apply the user's requested adjustment. Keep everything else the same unless the adjustment requires coordinating changes (e.g., changing the dress color may require updating accessories to complement).

Rules:
- Only modify what the user asked to change.
- If the user asks for a color change on one item, update that item's color_role, item_name, and serp_query accordingly. Optionally adjust 1-2 other items if needed for color harmony (cite the 60-30-10 Rule or similar).
- If the user asks to swap an item, replace it and adjust the serp_query.
- Keep the same outfit "name" style but you can slightly adjust it to reflect the change.
- Update the "logic" field to explain what was changed and why.
- Maintain the same number of items/categories.
- Generate proper serp_query strings for any modified items (must include "${genderLabel}" + color + material + item type + key feature).

**OUTPUT FORMAT (Strict JSON — single outfit object, NOT wrapped in an array):**
{
  "name": "Updated creative outfit name",
  "logic": "What was changed and why, citing style guide rules",
  "body_type_notes": "...",
  "recommendations": [
    {
      "category": "...",
      "item_name": "...",
      "serp_query": "...",
      "style_reason": "...",
      "color_role": "..."
    }
  ]
}
`;

        const response = await generateContentWithRetry(
            'gemini-3-pro-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        if (!parsed.name || !parsed.recommendations) {
            console.error("refineSingleOutfit: Invalid output", parsed);
            return baseOutfit; // Return original on failure
        }

        return parsed as StylistOutfit;

    } catch (e) {
        console.error("refineSingleOutfit failed:", e);
        return baseOutfit; // Return original on failure
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
3. Keep it concise (6-14 words). Do NOT include brand names unless specified.
4. Add "buy online" at the end of each query.
5. **BUDGET-AWARE QUERIES:** If the user has a budget, add a price hint to help SerpApi return affordable results.
   - If total budget is under $200, add "affordable" or "under $XX" (per-item estimate = total budget / number of categories).
   - If total budget is $200-$500, no price hint needed — mid-range results are default.
   - If total budget is over $500, you may add "designer" or "premium" to get higher-quality results.
   - Do NOT include the exact total budget — estimate a reasonable per-item price.
6. Do NOT include size in the query — SerpApi handles size filters separately.
7. Exclude: -pinterest -polyvore -lyst

**OUTPUT FORMAT (Strict JSON):**
{
  "queries": {
    "<category>": "<search query string>"
  }
}

Example (budget $100-$200 for 2 categories → ~$100 per item):
{
  "queries": {
    "bottom": "women's black high-waisted wide-leg trousers under $100 buy online -pinterest -polyvore -lyst",
    "footwear": "women's white chunky platform sneakers under $100 buy online -pinterest -polyvore -lyst"
  }
}

Example (budget $500+ or unspecified):
{
  "queries": {
    "bottom": "women's black high-waisted wide-leg trousers buy online -pinterest -polyvore -lyst",
    "footwear": "women's white designer chunky platform sneakers buy online -pinterest -polyvore -lyst"
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

        // --- BUDGET TOTAL CHECK ---
        // Parse user's budget range and verify the combined total across categories
        const parseBudgetPrice = (p: string) => parseFloat((p || '').replace(/[^0-9.]/g, '')) || 0;
        const budgetRangeStr = preferences.priceRange || '';
        const budgetParts = budgetRangeStr.replace(/\$/g, '').split('-');
        const budgetMin = parseFloat(budgetParts[0]) || 0;
        const budgetMax = parseFloat(budgetParts[1] || budgetParts[0]) || 0;

        if (budgetMax > 0) {
            // Calculate the cheapest possible total (cheapest item from each category)
            let cheapestTotal = 0;
            const categoryCount = pipelineResults.filter(r => r.topItems.length > 0).length;

            pipelineResults.forEach(res => {
                if (res.topItems.length === 0) return;
                const prices = res.topItems.map((item: any) => parseBudgetPrice(item.price)).filter((p: number) => p > 0);
                if (prices.length > 0) {
                    cheapestTotal += Math.min(...prices);
                }
            });

            logMessages.push(`[BudgetCheck] User budget: $${budgetMin}-$${budgetMax} | Cheapest combo total: $${cheapestTotal.toFixed(2)} across ${categoryCount} categories`);

            // If cheapest total exceeds budget, re-sort each category by price ascending
            // so the most affordable items appear first
            if (cheapestTotal > budgetMax * 1.1) { // 10% tolerance
                logMessages.push(`[BudgetCheck] Over budget — re-sorting items by price (ascending) to prioritize affordable options`);
                pipelineResults.forEach(res => {
                    if (res.topItems.length > 1) {
                        res.topItems.sort((a: any, b: any) => {
                            const priceA = parseBudgetPrice(a.price);
                            const priceB = parseBudgetPrice(b.price);
                            // Items with no price go last
                            if (priceA === 0 && priceB === 0) return 0;
                            if (priceA === 0) return 1;
                            if (priceB === 0) return -1;
                            return priceA - priceB;
                        });
                    }
                });
            } else {
                logMessages.push(`[BudgetCheck] Within budget — no re-sorting needed`);
            }

            // Per-category budget hint: if budget is specified and there are multiple categories,
            // calculate a fair per-category budget and log it
            if (categoryCount > 1) {
                const perCategoryBudget = budgetMax / categoryCount;
                logMessages.push(`[BudgetCheck] Suggested per-category budget: ~$${perCategoryBudget.toFixed(0)}`);
            }
        }

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
                        brand: item.brand || item.source || "Unknown",
                        price: item.price || "Check Site",
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
                    brand: item.brand || item.source || "Unknown",
                    price: item.price || "Check Site",
                    purchaseUrl: item.purchaseUrl,
                    validationNote: `Score: ${item.visualMatchScore}`,
                    fallbackSearchUrl: item.fallbackSearchUrl,
                    imageUrl: item.image || undefined
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
