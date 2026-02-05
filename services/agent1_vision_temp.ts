import { GoogleGenAI } from "@google/genai";
import { UserProfile } from "../types";

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

export const analyzeUserPhoto = async (dataUrl: string): Promise<Partial<UserProfile>> => {
  try {
    const { mimeType, data } = parseDataUrl(dataUrl);

    const prompt = `
Analyze this image for the "Elite Forensic Stylist" app. 

**Your Tasks:**
1. **Estimate User Attributes:**
   - Gender (M/F/Non-binary/Unknown)
   - Size: Use visual cues (body proportions, existing garment fit). Output standard sizes: XS, S, M, L, XL, XXL
   - Current Style: Classify as one of: Casual, Formal, Streetwear, Boho, Minimalist, Sporty, Vintage, Other
   **NEW: Provide confidence score (0-100%) for each estimate**

2. **Identify Kept Items:**
   - List specific visible clothing items (e.g., "Light Blue Denim Jeans", "White Cotton T-Shirt", "Black Leather Jacket")
   - Include color, material (if visible), and garment type
   **NEW: Mark items as "definite" or "uncertain" based on visibility**

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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "{}";
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Vision JSON", e);
        return {};
    }

    if (parsed.status === 'error') {
        console.warn("Vision Analysis Error:", parsed.errorMessage);
        return {
             gender: 'Female', 
             estimatedSize: 'M',
             currentStyle: '',
             keptItems: []
        };
    }
    
    // Map complex JSON back to flat UserProfile structure
    return {
        gender: parsed.gender?.value || 'Female',
        estimatedSize: parsed.estimatedSize?.value || 'M',
        currentStyle: parsed.currentStyle?.value || '',
        keptItems: parsed.keptItems ? parsed.keptItems.map((k: any) => k.item) : []
    };

  } catch (error) {
    console.error("Error analyzing photo:", error);
    throw error;
  }
};