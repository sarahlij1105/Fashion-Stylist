import { Preferences } from "../types";
import { generateContentWithRetry } from "./geminiService";

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
