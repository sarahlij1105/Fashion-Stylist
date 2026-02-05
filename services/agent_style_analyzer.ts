import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult, FashionPurpose } from "../types";
import { fashionVocabularyDatabase } from "./fashionVocabulary";

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


const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
};

/**
 * Filter the massive vocabulary database to only include what's relevant for this request.
 * Reduces context usage and distraction.
 */
const getContextualVocabulary = (requestedItemTypes: string) => {
    const requested = requestedItemTypes.toLowerCase().split(',').map(s => s.trim());
    const vocabularyContext: any = {};
    
    // Map of user terms to database keys (simple fuzzy matching)
    const termMapping: Record<string, string> = {
        'top': 'tops', 'shirt': 'tops', 'blouse': 'tops',
        'bottom': 'bottoms', 'pant': 'bottoms', 'jeans': 'bottoms', 'skirt': 'bottoms',
        'dress': 'dresses', 'gown': 'dresses',
        'shoe': 'shoes', 'boot': 'shoes', 'heel': 'shoes',
        'coat': 'outerwear', 'jacket': 'outerwear', 'blazer': 'outerwear',
        'bag': 'handbags', 'purse': 'handbags',
        'jewelry': 'jewelry', 'necklace': 'jewelry', 'ring': 'jewelry',
        'hair': 'hair_accessories'
    };

    fashionVocabularyDatabase.fashion_vocabulary_database.categories.forEach(cat => {
        // Check if this category is requested
        const isRequested = requested.some(req => 
            cat.name.includes(req) || 
            (termMapping[req] && cat.name === termMapping[req])
        );

        if (isRequested) {
            vocabularyContext[cat.name] = cat.subcategories;
        }
    });

    return vocabularyContext;
};

export const runStyleExampleAnalyzer = async (
  profile: UserProfile,
  preferences: Preferences
): Promise<StyleAnalysisResult> => {
  // If no images, return skipped status
  if (!profile.idealStyleImages || profile.idealStyleImages.length === 0) {
    return {
      analysisStatus: "skipped"
    };
  }

  try {
    const vocabulary = getContextualVocabulary(preferences.itemType);
    const vocabularyJson = JSON.stringify(vocabulary, null, 2);

    // Convert all example images to inline parts
    const imageParts = profile.idealStyleImages.map(img => {
      const { mimeType, data } = parseDataUrl(img);
      return { inlineData: { mimeType, data } };
    });

    const prompt = `
AGENT: Style Example Analyzer (Visual Attribute Extraction)
Trigger: User uploaded "ideal style example" images.
Runs: After Vision Analyst, before Procurement Specialist.

**Role:** You are an expert Fashion Taxonomist and Style Analyzer.
**Goal:** Extract specific visual attributes from user images, strictly filtering by the User's Requested Categories.

**Input Context:**
- User Request: ${preferences.itemType}
- Example Images: [Attached Images]

**CRITICAL RULE: SELECTIVE ATTENTION**
You will see complete outfits in the example images. You must IGNORE items that are not in the User Request.
- IF User wants "Tops" -> Analyze the shirt/blouse. IGNORE the pants, shoes, and bag.
- IF User wants "Shoes" -> Analyze the footwear. IGNORE the clothes.

**STRICT VOCABULARY ENFORCEMENT:**
You have been provided with a specific "Fashion Vocabulary Database" for the requested categories.
**YOU MUST USE EXACT TERMS FROM THIS DATABASE** when describing attributes like necklines, sleeves, materials, patterns, etc.
Do not invent terms like "low cut" if "plunging" is in the database. Use the database terms to ensure high-quality search results.

**Vocabulary Database (Contextual Subset):**
\`\`\`json
${vocabularyJson}
\`\`\`

**Your Tasks:**

**STEP 1: The "Tech Pack" Extraction (Structured Data)**
For every requested category, scan the examples and build a "Consolidated Spec Sheet" using the Vocabulary Database keys.
If the user uploaded multiple images, find the *common thread* between them.
If a feature is not visible or applicable, omit it or use null.

**STEP 2: Visual Anchors (Search Keywords)**
Extract specific visual terms that will help a search engine find these items. Combine terms from the database (e.g. "Silk Cowl Neck", "Bishop Sleeve").

**STEP 3: The "Vibe" Check**
Describe the overall aesthetic *only* as it applies to the requested items.

**Output Schema (Produce strictly valid JSON):**
\`\`\`json
{
  "analysis_status": "success",
  "category_analysis": {
    // Dynamic Key: Use the actual requested category name matched from database (e.g., "tops", "bottoms")
    "tops": {
      "detected_in_examples": true, 
      "common_attributes": {
        // FILL THESE WITH EXACT TERMS FROM VOCABULARY DATABASE
        "type": "String (e.g., blouse, tank top)",
        "neckline": "String (e.g., cowl neck)",
        "sleeves": "String (e.g., bishop sleeve)",
        "material": "String (e.g., silk, cotton)",
        "pattern": "String (e.g., floral, solid)",
        "detail": "String (e.g., ruffles)",
        "dominant_colors": ["Hex or Color Name"]
      },
      "visual_anchors": [
        "String (High-value search keyword 1)",
        "String (High-value search keyword 2)"
      ],
      "negative_anchors": [
        "String (Features to EXCLUDE)" 
      ]
    }
    // Repeat for other requested categories
  },
  "search_optimization": {
    "primary_search_string": "String (Combined search query using technical vocabulary)",
    "vibe_tags": ["String (e.g., Minimalist)", "String (e.g., Y2K)"]
  }
}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...imageParts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    let text = response.text || "{}";
    
    // Clean up Markdown code blocks if present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    } else {
        text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Style Analyzer JSON Error", e);
      return { analysisStatus: "error" };
    }

    // Map the LLM's new schema to the App's expected StyleAnalysisResult structure
    return {
        analysisStatus: parsed.analysis_status || 'success',
        // Store the raw complex data in categorySpecificAnalysis
        categorySpecificAnalysis: parsed.category_analysis,
        // Map to searchEnhancement for Agent 2
        searchEnhancement: {
            unifiedKeywords: parsed.search_optimization?.vibe_tags,
            // Pass the category analysis object directly, Agent 2 will parse keys dynamically
            byCategory: parsed.category_analysis,
            // Also store the primary string
            searchQuerySuggestion: parsed.search_optimization?.primary_search_string
        },
        userFacingMessage: `Analyzed style: ${parsed.search_optimization?.vibe_tags?.join(', ') || 'Custom Style'}`
    };

  } catch (error) {
    console.error("Error in Style Analyzer:", error);
    return { analysisStatus: "error" };
  }
};