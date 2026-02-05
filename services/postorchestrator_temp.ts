import { GoogleGenAI } from "@google/genai";
import { Preferences, StylistResponse } from "../types";

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


export const runDirectorFinalVerdict = async (
    finalResponse: StylistResponse,
    preferences: Preferences
): Promise<string> => {
    console.log(">> Director's Final Verdict (Agent 3.5)...");
    
    // We pass the full response object to give the Director context on errors/status
    const recommendations = finalResponse.recommendations || [];
    const stockSummary = (finalResponse as any).stockValidationSummary || {};
    const urlSummary = (finalResponse as any).urlValidationSummary || {};
    const errorDetails = (finalResponse as any).errorDetails || null;

    const critique2Prompt = `
    **CHANGES: Multi-category assessment, stock/URL validation review, error handling evaluation**

    **Role:** You are the Senior Fashion Director.
    **Task:** Give a final quality seal to these recommendations before showing the user.

    **Data:** 
    ${JSON.stringify(finalResponse)}

    **Context:**
    - User Budget: ${preferences.priceRange}
    - User Style Request: ${preferences.stylePreference}
    - **Categories Requested:** ${preferences.itemType}  // **NEW**
    - Required Delivery: ${preferences.deadline}

    **Quality Checklist (Score each 0-10):**

    **NEW: 0. Response Completeness (NEW):**
    - Did we provide the requested number of categories?
    - If user asked for "tops, bottoms, shoes", does each outfit have all 3?
    - If fewer than 3 recommendations, is the reasoning valid?
    - Score: [X/10]

    **1. Budget Compliance:**
    - Are **total outfit prices** within ${preferences.priceRange}?  // **ENHANCED: Total, not per-item**
    - If over budget, is it justifiable?
    - Score: [X/10]

    **2. Style Cohesion:**
    - Do components within each outfit work together?
    - **NEW: Check cohesionScore in recommendations (should be >7/10)**
    - Do all outfits match "${preferences.stylePreference}" aesthetic?
    - Score: [X/10]

    **NEW: 3. Stock Verification Quality (NEW):** ✅
    - Check stockValidationSummary.verificationRate (should be 100%)
    - Are all components marked "Stock Status: IN STOCK"?
    - Any "uncertain" stock items? (RED FLAG)
    - Score: [X/10]

    **NEW: 4. URL Validation Quality (NEW):** ✅
    - Check urlValidationSummary.validationRate (should be 100%)
    - Are all purchaseUrls verified links?
    - Any generic/invalid link warnings? (RED FLAG)
    - Check urlMatchScore for each component (should be >80%)
    - Score: [X/10]

    **5. Size Availability:**
    - All components must have sizeAvailable: true
    - All must show "Size Confirmed ✅"
    - Score: [X/10]

    **NEW: 6. Multi-Category Completeness (if applicable):** ✅
    - If multiple categories requested, does each outfit include all categories?
    - Example: If user wants "tops, bottoms, shoes", check each recommendation has all 3
    - Score: [X/10] or N/A if single category

    **7. Delivery Feasibility:**
    - Can items realistically arrive by ${preferences.deadline}?
    - Score: [X/10]

    **NEW: 8. Error Handling (if status != "success"):** ✅
    - If status is "partial" or "insufficient_results":
      - Are explanations clear?
      - Are suggested actions helpful?
      - Is error messaging user-friendly?
    - Score: [X/10] or N/A if success

    **Output Format:**
    \`\`\`json
    {
      "qualityScores": {
        "completeness": number,  // **NEW**
        "budget": number,
        "style": number,
        "stockVerification": number,  // **NEW**
        "urlValidation": number,  // **NEW**
        "sizeAvailability": number,
        "multiCategoryCompleteness": number,  // **NEW**
        "deliveryFeasibility": number,
        "errorHandling": number,  // **NEW**
        "overallScore": number  // Average of applicable scores
      },
      "verdict": "Approved" | "Approved with Cautions" | "Needs Revision" | "Error - Cannot Proceed",  // **ENHANCED**
      "directorMessage": "String (User-facing message)",
      "internalNotes": "String (Dev team notes)",
      "recommendedActions": ["String"]  // Only if verdict != "Approved"
    }
    \`\`\`

    **Director's Message Format (User-Facing):**

    **If verdict = "Approved":**
    "${recommendations.length} ${preferences.itemType.includes(',') ? 'complete outfit combinations' : 'options'} found matching your ${preferences.stylePreference} style within your ${preferences.priceRange} budget. **All items verified in stock** with your size available. ${preferences.itemType.includes(',') ? 'Each outfit includes ' + preferences.itemType : ''}. [Optional: Highlight standout pick]."

    **If verdict = "Approved with Cautions":**
    "I found ${recommendations.length} ${recommendations.length === 3 ? 'excellent' : 'quality'} options for your ${preferences.stylePreference} request. [Mention caution: fewer than requested, partial category coverage, etc.]. Stock verified for all items. [Specific action if needed]."

    **If verdict = "Needs Revision":**
    "Encountered challenges: [specific issue]. Stock verification: ${stockSummary.verificationRate || 'N/A'}. URL validation: ${urlSummary.validationRate || 'N/A'}. Recommend: [specific action]."

    **If verdict = "Error - Cannot Proceed":**
    "Unable to create recommendations: [clear explanation of errorDetails]. Suggested next steps: ${errorDetails?.suggestedActions?.join(', ') || 'Adjust criteria'}. Would you like to adjust your criteria and try again?"

    **Critical Decision Rules:** ✅ **NEW**
    - **If stockValidationSummary.verificationRate < 100%:** Verdict = "Needs Revision"
    - **If urlValidationSummary.validationRate < 90%:** Verdict = "Needs Revision"
    - **If any component has sizeAvailable: false:** Verdict = "Needs Revision"
    - **If any component.stockStatus != "IN STOCK":** Verdict = "Needs Revision"
    - **If multiple categories requested but outfits incomplete:** Verdict = "Approved with Cautions"
    - **If status = "error" or "insufficient_results":** Verdict = "Error - Cannot Proceed"
    - **If recommendations.length < 2 AND not explained:** Verdict = "Needs Revision"
    - **If any cohesionScore < 6/10:** Verdict = "Approved with Cautions"

    **Keep message concise: 3-4 sentences maximum**
    **Use warm, professional tone**
    **Be honest about limitations**
    **Always acknowledge stock verification completion**
    `;

    const critique2Resp = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: critique2Prompt }] },
        config: { responseMimeType: 'application/json' }
    });
    
    // Parse the JSON critique and append nicely formatted text
    try {
        const critiqueJson = JSON.parse(critique2Resp.text || "{}");
        const { verdict, directorMessage, qualityScores } = critiqueJson;

        return `\n\n--- DIRECTOR'S FINAL VERDICT ---\n` +
            `Verdict: ${verdict || 'Reviewed'}\n` +
            `Overall Quality Score: ${qualityScores?.overallScore || 'N/A'}/10\n\n` +
            `"${directorMessage || 'Review complete.'}"`;
    } catch (e) {
        console.warn("Failed to parse Director's Final Verdict JSON", e);
        return `\n\n--- DIRECTOR'S VERDICT ---\n${critique2Resp.text}`;
    }
};