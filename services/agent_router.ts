import { GoogleGenAI } from "@google/genai";
import { Preferences } from "../types";
import { generateContentWithRetry } from "./geminiService";

/**
 * AGENT: Intent Router & Refinement
 * Analyzes user text input to extract structured preferences.
 */
export const analyzeUserIntent = async (
    query: string
): Promise<Partial<Preferences>> => {
    try {
        const prompt = `
        **AGENT: Intent Router**
        **Task:** Analyze the user's shopping request and extract structured preferences.

        **User Input:** "${query}"

        **Extraction Rules:**
        - **Item Type:** Extract clothing categories (e.g. "Dress", "Shoes", "Top"). Map to standard types.
        - **Occasion:** Extract event context (e.g. "Wedding", "Work", "Date Night").
        - **Style:** Extract aesthetic keywords (e.g. "Boho", "Minimalist", "Sexy").
        - **Colors:** Extract color preferences.
        - **Budget:** Extract price constraints (e.g. "under $200"). Convert to range string "$0 - $200".

        **Output Schema (Strict JSON):**
        \`\`\`json
        {
            "itemType": "String (comma separated)",
            "occasion": "String",
            "stylePreference": "String",
            "colors": "String",
            "priceRange": "String (e.g. '$50 - $200')"
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

        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Intent Router Failed:", e);
        return {};
    }
};

/**
 * AGENT: Refinement Specialist
 * Updates existing preferences based on user feedback.
 */
export const refinePreferences = async (
    current: Preferences,
    feedback: string
): Promise<Preferences> => {
    try {
        const prompt = `
        **AGENT: Refinement Specialist**
        **Task:** Update the current shopping preferences based on user feedback.

        **Current Preferences:**
        ${JSON.stringify(current)}

        **User Feedback:** "${feedback}"

        **Instructions:**
        - Modify ONLY the fields mentioned in the feedback.
        - Keep other fields unchanged.
        - If user says "cheaper", lower the price range.
        - If user says "change style to boho", update stylePreference.

        **Output Schema (Strict JSON):**
        Return the FULL updated Preferences object.
        `;

        const response = await generateContentWithRetry(
            'gemini-3-flash-preview',
            {
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }
        );

        const updates = JSON.parse(response.text || "{}");
        return { ...current, ...updates };
    } catch (e) {
        console.error("Refinement Agent Failed:", e);
        return current;
    }
};
