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
}

export enum FashionPurpose {
  MATCHING = 'Find Matching Components',
  NEW_OUTFIT = 'Design a Whole New Outfit',
}

export interface UserProfile {
  gender: string;
  height?: string; // e.g. "165 cm" or "5'6\""
  shoeSize?: string; // e.g. "US 7"
  estimatedSize: string;
  currentStyle: string;
  keptItems?: string[]; // Inventory detected from photo for Path A
  userImageBase64: string | null;
  idealStyleImages: string[]; // Array of base64 images for Agent 1.5
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
  detailDataset?: any; // The structural vocabulary matches
  // Legacy fallback
  visualSimilarityRubric?: any;
  curatorGuidance?: any;
}