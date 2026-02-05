import { GoogleGenAI } from "@google/genai";
import { UserProfile, Preferences, StylistResponse, FashionPurpose } from "../types";
import { runProcurementAgent } from "./agent2_procurement_temp";
import { runCuratorAgent } from "./agent3_curator_temp";
import { runDirectorPreAudit } from "./preorchestrator_temp";
import { runDirectorFinalVerdict } from "./postorchestrator_temp";
import { cacheManager } from './cacheService';

const API_KEY = process.env.API_KEY || '';
// const ai = new GoogleGenAI({ apiKey: API_KEY }); // Unused in this file as agents manage their own calls

// Helper to extract mimeType and base64 data from a Data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
};

export const searchAndRecommend = async (
  profile: UserProfile,
  preferences: Preferences,
  additionalContext: string = ""
): Promise<StylistResponse> => {
  try {
    const imageParts = [];
    if (profile.userImageBase64) {
      const { mimeType, data } = parseDataUrl(profile.userImageBase64);
      imageParts.push({ inlineData: { mimeType, data } });
    }

    // --- CACHE MANAGER AGENT ---
    console.log(">> Agent 0: Cache Manager checking...");
    
    // Hash for profile photo
    const photoHash = cacheManager.generateFastHash(profile.userImageBase64);
    
    // Layer 1: Exact Match Check
    const exactKey = await cacheManager.generateCacheKey('exact', {
        preferences,
        profile,
        photoHash
    });
    
    const cachedExact = await cacheManager.checkCache(exactKey);

    if (cachedExact) {
        console.log(">> Cache Manager: HIT Layer 1 (Exact Match). Skipping all agents.");
        cachedExact.reflectionNotes = `[⚡ CACHE MANAGER: EXACT HIT] Retrieved results from cache (valid for 6h).\n\n` + cachedExact.reflectionNotes;
        return cachedExact;
    }

    // 1. Define Path Strategy
    const isPathA = preferences.purpose === FashionPurpose.MATCHING;
    const pathInstruction = isPathA 
        ? `**Path A (Inventory Mode):** The user is currently wearing: [${profile.keptItems?.join(', ') || 'Unknown'}]. Search for items: [${preferences.itemType}] that complement these.`
        : `**Path B (Mannequin Mode):** Ignore current clothes. Build a fresh look based on: ${preferences.itemType}.`;

    console.log("--- STARTING MULTI-AGENT SESSION (TEMP) ---");

    // 2. Run Procurement Agent (Check Layer 2 Cache first)
    let procurementReport = "";
    
    // Layer 2 key
    const searchKey = await cacheManager.generateCacheKey('search', {
        preferences,
        profile
    });
    
    const cachedSearch = await cacheManager.checkCache(searchKey);
    
    if (cachedSearch) {
        console.log(">> Cache Manager: HIT Layer 2 (Search Results). Skipping Procurement Agent.");
        procurementReport = cachedSearch + "\n\n[⚡ CACHE MANAGER: SEARCH HIT] Using cached search results.";
    } else {
        console.log(">> Agent 2 (Procurement): Searching (Cache Miss)...");
        procurementReport = await runProcurementAgent(profile, preferences, pathInstruction);
        // Save to Layer 2 Cache
        await cacheManager.setCache(searchKey, procurementReport);
        console.log(">> Agent 2 Complete. Results cached.");
    }

    // 2.5 DIRECTOR'S PRE-AUDIT (Critique 1) - using new module
    const procurementCritique = await runDirectorPreAudit(profile, preferences, procurementReport);
    console.log(">> Director's Guidance:", procurementCritique);

    // 3. Run Curator Agent (Agent 3)
    console.log(">> Agent 3 (Curator): Auditing...");
    const finalResponse = await runCuratorAgent(profile, preferences, procurementReport, procurementCritique, imageParts);
    console.log(">> Agent 3 Complete.");

    // 3.5 DIRECTOR'S FINAL VERDICT (Critique 2) - using new module
    // Passed the entire finalResponse to allow Director to see error flags and status
    const finalVerdict = await runDirectorFinalVerdict(finalResponse, preferences);
    finalResponse.reflectionNotes += finalVerdict;

    // Save final response to Layer 1 Cache
    await cacheManager.setCache(exactKey, finalResponse);

    return finalResponse;

  } catch (error) {
    console.error("Error in Orchestrator:", error);
    throw error;
  }
};