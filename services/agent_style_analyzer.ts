import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult, FashionPurpose } from "../types";
import { fashionVocabularyDatabase } from "./fashionVocabulary";
import { fashionStyleLibrary } from "./fashionStyleLibrary";
import { generateContentWithRetry } from "./geminiService";

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

    const prompt = `
    AGENT: Style & Detail Analyzer
    
    **Role:** You are an expert Fashion Taxonomist.
    **Task:** Analyze the user's uploaded "Ideal Style" images to extract structured data for a personal stylist app.
    
    **Input Context:**
    - User Request (Target Items): ${preferences.itemType}
    - Example Images: [Attached Images]
    
    **Reference Libraries:**
    1. **Fashion Style Library (Vibes):** Use this to identify the *overall aesthetic*.
    ${styleLibraryJson}
    
    2. **Fashion Vocabulary (Details):** Use this to identify *specific structural details* for the requested items.
    ${vocabularyJson}

    **Your Instructions:**
    
    **STEP 1: Style Identification (OR Logic)**
    - Look at ALL images. 
    - Identify the **Top 1-3** styles from the provided 'Fashion Style Library' that best match the images.
    - It is okay if different images match different styles (e.g., one image is 'Boho' and another is 'Minimalist'). 
    - Return the ID, Name, and a short reason for each match.

    **STEP 2: Color Detection**
    - Extract the *dominant* colors of the *requested items* in the photos.
    - Ignore background colors or colors of non-requested items.
    - Return a simple list of color names (e.g., "Navy Blue", "Cream", "Burgundy").

    **STEP 3: Structural Detail Extraction**
    - For each requested category (e.g., "dresses", "shoes"), scan the images for matching terms in the 'Fashion Vocabulary'.
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
    return {
        analysisStatus: parsed.analysis_status || 'success',
        
        // NEW FIELDS FOR CONFIRMATION FLOW
        suggestedStyles: parsed.suggested_styles,
        detectedColors: parsed.detected_colors,
        detailDataset: parsed.detail_dataset,

        // Legacy/Fallback mapping for backward compatibility (Agent 2/3 might still look for this)
        searchEnhancement: {
            unifiedKeywords: parsed.suggested_styles?.map((s: any) => s.name),
            byCategory: parsed.detail_dataset, 
            searchQuerySuggestion: parsed.suggested_styles?.[0]?.name 
        },
        userFacingMessage: `Analyzed style: ${parsed.suggested_styles?.map((s: any) => s.name).join(', ') || 'Custom Style'}`
    };

  } catch (error) {
    console.error("Error in Style Analyzer:", error);
    return { analysisStatus: "error" };
  }
};