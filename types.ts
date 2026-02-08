export enum AppStep {
  GOAL_SELECTION = 'GOAL_SELECTION',
  PROFILE_MANUAL = 'PROFILE_MANUAL', // New step for manual profile entry (no photo)
  UPLOAD_PHOTO = 'UPLOAD_PHOTO',
  ITEM_TYPE = 'ITEM_TYPE',
  CONFIRMATION = 'CONFIRMATION', // New step for verifying AI analysis
  PREFERENCES_DASHBOARD = 'PREFERENCES_DASHBOARD', // Replaces OCCASION, STYLE, COLOR, PRICE_RANGE
  OCCASION = 'OCCASION', // Deprecated but kept for type safety if needed
  STYLE = 'STYLE', // Deprecated
  COLOR = 'COLOR', // Deprecated
  PRICE_RANGE = 'PRICE_RANGE', // Deprecated
  // DELIVERY step removed
  IDEAL_STYLE = 'IDEAL_STYLE',
  SEARCHING = 'SEARCHING',
  RESULTS = 'RESULTS',
  // New Card 1 Flow Steps
  CARD1_DETAILS = 'CARD1_DETAILS',
  CARD1_PROFILE = 'CARD1_PROFILE',
  CARD1_CONFIRM = 'CARD1_CONFIRM',
  // New Card 2 Flow Steps
  CARD2_DETAILS = 'CARD2_DETAILS',
  CARD2_RECOMMENDATION = 'CARD2_RECOMMENDATION',
  // Profile Flow
  PROFILE_SETUP = 'PROFILE_SETUP',
  PROFILE_VIEW = 'PROFILE_VIEW',
  // Chat Refinement Flow (Card 1)
  CARD1_CHAT = 'CARD1_CHAT',
  // Card 3 Flow Steps
  CARD3_OCCASION = 'CARD3_OCCASION',
  CARD3_CHAT = 'CARD3_CHAT',
}

// Structured search criteria for the conversational refinement flow
export interface SearchCriteria {
  style: string | null;         // e.g. "Minimalist", "Boho"
  colors: string[];             // e.g. ["White", "Navy"]
  includedItems: string[];      // SPECIFIC items e.g. ["skirt", "silk camisole"] - used as search terms
  itemCategories: string[];     // BROAD categories e.g. ["bottoms", "tops"] - for pipeline routing
  excludedMaterials: string[];  // e.g. ["polyester", "nylon"]
  occasion: string | null;      // e.g. "Date night", "Office"
  priceRange: string | null;    // e.g. "$50-$200"
  additionalNotes: string;      // Free-form notes from the conversation
}

export interface RefinementChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  criteriaSnapshot?: Partial<SearchCriteria>; // What changed in this turn
}

// Professional Stylist Agent output types
export interface StylistOutfitItem {
  category: string;        // e.g. "bottom", "top", "footwear"
  item_name: string;       // e.g. "Cream Silk Wide-Leg Trousers"
  serp_query: string;      // e.g. "women's cream silk wide-leg trousers high-waisted"
  style_reason: string;    // e.g. "Hard-Soft rule: fluid fabric with structured blazer"
  color_role?: string;     // e.g. "Navy Blue", "Cream", "Navy Blue with Yellow Patterns"
}

export interface StylistOutfit {
  name: string;            // e.g. "The NYFW Minimalist"
  logic: string;           // Detailed reasoning citing specific style guide rules
  body_type_notes?: string; // How silhouette was balanced
  recommendations: StylistOutfitItem[];
  heroImageBase64?: string; // AI-generated flat-lay hero image for this outfit
}

export interface ProfessionalStylistResponse {
  outfits: StylistOutfit[];
  refined_constraints?: string;
}

export enum FashionPurpose {
  MATCHING = 'Find Matching Components',
  NEW_OUTFIT = 'Design a Whole New Outfit',
}

export interface UserProfile {
  gender: string;
  age?: string; // e.g. "25-30"
  height?: string; // e.g. "165 cm" or "5'6\""
  heightCategory?: string; // e.g. "Average", "Tall", "Petite"
  shoeSize?: string; // e.g. "US 7"
  estimatedSize: string;
  currentStyle: string;
  keptItems?: string[]; // Inventory detected from photo for Path A
  userImageBase64: string | null;
  profilePhotoBase64?: string | null; // Dedicated profile photo (persists independently)
  idealStyleImages: string[]; // Array of base64 images for Agent 1.5
  isProfileSetup?: boolean; // Whether the user has completed profile setup
}

export interface Preferences {
  purpose: FashionPurpose;
  occasion: string;
  stylePreference: string;
  colors: string;
  priceRange: string;
  location: string;
  // deadline removed
  // ignoreShippingLogic removed
  itemType: string; // Comma separated if multiple
}

export interface OutfitComponent {
  category: string; // e.g. "Top", "Bottom", "Shoes"
  name: string;
  brand: string;
  price: string;
  purchaseUrl: string;
  validationNote?: string;
  fallbackSearchUrl?: string;
  imageUrl?: string; // Product thumbnail from SerpApi
}

export interface RecommendationItem {
  // This now represents a full "Outfit" or "Look"
  name: string; // e.g., "Look 1: The Urban Cowboy"
  description: string; // Overall description of the look
  totalPrice?: string;
  components: OutfitComponent[]; // The individual items making up the look
  
  // Legacy/Fallback properties for backward compatibility or single-item flows
  imageUrl?: string; 
  reason?: string;
}

export interface StylistResponse {
  recommendations: RecommendationItem[];
  reflectionNotes: string; // The "Forensic Audit Log"
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  data?: StylistResponse;
}

export interface StyleAnalysisResult {
  analysisStatus: string;
  // Flexible types to accommodate the new complex schema
  searchEnhancement?: any; 
  scoringGuidance?: any;
  visualEmbedding?: any;
  categorySpecificAnalysis?: any;
  userFacingMessage?: string;
  // New structured output for user confirmation flow
  suggestedStyles?: {
    id: number;
    name: string;
    description: string;
    matchReason?: string;
  }[];
  detectedColors?: string[];
  detectedComponents?: Array<{category: string; type: string} | string>; // Clothing items detected in photos, e.g. [{category: "tops", type: "tank top"}]
  detailDataset?: any; // The structural vocabulary matches
  // Legacy fallback
  visualSimilarityRubric?: any;
  curatorGuidance?: any;
}