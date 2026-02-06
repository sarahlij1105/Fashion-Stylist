
import { UserProfile, Preferences, StyleAnalysisResult } from "../types";

// Browser-compatible SHA-256 hashing
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface CacheEntry {
  data: any;
  expiry: number; // timestamp in ms
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly STORAGE_PREFIX = 'gemini_stylist_cache_';

  /**
   * Helper to generate a fast hash for large strings (like photos)
   * Samples start, middle, and end to avoid processing MBs of data.
   */
  generateFastHash(str: string | null): string {
    if (!str) return 'no_data';
    const len = str.length;
    if (len < 1000) {
        // Simple distinct hash for short strings
        let hash = 0;
        for (let i = 0; i < len; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    // Sampling for large strings
    const sample = str.substring(0, 200) + 
                   str.substring(Math.floor(len/2), Math.floor(len/2)+200) + 
                   str.substring(len-200) + 
                   len;
    
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
        const char = sample.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate deterministic cache key
   * CRITICAL: Sorts all arrays/objects to ensure same hash for same data
   */
  async generateCacheKey(
    layer: 'exact' | 'search',
    data: {
      userId?: string;
      preferences: Preferences;
      profile?: UserProfile;
      styleAnalysis?: StyleAnalysisResult;
      photoHash?: string;
      analysisHash?: number; // New field for analysis fingerprint
    }
  ): Promise<string> {
    // Sort keys deterministically
    const sortedData: any = {};
    
    if (layer === 'exact') {
      // Layer 1: Everything matters
      sortedData.userId = data.userId;
      sortedData.photoHash = data.photoHash;
      sortedData.analysisHash = data.analysisHash; // Include analysis hash
      sortedData.gender = data.profile?.gender;
      sortedData.size = data.profile?.estimatedSize;
      sortedData.itemType = data.preferences.itemType.split(',').map(s => s.trim()).sort().join(',');
      sortedData.occasion = data.preferences.occasion;
      sortedData.style = data.preferences.stylePreference;
      sortedData.colors = data.preferences.colors.split(',').map(s => s.trim()).sort().join(',');
      sortedData.priceRange = data.preferences.priceRange;
      // sortedData.deadline = data.preferences.deadline;
    } else {
      // Layer 2: Search criteria only (no user/photo)
      sortedData.itemType = data.preferences.itemType.split(',').map(s => s.trim()).sort().join(',');
      sortedData.style = data.preferences.stylePreference;
      sortedData.colors = data.preferences.colors.split(',').map(s => s.trim()).sort().join(',');
      sortedData.priceRange = data.preferences.priceRange;
      sortedData.size = data.profile?.estimatedSize;
      // Include style analysis fingerprint if available
      if (data.styleAnalysis?.searchEnhancement?.unifiedKeywords) {
        sortedData.styleFingerprint = data.styleAnalysis.searchEnhancement.unifiedKeywords
          .slice(0, 5)
          .sort()
          .join(',');
      }
    }
    
    // Create deterministic hash
    const jsonString = JSON.stringify(sortedData, Object.keys(sortedData).sort());
    const hash = await sha256(jsonString);
    const shortHash = hash.substring(0, 16);
    
    return `${layer}_${shortHash}`;
  }
  
  /**
   * Check if cache exists in Memory or LocalStorage
   */
  async checkCache(cacheKey: string): Promise<any | null> {
    try {
      const now = Date.now();

      // 1. Check Memory (Fastest)
      if (this.memoryCache.has(cacheKey)) {
          const entry = this.memoryCache.get(cacheKey)!;
          if (entry.expiry > now) {
              console.log(`[Cache] HIT (Memory) - ${cacheKey}`);
              return entry.data;
          } else {
              this.memoryCache.delete(cacheKey);
          }
      }

      // 2. Check LocalStorage (Persistence)
      const storageKey = this.STORAGE_PREFIX + cacheKey;
      const storedItem = localStorage.getItem(storageKey);
      
      if (storedItem) {
          try {
              const entry: CacheEntry = JSON.parse(storedItem);
              if (entry.expiry > now) {
                  // Rehydrate memory cache for future access
                  this.memoryCache.set(cacheKey, entry);
                  console.log(`[Cache] HIT (Storage) - ${cacheKey}`);
                  return entry.data;
              } else {
                  console.log(`[Cache] EXPIRED (Storage) - ${cacheKey}`);
                  localStorage.removeItem(storageKey);
              }
          } catch (parseError) {
              console.warn(`[Cache] CORRUPT data for ${cacheKey}`, parseError);
              localStorage.removeItem(storageKey);
          }
      }

      return null;
    } catch (error) {
      console.error(`[Cache] READ ERROR ${cacheKey}:`, error);
      return null;
    }
  }
  
  /**
   * Store data in Memory and LocalStorage
   */
  async setCache(
    cacheKey: string,
    data: any,
    ttlSeconds: number = 21600 // 6 hours default
  ): Promise<void> {
    try {
      const expiry = Date.now() + (ttlSeconds * 1000);
      const entry: CacheEntry = { data, expiry };

      // 1. Save to Memory
      this.memoryCache.set(cacheKey, entry);

      // 2. Save to LocalStorage
      const storageKey = this.STORAGE_PREFIX + cacheKey;
      try {
          // Attempt to save to LocalStorage
          localStorage.setItem(storageKey, JSON.stringify(entry));
          console.log(`[Cache] STORED ${cacheKey} (TTL: ${ttlSeconds}s)`);
      } catch (e) {
          // Handle QuotaExceededError or other storage issues gracefully
          console.warn('[Cache] LocalStorage full or unavailable. Using session memory only.', e);
      }
      
    } catch (error) {
      console.error(`[Cache] WRITE ERROR ${cacheKey}:`, error);
      // Non-fatal, just won't be cached
    }
  }

  /**
   * Utility to clear app cache if needed
   */
  clearAll() {
      this.memoryCache.clear();
      Object.keys(localStorage).forEach(key => {
          if (key.startsWith(this.STORAGE_PREFIX)) {
              localStorage.removeItem(key);
          }
      });
      console.log("[Cache] CLEARED ALL");
  }
}

export const cacheManager = new CacheManager();
