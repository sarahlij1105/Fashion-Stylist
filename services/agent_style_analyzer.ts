import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult, FashionPurpose } from "../types";
import { fashionVocabularyDatabase } from "./fashionVocabulary";
import { fashionStyleLibrary } from "./fashionStyleLibrary";
import { generateContentWithRetry } from "./geminiService";
import { cacheManager } from "./cacheService";

// REMOVED LOCAL AI INITIALIZATION - using geminiService's instance via retry wrapper


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
    const requested = requestedItemTypes.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const vocabularyContext: any = {};
    
    // If no specific items requested, include ALL categories (auto-detect mode)
    const includeAll = requested.length === 0;
    
    // Map of user terms to database keys (simple fuzzy matching)
    const termMapping: Record<string, string> = {
        'top': 'tops', 'shirt': 'tops', 'blouse': 'tops',
        'bottom': 'bottoms', 'pant': 'bottoms', 'jeans': 'bottoms', 'skirt': 'bottoms',
        'dress': 'dresses', 'gown': 'dresses',
        'shoe': 'footwear', 'boot': 'footwear', 'heel': 'footwear', 'sneaker': 'footwear',
        'coat': 'outerwear', 'jacket': 'outerwear', 'blazer': 'outerwear',
        'bag': 'handbags', 'purse': 'handbags',
        'jewelry': 'jewelry', 'necklace': 'jewelry', 'ring': 'jewelry',
        'hair': 'hair_accessories'
    };

    fashionVocabularyDatabase.fashion_vocabulary_database.categories.forEach(cat => {
        // Check if this category is requested (or include all for auto-detect)
        const isRequested = includeAll || requested.some(req => 
            cat.name.includes(req) || 
            (termMapping[req] && cat.name === termMapping[req])
        );

        if (isRequested) {
            // v3.0 uses basics + details; fallback to subcategories for older versions
            vocabularyContext[cat.name] = (cat as any).basics || (cat as any).subcategories || {};
            if ((cat as any).details) {
                vocabularyContext[cat.name + '_details'] = (cat as any).details;
            }
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
    // --- CACHE CHECK ---
    // Create a deterministic hash based on images and request items
    // Use the first image + itemType to create a fast signature
    const imagesSignature = profile.idealStyleImages.map(img => img.slice(-50)).join('_'); // Last 50 chars of each base64
    const cacheKey = `style_analysis_${await cacheManager.generateFastHash(imagesSignature + preferences.itemType)}`;
    
    const cachedResult = await cacheManager.checkCache(cacheKey);
    if (cachedResult) {
        console.log(">> Agent 1.5 (Style Analyzer): Cache Hit");
        return cachedResult;
    }

    const vocabulary = getContextualVocabulary(preferences.itemType);
    const vocabularyJson = JSON.stringify(vocabulary, null, 2);
    
    // Summarize Style Library to reduce token count (just names and IDs for initial match)
    // The full definition is too large, so we provide a summary and ask LLM to map.
    const styleLibrarySummary = fashionStyleLibrary.fashion_style_guide.styles.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        key_elements: {
            colors: s.elements.color_palette.approach || s.elements.color_palette.primary,
            fabrics: s.elements.materials_and_fabrics.natural || s.elements.materials_and_fabrics.luxury,
            prints: s.elements.patterns_and_prints.preferred || s.elements.patterns_and_prints.classic
        }
    }));
    const styleLibraryJson = JSON.stringify(styleLibrarySummary, null, 2);

    // Convert all example images to inline parts
    const imageParts = profile.idealStyleImages.map(img => {
      const { mimeType, data } = parseDataUrl(img);
      return { inlineData: { mimeType, data } };
    });

    const hasRequestedItems = preferences.itemType && preferences.itemType.trim().length > 0;

    const prompt = `
    AGENT: Style & Detail Analyzer
    
    **Role:** You are an expert Fashion Taxonomist.
    **Task:** Analyze the user's uploaded "Ideal Style" images to extract structured data for a personal stylist app.
    
    **Input Context:**
    ${hasRequestedItems ? `- User Request (Target Items): ${preferences.itemType}` : '- User Request: Not specified (auto-detect from images)'}
    - Example Images: [Attached Images]
    
    **Reference Libraries:**
    1. **Fashion Style Library (Vibes):** Use this to identify the *overall aesthetic*.
    ${styleLibraryJson}
    
    2. **Fashion Vocabulary (Details):** Use this to identify *specific structural details*.
    ${vocabularyJson}

    **Your Instructions:**
    
    **STEP 1: Style Identification (OR Logic)**
    - Look at ALL images. 
    - Identify the **Top 1-3** styles from the provided 'Fashion Style Library' that best match the images.
    - It is okay if different images match different styles (e.g., one image is 'Boho' and another is 'Minimalist'). 
    - Return the ID, Name, and a short reason for each match.

    **STEP 2: Color Detection**
    ${hasRequestedItems 
        ? `- Extract the *dominant* colors ONLY from the following items: ${preferences.itemType}. 
    - IGNORE the colors of any other clothing items in the photo that are NOT in the list above.`
        : `- Extract the *dominant* colors of the clothing items in the photos.`}
    - Ignore background colors, skin tones, and non-clothing elements.
    - Return a simple list of color names (e.g., "Navy Blue", "Cream", "Burgundy").

    **STEP 3: Component Detection**
    - Identify ALL clothing items visible in the images.
    - For EACH item, return BOTH the **category** and the specific **type** from the Fashion Vocabulary (category → basics → types).
    - Valid categories: "tops", "bottoms", "dresses", "outerwear", "footwear", "handbags", "jewelry", "hair_accessories"
    - The "type" MUST be a specific type from the Fashion Vocabulary's "basics.types" list for that category.
    - For example, if the photo shows a tank top, skinny jeans, ankle boots, and a crossbody bag, return:
      [{"category": "tops", "type": "tank top"}, {"category": "bottoms", "type": "skinny jeans"}, {"category": "footwear", "type": "ankle boots"}, {"category": "handbags", "type": "crossbody bag"}]
    - Look across ALL uploaded images and combine the results.

    **STEP 4: Structural Detail Extraction**
    - For each detected component category, scan the images for matching terms in the 'Fashion Vocabulary'.
    - Extract specific attributes like: necklines, sleeves, materials, patterns, heel_types, etc.
    - **CRITICAL:** Only use terms that exist in the provided Vocabulary JSON.

    **Output Schema (Strict JSON):**
    \`\`\`json
    {
      "analysis_status": "success",
      "suggested_styles": [
        {
          "id": number,
          "name": "String (Exact match from Library)",
          "description": "String (Copy from Library)",
          "match_reason": "String (e.g. 'Image 1 features tiered skirts and earth tones.')"
        }
      ],
      "detected_colors": ["String", "String"],
      "detected_components": [
        {"category": "tops", "type": "tank top"},
        {"category": "bottoms", "type": "skinny jeans"},
        {"category": "footwear", "type": "ankle boots"}
      ],
      "detail_dataset": {
        "category_name (e.g. tops)": {
           "necklines": ["String"],
           "sleeves": ["String"],
           "materials": ["String"],
           "patterns": ["String"]
        }
      }
    }
    \`\`\`
    `;

    const response = await generateContentWithRetry(
      'gemini-3-flash-preview',
      {
        contents: {
          parts: [
            ...imageParts,
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      }
    );

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
    const result: StyleAnalysisResult = {
        analysisStatus: parsed.analysis_status || 'success',
        
        // NEW FIELDS FOR CONFIRMATION FLOW
        suggestedStyles: parsed.suggested_styles,
        detectedColors: parsed.detected_colors,
        detectedComponents: parsed.detected_components || [],
        detailDataset: parsed.detail_dataset,

        // Legacy/Fallback mapping for backward compatibility (Agent 2/3 might still look for this)
        searchEnhancement: {
            unifiedKeywords: parsed.suggested_styles?.map((s: any) => s.name),
            byCategory: parsed.detail_dataset, 
            searchQuerySuggestion: parsed.suggested_styles?.[0]?.name 
        },
        userFacingMessage: `Analyzed style: ${parsed.suggested_styles?.map((s: any) => s.name).join(', ') || 'Custom Style'}`
    };

    // Cache the successful result
    await cacheManager.setCache(cacheKey, result, 3600); // 1 hour TTL for style analysis

    return result;

  } catch (error) {
    console.error("Error in Style Analyzer:", error);
    return { analysisStatus: "error" };
  }
};