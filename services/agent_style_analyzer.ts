import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StyleAnalysisResult, FashionPurpose } from "../types";
import { fashionVocabularyDatabase } from "./fashionVocabulary";
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
    **Goal:** Extract specific visual attributes from user images to build a "Scoring Bracket".
    
    **Input Context:**
    - User Request: ${preferences.itemType}
    - Example Images: [Attached Images]

    **CRITICAL RULE: AGGREGATE, DON'T FILTER**
    - You may see multiple images. 
    - **Capture ALL distinct features** present across the images.
    - If Image 1 has "Short Sleeves" and Image 2 has "Long Sleeves", record **BOTH** in the output array.
    - Do not force a "common thread" if it excludes valid features from one of the examples.
    - Treat these as "Acceptable Variants".

    **STRICT VOCABULARY ENFORCEMENT:**
    You have been provided with a specific "Fashion Vocabulary Database" for the requested categories.
    **YOU MUST USE EXACT TERMS FROM THIS DATABASE** when describing attributes like necklines, sleeves, materials, patterns, etc.

    **Vocabulary Database (Contextual Subset):**
    \`\`\`json
    ${vocabularyJson}
    \`\`\`

    **Your Tasks:**

    **STEP 1: The "Bracket" Extraction (Structured Data)**
    For every requested category, scan ALL examples and build a list of observed features.
    Return attributes as ARRAYS of strings to accommodate multiple valid styles.
    
    **STEP 2: Visual Anchors (Scoring Tags)**
    Extract specific visual terms to be used for SCORING matches later.

    **Output Schema (Produce strictly valid JSON):**
    \`\`\`json
    {
      "analysis_status": "success",
      "category_analysis": {
        "tops": {
          "detected_in_examples": true, 
          "scoring_bracket": {
            // ARRAYS of observed values.
            "type": ["String (e.g. blouse)", "String (e.g. tank)"],
            "neckline": ["String", "String"],
            "sleeves": ["String", "String"],
            "material": ["String", "String"],
            "pattern": ["String"],
            "detail": ["String"],
            "dominant_colors": ["Hex or Color Name"]
          },
          "visual_anchors": [
            "String (High-value feature 1)",
            "String (High-value feature 2)"
          ]
        }
      },
      "search_optimization": {
        "primary_search_string": "String (General style query)",
        "vibe_tags": ["String", "String"]
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