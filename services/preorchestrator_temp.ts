
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences } from "../types";
import { generateContentWithRetry } from "./geminiService";

// REMOVED LOCAL AI INITIALIZATION - using geminiService's instance via retry wrapper


export const runDirectorPreAudit = async (
    profile: UserProfile, 
    preferences: Preferences, 
    procurementReport: string
): Promise<string> => {
    console.log(">> Director's Pre-Audit (Agent 2.5)...");
    
    // Parse categories for context if needed, or just use the string
    const categories = preferences.itemType; 

    const critique1Prompt = `
    **Role:** You are the Senior Fashion Director supervising a procurement run.
    **Task:** Provide a brief, actionable critique of the search results before they reach the Curator.

    **Context:** 
    - User Request: "${preferences.stylePreference}" items for ${preferences.occasion}
    - **Categories Requested:** ${categories}
    - Budget: ${preferences.priceRange}
    - User Size: ${profile.estimatedSize}

    **Input Data (Search Results in JSON):**
    ${procurementReport}

    **Your Assessment Framework:**

    **NEW: 1. Category Completeness Check** ✅
    \`\`\`
    For EACH category requested:
      - Were ≥7 items found? (YES/NO)
      - If NO: Is this acceptable or should we abort?
      - Are items well-distributed across price points?
    \`\`\`

    **2. Style Alignment Score (0-10):**
    Rate how well the found items match "${preferences.stylePreference}" aesthetic.
    - 8-10: Excellent matches
    - 5-7: Acceptable with minor deviations
    - 0-4: Poor alignment, needs re-search

    **NEW: 3. Stock Verification Audit** ✅
    \`\`\`
    Check items for "stockStatus" field.
      - Are there any items marked "uncertain"?
      - Red flag if >30% of items have "uncertain" status
    \`\`\`

    **4. Budget Reality Check:**
    - Are the prices realistic for ${preferences.priceRange}?

    **NEW: 5. URL Validation Check** ✅
    \`\`\`
    Scan "purchaseUrl" fields.
      - Do they look like valid product links?
      - Flag any items with generic search pages.
    \`\`\`

    **Output Format:**
    \`\`\`
    DIRECTOR'S PRE-AUDIT:

    Category Assessment: ✅
      - [Category]: [Count] items
      Overall: PROCEED / REQUEST RE-SEARCH

    Style Score: [X/10]
    Quick Take: [1 sentence on style alignment]

    Stock Verification: [General assessment of stock quality] ✅
    Concern Level: NONE / LOW / MEDIUM / HIGH

    URL Validation: [General assessment of link quality] ✅
    Concern Level: NONE / LOW / MEDIUM / HIGH

    Budget Status: Within Range | Exceeds Budget | Mixed

    **GUIDANCE TO CURATOR:**
    Priority Items: [List item names/IDs to prioritize]
    Discard: [List item names/IDs to exclude with reason]
    Special Note: [Any other instructions]
    \`\`\`

    **Decision Rules:**
    - If ANY category has <5 valid items: Verdict = "REQUEST RE-SEARCH"
    - If >20% items have stock uncertainty: Verdict = "PROCEED WITH CAUTION"
    - Otherwise: Verdict = "PROCEED"

    **Keep it concise: 6-8 sentences total.**
    `;

    const critique1Resp = await generateContentWithRetry(
        'gemini-3-flash-preview',
        {
            contents: { parts: [{ text: critique1Prompt }] }
        }
    );
    
    return critique1Resp.text || "Proceed with caution.";
};
