import React, { useState, useEffect } from 'react';
import { AppStep, UserProfile, Preferences, FashionPurpose, ChatMessage, StyleAnalysisResult, SearchCriteria, RefinementChatMessage, StylistOutfit, ProfessionalStylistResponse } from './types';
import { analyzeUserPhoto, analyzeProfilePhoto, searchAndRecommend, searchAndRecommendCard1, generateStylistRecommendations, generateOccasionPlan, runChatRefinement, resolveItemCategory, generateSearchQueries, searchWithStylistQueries, generateAllOutfitHeroImages } from './services/geminiService';
import { runStyleExampleAnalyzer } from './services/agent_style_analyzer';
import { analyzeUserIntent, refinePreferences } from './services/agent_router';
import { Upload, Camera, ArrowLeft, ShieldCheck, CheckCircle2, ChevronLeft, X, FileImage, ExternalLink, Layers, Search, Check, Sparkles, Plus, Edit2, AlertCircle, MessageSquare, ArrowRight, Home, User, Ruler, Footprints, Save, Send, Palette, ShoppingBag, Tag, Ban, Calendar, DollarSign, StickyNote } from 'lucide-react';
// import ReactMarkdown from 'react-markdown';

// Helper: map color name to a CSS color for visual dots
const colorNameToCSS = (name: string): string => {
    const n = name.toLowerCase().trim();
    const map: Record<string, string> = {
        'black': '#1c1917', 'white': '#f5f5f4', 'cream': '#fffdd0', 'ivory': '#fffff0',
        'beige': '#f5f0e1', 'tan': '#d2b48c', 'brown': '#8b4513', 'chocolate': '#7b3f00',
        'camel': '#c19a6b', 'khaki': '#c3b091', 'taupe': '#483c32',
        'red': '#ef4444', 'burgundy': '#800020', 'wine': '#722f37', 'maroon': '#800000',
        'coral': '#ff7f50', 'salmon': '#fa8072', 'rose': '#ff007f', 'blush': '#de5d83',
        'pink': '#ec4899', 'hot pink': '#ff69b4', 'magenta': '#ff00ff', 'fuchsia': '#ff00ff',
        'orange': '#f97316', 'peach': '#ffcba4', 'apricot': '#fbceb1', 'rust': '#b7410e', 'terracotta': '#e2725b',
        'yellow': '#eab308', 'gold': '#ffd700', 'mustard': '#e1ad01', 'amber': '#ffbf00',
        'green': '#22c55e', 'olive': '#808000', 'sage': '#9caf88', 'emerald': '#50c878',
        'mint': '#98fb98', 'forest': '#228b22', 'hunter': '#355e3b', 'lime': '#84cc16',
        'teal': '#008080', 'turquoise': '#40e0d0', 'aqua': '#00ffff', 'cyan': '#06b6d4',
        'blue': '#3b82f6', 'navy': '#000080', 'navy blue': '#000080', 'cobalt': '#0047ab',
        'royal blue': '#4169e1', 'baby blue': '#89cff0', 'sky blue': '#87ceeb', 'powder blue': '#b0e0e6',
        'indigo': '#4b0082', 'purple': '#a855f7', 'violet': '#8b5cf6', 'lavender': '#e6e6fa',
        'plum': '#8e4585', 'lilac': '#c8a2c8', 'mauve': '#e0b0ff',
        'silver': '#c0c0c0', 'charcoal': '#36454f', 'grey': '#9ca3af', 'gray': '#9ca3af',
        'pastels': '#e8d5e0', 'jewel tones': '#7c3aed', 'neutrals': '#a8a29e', 'earth tones': '#a0826d',
        'mixed': '#9ca3af',
    };
    // Try exact match first
    if (map[n]) return map[n];
    // Try partial match
    for (const [key, val] of Object.entries(map)) {
        if (n.includes(key) || key.includes(n)) return val;
    }
    return '#9ca3af'; // default grey
};

// Category icon mapping for item pills
const itemCatIcon = (item: string): string => {
    const n = item.toLowerCase();
    if (n.includes('top') || n.includes('blouse') || n.includes('shirt') || n.includes('camisole') || n.includes('sweater')) return '👕';
    if (n.includes('bottom') || n.includes('pant') || n.includes('jean') || n.includes('skirt') || n.includes('trouser') || n.includes('short') || n.includes('legging')) return '👖';
    if (n.includes('dress') || n.includes('gown')) return '👗';
    if (n.includes('outer') || n.includes('jacket') || n.includes('coat') || n.includes('blazer')) return '🧥';
    if (n.includes('foot') || n.includes('shoe') || n.includes('heel') || n.includes('boot') || n.includes('sneaker') || n.includes('sandal')) return '👟';
    if (n.includes('bag') || n.includes('clutch') || n.includes('purse') || n.includes('tote')) return '👜';
    if (n.includes('jewel') || n.includes('necklace') || n.includes('bracelet') || n.includes('ring') || n.includes('earring')) return '💎';
    if (n.includes('hair') || n.includes('scarf') || n.includes('hat')) return '🎀';
    if (n.includes('accessor')) return '✨';
    return '🏷️';
};

const DefaultProfile: UserProfile = {
  gender: 'Female',
  estimatedSize: 'M',
  currentStyle: '',
  keptItems: [],
  userImageBase64: null,
  profilePhotoBase64: null,
  idealStyleImages: [],
  isProfileSetup: false,
};

const DefaultPreferences: Preferences = {
  purpose: FashionPurpose.NEW_OUTFIT,
  occasion: '',
  stylePreference: '',
  colors: '',
  priceRange: '$50 - $200',
  location: 'New York, USA',
  itemType: '',
};

const WIZARD_STEPS = [
  AppStep.GOAL_SELECTION, // Will become LANDING
  AppStep.ITEM_TYPE, 
  AppStep.UPLOAD_PHOTO, 
  AppStep.PROFILE_MANUAL, 
  AppStep.IDEAL_STYLE, 
  AppStep.CONFIRMATION, 
  AppStep.PREFERENCES_DASHBOARD, // New consolidated step
  AppStep.CARD2_DETAILS,
  AppStep.CARD2_RECOMMENDATION,
  AppStep.CARD3_OCCASION,
  AppStep.CARD3_CHAT,
  AppStep.SEARCHING,
  AppStep.RESULTS,
];

interface NavigationButtonsProps {
  onContinue: () => void;
  disabled?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  continueLabel?: string;
}

const NavigationButtons: React.FC<NavigationButtonsProps> = ({ onContinue, disabled = false, showBack = true, onBack, continueLabel = "Continue" }) => (
  <div className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-100 p-4 pb-8 z-50">
    <div className="max-w-md mx-auto flex items-center justify-between px-4">
       {showBack && (
          <button 
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
          >
            <ChevronLeft size={24} className="text-stone-600" />
          </button>
       )}
       <button 
         onClick={onContinue}
         disabled={disabled}
         className={`flex-1 ${showBack ? 'ml-4' : ''} bg-stone-950 text-white font-medium h-12 rounded-xl transition-all shadow-lg shadow-stone-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-800'}`}
       >
         {continueLabel}
       </button>
    </div>
  </div>
);

interface ProgressBarProps {
  currentStep: AppStep;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep }) => {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  if (currentIndex === -1) return null;

  return (
    <div className="flex gap-2 mb-8 max-w-sm mx-auto">
      {WIZARD_STEPS.slice(1).map((s, idx) => { 
           const isActive = idx <= (currentIndex - 1); 
           return (
             <div key={idx} className={`h-1 flex-1 rounded-full ${isActive ? 'bg-stone-900' : 'bg-stone-200'}`} />
           );
      })}
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.GOAL_SELECTION);
  const [profile, setProfile] = useState<UserProfile>(DefaultProfile);
  const [preferences, setPreferences] = useState<Preferences>(DefaultPreferences);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [styleAnalysisResults, setStyleAnalysisResults] = useState<StyleAnalysisResult | null>(null);

  const [selectedItemTypes, setSelectedItemTypes] = useState<string[]>([]);
  const [customItemType, setCustomItemType] = useState<string>('');
  const [minPrice, setMinPrice] = useState<number | string>('');
  const [maxPrice, setMaxPrice] = useState<number | string>('');

  const [searchQuery, setSearchQuery] = useState(''); // For Landing & Refinement

  // --- CARD 1 FLOW STATE ---
  const [card1AnalysisPromise, setCard1AnalysisPromise] = useState<Promise<StyleAnalysisResult> | null>(null);
  
  // Card 2 State
  const [keptItems, setKeptItems] = useState<string[]>([]);
  const [stylistOutfits, setStylistOutfits] = useState<StylistOutfit[]>([]);
  const [selectedOutfitIndex, setSelectedOutfitIndex] = useState<number | null>(null);
  const [stylistSearchQueries, setStylistSearchQueries] = useState<Record<string, string>>({});
  const [isAnalyzingCard2, setIsAnalyzingCard2] = useState(false);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);

  // Profile Page State
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [previousStep, setPreviousStep] = useState<AppStep>(AppStep.GOAL_SELECTION);

  // --- CHAT REFINEMENT STATE (Card 1) ---
  const defaultSearchCriteria: SearchCriteria = {
    style: null,
    colors: [],
    includedItems: [],
    itemCategories: [],
    excludedMaterials: [],
    occasion: null,
    priceRange: null,
    additionalNotes: '',
  };
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(defaultSearchCriteria);
  const [chatMessages, setChatMessages] = useState<RefinementChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [card3OccasionInput, setCard3OccasionInput] = useState('');
  const [card3Plan, setCard3Plan] = useState<{ items: string[]; styles: string[]; colors: string[]; features: string[]; summary: string } | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Hoisted ref for chat container auto-scroll
  const chatContainerRef = React.useRef<HTMLDivElement>(null);
  const prevChatMessageCountRef = React.useRef<number>(0);

  // Hoisted from renderCard1Profile (hooks must be at top level)
  const [useManualSize, setUseManualSize] = useState(false);

  // Hoisted from renderUploadPhoto (hooks must be at top level)
  const [heightVal, setHeightVal] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');

  // --- NEW: Landing Page Logic ---
  const handleSmartEntry = async () => {
      if (!searchQuery.trim()) return;
      setIsLoading(true);
      try {
          const extracted = await analyzeUserIntent(searchQuery);
          setPreferences(prev => ({ ...prev, ...extracted }));
          
          // Determine next step based on extraction
          // If items found, maybe skip to Dashboard? 
          // For now, let's go to Dashboard directly as "Smart Start"
          setStep(AppStep.PREFERENCES_DASHBOARD);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  // --- NEW: Refinement Logic ---
  const handleRefinement = async () => {
      if (!searchQuery.trim()) return;
      setIsLoading(true);
      try {
          const newPrefs = await refinePreferences(preferences, searchQuery);
          setPreferences(newPrefs);
          setSearchQuery(''); // Clear input
          handleSearch(); // Re-run search
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

    // Helper to check if any clothing item is selected
  const hasClothingSelected = () => {
      const clothingTypes = ["Dress", "Top", "Bottom", "Outerwear"];
      return selectedItemTypes.some(t => clothingTypes.includes(t));
  };

  const hasShoesSelected = () => selectedItemTypes.includes("Shoes");

  useEffect(() => {
    // Mount effect
    console.log("App mounted");
  }, []);

  // Update Item Type and Price Preferences
  useEffect(() => {
    const processedItemTypes = selectedItemTypes.map(t => {
        if (t === 'Other') return customItemType.trim();
        return t;
    }).filter(t => t.length > 0 && t !== 'Other');

    // Build priceRange string based on which fields are filled
    let priceRange = '';
    const hasMin = minPrice !== '' && Number(minPrice) > 0;
    const hasMax = maxPrice !== '' && Number(maxPrice) > 0;
    if (hasMin && hasMax) {
        priceRange = `$${minPrice} - $${maxPrice}`;
    } else if (hasMin) {
        priceRange = `From $${minPrice}`;
    } else if (hasMax) {
        priceRange = `Under $${maxPrice}`;
    }

    setPreferences(prev => ({
      ...prev,
      itemType: processedItemTypes.join(', '),
      priceRange
    }));
  }, [selectedItemTypes, customItemType, minPrice, maxPrice]);

  // Hoisted from renderUploadPhoto (hooks must be at top level)
  useEffect(() => {
      if (heightVal) {
          setProfile(p => ({...p, height: `${heightVal} ${heightUnit}`}));
      }
  }, [heightVal, heightUnit]);

  // Hoisted from renderCard1Chat - auto-scroll chat only when NEW messages are added
  useEffect(() => {
      if (chatContainerRef.current && chatMessages.length > prevChatMessageCountRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      prevChatMessageCountRef.current = chatMessages.length;
  }, [chatMessages]);

  // Reset chat scroll position to top when navigating to a new step
  useEffect(() => {
      if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = 0;
      }
      prevChatMessageCountRef.current = chatMessages.length;
  }, [step]);

  // Hoisted from renderCard1Confirm - resolve analysis promise when it changes
  useEffect(() => {
      if (card1AnalysisPromise) {
          setIsLoading(true);
          card1AnalysisPromise.then(result => {
              setStyleAnalysisResults(result);
              setIsLoading(false);
          }).catch(e => {
              console.error("Analysis failed", e);
              setIsLoading(false);
          });
      }
  }, [card1AnalysisPromise]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'userImageBase64', skipAutoAnalysis?: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|gif|webp|heic|heif)$/) && !file.name.toLowerCase().endsWith('.heic')) {
        alert("Please upload a standard image file (JPG, PNG, WEBP, HEIC).");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setProfile(prev => ({ ...prev, [field]: base64String }));

      // Skip auto-analysis for Card 2 (it has its own explicit analysis flow)
      if (field === 'userImageBase64' && !skipAutoAnalysis) {
        setIsLoading(true);
        try {
          const analysis = await analyzeUserPhoto(base64String, preferences.purpose);
          // Preserve gender/size from saved profile if set up; only update outfit-related fields
          setProfile(prev => ({
            ...prev,
            gender: prev.isProfileSetup ? prev.gender : (analysis.gender || prev.gender),
            estimatedSize: prev.isProfileSetup ? prev.estimatedSize : (analysis.estimatedSize || prev.estimatedSize),
            currentStyle: analysis.currentStyle || prev.currentStyle,
            keptItems: analysis.keptItems || []
          }));
        } catch (error) {
          console.error("Analysis Failed", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleIdealStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newImages: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.match(/^image\/(jpeg|png|gif|webp|heic|heif)$/)) continue;
          
          const reader = new FileReader();
          const promise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
          });
          reader.readAsDataURL(file);
          newImages.push(await promise);
      }

      setProfile(prev => ({
          ...prev,
          idealStyleImages: [...(prev.idealStyleImages || []), ...newImages]
      }));
  };

  const removeIdealImage = (index: number) => {
      setProfile(prev => ({
          ...prev,
          idealStyleImages: prev.idealStyleImages.filter((_, i) => i !== index)
      }));
  };

  const removeKeptItem = (index: number) => {
    setProfile(prev => ({
        ...prev,
        keptItems: prev.keptItems ? prev.keptItems.filter((_, i) => i !== index) : []
    }));
  };

  const handleSearch = async (customPrompt?: string) => {
    setStep(AppStep.SEARCHING);
    setIsLoading(true);

    try {
      // Pass the potentially edited analysis results to the pipeline
      const result = await searchAndRecommend(profile, preferences, customPrompt, styleAnalysisResults || undefined);
      const newMsg: ChatMessage = {
        role: 'model',
        content: result.reflectionNotes,
        data: result
      };
      setMessages(prev => [...prev, newMsg]);
      setStep(AppStep.RESULTS);
    } catch (e) {
      console.error(e);
      alert(`Something went wrong during the styling search. Error: ${e instanceof Error ? e.message : String(e)}`);
      setStep(AppStep.GOAL_SELECTION);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = async () => {
    const currentIndex = WIZARD_STEPS.indexOf(step);
    
    // BRANCHING LOGIC: After ITEM_TYPE
    if (step === AppStep.ITEM_TYPE) {
        if (hasClothingSelected()) {
            setStep(AppStep.UPLOAD_PHOTO);
        } else {
            setStep(AppStep.PROFILE_MANUAL);
        }
        return;
    }

    // BRANCHING LOGIC: After UPLOAD_PHOTO (Vision Analyst)
    if (step === AppStep.UPLOAD_PHOTO) {
        // Proceed to Ideal Style
        setStep(AppStep.IDEAL_STYLE);
        return;
    }

    // BRANCHING LOGIC: After PROFILE_MANUAL
    if (step === AppStep.PROFILE_MANUAL) {
        setStep(AppStep.IDEAL_STYLE);
        return;
    }
    
    // NEW: Intercept transition after IDEAL_STYLE to run Analyzer
    if (step === AppStep.IDEAL_STYLE) {
        if (profile.idealStyleImages.length > 0) {
            setIsLoading(true);
            try {
                // Run Analysis
                const result = await runStyleExampleAnalyzer(profile, preferences);
                setStyleAnalysisResults(result);
                
                // If analysis successful, go to Confirmation
                if (result.analysisStatus === 'success') {
                    setStep(AppStep.CONFIRMATION);
                } else {
                    // Fallback if skipped or error
                     setStep(AppStep.PREFERENCES_DASHBOARD);
                }
            } catch (e) {
                console.error("Analyzer error", e);
                // Proceed without analysis
                setStep(AppStep.PREFERENCES_DASHBOARD);
            } finally {
                setIsLoading(false);
            }
            return;
        } else {
             // No images, skip Confirmation and go to Manual Path
             setStep(AppStep.PREFERENCES_DASHBOARD);
             return;
        }
    }

    if (step === AppStep.CONFIRMATION) {
       // Sync Confirmed Data to Preferences
       if (styleAnalysisResults) {
           const topStyle = styleAnalysisResults.suggestedStyles?.map(s => s.name).join(' OR ');
           const confirmedColors = styleAnalysisResults.detectedColors?.join(', ');

           setPreferences(prev => ({
               ...prev,
               stylePreference: topStyle || prev.stylePreference || "", 
               colors: confirmedColors || prev.colors || "Any",
               occasion: prev.occasion || "General" 
           }));
       }

       // Skip Occasion/Style/Color -> Jump to Dashboard
       setStep(AppStep.PREFERENCES_DASHBOARD);
       return;
    }

    if (currentIndex >= 0 && currentIndex < WIZARD_STEPS.length - 1) {
      setStep(WIZARD_STEPS[currentIndex + 1]);
    } else if (step === AppStep.PREFERENCES_DASHBOARD) {
      handleSearch();
    }
  };

  const prevStep = () => {
    // Custom Back Logic for Branching
    
    // From UPLOAD_PHOTO -> back to ITEM_TYPE
    if (step === AppStep.UPLOAD_PHOTO) {
        setStep(AppStep.ITEM_TYPE);
        return;
    }

    // From PROFILE_MANUAL -> back to ITEM_TYPE
    if (step === AppStep.PROFILE_MANUAL) {
        setStep(AppStep.ITEM_TYPE);
        return;
    }

    // From IDEAL_STYLE -> back to UPLOAD_PHOTO or PROFILE_MANUAL
    if (step === AppStep.IDEAL_STYLE) {
        if (hasClothingSelected()) {
            setStep(AppStep.UPLOAD_PHOTO);
        } else {
            setStep(AppStep.PROFILE_MANUAL);
        }
        return;
    }

    if (step === AppStep.PREFERENCES_DASHBOARD) {
        // Dashboard comes from Confirmation (if analyzed) or Ideal Style (if skipped)
        if (styleAnalysisResults && profile.idealStyleImages.length > 0) {
            setStep(AppStep.CONFIRMATION);
        } else {
            setStep(AppStep.IDEAL_STYLE);
        }
        return;
    }

    const currentIndex = WIZARD_STEPS.indexOf(step);
    if (currentIndex > 0) {
      setStep(WIZARD_STEPS[currentIndex - 1]);
    }
  };

  const toggleItemType = (type: string) => {
    setSelectedItemTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Helper: normalize detected components (supports new {category, type} and legacy string formats)
  const normalizeDetectedComponents = (components: Array<{category: string; type: string} | string> | undefined) => {
      if (!components || components.length === 0) return { typeNames: [], categories: [] };

      const categoryMapping: Record<string, string> = {
          'top': 'tops', 'tops': 'tops', 'bottom': 'bottoms', 'bottoms': 'bottoms',
          'dress': 'dresses', 'dresses': 'dresses', 'outerwear': 'outerwear',
          'footwear': 'footwear', 'handbag': 'handbags', 'handbags': 'handbags',
          'jewelry': 'jewelry', 'hair_accessories': 'hair_accessories',
      };
      const fallbackCategoryDisplay: Record<string, string> = {
          'tops': 'Top', 'bottoms': 'Bottom', 'dresses': 'Dress',
          'outerwear': 'Outerwear', 'footwear': 'Footwear',
          'handbags': 'Handbag', 'jewelry': 'Jewelry',
          'hair_accessories': 'Hair Accessories',
      };

      const typeNames: string[] = [];
      const categories: string[] = [];

      for (const comp of components) {
          if (typeof comp === 'object' && comp.category && comp.type) {
              // New format: {category: "tops", type: "tank top"}
              // Capitalize type for display: "tank top" -> "Tank Top"
              const displayType = comp.type.replace(/\b\w/g, (c: string) => c.toUpperCase());
              typeNames.push(displayType);
              const cat = categoryMapping[comp.category.toLowerCase()] || comp.category.toLowerCase();
              if (!categories.includes(cat)) categories.push(cat);
          } else if (typeof comp === 'string') {
              // Legacy format: "top"
              const cat = categoryMapping[comp.toLowerCase()] || comp.toLowerCase();
              const displayName = fallbackCategoryDisplay[cat] || comp;
              typeNames.push(displayName);
              if (!categories.includes(cat)) categories.push(cat);
          }
      }
      return { typeNames, categories };
  };

  // Initialize search criteria from style analysis results (accepts optional direct result)
  const initSearchCriteriaFromAnalysisResult = (result?: StyleAnalysisResult | null) => {
      const analysisResult = result || styleAnalysisResults;
      
      // Build detected components list using normalized helper
      const { typeNames: detectedTypeNames, categories: detectedItemCategories } = 
          normalizeDetectedComponents(analysisResult?.detectedComponents);

      const criteria: SearchCriteria = {
          style: analysisResult?.suggestedStyles?.map(s => s.name).join(', ') || null,
          colors: analysisResult?.detectedColors || [],
          includedItems: detectedTypeNames.map(t => t.toLowerCase()),
          itemCategories: detectedItemCategories,
          excludedMaterials: [],
          occasion: preferences.occasion || null,
          priceRange: preferences.priceRange || null,
          additionalNotes: '',
      };
      setSearchCriteria(criteria);
      
      // Build initial system message for chat — use specific type names
      const componentsText = detectedTypeNames.length > 0 
          ? detectedTypeNames.join(' + ') 
          : 'No specific items detected';
      
      const systemMsg: RefinementChatMessage = {
          role: 'system',
          content: `Style analysis complete. Detected: ${criteria.style || 'N/A'}. Colors: ${criteria.colors.join(', ') || 'Any'}. Components: ${componentsText}.`,
      };
      const welcomeMsg: RefinementChatMessage = {
          role: 'assistant',
          content: `We detected:\n\nStyle: **${criteria.style || 'Not detected'}**\nOverall Color: **${criteria.colors.length > 0 ? criteria.colors.join(', ') : 'Any'}**\nA combination of: **${componentsText}**${criteria.priceRange ? `\nBudget: **${criteria.priceRange}**` : ''}\n\nIs that what you're looking for?`,
      };
      setChatMessages([systemMsg, welcomeMsg]);
      setChatInput('');
  };

  // Handle sending a chat message for refinement
  const handleChatSend = async () => {
      const msg = chatInput.trim();
      if (!msg || isChatLoading) return;

      // Add user message to chat
      const userMsg: RefinementChatMessage = { role: 'user', content: msg };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          const { updatedCriteria, assistantMessage } = await runChatRefinement(
              searchCriteria,
              chatMessages,
              msg,
              profile
          );

          // Merge updated criteria into current criteria
          setSearchCriteria(prev => {
              const merged = { ...prev };
              if (updatedCriteria.style !== undefined) merged.style = updatedCriteria.style;
              if (updatedCriteria.colors !== undefined) merged.colors = updatedCriteria.colors;
              if (updatedCriteria.includedItems !== undefined) merged.includedItems = updatedCriteria.includedItems;
              if (updatedCriteria.itemCategories !== undefined) merged.itemCategories = updatedCriteria.itemCategories;
              if (updatedCriteria.excludedMaterials !== undefined) merged.excludedMaterials = updatedCriteria.excludedMaterials;
              if (updatedCriteria.occasion !== undefined) merged.occasion = updatedCriteria.occasion;
              if (updatedCriteria.priceRange !== undefined) merged.priceRange = updatedCriteria.priceRange;
              if (updatedCriteria.additionalNotes !== undefined) merged.additionalNotes = updatedCriteria.additionalNotes;
              return merged;
          });

          // Add assistant response with criteria snapshot
          const assistantMsg: RefinementChatMessage = {
              role: 'assistant',
              content: assistantMessage,
              criteriaSnapshot: updatedCriteria,
          };
          setChatMessages(prev => [...prev, assistantMsg]);
      } catch (e) {
          console.error("Chat error:", e);
          const errMsg: RefinementChatMessage = {
              role: 'assistant',
              content: "Sorry, something went wrong. Please try again.",
          };
          setChatMessages(prev => [...prev, errMsg]);
      } finally {
          setIsChatLoading(false);
      }
  };

  // Fire search from chat with criteria-aware category mapping
  const handleCard1SearchFromChat = async () => {
      setStep(AppStep.SEARCHING);
      setIsLoading(true);

      try {
          // Build a synthetic StylistOutfit from searchCriteria for query generation
          const genderLabel = profile.gender === 'Female' ? "women's" : profile.gender === 'Male' ? "men's" : "unisex";
          const styleLabel = searchCriteria.style || preferences.stylePreference || '';
          const colorsLabel = searchCriteria.colors.length > 0 ? searchCriteria.colors.join(', ') : '';
          
          // Build one recommendation per category from searchCriteria
          const syntheticRecs = searchCriteria.itemCategories.map((cat, idx) => {
              const specificItem = searchCriteria.includedItems[idx] || cat;
              return {
                  category: cat,
                  item_name: `${colorsLabel} ${specificItem}`.trim(),
                  serp_query: `${genderLabel} ${colorsLabel} ${specificItem} ${styleLabel} buy online -pinterest -polyvore -lyst`.trim(),
                  style_reason: styleLabel,
                  color_role: colorsLabel,
              };
          });

          const syntheticOutfit: StylistOutfit = {
              name: 'Style Clone Search',
              logic: `Searching for items matching analyzed style: ${styleLabel}`,
              recommendations: syntheticRecs,
          };

          // Step 1: Gemini Pro generates optimized search queries
          console.log(">> Card 1: Generating search queries with Gemini Pro...");
          const chatPreferences: Preferences = {
              ...preferences,
              stylePreference: searchCriteria.style || preferences.stylePreference,
              colors: searchCriteria.colors.length > 0 ? searchCriteria.colors.join(', ') : preferences.colors,
              occasion: searchCriteria.occasion || preferences.occasion,
              priceRange: searchCriteria.priceRange || preferences.priceRange,
              itemType: searchCriteria.itemCategories.join(', '),
          };

          const searchQueries = await generateSearchQueries(syntheticOutfit, profile, chatPreferences);
          console.log(">> Search queries:", searchQueries);

          // Step 2: Run simplified pipeline
          const result = await searchWithStylistQueries(profile, chatPreferences, searchQueries);

          const newMsg: ChatMessage = {
              role: 'model',
              content: result.reflectionNotes,
              data: result
          };
          setMessages(prev => [...prev, newMsg]);
          setStep(AppStep.RESULTS);
      } catch (e) {
          console.error(e);
          alert(`Something went wrong during the styling search. Error: ${e instanceof Error ? e.message : String(e)}`);
          setStep(AppStep.CARD1_CHAT);
      } finally {
          setIsLoading(false);
      }
  };

  const handleCard1Search = async () => {
    setStep(AppStep.SEARCHING);
    setIsLoading(true);

    try {
      // Fallback: use legacy Card 1 pipeline if no search criteria available
      const result = await searchAndRecommendCard1(profile, preferences, styleAnalysisResults || undefined);
      const newMsg: ChatMessage = {
        role: 'model',
        content: result.reflectionNotes,
        data: result
      };
      setMessages(prev => [...prev, newMsg]);
      setStep(AppStep.RESULTS);
    } catch (e) {
      console.error(e);
      alert(`Something went wrong during the styling search. Error: ${e instanceof Error ? e.message : String(e)}`);
      setStep(AppStep.GOAL_SELECTION);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Steps ---

  // PAGE 1A: Example Photos + Budget
  const renderCard1Details = () => {
      const onNext = async () => {
          // Start analysis and go directly to chat
          // Clear all shared state from other card flows
          setChatMessages([]);
          setChatInput('');
          setStylistOutfits([]);
          setSelectedOutfitIndex(null);
          setCard3Plan(null);
          setIsGeneratingRecs(false);

          setStep(AppStep.CARD1_CHAT);
          setIsLoading(true);
          try {
              // Run style analyzer (no pre-selected item types - auto-detect from photos)
              const analysisPrefs = { ...preferences, itemType: '' }; // empty = auto-detect all components
              const result = await runStyleExampleAnalyzer(profile, analysisPrefs);
              setStyleAnalysisResults(result);

              // Auto-populate selectedItemTypes from detected components (use categories for search routing)
              if (result?.detectedComponents && result.detectedComponents.length > 0) {
                  const catToDisplayName: Record<string, string> = {
                      'tops': 'Top', 'bottoms': 'Bottom', 'dresses': 'Dress',
                      'outerwear': 'Outerwear', 'footwear': 'Footwear',
                      'handbags': 'Handbags', 'jewelry': 'Jewelries',
                      'hair_accessories': 'Hair Accessories',
                  };
                  const { categories } = normalizeDetectedComponents(result.detectedComponents);
                  const detected = categories.map(c => catToDisplayName[c] || c).filter(Boolean);
                  setSelectedItemTypes(detected);
              }

              // Initialize chat with analysis results
              initSearchCriteriaFromAnalysisResult(result);
          } catch (err) {
              console.error('Style analysis error:', err);
              // Still go to chat with empty state so user can manually input
              initSearchCriteriaFromAnalysisResult(null);
          } finally {
              setIsLoading(false);
          }
      };

      return (
        <div className="max-w-md mx-auto px-6 pt-8 animate-fade-in pb-32">
          {/* Header */}
          <h1 className="text-2xl font-bold font-sans text-stone-900 leading-tight mb-8">
            Please provide us up to<br />3 example photos
          </h1>

          {/* Photo Upload - 2 column grid */}
          <div className="grid grid-cols-2 gap-3 mb-10">
             {profile.idealStyleImages.map((img, idx) => (
                 <div key={idx} className="relative aspect-[3/4] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200">
                     <img src={img} alt={`Example ${idx+1}`} className="w-full h-full object-cover" />
                     <button 
                        onClick={() => removeIdealImage(idx)}
                        className="absolute top-2.5 right-2.5 bg-white/90 w-7 h-7 flex items-center justify-center rounded-full shadow-sm hover:bg-white text-stone-500 hover:text-red-500 transition-colors"
                     >
                        <X size={14} />
                     </button>
                 </div>
             ))}
             
             {profile.idealStyleImages.length < 3 && (
                 <label className="aspect-[3/4] bg-white border-2 border-dashed border-stone-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 hover:border-stone-400 transition-all text-stone-300 hover:text-stone-500">
                     <Plus size={32} />
                     <input 
                        type="file" 
                        className="hidden" 
                        multiple
                        accept="image/*"
                        onChange={handleIdealStyleUpload}
                     />
                 </label>
             )}
          </div>

          {/* Budget Section */}
          <div className="mb-8">
            <p className="text-sm text-stone-400 mb-2">What's your budget?</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center border border-stone-200 rounded-xl px-4 py-3.5 bg-white">
                <span className="text-stone-400 font-medium mr-2">$</span>
                <input 
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full outline-none text-stone-900 font-medium bg-transparent"
                  placeholder="Min"
                />
              </div>
              <span className="text-stone-400 text-sm">to</span>
              <div className="flex-1 flex items-center border border-stone-200 rounded-xl px-4 py-3.5 bg-white">
                <span className="text-stone-400 font-medium mr-2">$</span>
                <input 
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full outline-none text-stone-900 font-medium bg-transparent"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          <NavigationButtons 
            onContinue={onNext} 
            onBack={() => setStep(AppStep.GOAL_SELECTION)}
            disabled={profile.idealStyleImages.length === 0}
            continueLabel="Continue"
          />
        </div>
      );
  };

  // PAGE 1B: Budget & Profile
  // NOTE: renderCard1Profile and renderCard1Confirm have been removed.
  // Card 1 flow is now: CARD1_DETAILS (photos + budget) → CARD1_CHAT (with auto-populated analysis)

  // PAGE 1D: Conversational Refinement (Chat + Living Card)
  const renderCard1Chat = () => {
      // chatContainerRef and auto-scroll useEffect are hoisted to App top level

      return (
          <div className="max-w-md mx-auto flex flex-col h-screen bg-white">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-stone-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                      <button onClick={() => setStep(AppStep.CARD1_DETAILS)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                          <ChevronLeft size={20} className="text-stone-600" />
                      </button>
                      <div className="text-center">
                          <h1 className="text-sm font-bold text-stone-900">Fashion Assistant</h1>
                          <p className="text-[10px] text-stone-400">Let me know if you need any changes</p>
                      </div>
                      <div className="w-8" /> {/* Spacer */}
                  </div>
              </div>

              {/* Criteria summary is now embedded in the first chat message card */}

              {/* Chat Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {/* Loading state while analysis runs */}
                  {isLoading && chatMessages.length === 0 && (
                      <div className="flex justify-center items-center py-16">
                          <div className="text-center">
                              <div className="flex justify-center mb-4">
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '0ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '150ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '300ms' }} />
                              </div>
                              <p className="text-sm font-medium text-stone-600">Analyzing your style photos...</p>
                              <p className="text-xs text-stone-400 mt-1">This usually takes 10-15 seconds</p>
                          </div>
                      </div>
                  )}

                  {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => {
                      // Special card rendering for the first assistant message (detection summary)
                      const isFirstAssistant = idx === 0 && msg.role === 'assistant' && msg.content.includes('We detected');
                      
                      if (isFirstAssistant) {
                          return (
                              <div key={idx} className="flex justify-start">
                                  <div className="max-w-[90%] bg-rose-50 border border-rose-100 rounded-2xl rounded-bl-md px-4 py-4 shadow-sm">
                                      <div className="flex items-center gap-2 mb-2">
                                          <Sparkles size={16} className="text-emerald-600" />
                                          <span className="text-sm font-bold text-emerald-700">Style Analysis</span>
                                      </div>
                                      <p className="text-sm text-stone-700 mb-4">Here's what we detected from your photos:</p>
                                      
                                      {searchCriteria.includedItems.length > 0 && (
                                          <div className="mb-4">
                                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Detected Items</p>
                                              <div className="flex flex-wrap gap-2">
                                                  {searchCriteria.includedItems.map((item, i) => (
                                                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-800 capitalize shadow-sm">
                                                          {itemCatIcon(item)} {item}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                      )}

                                      {searchCriteria.style && (
                                          <div className="mb-4">
                                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Style</p>
                                              <div className="flex flex-wrap gap-2">
                                                  {searchCriteria.style.split(',').map((s, i) => (
                                                      <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700">
                                                          {s.trim()}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                      
                                      {searchCriteria.colors.length > 0 && (
                                          <div className="mb-4">
                                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Color Palette</p>
                                              <div className="flex flex-wrap gap-2">
                                                  {searchCriteria.colors.map((c, i) => (
                                                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-700 shadow-sm">
                                                          <span className="w-3 h-3 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(c) }} /> {c}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                      
                                      {searchCriteria.priceRange && (
                                          <div className="mb-3">
                                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Budget</p>
                                              <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
                                                  {searchCriteria.priceRange}
                                              </span>
                                          </div>
                                      )}
                                      
                                      <p className="text-sm text-stone-600 mt-3">Is that what you're looking for?</p>
                                  </div>
                              </div>
                          );
                      }

                      return (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  msg.role === 'user' 
                                      ? 'bg-stone-900 text-white rounded-br-md' 
                                      : 'bg-stone-100 text-stone-800 rounded-bl-md'
                              }`}>
                                  {/* Render message with basic formatting */}
                                  {msg.content.split('\n').map((line, li) => (
                                      <p key={li} className={li > 0 ? 'mt-1' : ''}>
                                          {line.split(/(\*\*.*?\*\*)/).map((part, pi) => {
                                              if (part.startsWith('**') && part.endsWith('**')) {
                                                  return <strong key={pi}>{part.slice(2, -2)}</strong>;
                                              }
                                              return <span key={pi}>{part}</span>;
                                          })}
                                      </p>
                                  ))}
                                  
                                  {/* Show what changed if criteria updated */}
                                  {msg.criteriaSnapshot && Object.keys(msg.criteriaSnapshot).length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-stone-200/50">
                                          {/* Show current items as pills if includedItems were updated */}
                                          {(msg.criteriaSnapshot as any).includedItems && (
                                              <div className="mb-1.5">
                                                  <p className="text-[10px] text-stone-400 mb-1">Current items:</p>
                                                  <div className="flex flex-wrap gap-1">
                                                      {searchCriteria.includedItems.map((item, i) => (
                                                          <span key={i} className="px-2 py-0.5 bg-stone-200/60 text-stone-600 rounded-full text-[10px] font-medium capitalize">
                                                              {item}
                                                          </span>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                          {/* Show other updated fields */}
                                          <div className="flex flex-wrap gap-1">
                                              {Object.entries(msg.criteriaSnapshot).filter(([key]) => key !== 'includedItems' && key !== 'itemCategories').map(([key, val]) => {
                                                  if (!val || (Array.isArray(val) && val.length === 0)) return null;
                                                  const displayVal = Array.isArray(val) ? val.join(', ') : String(val);
                                                  return (
                                                      <span key={key} className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded text-stone-500 border border-stone-200/50">
                                                          {key}: {displayVal}
                                                      </span>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
                  
                  {/* Typing indicator */}
                  {isChatLoading && (
                      <div className="flex justify-start">
                          <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
                              <div className="flex gap-1.5">
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              {/* Input Area */}
              <div className="border-t border-stone-100 bg-white px-4 py-3 pb-6">
                  {/* Quick suggestion pills */}
                  <div className="flex gap-2 overflow-x-auto mb-3 pb-1 scrollbar-hide">
                      {['Add a skirt', 'No polyester', 'Date night', 'Under $150', 'Navy blue'].map(suggestion => (
                          <button
                              key={suggestion}
                              onClick={() => {
                                  setChatInput(suggestion);
                              }}
                              className="shrink-0 text-[11px] px-3 py-1.5 bg-stone-50 text-stone-500 rounded-full border border-stone-200 hover:bg-stone-100 hover:text-stone-700 transition-colors font-medium"
                          >
                              {suggestion}
                          </button>
                      ))}
                  </div>

                  <div className="flex items-center gap-2">
                      <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                          placeholder="Type your response..."
                          className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 focus:bg-white transition-all"
                          disabled={isChatLoading}
                      />
                      <button
                          onClick={handleChatSend}
                          disabled={!chatInput.trim() || isChatLoading}
                          className={`p-3 rounded-xl transition-all ${
                              chatInput.trim() && !isChatLoading
                                  ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-md' 
                                  : 'bg-stone-100 text-stone-300'
                          }`}
                      >
                          <Send size={18} />
                      </button>
                  </div>

                  {/* Search button */}
                  <button
                      onClick={handleCard1SearchFromChat}
                      disabled={searchCriteria.includedItems.length === 0 && searchCriteria.itemCategories.length === 0}
                      className={`w-full mt-3 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                          (searchCriteria.includedItems.length > 0 || searchCriteria.itemCategories.length > 0)
                              ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200'
                              : 'bg-stone-100 text-stone-300 cursor-not-allowed'
                      }`}
                  >
                      <Search size={16} />
                      Find My Style ({searchCriteria.includedItems.length} item{searchCriteria.includedItems.length !== 1 ? 's' : ''})
                  </button>
              </div>
          </div>
      );
  };

  const renderLanding = () => (
    <div className="max-w-md mx-auto px-6 pt-12 animate-fade-in pb-32">
       <h1 className="text-4xl font-bold font-serif text-stone-900 mb-2 text-center">Elite Stylist</h1>
       <p className="text-stone-500 mb-8 text-center">Your AI personal shopper</p>

       {/* Search Box */}
       <div className="relative mb-8">
           <input 
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="What are you looking for? (e.g. Wedding guest dress)"
             className="w-full p-4 pr-12 bg-white border border-stone-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-stone-900 transition-all"
             onKeyDown={(e) => e.key === 'Enter' && handleSmartEntry()}
           />
           <button 
             onClick={handleSmartEntry}
             className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
           >
             <Search size={18} />
           </button>
       </div>

       <div className="grid grid-cols-1 gap-4">
          {/* Card 1: Style Clone (New Flow) */}
          <button
             onClick={() => {
                 setPreferences(p => ({...p, purpose: FashionPurpose.MATCHING})); 
                 setStep(AppStep.CARD1_DETAILS); // New Entry Point
             }}
             className="flex items-center gap-4 p-5 bg-white border border-stone-200 rounded-2xl hover:border-stone-900 hover:shadow-md transition-all text-left"
          >
             <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shrink-0">
                 <Camera size={24} />
             </div>
             <div>
                 <h3 className="font-bold text-stone-900">Show me this style</h3>
                 <p className="text-xs text-stone-500">Upload a photo to find similar items</p>
             </div>
          </button>

          {/* Card 2: Match Item */}
          <button
             onClick={() => {
                 setPreferences(p => ({...p, purpose: FashionPurpose.MATCHING}));
                 setStep(AppStep.CARD2_DETAILS);
             }}
             className="flex items-center gap-4 p-5 bg-white border border-stone-200 rounded-2xl hover:border-stone-900 hover:shadow-md transition-all text-left"
          >
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                 <Layers size={24} />
             </div>
             <div>
                 <h3 className="font-bold text-stone-900">Find items to match</h3>
                 <p className="text-xs text-stone-500">Complete an outfit you already own</p>
             </div>
          </button>

          {/* Card 3: Create Outfit (Manual) */}
          <button
             onClick={() => {
                 setPreferences(p => ({...p, purpose: FashionPurpose.NEW_OUTFIT}));
                 setStep(AppStep.CARD3_OCCASION);
             }}
             className="flex items-center gap-4 p-5 bg-white border border-stone-200 rounded-2xl hover:border-stone-900 hover:shadow-md transition-all text-left"
          >
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                 <Sparkles size={24} />
             </div>
             <div>
                 <h3 className="font-bold text-stone-900">Create complete outfit</h3>
                 <p className="text-xs text-stone-500">Start from scratch with guided steps</p>
             </div>
          </button>
       </div>
    </div>
  );

  const renderPreferencesDashboard = () => (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <ProgressBar currentStep={step} />
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-6">Your Preferences</h1>
          
          <div className="space-y-4">
              {/* Occasion */}
              <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <label className="text-xs font-bold text-stone-500 uppercase">Occasion</label>
                  <input 
                      value={preferences.occasion}
                      onChange={(e) => setPreferences(p => ({...p, occasion: e.target.value}))}
                      className="w-full mt-1 font-medium outline-none border-b border-transparent focus:border-stone-900"
                      placeholder="e.g. Wedding, Work..."
                  />
              </div>

              {/* Style */}
              <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <label className="text-xs font-bold text-stone-500 uppercase">Style / Vibe</label>
                  <input 
                      value={preferences.stylePreference}
                      onChange={(e) => setPreferences(p => ({...p, stylePreference: e.target.value}))}
                      className="w-full mt-1 font-medium outline-none border-b border-transparent focus:border-stone-900"
                      placeholder="e.g. Boho, Minimalist..."
                  />
              </div>

              {/* Colors */}
              <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <label className="text-xs font-bold text-stone-500 uppercase">Colors</label>
                  <input 
                      value={preferences.colors}
                      onChange={(e) => setPreferences(p => ({...p, colors: e.target.value}))}
                      className="w-full mt-1 font-medium outline-none border-b border-transparent focus:border-stone-900"
                      placeholder="e.g. Earth tones, Black..."
                  />
              </div>

              {/* Budget */}
              <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <label className="text-xs font-bold text-stone-500 uppercase">Budget</label>
                  <input 
                      value={preferences.priceRange}
                      onChange={(e) => setPreferences(p => ({...p, priceRange: e.target.value}))}
                      className="w-full mt-1 font-medium outline-none border-b border-transparent focus:border-stone-900"
                      placeholder="$50 - $200"
                  />
              </div>
          </div>

          <NavigationButtons 
            onContinue={() => handleSearch()} 
            onBack={() => setStep(AppStep.GOAL_SELECTION)}
            continueLabel="Find Outfits"
          />
      </div>
  );

  // ... (Update renderResults to include chat)


  const renderUploadPhoto = () => {
    const isHeic = profile.userImageBase64 ? (profile.userImageBase64.toLowerCase().includes('image/heic') || profile.userImageBase64.toLowerCase().includes('image/heif')) : false;
    // useState and useEffect for heightVal/heightUnit are now hoisted to App top level

    return (
    <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
      <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Vision Analyst</h1>
      <p className="text-stone-500 mb-6 text-sm">Upload a full-body photo for size estimation</p>

      <div className="bg-stone-100 rounded-3xl p-4 relative mb-6 min-h-[300px] flex items-center justify-center border-2 border-dashed border-stone-200 overflow-hidden">
         {profile.userImageBase64 ? (
            <>
              {isHeic ? (
                <div className="flex flex-col items-center justify-center text-stone-400">
                    <FileImage size={48} className="mb-2" />
                    <span className="font-bold text-stone-900">HEIC Image Uploaded</span>
                    <span className="text-xs">Preview not available in browser</span>
                </div>
              ) : (
                <img 
                    src={profile.userImageBase64} 
                    alt="Preview" 
                    className="w-full h-full object-contain rounded-xl bg-white"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        setProfile(p => ({...p, userImageBase64: null}));
                        alert("The image could not be loaded. Please try a different file.");
                    }}
                />
              )}
              
              <button 
                onClick={() => setProfile(p => ({...p, userImageBase64: null}))}
                className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md hover:bg-stone-100 transition-colors"
              >
                <X size={20} />
              </button>
            </>
         ) : (
            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-stone-100/50 transition-colors">
               <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                 <Camera size={24} className="text-stone-900" />
               </div>
               <span className="font-semibold text-stone-900">Upload photo</span>
               <input 
                 type="file" 
                 className="hidden" 
                 accept="image/png, image/jpeg, image/webp, image/heic, image/heif" 
                 onChange={(e) => handleFileUpload(e, 'userImageBase64')} 
               />
            </label>
         )}
         {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
               <div className="animate-spin w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full"></div>
            </div>
         )}
      </div>

      <div className="space-y-4">
          <div>
             <label className="block text-sm font-bold text-stone-900 mb-1.5">Your Height</label>
             <div className="flex gap-2">
                 <input 
                    type="number" 
                    value={heightVal}
                    onChange={(e) => setHeightVal(e.target.value)}
                    placeholder={heightUnit === 'cm' ? "165" : "5.5"}
                    className="flex-1 p-4 bg-white border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-stone-900"
                 />
                 <select 
                    value={heightUnit}
                    onChange={(e) => setHeightUnit(e.target.value)}
                    className="p-4 bg-white border border-stone-200 rounded-xl outline-none"
                 >
                     <option value="cm">cm</option>
                     <option value="ft">ft</option>
                 </select>
             </div>
          </div>
      </div>

      {profile.estimatedSize && (
          <div className="bg-stone-50 p-6 rounded-3xl space-y-4 mt-6 animate-fade-in">
            <h3 className="text-stone-500 text-sm font-medium">Analysis Results</h3>
            
            <div className="flex gap-4">
                <div className="flex-1">
                   <label className="block text-xs font-bold text-stone-900 mb-1">Est. Size</label>
                   <div className="p-3 bg-white border border-stone-200 rounded-xl font-bold text-center">
                       {profile.estimatedSize}
                   </div>
                </div>
                <div className="flex-1">
                   <label className="block text-xs font-bold text-stone-900 mb-1">Gender</label>
                   <div className="p-3 bg-white border border-stone-200 rounded-xl font-bold text-center">
                       {profile.gender}
                   </div>
                </div>
            </div>

            {hasShoesSelected() && (
                <div>
                   <label className="block text-sm font-bold text-stone-900 mb-1.5">Select Shoe Size (US)</label>
                   <select 
                       value={profile.shoeSize || ''}
                       onChange={(e) => setProfile(p => ({...p, shoeSize: e.target.value}))}
                       className="w-full p-4 bg-white border border-stone-200 rounded-xl appearance-none font-medium focus:ring-1 focus:ring-stone-900 outline-none"
                     >
                       <option value="">Select Size</option>
                       {profile.gender === 'Male' || profile.gender === "Men's" ? (
                           [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(s => <option key={s} value={`US ${s}`}>{s}</option>)
                       ) : (
                           [4, 5, 6, 7, 8, 9, 10, 11, 12].map(s => <option key={s} value={`US ${s}`}>{s}</option>)
                       )}
                     </select>
                </div>
            )}

            {profile.keptItems && profile.keptItems.length > 0 && (
                 <div className="pt-2">
                    <label className="flex items-center justify-between text-sm font-bold text-stone-900 mb-1.5">
                        <span>Detected Inventory</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {profile.keptItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs bg-white text-stone-700 pl-3 pr-1.5 py-1.5 rounded-lg font-medium border border-stone-200 shadow-sm">
                                {item}
                                <button onClick={() => removeKeptItem(idx)} className="p-0.5 hover:bg-red-100 rounded-md text-stone-400"><X size={12} /></button>
                            </div>
                        ))}
                    </div>
                 </div>
            )}
          </div>
      )}

      <NavigationButtons onContinue={nextStep} onBack={prevStep} disabled={!profile.userImageBase64 || !heightVal} />
    </div>
    );
  };

  const renderProfileManual = () => {
      return (
        <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <ProgressBar currentStep={step} />
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Your Profile</h1>
          <p className="text-stone-500 mb-8 text-sm">Tell us a bit about yourself</p>

          <div className="space-y-6">
            <div>
               <label className="block text-sm font-bold text-stone-900 mb-1.5">Gender</label>
               <div className="grid grid-cols-3 gap-3">
                   {['Female', 'Male', 'Non-Binary'].map(g => (
                       <button
                         key={g}
                         onClick={() => setProfile(p => ({...p, gender: g}))}
                         className={`p-4 rounded-xl border font-medium transition-all ${profile.gender === g ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-900 hover:border-stone-300'}`}
                       >
                           {g}
                       </button>
                   ))}
               </div>
            </div>

            {hasShoesSelected() && profile.gender && (
                <div className="animate-fade-in">
                   <label className="block text-sm font-bold text-stone-900 mb-1.5">Shoe Size (US)</label>
                   <select 
                       value={profile.shoeSize || ''}
                       onChange={(e) => setProfile(p => ({...p, shoeSize: e.target.value}))}
                       className="w-full p-4 bg-white border border-stone-200 rounded-xl appearance-none font-medium focus:ring-1 focus:ring-stone-900 outline-none"
                     >
                       <option value="">Select Size</option>
                       {profile.gender === 'Male' ? (
                           [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(s => <option key={s} value={`US ${s}`}>{s}</option>)
                       ) : (
                           [4, 5, 6, 7, 8, 9, 10, 11, 12].map(s => <option key={s} value={`US ${s}`}>{s}</option>)
                       )}
                     </select>
                </div>
            )}
          </div>

          <NavigationButtons 
            onContinue={nextStep} 
            onBack={prevStep} 
            disabled={!profile.gender || (hasShoesSelected() && !profile.shoeSize)} 
          />
        </div>
      );
  };

  const renderItemType = () => {
    // EXPANDED LIST as per request
    const types = ["Dress", "Top", "Bottom", "Shoes", "Outerwear", "Hair Accessories", "Handbags", "Jewelries", "Other"];
    const isOtherSelected = selectedItemTypes.includes('Other');

    return (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
        <ProgressBar currentStep={step} />
        <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Target Items</h1>
        <p className="text-stone-500 mb-8 text-sm">Select items to procure</p>

        <div className="space-y-3">
           {types.map(type => {
             const isSelected = selectedItemTypes.includes(type);
             return (
               <button
                 key={type}
                 onClick={() => toggleItemType(type)}
                 className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all ${isSelected ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 bg-white hover:border-stone-300'}`}
               >
                 <span className="font-bold text-stone-900">{type}</span>
                 {isSelected && <div className="bg-stone-900 rounded-full p-1"><Check size={12} className="text-white" /></div>}
               </button>
             )
           })}

           {isOtherSelected && (
              <div className="animate-fade-in p-1">
                 <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wide">Specify Other Item</label>
                 <input 
                   type="text"
                   value={customItemType}
                   onChange={(e) => setCustomItemType(e.target.value)}
                   placeholder="e.g. Scarf, Belt, Hat..."
                   className="w-full p-4 bg-white border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
                   autoFocus
                 />
              </div>
           )}
        </div>
        
        <NavigationButtons 
            onContinue={nextStep} 
            onBack={prevStep}
            disabled={
                selectedItemTypes.length === 0 || 
                (selectedItemTypes.includes('Other') && !customItemType.trim())
            } 
        />
      </div>
    );
  };

  const renderOccasion = () => {
    const occasions = ["Date Night", "Graduation", "Music Festival", "Wedding", "Work Attire", "Other"];
    const isCustom = preferences.occasion === 'Other' || (preferences.occasion && !occasions.includes(preferences.occasion));
    
    return (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
        <ProgressBar currentStep={step} />
        <h1 className="text-2xl font-bold font-sans text-stone-900 mb-8">What's the occasion?</h1>

        <div className="space-y-3">
           {occasions.map(occ => {
             const isSelected = occ === 'Other' 
                ? (preferences.occasion === 'Other' || (preferences.occasion && !occasions.slice(0, -1).includes(preferences.occasion)))
                : preferences.occasion === occ;

             return (
                 <button
                   key={occ}
                   onClick={() => setPreferences(p => ({...p, occasion: occ}))}
                   className={`w-full text-left p-5 rounded-xl border transition-all font-bold text-stone-900 ${isSelected ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                 >
                   {occ}
                 </button>
             );
           })}

           {isCustom && (
              <div className="animate-fade-in p-1">
                 <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wide">Specify Occasion</label>
                 <input 
                   type="text"
                   value={preferences.occasion === 'Other' ? '' : preferences.occasion}
                   onChange={(e) => setPreferences(p => ({...p, occasion: e.target.value}))}
                   placeholder="e.g. Birthday Party, Hiking..."
                   className="w-full p-4 bg-white border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
                   autoFocus
                 />
              </div>
           )}
        </div>
        <NavigationButtons onContinue={nextStep} onBack={prevStep} disabled={!preferences.occasion || preferences.occasion === 'Other'} />
      </div>
    );
  };

  const renderStyle = () => {
    const styles = ["Formal", "Elegant", "Sexy", "Minimalist", "Boho", "Other"];
    const isCustom = preferences.stylePreference === 'Other' || (preferences.stylePreference && !styles.includes(preferences.stylePreference));

    return (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
        <ProgressBar currentStep={step} />
        <h1 className="text-2xl font-bold font-sans text-stone-900 mb-8">Target Aesthetic</h1>

        <div className="space-y-3">
           {styles.map(s => {
             const isSelected = s === 'Other' 
                ? (preferences.stylePreference === 'Other' || (preferences.stylePreference && !styles.slice(0, -1).includes(preferences.stylePreference)))
                : preferences.stylePreference === s;

             return (
               <button
                 key={s}
                 onClick={() => setPreferences(p => ({...p, stylePreference: s}))}
                 className={`w-full text-left p-5 rounded-xl border transition-all font-bold text-stone-900 ${isSelected ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 bg-white hover:border-stone-300'}`}
               >
                 {s}
               </button>
             );
           })}

           {isCustom && (
              <div className="animate-fade-in p-1">
                 <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wide">Specify Aesthetic</label>
                 <input 
                   type="text"
                   value={preferences.stylePreference === 'Other' ? '' : preferences.stylePreference}
                   onChange={(e) => setPreferences(p => ({...p, stylePreference: e.target.value}))}
                   placeholder="e.g. Cyberpunk, Cottagecore..."
                   className="w-full p-4 bg-white border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
                   autoFocus
                 />
              </div>
           )}
        </div>
        <NavigationButtons onContinue={nextStep} onBack={prevStep} disabled={!preferences.stylePreference || preferences.stylePreference === 'Other'} />
      </div>
    );
  };

  const renderColor = () => {
    const colors = ["White", "Black", "Red", "Blue", "Pink", "Other"];
    const isCustom = preferences.colors === 'Other' || (preferences.colors && !colors.includes(preferences.colors));

    return (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
        <ProgressBar currentStep={step} />
        <h1 className="text-2xl font-bold font-sans text-stone-900 mb-8">Target Color</h1>

        <div className="space-y-3">
           {colors.map(c => {
             const isSelected = c === 'Other' 
                ? (preferences.colors === 'Other' || (preferences.colors && !colors.slice(0, -1).includes(preferences.colors)))
                : preferences.colors === c;

             return (
               <button
                 key={c}
                 onClick={() => setPreferences(p => ({...p, colors: c}))}
                 className={`w-full text-left p-5 rounded-xl border transition-all font-bold text-stone-900 ${isSelected ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 bg-white hover:border-stone-300'}`}
               >
                 {c}
               </button>
             );
           })}

           {isCustom && (
              <div className="animate-fade-in p-1">
                 <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wide">Specify Color</label>
                 <input 
                   type="text"
                   value={preferences.colors === 'Other' ? '' : preferences.colors}
                   onChange={(e) => setPreferences(p => ({...p, colors: e.target.value}))}
                   placeholder="e.g. Neon Green, Pastel Purple..."
                   className="w-full p-4 bg-white border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
                   autoFocus
                 />
              </div>
           )}
        </div>
        <NavigationButtons onContinue={nextStep} onBack={prevStep} disabled={!preferences.colors || preferences.colors === 'Other'} />
      </div>
    );
  };

  const renderPriceRange = () => {
    // Dual Range Slider Logic
    const MIN_LIMIT = 0;
    const MAX_LIMIT = 3000;
    
    // Convert current inputs to number safely for percentage calculation
    // If input is empty string, default to 0 for slider position
    const minVal = minPrice === '' ? 0 : Number(minPrice);
    const maxVal = maxPrice === '' ? MAX_LIMIT : Number(maxPrice);
    
    // Percentage for track coloring (clamped 0-100 for visual sanity)
    const minPercent = Math.min(Math.max(((minVal - MIN_LIMIT) / (MAX_LIMIT - MIN_LIMIT)) * 100, 0), 100);
    const maxPercent = Math.min(Math.max(((maxVal - MIN_LIMIT) / (MAX_LIMIT - MIN_LIMIT)) * 100, 0), 100);

    // Validation
    const isMinEmpty = minPrice === '';
    const isMaxEmpty = maxPrice === '';
    const isInvalidRange = !isMinEmpty && !isMaxEmpty && Number(maxPrice) < Number(minPrice);

    return (
    <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
        <style>{`
          .slider-thumb::-webkit-slider-thumb {
            pointer-events: auto;
            -webkit-appearance: none;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background: #1c1917; /* stone-900 */
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            cursor: pointer;
            margin-top: -10px; /* Center thumb on track */
          }
          .slider-thumb::-moz-range-thumb {
            pointer-events: auto;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background: #1c1917;
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            cursor: pointer;
            border: none;
          }
          /* Remove default appearance */
          input[type=range]::-webkit-slider-runnable-track {
            -webkit-appearance: none;
            height: 100%;
          }
        `}</style>
        <ProgressBar currentStep={step} />
        <h1 className="text-2xl font-bold font-sans text-stone-900 mb-8">User Budget</h1>

        {/* Inputs Display */}
        <div className="flex items-center gap-4 mb-12">
           <div className="flex-1">
             <label className="block text-xs font-medium text-stone-500 mb-2">Minimum</label>
             <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input 
                  type="number"
                  value={minPrice}
                  onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                          setMinPrice('');
                          return;
                      }
                      const numVal = Number(val);
                      // Remove upper bound clamping to allow typing freely
                      setMinPrice(numVal);
                  }}
                  className="w-full p-4 pl-8 bg-white border border-stone-200 rounded-xl font-bold text-stone-900 text-lg outline-none focus:border-stone-900"
                />
             </div>
           </div>
           <div className="text-stone-300 mt-6">—</div>
           <div className="flex-1">
             <label className="block text-xs font-medium text-stone-500 mb-2">Maximum</label>
             <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input 
                  type="number"
                  value={maxPrice}
                  onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                          setMaxPrice('');
                          return;
                      }
                      const numVal = Number(val);
                      // Remove lower bound clamping to allow typing freely
                      setMaxPrice(numVal);
                  }}
                  className={`w-full p-4 pl-8 bg-white border rounded-xl font-bold text-lg outline-none focus:border-stone-900 ${isInvalidRange ? 'border-red-300 text-red-600 bg-red-50' : 'border-stone-200 text-stone-900'}`}
                />
             </div>
             {isInvalidRange && (
                 <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                     <AlertCircle size={10} />
                     Max must be higher than Min
                 </p>
             )}
           </div>
        </div>

        {/* Slider UI */}
        {/* We use negative margins to allow the visual track to extend slightly beyond the content area if desired, 
            but strictly speaking, "graphically having ends to both sides" implies it shouldn't just cut off. 
            We'll make the container relative and ensure the track fills it fully. */}
        <div className="relative w-full h-12 mb-8 select-none">
            {/* Track Background */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-stone-200 rounded-full overflow-hidden"></div>
            
            {/* Active Range Track */}
            <div 
                className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-stone-900 rounded-full pointer-events-none"
                style={{ left: `${minPercent}%`, width: `${Math.max(maxPercent - minPercent, 0)}%` }}
            ></div>

            {/* Range Inputs (Overlaid) */}
            <input 
                type="range"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                step={10}
                value={minVal}
                onChange={(e) => {
                    const val = Math.min(Number(e.target.value), maxVal - 50);
                    setMinPrice(val);
                }}
                className="slider-thumb absolute top-1/2 -translate-y-1/2 w-full h-1.5 opacity-0 appearance-none pointer-events-none z-20"
                style={{ pointerEvents: 'none' }} // Ensure clicks pass through, thumbs handle pointer-events via CSS
            />
            <input 
                type="range"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                step={10}
                value={maxVal > MAX_LIMIT ? MAX_LIMIT : maxVal} // Visual clamp for slider thumb
                onChange={(e) => {
                    const val = Math.max(Number(e.target.value), minVal + 50);
                    setMaxPrice(val);
                }}
                className="slider-thumb absolute top-1/2 -translate-y-1/2 w-full h-1.5 opacity-0 appearance-none pointer-events-none z-20"
                style={{ pointerEvents: 'none' }}
            />
        </div>

        <p className="text-center text-stone-500 text-sm">
            {maxVal > MAX_LIMIT ? `Selected range: $${minVal} - $${maxVal} (Custom)` : `Selected range: $${minVal} - $${maxVal}`}
        </p>

        <NavigationButtons 
            onContinue={nextStep} 
            onBack={prevStep} 
            disabled={isInvalidRange || isMinEmpty || isMaxEmpty}
        />
    </div>
    );
  };

// Delivery render function removed

  const renderConfirmation = () => {
    if (!styleAnalysisResults) return null;

    const styles = styleAnalysisResults.suggestedStyles || [];
    const colors = styleAnalysisResults.detectedColors || [];
    
    // Helper to toggle a style selection (filter out if user rejects)
    const toggleStyle = (id: number) => {
        const current = styleAnalysisResults.suggestedStyles || [];
        const exists = current.find(s => s.id === id);
        if (exists) {
             setStyleAnalysisResults(prev => prev ? ({
                 ...prev,
                 suggestedStyles: prev.suggestedStyles?.filter(s => s.id !== id)
             }) : null);
        }
    };
    
    // Manage colors per category if detailDataset exists, otherwise global
    // But detectedColors is currently a flat list from Agent 1.5. 
    // To support per-category, we need to restructure how we store/display them.
    // For now, let's allow adding specific tags like "Top: Red". 
    // OR BETTER: Just use the flat list but allow user to be specific in the text.
    
    const removeColor = (colorToRemove: string) => {
        setStyleAnalysisResults(prev => prev ? ({
            ...prev,
            detectedColors: prev.detectedColors?.filter(c => c !== colorToRemove)
        }) : null);
    };

    const addColor = () => {
        const newColor = prompt("Enter a color to add (e.g. 'Navy Blue' or 'Top: Red'):");
        if (newColor) {
             setStyleAnalysisResults(prev => prev ? ({
                ...prev,
                detectedColors: [...(prev.detectedColors || []), newColor]
            }) : null);
        }
    };

    // Split colors by category if possible, or just show flat list
    // Since Agent 1.5 returns a flat list `detected_colors`, we'll stick to that for now 
    // but visually group them if they have prefixes, or just keep simple.
    // REQUEST: "add separate color confirmation box for each category"
    // We need to infer categories from the user's selection `preferences.itemType`
    
    const categories = preferences.itemType.split(',').map(s => s.trim()).filter(Boolean);
    
    return (
        <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <ProgressBar currentStep={step} />
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Analysis Confirmation</h1>
          <p className="text-stone-500 mb-6 text-sm">We detected these vibes from your photos. Confirm or edit to refine your search.</p>

          <div className="space-y-6">
             {/* STYLES SECTION */}
             <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
                <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-stone-500" /> Detected Aesthetics
                </h3>
                <div className="space-y-3">
                    {styles.length > 0 ? styles.map((style) => (
                        <div key={style.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm relative group">
                            <div className="pr-8">
                                <h4 className="font-bold text-stone-900 text-sm">{style.name}</h4>
                                <p className="text-xs text-stone-500 mt-1 line-clamp-2">{style.description}</p>
                                <p className="text-[10px] text-stone-400 mt-2 italic border-t border-stone-100 pt-1">
                                    Why: {style.matchReason}
                                </p>
                            </div>
                            <button 
                                onClick={() => toggleStyle(style.id)}
                                className="absolute top-3 right-3 p-1.5 bg-stone-100 rounded-full text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title="Remove this style"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )) : (
                        <div className="text-center p-4 text-stone-400 text-xs italic">
                            No specific style matched. We will use your general preferences.
                        </div>
                    )}
                </div>
             </div>

             {/* COLORS SECTION - PER CATEGORY */}
             <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <Layers size={14} className="text-stone-500" /> Detected Palette
                    </h3>
                </div>
                
                {/* Global/General Colors (detected without category) */}
                <div className="mb-4">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2 block">General Palette</span>
                    <div className="flex flex-wrap gap-2">
                        {colors.filter(c => !c.includes(':')).map((color, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-white pl-3 pr-2 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-stone-300" style={{backgroundColor: color.toLowerCase().replace(' ', '')}}></span>
                                {color}
                                <button onClick={() => removeColor(color)} className="ml-1 p-0.5 hover:bg-stone-100 rounded text-stone-400 hover:text-red-500">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => {
                             const c = prompt("Add a general color:");
                             if(c) setStyleAnalysisResults(prev => prev ? ({...prev, detectedColors: [...(prev.detectedColors||[]), c]}) : null);
                        }} className="text-xs font-bold text-stone-400 hover:text-stone-600 bg-white px-2 py-1.5 rounded border border-stone-200 border-dashed">
                            + Add
                        </button>
                    </div>
                </div>

                {/* Per-Category Color Overrides */}
                {categories.map(cat => (
                    <div key={cat} className="mb-4 last:mb-0 border-t border-stone-100 pt-3">
                        <span className="text-xs font-bold text-stone-900 uppercase tracking-wide mb-2 block">{cat} Colors</span>
                        <div className="flex flex-wrap gap-2">
                             {/* Show colors specifically tagged with this category (e.g. "Dress: Red") */}
                             {colors.filter(c => c.toLowerCase().startsWith(cat.toLowerCase() + ':')).map((color, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 bg-white pl-3 pr-2 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-stone-300" style={{backgroundColor: color.split(':')[1].trim().toLowerCase()}}></span>
                                    {color.split(':')[1].trim()}
                                    <button onClick={() => removeColor(color)} className="ml-1 p-0.5 hover:bg-stone-100 rounded text-stone-400 hover:text-red-500">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => {
                                 const c = prompt(`Add a color for ${cat}:`);
                                 if(c) setStyleAnalysisResults(prev => prev ? ({...prev, detectedColors: [...(prev.detectedColors||[]), `${cat}: ${c}`]}) : null);
                            }} className="text-xs font-bold text-stone-400 hover:text-stone-600 bg-white px-2 py-1.5 rounded border border-stone-200 border-dashed">
                                + Add {cat} Color
                            </button>
                        </div>
                    </div>
                ))}
             </div>
             
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                 <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
                 <p className="text-xs text-blue-800 leading-relaxed">
                     <span className="font-bold">Note:</span> These verified styles and colors will be used as the <strong>primary search filters</strong>. The structural details (sleeves, fabrics) identified in the background will be used to score the results.
                 </p>
             </div>
          </div>

          <NavigationButtons 
            onContinue={nextStep} 
            onBack={() => setStep(AppStep.IDEAL_STYLE)}
            continueLabel="Confirm & Continue"
          />
        </div>
    );
  };

  // --- CARD 2 LOGIC ---

  // NOTE: handleCard2Analysis and handleGenerateStylistRecs have been consolidated
  // into onCard2Continue inside renderCard2Details for a streamlined Card 2 flow.

  const handleCard2Search = async () => {
      if (selectedOutfitIndex === null || !stylistOutfits[selectedOutfitIndex]) return;
      
      setStep(AppStep.SEARCHING);
      
      const selectedOutfit = stylistOutfits[selectedOutfitIndex];

      try {
          // Step 1: Gemini Pro generates optimized SerpApi search queries
          console.log(">> Generating search queries with Gemini Pro...");
          const searchQueries = await generateSearchQueries(selectedOutfit, profile, preferences);
          console.log(">> Search queries:", searchQueries);

          // Step 2: Run simplified pipeline (procurement + verification + top 3)
          const result = await searchWithStylistQueries(profile, preferences, searchQueries);
          
          const newMsg: ChatMessage = {
            role: 'model',
            content: result.reflectionNotes,
            data: result
          };
          setMessages(prev => [...prev, newMsg]);
          setStep(AppStep.RESULTS);
      } catch (error) {
          console.error("Card 2 Search Failed", error);
          setStep(AppStep.CARD2_RECOMMENDATION);
      }
  };

  // Auto-analyze photo when uploaded for Card 2
  const handleCard2PhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleFileUpload(e, 'userImageBase64', true);
      
      // After photo is set, run vision analysis to detect items
      // We need to wait a tick for state to update
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsAnalyzingCard2(true);
      try {
          // Read the file to get base64 for analysis (handleFileUpload already does this, 
          // but we need the value immediately)
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
          });
          
          const analysis = await analyzeUserPhoto(base64, preferences.purpose, profile.height);
          const detected = analysis.keptItems || [];
          setKeptItems(detected);
          setProfile(prev => ({
              ...prev,
              gender: prev.isProfileSetup ? prev.gender : (analysis.gender || prev.gender),
              estimatedSize: prev.isProfileSetup ? prev.estimatedSize : (analysis.estimatedSize || prev.estimatedSize),
              currentStyle: analysis.currentStyle || prev.currentStyle,
              keptItems: detected
          }));
      } catch (err) {
          console.error('Vision analysis failed:', err);
          setKeptItems([]);
      } finally {
          setIsAnalyzingCard2(false);
      }
  };

  const renderCard2Details = () => {
      const itemTypes = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Footwear', 'Handbags', 'Hair Accessories', 'Jewelries'];

      const onCard2Continue = async () => {
          if (!profile.userImageBase64) return;
          
          const searchingFor = [...selectedItemTypes];
          const currentKeptItems = [...keptItems];
          
          setStep(AppStep.CARD2_RECOMMENDATION);
          setIsGeneratingRecs(true);
          setChatMessages([]);
          setChatInput('');
          setStylistOutfits([]);
          setSelectedOutfitIndex(null);
          setCard3Plan(null);
          setStyleAnalysisResults(null);
          
          try {
              // 1. Style Analysis (Agent 1.5) - analyze ONLY the kept items' style/colors
              // Pass kept items as the target so analyzer focuses on them, not the search items
              const keptItemsForAnalyzer = currentKeptItems.join(', ');
              const styleResult = await runStyleExampleAnalyzer(
                  { ...profile, idealStyleImages: [profile.userImageBase64!] },
                  { ...preferences, itemType: keptItemsForAnalyzer }
              );
              setStyleAnalysisResults(styleResult);

              // 2. Professional Stylist Agent - generate recs ONLY for search items
              // kept_items are context (what user is wearing), search items are what to recommend
              const stylistPrefs = {
                  ...preferences,
                  itemType: searchingFor.join(', '), // Only generate recs for these
              };
              const profileWithKept = {
                  ...profile,
                  keptItems: currentKeptItems, // What user is keeping/wearing
              };
              const response = await generateStylistRecommendations(profileWithKept, stylistPrefs, styleResult);
              setStylistOutfits(response.outfits);
              setSelectedOutfitIndex(0);

              // Fire hero image generation in background (non-blocking)
              generateAllOutfitHeroImages(response.outfits).then(outfitsWithImages => {
                  setStylistOutfits(outfitsWithImages);
              });
              
              // Build chat messages
              const styleName = styleResult?.suggestedStyles?.map(s => s.name).join(', ') || 'Your style';
              const mainColor = styleResult?.detectedColors?.[0] || 'Mixed';
              const otherColors = (styleResult?.detectedColors || []).slice(1);
              const keptItemsText = currentKeptItems.length > 0 ? currentKeptItems.join(', ') : 'your current outfit';
              const searchItemsText = searchingFor.join(', ').toLowerCase();
              
              const analysisMsg: RefinementChatMessage = {
                  role: 'system',
                  content: JSON.stringify({
                      type: 'stylist_analysis',
                      style: styleName,
                      mainColor: mainColor,
                      otherColors: otherColors,
                      searchItems: searchItemsText,
                      keptItems: keptItemsText,
                  }),
              };
              const introMsg: RefinementChatMessage = {
                  role: 'assistant',
                  content: `Based on your current outfit, here are some styling ideas:\n\nPick one option you like, or let me know if you'd like to adjust anything!`,
              };
              setChatMessages([analysisMsg, introMsg]);

          } catch (e) {
              console.error("Card 2 Pipeline Failed", e);
              alert(`Something went wrong during analysis. Error: ${e instanceof Error ? e.message : String(e)}`);
              setStep(AppStep.CARD2_DETAILS);
          } finally {
              setIsGeneratingRecs(false);
          }
      };

      return (
          <div className="max-w-md mx-auto px-6 pt-6 animate-fade-in pb-32">
              {/* Header */}
              <h1 className="text-2xl font-bold font-sans text-stone-900 leading-tight mb-5">
                  Please provide us a photo<br />of your current outfit
              </h1>

              {/* Single Photo Upload - compact */}
              <div className="mb-5">
                  <div className="relative aspect-[5/4] bg-white border-2 border-dashed border-stone-300 rounded-2xl overflow-hidden">
                      {profile.userImageBase64 ? (
                          <>
                              <img src={profile.userImageBase64} alt="Current Outfit" className="w-full h-full object-cover" />
                              <button 
                                  onClick={() => {
                                      setProfile(p => ({...p, userImageBase64: null, keptItems: []}));
                                      setKeptItems([]);
                                  }}
                                  className="absolute top-2.5 right-2.5 bg-white/90 w-7 h-7 flex items-center justify-center rounded-full shadow-sm hover:bg-white text-stone-500 hover:text-red-500 transition-colors"
                              >
                                  <X size={14} />
                              </button>
                          </>
                      ) : (
                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-stone-50 transition-colors">
                              <Plus size={32} className="text-stone-300 mb-2" />
                              <span className="text-sm text-stone-400">Upload photo</span>
                              <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={handleCard2PhotoUpload}
                              />
                          </label>
                      )}
                  </div>
              </div>

              {/* Detected Items - Kept Items Selection */}
              {profile.userImageBase64 && (
                  <div className="mb-5">
                      {isAnalyzingCard2 ? (
                          <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 flex items-center gap-3">
                              <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin shrink-0" />
                              <span className="text-xs text-stone-500">Detecting items in your photo...</span>
                          </div>
                      ) : keptItems.length > 0 ? (
                          <div className="bg-white border border-stone-200 rounded-xl p-4">
                              <p className="text-sm text-stone-700 mb-3">
                                  We detected the following items from this photo. What do you want to keep in your outfit?
                              </p>
                              <div className="flex flex-wrap gap-2">
                                  {(profile.keptItems || []).map((item: string, idx: number) => {
                                      const isKept = keptItems.includes(item);
                                      return (
                                          <button
                                              key={idx}
                                              onClick={() => {
                                                  setKeptItems(prev => 
                                                      isKept ? prev.filter(k => k !== item) : [...prev, item]
                                                  );
                                              }}
                                              className={`relative px-4 py-2 rounded-full text-xs font-medium border-2 transition-all ${
                                                  isKept
                                                      ? 'bg-stone-100 text-stone-900 border-stone-900'
                                                      : 'bg-white text-stone-400 border-stone-200'
                                              }`}
                                          >
                                              {item}
                                              {isKept && (
                                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-stone-900 text-white rounded-full flex items-center justify-center">
                                                      <Check size={10} />
                                                  </span>
                                              )}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      ) : null}
                  </div>
              )}

              {/* Item Selection - what to search for */}
              <div className="mb-5">
                  <p className="text-sm text-stone-400 mb-2">What items do you want to search for?</p>
                  <div className="flex flex-wrap gap-1.5">
                      {itemTypes.map((type) => (
                          <button
                              key={type}
                              onClick={() => {
                                  setSelectedItemTypes(prev => 
                                      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                  );
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                                  selectedItemTypes.includes(type)
                                      ? 'bg-stone-900 text-white border-stone-900'
                                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                              }`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Budget */}
              <div className="mb-6">
                  <p className="text-sm text-stone-400 mb-2">What's your budget?</p>
                  <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center border border-stone-200 rounded-xl px-4 py-3 bg-white">
                          <span className="text-stone-400 font-medium mr-2">$</span>
                          <input 
                              type="number"
                              value={minPrice}
                              onChange={(e) => setMinPrice(e.target.value)}
                              className="w-full outline-none text-stone-900 font-medium bg-transparent"
                              placeholder="Min"
                          />
                      </div>
                      <span className="text-stone-400 text-sm">to</span>
                      <div className="flex-1 flex items-center border border-stone-200 rounded-xl px-4 py-3 bg-white">
                          <span className="text-stone-400 font-medium mr-2">$</span>
                          <input 
                              type="number"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              className="w-full outline-none text-stone-900 font-medium bg-transparent"
                              placeholder="Max"
                          />
                      </div>
                  </div>
              </div>

              <NavigationButtons 
                  onContinue={onCard2Continue}
                  disabled={!profile.userImageBase64 || selectedItemTypes.length === 0}
                  continueLabel="Continue"
                  onBack={() => setStep(AppStep.GOAL_SELECTION)}
              />
          </div>
      );
  };

  // Card 2 chat refinement handler
  const handleCard2ChatSend = async () => {
      const msg = chatInput.trim();
      if (!msg || isChatLoading) return;

      const userMsg: RefinementChatMessage = { role: 'user', content: msg };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          // Use the chat refinement agent to adjust the selected outfit
          const { updatedCriteria, assistantMessage } = await runChatRefinement(
              searchCriteria,
              chatMessages,
              msg,
              profile
          );

          // Merge updated criteria
          if (updatedCriteria && Object.keys(updatedCriteria).length > 0) {
              setSearchCriteria(prev => ({
                  ...prev,
                  ...updatedCriteria,
                  colors: updatedCriteria.colors || prev.colors,
                  includedItems: updatedCriteria.includedItems || prev.includedItems,
                  itemCategories: updatedCriteria.itemCategories || prev.itemCategories,
                  excludedMaterials: updatedCriteria.excludedMaterials || prev.excludedMaterials,
              }));
          }

          const assistantMsg: RefinementChatMessage = {
              role: 'assistant',
              content: assistantMessage,
              criteriaSnapshot: updatedCriteria,
          };
          setChatMessages(prev => [...prev, assistantMsg]);
      } catch (e) {
          console.error('Card 2 chat error:', e);
          const errMsg: RefinementChatMessage = {
              role: 'assistant',
              content: "Sorry, I couldn't process that. Please try again.",
          };
          setChatMessages(prev => [...prev, errMsg]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const renderCard2Recommendations = () => {
      // Parse the analysis data from the system message
      let analysisData: any = null;
      const sysMsg = chatMessages.find(m => m.role === 'system' && m.content.includes('stylist_analysis'));
      if (sysMsg) {
          try { analysisData = JSON.parse(sysMsg.content); } catch {}
      }

      return (
          <div className="max-w-md mx-auto flex flex-col h-screen bg-white">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-stone-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                      <button onClick={() => setStep(AppStep.CARD2_DETAILS)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                          <ChevronLeft size={20} className="text-stone-600" />
                      </button>
                      <div className="text-center">
                          <h1 className="text-sm font-bold text-stone-900">Fashion Stylist</h1>
                          <p className="text-[10px] text-stone-400">Review styling recommendations</p>
                      </div>
                      <div className="w-8" />
                  </div>
              </div>

              {/* Chat + Cards area */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {/* Loading state */}
                  {isGeneratingRecs && stylistOutfits.length === 0 && (
                      <div className="flex justify-center items-center py-16">
                          <div className="text-center">
                              <div className="flex justify-center mb-4">
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '0ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '150ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '300ms' }} />
                              </div>
                              <p className="text-sm font-medium text-stone-600">Analyzing your outfit...</p>
                              <p className="text-xs text-stone-400 mt-1">This may take 15-30 seconds</p>
                          </div>
                      </div>
                  )}

                  {/* Stylist Analysis Card (first message) */}
                  {analysisData && (
                      <div className="flex justify-start">
                          <div className="max-w-[90%] bg-rose-50 border border-rose-100 rounded-2xl rounded-bl-md px-4 py-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                  <Sparkles size={16} className="text-emerald-600" />
                                  <span className="text-sm font-bold text-emerald-700">Stylist Analysis</span>
                              </div>
                              <p className="text-sm text-stone-700 mb-4">
                                  Your current outfit style is <strong>{analysisData.style}</strong>.
                              </p>

                              {/* Colors */}
                              <div className="mb-4">
                                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Color Palette</p>
                                  <div className="flex flex-wrap gap-2">
                                      {analysisData.mainColor && (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-700 shadow-sm">
                                              <span className="w-3 h-3 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(analysisData.mainColor) }} /> {analysisData.mainColor}
                                          </span>
                                      )}
                                      {analysisData.otherColors?.map((c: string, i: number) => (
                                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-700 shadow-sm">
                                              <span className="w-3 h-3 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(c) }} /> {c}
                                          </span>
                                      ))}
                                  </div>
                              </div>

                              {/* Kept items */}
                              {analysisData.keptItems && (
                                  <div className="mb-4">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Keeping</p>
                                      <div className="flex flex-wrap gap-2">
                                          {analysisData.keptItems.split(',').map((item: string, i: number) => (
                                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-800 shadow-sm">
                                                  {itemCatIcon(item.trim())} {item.trim()}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {/* Search items */}
                              {analysisData.searchItems && (
                                  <div className="mb-3">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Searching For</p>
                                      <div className="flex flex-wrap gap-2">
                                          {analysisData.searchItems.split(',').map((item: string, i: number) => (
                                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
                                                  <Search size={10} /> {item.trim()}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {/* Chat messages (skip system messages) */}
                  {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              msg.role === 'user' 
                                  ? 'bg-stone-900 text-white rounded-br-md' 
                                  : 'bg-stone-100 text-stone-800 rounded-bl-md'
                          }`}>
                              {msg.content.split('\n').map((line, li) => (
                                  <p key={li} className={li > 0 ? 'mt-1' : ''}>
                                      {line.split(/(\*\*.*?\*\*)/).map((part, pi) => {
                                          if (part.startsWith('**') && part.endsWith('**')) {
                                              return <strong key={pi}>{part.slice(2, -2)}</strong>;
                                          }
                                          return <span key={pi}>{part}</span>;
                                      })}
                                  </p>
                              ))}
                          </div>
                      </div>
                  ))}

                  {/* Horizontally scrollable outfit cards */}
                  {stylistOutfits.length > 0 && (
                      <div className="pt-1">
                          <p className="text-[10px] text-stone-400 mb-2 italic">Swipe to see all options</p>
                          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                              {stylistOutfits.map((outfit, idx) => {
                                  const isSelected = selectedOutfitIndex === idx;
                                  // Use outfit.name as style title (max ~5 words)
                                  const styleTitle = outfit.name.split(' ').slice(0, 5).join(' ');
                                  
                                  return (
                                      <button
                                          key={idx}
                                          onClick={() => setSelectedOutfitIndex(idx)}
                                          className={`snap-start shrink-0 w-[80%] text-left rounded-2xl transition-all overflow-hidden ${
                                              isSelected 
                                                  ? 'border-2 border-emerald-500 shadow-lg shadow-emerald-100' 
                                                  : 'border border-stone-200 shadow-sm'
                                          }`}
                                      >
                                          {/* Hero Image */}
                                          {outfit.heroImageBase64 ? (
                                              <div className="w-full aspect-[3/4] bg-stone-50 overflow-hidden">
                                                  <img src={outfit.heroImageBase64} alt={styleTitle} className="w-full h-full object-cover" />
                                              </div>
                                          ) : (
                                              <div className="w-full aspect-[3/4] bg-stone-50 flex items-center justify-center">
                                                  <div className="text-center text-stone-300">
                                                      <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin mx-auto mb-2" />
                                                      <p className="text-[10px]">Generating preview...</p>
                                                  </div>
                                              </div>
                                          )}

                                          {/* Card Header */}
                                          <div className="px-4 py-3.5 bg-white border-b border-stone-100">
                                              <h3 className="font-bold text-sm text-stone-900 leading-tight">{styleTitle}</h3>
                                          </div>
                                          
                                          {/* Card Items */}
                                          <div className="px-3 py-3 bg-white space-y-2.5">
                                              {outfit.recommendations.map((rec, rIdx) => {
                                                  // Category icon and color mapping
                                                  const catIcons: Record<string, { icon: string; bg: string; text: string }> = {
                                                      'top': { icon: '👕', bg: 'bg-blue-50', text: 'text-blue-600' },
                                                      'tops': { icon: '👕', bg: 'bg-blue-50', text: 'text-blue-600' },
                                                      'bottom': { icon: '👖', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                                                      'bottoms': { icon: '👖', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                                                      'dress': { icon: '👗', bg: 'bg-pink-50', text: 'text-pink-600' },
                                                      'dresses': { icon: '👗', bg: 'bg-pink-50', text: 'text-pink-600' },
                                                      'outerwear': { icon: '🧥', bg: 'bg-amber-50', text: 'text-amber-600' },
                                                      'footwear': { icon: '👟', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                                                      'shoes': { icon: '👟', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                                                      'handbag': { icon: '👜', bg: 'bg-purple-50', text: 'text-purple-600' },
                                                      'handbags': { icon: '👜', bg: 'bg-purple-50', text: 'text-purple-600' },
                                                      'jewelry': { icon: '💎', bg: 'bg-rose-50', text: 'text-rose-600' },
                                                      'accessories': { icon: '✨', bg: 'bg-teal-50', text: 'text-teal-600' },
                                                      'hair_accessories': { icon: '🎀', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
                                                  };
                                                  const catKey = rec.category.toLowerCase();
                                                  const catStyle = catIcons[catKey] || { icon: '🏷️', bg: 'bg-stone-50', text: 'text-stone-600' };
                                                  
                                                  // Extract a short reason (first phrase before colon or period)
                                                  const shortReason = rec.style_reason 
                                                      ? rec.style_reason.split(/[:.]/)[0].trim()
                                                      : '';
                                                  
                                                  return (
                                                      <div key={rIdx} className={`${catStyle.bg} rounded-xl p-3`}>
                                                          <div className="flex items-start gap-2.5">
                                                              <span className="text-lg mt-0.5">{catStyle.icon}</span>
                                                              <div className="flex-1 min-w-0">
                                                                  <p className={`text-xs font-bold ${catStyle.text} capitalize`}>{rec.category}</p>
                                                                  <p className="text-sm font-medium text-stone-900 leading-snug">{rec.item_name}</p>
                                                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                      {rec.color_role && (
                                                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-700 bg-white px-2 py-0.5 rounded-full border border-stone-200">
                                                                              <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(rec.color_role) }} /> {rec.color_role}
                                                                          </span>
                                                                      )}
                                                                  </div>
                                                                  {shortReason && (
                                                                      <p className="text-[11px] text-stone-500 mt-1.5 leading-snug">{shortReason}</p>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  )}

                  {/* Typing indicator */}
                  {isChatLoading && (
                      <div className="flex justify-start">
                          <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
                              <div className="flex gap-1.5">
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              {/* Input Area */}
              <div className="border-t border-stone-100 bg-white px-4 py-3 pb-6">
                  <div className="flex items-center gap-2">
                      <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCard2ChatSend()}
                          placeholder="Type your response..."
                          className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 focus:bg-white transition-all"
                          disabled={isChatLoading || isGeneratingRecs}
                      />
                      <button
                          onClick={handleCard2ChatSend}
                          disabled={!chatInput.trim() || isChatLoading || isGeneratingRecs}
                          className={`p-3 rounded-xl transition-all ${
                              chatInput.trim() && !isChatLoading && !isGeneratingRecs
                                  ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-md' 
                                  : 'bg-stone-100 text-stone-300'
                          }`}
                      >
                          <Send size={18} />
                      </button>
                  </div>

                  {/* Search button */}
                  {stylistOutfits.length > 0 && selectedOutfitIndex !== null && (
                      <button
                          onClick={handleCard2Search}
                          className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200 flex items-center justify-center gap-2 transition-all"
                      >
                          <Search size={16} />
                          Find Items for Option {String.fromCharCode(65 + selectedOutfitIndex)}
                      </button>
                  )}
              </div>
          </div>
      );
  };

  // --- CARD 3 FLOW ---

  const handleCard3GoToChat = async (occasion: string) => {
      setPreferences(prev => ({ ...prev, occasion }));
      setStep(AppStep.CARD3_CHAT);
      setIsLoading(true);
      setChatMessages([]);
      setChatInput('');
      setCard3Plan(null);
      setStylistOutfits([]);
      setSelectedOutfitIndex(null);
      setStyleAnalysisResults(null);
      setIsGeneratingRecs(false);

      try {
          const plan = await generateOccasionPlan(occasion, profile);
          setCard3Plan(plan);

          // Set selectedItemTypes from the plan
          const itemToDisplay: Record<string, string> = {
              'tops': 'Top', 'bottoms': 'Bottom', 'dresses': 'Dress',
              'outerwear': 'Outerwear', 'footwear': 'Footwear',
              'handbags': 'Handbags', 'jewelry': 'Jewelries',
              'hair_accessories': 'Hair Accessories',
          };
          const detectedItems = plan.items.map(i => itemToDisplay[i] || i).filter(Boolean);
          setSelectedItemTypes(detectedItems);

          // Build chat messages
          const analysisMsg: RefinementChatMessage = {
              role: 'system',
              content: JSON.stringify({ type: 'card3_plan', ...plan, occasion }),
          };
          const welcomeMsg: RefinementChatMessage = {
              role: 'assistant',
              content: `Please confirm or tell us more about your preferences/restrictions to proceed with further outfit construction.`,
          };
          setChatMessages([analysisMsg, welcomeMsg]);
      } catch (err) {
          console.error('Occasion plan error:', err);
          const errMsg: RefinementChatMessage = {
              role: 'assistant',
              content: `I couldn't generate a plan. Please tell me more about what you're looking for.`,
          };
          setChatMessages([errMsg]);
      } finally {
          setIsLoading(false);
      }
  };

  const handleCard3Confirm = async () => {
      if (!card3Plan) return;

      setIsGeneratingRecs(true);
      try {
          // Build a synthetic StyleAnalysisResult from the plan
          const syntheticAnalysis: StyleAnalysisResult = {
              analysisStatus: 'success',
              suggestedStyles: card3Plan.styles.map((s, i) => ({ id: i, name: s, description: s })),
              detectedColors: card3Plan.colors,
              detectedComponents: card3Plan.items,
          };

          // Build preferences with items from the plan
          const card3Prefs = {
              ...preferences,
              itemType: selectedItemTypes.join(', '),
              stylePreference: card3Plan.styles.join(', '),
              colors: card3Plan.colors.join(', '),
          };

          const response = await generateStylistRecommendations(profile, card3Prefs, syntheticAnalysis);
          setStylistOutfits(response.outfits);
          setSelectedOutfitIndex(0);

          // Fire hero image generation in background (non-blocking)
          generateAllOutfitHeroImages(response.outfits).then(outfitsWithImages => {
              setStylistOutfits(outfitsWithImages);
          });
      } catch (e) {
          console.error("Card 3 Stylist Failed", e);
          alert(`Something went wrong. Error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsGeneratingRecs(false);
      }
  };

  const handleCard3Search = async () => {
      if (selectedOutfitIndex === null || !stylistOutfits[selectedOutfitIndex]) return;

      setStep(AppStep.SEARCHING);
      const selectedOutfit = stylistOutfits[selectedOutfitIndex];

      try {
          // Step 1: Gemini Pro generates optimized SerpApi search queries
          console.log(">> Generating search queries with Gemini Pro...");
          const searchQueries = await generateSearchQueries(selectedOutfit, profile, preferences);
          console.log(">> Search queries:", searchQueries);

          // Step 2: Run simplified pipeline (procurement + verification + top 3)
          const result = await searchWithStylistQueries(profile, preferences, searchQueries);

          const newMsg: ChatMessage = {
              role: 'model',
              content: result.reflectionNotes,
              data: result
          };
          setMessages(prev => [...prev, newMsg]);
          setStep(AppStep.RESULTS);
      } catch (error) {
          console.error("Card 3 Search Failed", error);
          setStep(AppStep.CARD3_CHAT);
      }
  };

  // Card 3 chat refinement handler
  const handleCard3ChatSend = async () => {
      const msg = chatInput.trim();
      if (!msg || isChatLoading) return;

      const userMsg: RefinementChatMessage = { role: 'user', content: msg };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          // Build criteria from current plan
          const currentCriteria: SearchCriteria = {
              style: card3Plan?.styles.join(', ') || null,
              colors: card3Plan?.colors || [],
              includedItems: card3Plan?.items || [],
              itemCategories: card3Plan?.items || [],
              excludedMaterials: [],
              occasion: preferences.occasion || null,
              priceRange: preferences.priceRange || null,
              additionalNotes: card3Plan?.features.join(', ') || '',
          };

          const { updatedCriteria, assistantMessage } = await runChatRefinement(
              currentCriteria,
              chatMessages,
              msg,
              profile
          );

          // Update plan if criteria changed
          if (updatedCriteria && Object.keys(updatedCriteria).length > 0) {
              setCard3Plan(prev => {
                  if (!prev) return prev;
                  return {
                      ...prev,
                      styles: updatedCriteria.style ? updatedCriteria.style.split(', ') : prev.styles,
                      colors: updatedCriteria.colors || prev.colors,
                      items: updatedCriteria.includedItems || prev.items,
                  };
              });
          }

          const assistantMsg: RefinementChatMessage = {
              role: 'assistant',
              content: assistantMessage,
              criteriaSnapshot: updatedCriteria,
          };
          setChatMessages(prev => [...prev, assistantMsg]);
      } catch (e) {
          console.error('Card 3 chat error:', e);
          const errMsg: RefinementChatMessage = {
              role: 'assistant',
              content: "Sorry, I couldn't process that. Please try again.",
          };
          setChatMessages(prev => [...prev, errMsg]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const renderCard3Occasion = () => {
      const quickOccasions = ['Wedding Guest', 'Graduation Ceremony', 'Interview', 'Date Night', 'Work/Office', 'Party/Event'];

      return (
          <div className="max-w-md mx-auto flex flex-col h-screen bg-white">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-stone-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                      <button onClick={() => setStep(AppStep.GOAL_SELECTION)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                          <ChevronLeft size={20} className="text-stone-600" />
                      </button>
                      <div className="text-center">
                          <h1 className="text-sm font-bold text-stone-900">New Outfit</h1>
                          <p className="text-[10px] text-stone-400">Tell us about the occasion</p>
                      </div>
                      <div className="w-8" />
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pt-8">
                  <h2 className="text-2xl font-bold text-stone-900 leading-tight mb-2">What's the occasion?</h2>
                  <p className="text-sm text-stone-400 mb-8">Tell us where you'll be wearing this outfit</p>

                  {/* Text input */}
                  <div className="mb-8">
                      <p className="text-xs text-stone-400 mb-2">Type your answer</p>
                      <div className="flex items-center gap-2">
                          <input
                              type="text"
                              value={card3OccasionInput}
                              onChange={(e) => setCard3OccasionInput(e.target.value)}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && card3OccasionInput.trim()) {
                                      handleCard3GoToChat(card3OccasionInput.trim());
                                  }
                              }}
                              placeholder="E.g., Summer wedding, job interview, casu..."
                              className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 transition-all"
                          />
                          <button
                              onClick={() => card3OccasionInput.trim() && handleCard3GoToChat(card3OccasionInput.trim())}
                              disabled={!card3OccasionInput.trim()}
                              className={`p-3 rounded-xl transition-all ${
                                  card3OccasionInput.trim()
                                      ? 'bg-stone-500 text-white hover:bg-stone-600'
                                      : 'bg-stone-100 text-stone-300'
                              }`}
                          >
                              <Send size={18} />
                          </button>
                      </div>
                  </div>

                  {/* Quick occasion options */}
                  <div>
                      <p className="text-xs text-stone-400 mb-3">Or choose from common occasions:</p>
                      <div className="grid grid-cols-2 gap-2">
                          {quickOccasions.map(occ => (
                              <button
                                  key={occ}
                                  onClick={() => handleCard3GoToChat(occ)}
                                  className="px-4 py-3 rounded-xl border text-sm text-left transition-all border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                              >
                                  {occ}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderCard3Chat = () => {
      // Parse plan data from system message
      let planData: any = null;
      const sysMsg = chatMessages.find(m => m.role === 'system' && m.content.includes('card3_plan'));
      if (sysMsg) {
          try { planData = JSON.parse(sysMsg.content); } catch {}
      }

      return (
          <div className="max-w-md mx-auto flex flex-col h-screen bg-white">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-stone-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                      <button onClick={() => setStep(AppStep.CARD3_OCCASION)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                          <ChevronLeft size={20} className="text-stone-600" />
                      </button>
                      <div className="text-center">
                          <h1 className="text-sm font-bold text-stone-900">New Outfit</h1>
                          <p className="text-[10px] text-stone-400">AI Recommendations</p>
                      </div>
                      <div className="w-8" />
                  </div>
              </div>

              {/* Chat area */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {/* Loading state */}
                  {isLoading && !planData && (
                      <div className="flex justify-center items-center py-16">
                          <div className="text-center">
                              <div className="flex justify-center mb-4">
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '0ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '150ms' }} />
                                  <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce mx-0.5" style={{ animationDelay: '300ms' }} />
                              </div>
                              <p className="text-sm font-medium text-stone-600">Planning your outfit...</p>
                              <p className="text-xs text-stone-400 mt-1">Analyzing occasion and style options</p>
                          </div>
                      </div>
                  )}

                  {/* Plan Analysis Card */}
                  {planData && (
                      <div className="flex justify-start">
                          <div className="max-w-[90%] bg-rose-50 border border-rose-100 rounded-2xl rounded-bl-md px-4 py-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                  <Sparkles size={16} className="text-emerald-600" />
                                  <span className="text-sm font-bold text-emerald-700">Based on your occasion</span>
                              </div>
                              <p className="text-sm text-stone-700 mb-4">
                                  For "<strong>{planData.occasion}</strong>", we would recommend:
                              </p>

                              {planData.items?.length > 0 && (
                                  <div className="mb-4">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Outfit Items</p>
                                      <div className="flex flex-wrap gap-2">
                                          {planData.items.map((item: string, i: number) => (
                                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-800 capitalize shadow-sm">
                                                  {itemCatIcon(item)} {item}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {planData.styles?.length > 0 && (
                                  <div className="mb-4">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Style</p>
                                      <div className="flex flex-wrap gap-2">
                                          {planData.styles.map((s: string, i: number) => (
                                              <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700">
                                                  {s}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {planData.colors?.length > 0 && (
                                  <div className="mb-4">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Color Palette</p>
                                      <div className="flex flex-wrap gap-2">
                                          {planData.colors.map((c: string, i: number) => (
                                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-700 shadow-sm">
                                                  <span className="w-3 h-3 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(c) }} /> {c}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {planData.features?.length > 0 && (
                                  <div className="mb-3">
                                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Key Features</p>
                                      <div className="flex flex-wrap gap-2">
                                          {planData.features.map((f: string, i: number) => (
                                              <span key={i} className="px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-full text-xs font-medium text-stone-600">
                                                  {f}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              <p className="text-sm text-stone-600 mt-3">Please confirm or tell us more about your preferences/restrictions to proceed with further outfit construction.</p>
                          </div>
                      </div>
                  )}

                  {/* Chat messages (skip system) */}
                  {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              msg.role === 'user'
                                  ? 'bg-stone-900 text-white rounded-br-md'
                                  : 'bg-stone-100 text-stone-800 rounded-bl-md'
                          }`}>
                              {msg.content.split('\n').map((line, li) => (
                                  <p key={li} className={li > 0 ? 'mt-1' : ''}>
                                      {line.split(/(\*\*.*?\*\*)/).map((part, pi) => {
                                          if (part.startsWith('**') && part.endsWith('**')) {
                                              return <strong key={pi}>{part.slice(2, -2)}</strong>;
                                          }
                                          return <span key={pi}>{part}</span>;
                                      })}
                                  </p>
                              ))}
                          </div>
                      </div>
                  ))}

                  {/* Outfit cards (after stylist generates) */}
                  {stylistOutfits.length > 0 && (
                      <div className="pt-1">
                          <p className="text-[10px] text-stone-400 mb-2 italic">Swipe to see all options</p>
                          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                              {stylistOutfits.map((outfit, idx) => {
                                  const isSelected = selectedOutfitIndex === idx;
                                  const styleTitle = outfit.name.split(' ').slice(0, 5).join(' ');
                                  
                                  return (
                                      <button
                                          key={idx}
                                          onClick={() => setSelectedOutfitIndex(idx)}
                                          className={`snap-start shrink-0 w-[80%] text-left rounded-2xl transition-all overflow-hidden ${
                                              isSelected ? 'border-2 border-emerald-500 shadow-lg shadow-emerald-100' : 'border border-stone-200 shadow-sm'
                                          }`}
                                      >
                                          {/* Hero Image */}
                                          {outfit.heroImageBase64 ? (
                                              <div className="w-full aspect-[3/4] bg-stone-50 overflow-hidden">
                                                  <img src={outfit.heroImageBase64} alt={styleTitle} className="w-full h-full object-cover" />
                                              </div>
                                          ) : (
                                              <div className="w-full aspect-[3/4] bg-stone-50 flex items-center justify-center">
                                                  <div className="text-center text-stone-300">
                                                      <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin mx-auto mb-2" />
                                                      <p className="text-[10px]">Generating preview...</p>
                                                  </div>
                                              </div>
                                          )}

                                          <div className="px-4 py-3.5 bg-white border-b border-stone-100">
                                              <h3 className="font-bold text-sm text-stone-900 leading-tight">{styleTitle}</h3>
                                          </div>
                                          <div className="px-3 py-3 bg-white space-y-2.5">
                                              {outfit.recommendations.map((rec, rIdx) => {
                                                  const catIcons: Record<string, { icon: string; bg: string; text: string }> = {
                                                      'top': { icon: '👕', bg: 'bg-blue-50', text: 'text-blue-600' },
                                                      'tops': { icon: '👕', bg: 'bg-blue-50', text: 'text-blue-600' },
                                                      'bottom': { icon: '👖', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                                                      'bottoms': { icon: '👖', bg: 'bg-indigo-50', text: 'text-indigo-600' },
                                                      'dress': { icon: '👗', bg: 'bg-pink-50', text: 'text-pink-600' },
                                                      'dresses': { icon: '👗', bg: 'bg-pink-50', text: 'text-pink-600' },
                                                      'outerwear': { icon: '🧥', bg: 'bg-amber-50', text: 'text-amber-600' },
                                                      'footwear': { icon: '👟', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                                                      'shoes': { icon: '👟', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                                                      'handbag': { icon: '👜', bg: 'bg-purple-50', text: 'text-purple-600' },
                                                      'handbags': { icon: '👜', bg: 'bg-purple-50', text: 'text-purple-600' },
                                                      'jewelry': { icon: '💎', bg: 'bg-rose-50', text: 'text-rose-600' },
                                                      'accessories': { icon: '✨', bg: 'bg-teal-50', text: 'text-teal-600' },
                                                      'hair_accessories': { icon: '🎀', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
                                                  };
                                                  const catKey = rec.category.toLowerCase();
                                                  const catStyle = catIcons[catKey] || { icon: '🏷️', bg: 'bg-stone-50', text: 'text-stone-600' };
                                                  const shortReason = rec.style_reason ? rec.style_reason.split(/[:.]/)[0].trim() : '';
                                                  
                                                  return (
                                                      <div key={rIdx} className={`${catStyle.bg} rounded-xl p-3`}>
                                                          <div className="flex items-start gap-2.5">
                                                              <span className="text-lg mt-0.5">{catStyle.icon}</span>
                                                              <div className="flex-1 min-w-0">
                                                                  <p className={`text-xs font-bold ${catStyle.text} capitalize`}>{rec.category}</p>
                                                                  <p className="text-sm font-medium text-stone-900 leading-snug">{rec.item_name}</p>
                                                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                      {rec.color_role && (
                                                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-700 bg-white px-2 py-0.5 rounded-full border border-stone-200">
                                                                              <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-stone-200" style={{ backgroundColor: colorNameToCSS(rec.color_role) }} /> {rec.color_role}
                                                                          </span>
                                                                      )}
                                                                  </div>
                                                                  {shortReason && (
                                                                      <p className="text-[11px] text-stone-500 mt-1.5 leading-snug">{shortReason}</p>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  )}

                  {/* Generating recs indicator */}
                  {isGeneratingRecs && (
                      <div className="flex justify-start">
                          <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
                              <div className="flex items-center gap-2">
                                  <div className="flex gap-1.5">
                                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </div>
                                  <span className="text-xs text-stone-500">Creating outfit options...</span>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Typing indicator for chat */}
                  {isChatLoading && (
                      <div className="flex justify-start">
                          <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
                              <div className="flex gap-1.5">
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              {/* Input Area */}
              <div className="border-t border-stone-100 bg-white px-4 py-3 pb-6">
                  <div className="flex items-center gap-2">
                      <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCard3ChatSend()}
                          placeholder="Type your response..."
                          className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-400 focus:bg-white transition-all"
                          disabled={isChatLoading || isLoading}
                      />
                      <button
                          onClick={handleCard3ChatSend}
                          disabled={!chatInput.trim() || isChatLoading || isLoading}
                          className={`p-3 rounded-xl transition-all ${
                              chatInput.trim() && !isChatLoading && !isLoading
                                  ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-md'
                                  : 'bg-stone-100 text-stone-300'
                          }`}
                      >
                          <Send size={18} />
                      </button>
                  </div>

                  {/* Action buttons */}
                  {planData && !isGeneratingRecs && stylistOutfits.length === 0 && (
                      <button
                          onClick={handleCard3Confirm}
                          className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200 flex items-center justify-center gap-2 transition-all"
                      >
                          <Sparkles size={16} />
                          Generate Outfit Options
                      </button>
                  )}

                  {stylistOutfits.length > 0 && selectedOutfitIndex !== null && (
                      <button
                          onClick={handleCard3Search}
                          className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200 flex items-center justify-center gap-2 transition-all"
                      >
                          <Search size={16} />
                          Find Items for Option {String.fromCharCode(65 + selectedOutfitIndex)}
                      </button>
                  )}
              </div>
          </div>
      );
  };

  const renderIdealStyle = () => {
    return (
        <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          {/* Custom Progress Bar for this Step if needed, or use default */}
          <ProgressBar currentStep={step} />
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Ideal Look Examples</h1>
          <p className="text-stone-500 mb-8 text-sm">Optional: Upload images of outfits you love to help us match the vibe.</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
             {profile.idealStyleImages.map((img, idx) => (
                 <div key={idx} className="relative aspect-[3/4] bg-stone-100 rounded-xl overflow-hidden border border-stone-200">
                     <img src={img} alt={`Example ${idx+1}`} className="w-full h-full object-cover" />
                     <button 
                        onClick={() => removeIdealImage(idx)}
                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow-sm hover:bg-white text-stone-500 hover:text-red-500 transition-colors"
                     >
                        <X size={14} />
                     </button>
                 </div>
             ))}
             
             <label className="aspect-[3/4] bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-stone-100 transition-all text-stone-400 hover:text-stone-600">
                 <Plus size={32} className="mb-2" />
                 <span className="text-xs font-medium">Add Image</span>
                 <input 
                    type="file" 
                    className="hidden" 
                    multiple
                    accept="image/*"
                    onChange={handleIdealStyleUpload}
                 />
             </label>
          </div>
          
          <div className="bg-stone-50 p-4 rounded-xl mb-4 border border-stone-100 flex items-start gap-3">
             <div className="bg-stone-900 text-white p-2 rounded-lg mt-0.5">
                 <Sparkles size={16} />
             </div>
             <div>
                 <h4 className="text-sm font-bold text-stone-900">Style Example Analyzer</h4>
                 <p className="text-xs text-stone-500 mt-1">If you upload examples, Agent 1.5 will analyze them for specific cuts, colors, and vibes to score search results.</p>
             </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4">
              <p className="text-xs text-blue-800 text-center">
                  <strong>Tip:</strong> Uploading photos lets you skip the manual style & color questions!
              </p>
          </div>

          <div className="flex flex-col gap-3">
              <button 
                onClick={nextStep}
                disabled={profile.idealStyleImages.length === 0}
                className={`w-full bg-stone-950 text-white font-medium h-12 rounded-xl transition-all shadow-lg shadow-stone-200 ${profile.idealStyleImages.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-800'}`}
              >
                Analyze & Auto-Fill
              </button>
              
              <button 
                onClick={() => setStep(AppStep.OCCASION)}
                className="w-full bg-stone-100 text-stone-500 font-medium h-12 rounded-xl transition-colors hover:bg-stone-200 hover:text-stone-700"
              >
                Skip (Configure Manually)
              </button>
          </div>
          
          <div className="mt-6 flex justify-center">
             <button 
                onClick={prevStep}
                className="w-12 h-12 flex items-center justify-center border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
              >
                <ChevronLeft size={24} className="text-stone-600" />
              </button>
          </div>
        </div>
    );
  };

  const renderResults = () => (
    <div className="w-full max-w-5xl mx-auto h-[100dvh] flex flex-col bg-stone-50">
       <div className="flex-1 overflow-y-auto space-y-6 pb-32 px-4 pt-6">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setStep(AppStep.GOAL_SELECTION)}
                className="p-2 -ml-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold font-sans text-stone-900">Search Results</h2>
            </div>
          </div>

          {messages.map((msg, idx) => {
              if (msg.role === 'user') return null;

              return (
                  <div key={idx} className="space-y-6 animate-fade-in">
                      {/* Chat Refinement Box */}
                      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                          <label className="text-xs font-bold text-stone-500 uppercase mb-2 block">Refine Results</label>
                          <div className="flex gap-2">
                              <input 
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="e.g. 'Make it cheaper' or 'Show me red'"
                                  className="flex-1 p-3 bg-stone-50 rounded-lg outline-none focus:ring-1 focus:ring-stone-900"
                                  onKeyDown={(e) => e.key === 'Enter' && handleRefinement()}
                              />
                              <button 
                                  onClick={handleRefinement}
                                  className="p-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
                              >
                                  <Sparkles size={18} />
                              </button>
                          </div>
                      </div>

                      {/* Duration summary — extract total latency from reflectionNotes */}
                      {(() => {
                          const notes = msg.data?.reflectionNotes || '';
                          const latencyMatch = notes.match(/Total Latency:\s*(\d+)ms/);
                          const duration = latencyMatch ? `${(Number(latencyMatch[1]) / 1000).toFixed(1)}s` : null;
                          return duration ? (
                              <div className="flex items-center gap-2 text-xs text-stone-400">
                                  <CheckCircle2 size={12} className="text-green-500" />
                                  <span>Search completed in {duration}</span>
                              </div>
                          ) : null;
                      })()}

                      <div className="space-y-5">
                          {msg.data?.recommendations.map((outfit, rIdx) => {
                              const catIcon = itemCatIcon(outfit.name.toLowerCase().includes('top') ? 'top' : outfit.components?.[0]?.category || '');
                              return (
                              <div key={rIdx} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
                                  {/* Category Group Header */}
                                  <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
                                      <div className="flex items-center gap-2.5">
                                          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                              <ShoppingBag size={16} className="text-emerald-600" />
                                          </div>
                                          <h4 className="font-bold text-base text-stone-900">{outfit.name}</h4>
                                      </div>
                                      <span className="text-xs font-medium text-stone-400">{outfit.components?.length || 0} items</span>
                                  </div>

                                  {/* Product Items */}
                                  <div className="divide-y divide-stone-50">
                                      {outfit.components && outfit.components.map((comp, cIdx) => (
                                          <div key={cIdx} className="px-5 py-4">
                                              <div className="flex items-center gap-4">
                                                  {/* Product Thumbnail */}
                                                  <div className="relative shrink-0">
                                                      {comp.imageUrl ? (
                                                          <div className="w-20 h-20 rounded-xl bg-stone-50 overflow-hidden border border-stone-100">
                                                              <img src={comp.imageUrl} alt={comp.name} className="w-full h-full object-cover" />
                                                          </div>
                                                      ) : (
                                                          <div className="w-20 h-20 rounded-xl bg-stone-50 flex items-center justify-center border border-stone-100">
                                                              <Layers size={20} className="text-stone-300" />
                                                          </div>
                                                      )}
                                                      {/* Verified badge */}
                                                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                                                          <Check size={12} className="text-white" strokeWidth={3} />
                                                      </div>
                                                  </div>

                                                  {/* Product Info */}
                                                  <div className="flex-1 min-w-0">
                                                      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{comp.category}</p>
                                                      <h5 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2">{comp.name}</h5>
                                                      <div className="flex items-center gap-1.5 mt-1">
                                                          <span className="text-xs text-stone-500">{comp.brand}</span>
                                                          <span className="text-xs text-stone-300">•</span>
                                                          <span className="text-xs font-semibold text-emerald-600">Verified</span>
                                                      </div>
                                                      <p className="text-lg font-bold text-emerald-600 mt-1.5">{comp.price || 'Check Site'}</p>
                                                  </div>

                                                  {/* Action buttons */}
                                                  <div className="flex flex-col gap-1.5 shrink-0">
                                                      {comp.purchaseUrl && comp.purchaseUrl.startsWith('http') ? (
                                                          <a 
                                                              href={comp.purchaseUrl}
                                                              target="_blank" 
                                                              rel="noopener noreferrer"
                                                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-900 text-white hover:bg-stone-700 transition-colors shadow-sm"
                                                              title="Buy Item"
                                                          >
                                                              <ExternalLink size={14} />
                                                          </a>
                                                      ) : (
                                                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-100 text-stone-300 cursor-not-allowed" title="Link Unavailable">
                                                              <ExternalLink size={14} />
                                                          </div>
                                                      )}
                                                      {comp.fallbackSearchUrl && (
                                                          <a 
                                                              href={comp.fallbackSearchUrl}
                                                              target="_blank" 
                                                              rel="noopener noreferrer"
                                                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors border border-stone-100"
                                                              title="Find Similar"
                                                          >
                                                              <Search size={14} />
                                                          </a>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              );
                          })}
                      </div>
                      
                      {msg.data?.recommendations.length === 0 && (
                          <div className="text-center p-8 bg-white rounded-2xl border border-red-100">
                              <p className="text-red-600 font-bold mb-2">No Results Found</p>
                              <p className="text-sm text-stone-500">We couldn't find matching items. Try relaxing your search criteria or budget.</p>
                          </div>
                      )}
                  </div>
              );
          })}
       </div>

       {/* Bottom Navigation Bar */}
       <div className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-100 p-4 pb-8 z-10">
           <div className="max-w-5xl mx-auto flex items-center justify-between px-4 gap-3">
               <button 
                   onClick={() => setStep(AppStep.GOAL_SELECTION)}
                   className="flex items-center gap-2 px-5 h-12 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-sm font-medium text-stone-600"
               >
                   <Home size={16} />
                   Start Over
               </button>
               <button 
                   onClick={() => {
                       setMessages([]);
                       setStep(AppStep.GOAL_SELECTION);
                   }}
                   className="flex-1 bg-stone-950 text-white font-medium h-12 rounded-xl transition-all shadow-lg shadow-stone-200 hover:bg-stone-800 text-sm flex items-center justify-center gap-2"
               >
                   <Search size={16} />
                   New Search
               </button>
           </div>
       </div>
    </div>
  );

  // --- PROFILE SETUP PAGE ---
  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64 = reader.result as string;
          setProfile(prev => ({ ...prev, profilePhotoBase64: base64 }));
      };
      reader.readAsDataURL(file);
  };

  const handleProfileAnalysis = async () => {
      if (!profile.profilePhotoBase64) return;
      setIsAnalyzingProfile(true);
      try {
          const result = await analyzeProfilePhoto(profile.profilePhotoBase64);
          setProfile(prev => ({
              ...prev,
              ...result,
              isProfileSetup: true,
          }));
      } catch (e) {
          console.error("Profile analysis failed", e);
      } finally {
          setIsAnalyzingProfile(false);
      }
  };

  const renderProfileSetup = () => (
      <div className="max-w-md mx-auto px-6 pt-6 animate-fade-in pb-32">
          {/* Back Button */}
          <button 
              onClick={() => {
                  // Go back to where we came from
                  setStep(previousStep === AppStep.PROFILE_SETUP || previousStep === AppStep.PROFILE_VIEW ? AppStep.GOAL_SELECTION : previousStep);
              }}
              className="mb-4 p-2 -ml-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
              <ChevronLeft size={24} />
          </button>

          <div className="text-center mb-8">
              <div className="w-16 h-16 bg-stone-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={28} />
              </div>
              <h1 className="text-2xl font-bold font-sans text-stone-900 mb-1">Physical Profile Setup</h1>
              <p className="text-stone-500 text-sm">Upload a photo and we will analyze your physical attributes using AI</p>
          </div>

          {/* Photo Upload Area */}
          <div className="mb-6">
              <div className="relative aspect-[3/4] max-h-[350px] bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl overflow-hidden hover:bg-stone-100 transition-all group mx-auto">
                  {profile.profilePhotoBase64 ? (
                      <>
                          <img src={profile.profilePhotoBase64} alt="Profile" className="w-full h-full object-cover" />
                          <button 
                              onClick={() => setProfile(p => ({...p, profilePhotoBase64: null}))}
                              className="absolute top-3 right-3 bg-white/90 p-2 rounded-full shadow-sm text-stone-500 hover:text-red-500"
                          >
                              <X size={16} />
                          </button>
                      </>
                  ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                          <div className="bg-white p-4 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                              <Camera size={28} className="text-stone-900" />
                          </div>
                          <span className="font-semibold text-stone-700 text-sm">Upload Full Body Photo</span>
                          <span className="text-xs text-stone-400 mt-1">JPG, PNG, or HEIC</span>
                          <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleProfilePhotoUpload}
                          />
                      </label>
                  )}
              </div>
          </div>

          {/* Analyze Button */}
          {profile.profilePhotoBase64 && !profile.isProfileSetup && (
              <button 
                  onClick={handleProfileAnalysis}
                  disabled={isAnalyzingProfile}
                  className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-6 transition-all ${
                      isAnalyzingProfile 
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                          : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200'
                  }`}
              >
                  {isAnalyzingProfile ? (
                      <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Analyzing with Nano Banana Pro...
                      </>
                  ) : (
                      <>
                          <Sparkles size={16} />
                          Analyze with AI
                      </>
                  )}
              </button>
          )}

          {/* Results / Manual Input */}
          {(profile.isProfileSetup || !profile.profilePhotoBase64) && (
              <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-stone-900">
                          {profile.isProfileSetup ? 'Detected Attributes' : 'Or enter manually'}
                      </h3>
                      {profile.isProfileSetup && (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={10} /> AI Detected
                          </span>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Gender</label>
                          <select 
                              value={profile.gender}
                              onChange={(e) => setProfile(p => ({...p, gender: e.target.value}))}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          >
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                              <option value="Non-binary">Non-binary</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Age Range</label>
                          <select 
                              value={profile.age || ''}
                              onChange={(e) => setProfile(p => ({...p, age: e.target.value}))}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          >
                              <option value="">Select</option>
                              <option value="18-24">18-24</option>
                              <option value="25-30">25-30</option>
                              <option value="31-40">31-40</option>
                              <option value="41-50">41-50</option>
                              <option value="50+">50+</option>
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Height</label>
                          <input 
                              type="text"
                              value={profile.height || ''}
                              onChange={(e) => setProfile(p => ({...p, height: e.target.value}))}
                              placeholder="e.g. 165 cm"
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Height Category</label>
                          <select 
                              value={profile.heightCategory || ''}
                              onChange={(e) => setProfile(p => ({...p, heightCategory: e.target.value}))}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          >
                              <option value="">Select</option>
                              <option value="Petite">Petite</option>
                              <option value="Average">Average</option>
                              <option value="Tall">Tall</option>
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Clothing Size</label>
                          <select 
                              value={profile.estimatedSize}
                              onChange={(e) => setProfile(p => ({...p, estimatedSize: e.target.value}))}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          >
                              <option value="XS">XS</option>
                              <option value="S">S</option>
                              <option value="M">M</option>
                              <option value="L">L</option>
                              <option value="XL">XL</option>
                              <option value="XXL">XXL</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Shoe Size</label>
                          <input 
                              type="text"
                              value={profile.shoeSize || ''}
                              onChange={(e) => setProfile(p => ({...p, shoeSize: e.target.value}))}
                              placeholder="e.g. US 7"
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900"
                          />
                      </div>
                  </div>
              </div>
          )}

          <button 
              onClick={() => {
                  setProfile(p => ({...p, isProfileSetup: true}));
                  setStep(AppStep.PROFILE_VIEW);
              }}
              disabled={!profile.gender || !profile.estimatedSize}
              className={`w-full mt-6 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  (!profile.gender || !profile.estimatedSize) 
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed' 
                      : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200'
              }`}
          >
              <Save size={16} />
              Save Profile
          </button>
      </div>
  );

  // --- PROFILE VIEW / EDIT PAGE ---
  const renderProfileView = () => {
      const fields = [
          { label: 'Gender', value: profile.gender, key: 'gender', icon: <User size={16} /> },
          { label: 'Age Range', value: profile.age || 'Not set', key: 'age', icon: <User size={16} /> },
          { label: 'Height', value: profile.height || 'Not set', key: 'height', icon: <Ruler size={16} /> },
          { label: 'Height Category', value: profile.heightCategory || 'Not set', key: 'heightCategory', icon: <Ruler size={16} /> },
          { label: 'Clothing Size', value: profile.estimatedSize, key: 'estimatedSize', icon: <Layers size={16} /> },
          { label: 'Shoe Size', value: profile.shoeSize || 'Not set', key: 'shoeSize', icon: <Footprints size={16} /> },
      ];

      return (
          <div className="max-w-md mx-auto px-6 pt-6 animate-fade-in pb-32">
              {/* Back Button */}
              <button 
                  onClick={() => {
                      setIsEditingProfile(false);
                      setStep(previousStep === AppStep.PROFILE_SETUP || previousStep === AppStep.PROFILE_VIEW ? AppStep.GOAL_SELECTION : previousStep);
                  }}
                  className="mb-4 p-2 -ml-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
              >
                  <ChevronLeft size={24} />
              </button>

              {/* Profile Header */}
              <div className="text-center mb-8">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                      {profile.profilePhotoBase64 ? (
                          <img src={profile.profilePhotoBase64} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-stone-100 shadow-lg" />
                      ) : (
                          <div className="w-24 h-24 rounded-full bg-stone-100 border-4 border-stone-200 flex items-center justify-center">
                              <User size={32} className="text-stone-400" />
                          </div>
                      )}
                      {profile.isProfileSetup && (
                          <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full">
                              <Check size={12} />
                          </div>
                      )}
                  </div>
                  <h1 className="text-xl font-bold text-stone-900">My Profile</h1>
                  <p className="text-xs text-stone-500 mt-1">
                      {profile.isProfileSetup ? 'AI-analyzed physical profile' : 'Profile not yet analyzed'}
                  </p>
              </div>

              {/* Profile Cards */}
              <div className="space-y-3 mb-6">
                  {fields.map((field) => (
                      <div key={field.key} className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-stone-50 rounded-lg flex items-center justify-center text-stone-500">
                                  {field.icon}
                              </div>
                              <div>
                                  <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide">{field.label}</p>
                                  {isEditingProfile ? (
                                      <input
                                          type="text"
                                          value={field.value === 'Not set' ? '' : field.value}
                                          onChange={(e) => setProfile(p => ({...p, [field.key]: e.target.value}))}
                                          className="text-sm font-bold text-stone-900 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 mt-0.5 outline-none focus:border-stone-900 w-full"
                                      />
                                  ) : (
                                      <p className={`text-sm font-bold ${field.value === 'Not set' ? 'text-stone-300' : 'text-stone-900'}`}>
                                          {field.value}
                                      </p>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                  <button
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                          isEditingProfile 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                      }`}
                  >
                      {isEditingProfile ? (
                          <><Check size={16} /> Save Changes</>
                      ) : (
                          <><Edit2 size={16} /> Edit Profile</>
                      )}
                  </button>
                  <button
                      onClick={() => {
                          setProfile(p => ({...p, profilePhotoBase64: null, isProfileSetup: false}));
                          setIsEditingProfile(false);
                          setStep(AppStep.PROFILE_SETUP);
                      }}
                      className="w-full py-3 rounded-xl font-bold text-sm bg-white text-stone-400 border border-stone-100 hover:bg-stone-50 flex items-center justify-center gap-2"
                  >
                      <Camera size={16} /> Re-Scan with New Photo
                  </button>
              </div>
          </div>
      );
  };

  // --- BOTTOM NAVIGATION BAR ---
  // Only show BottomNav on landing page and profile pages — hide on all wizard/flow pages
  const showBottomNav = step === AppStep.GOAL_SELECTION || step === AppStep.PROFILE_SETUP || step === AppStep.PROFILE_VIEW;
  const isProfilePage = step === AppStep.PROFILE_SETUP || step === AppStep.PROFILE_VIEW;
  const isHomePage = !isProfilePage;

  const BottomNav = () => (
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-100 z-40">
          <div className="max-w-md mx-auto flex items-center justify-around py-2 pb-6">
              <button 
                  onClick={() => {
                      if (!isHomePage) {
                          setStep(previousStep === AppStep.PROFILE_SETUP || previousStep === AppStep.PROFILE_VIEW ? AppStep.GOAL_SELECTION : previousStep);
                      }
                  }}
                  className={`flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition-all ${
                      isHomePage ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
                  }`}
              >
                  <Home size={22} strokeWidth={isHomePage ? 2.5 : 1.5} />
                  <span className={`text-[10px] ${isHomePage ? 'font-bold' : 'font-medium'}`}>Home</span>
              </button>
              <button 
                  onClick={() => {
                      if (!isProfilePage) {
                          setPreviousStep(step);
                          setStep(profile.isProfileSetup ? AppStep.PROFILE_VIEW : AppStep.PROFILE_SETUP);
                      }
                  }}
                  className={`flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition-all relative ${
                      isProfilePage ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
                  }`}
              >
                  <User size={22} strokeWidth={isProfilePage ? 2.5 : 1.5} />
                  <span className={`text-[10px] ${isProfilePage ? 'font-bold' : 'font-medium'}`}>Profile</span>
                  {!profile.isProfileSetup && (
                      <div className="absolute top-0.5 right-4 w-2 h-2 bg-red-500 rounded-full" />
                  )}
              </button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans selection:bg-stone-200">
        <main className="min-h-screen pb-20">
            {step === AppStep.GOAL_SELECTION && renderLanding()}
            {step === AppStep.ITEM_TYPE && renderItemType()}
            {step === AppStep.UPLOAD_PHOTO && renderUploadPhoto()}
            {step === AppStep.PROFILE_MANUAL && renderProfileManual()}
            {/* Card 1 Flow */}
            {step === AppStep.CARD1_DETAILS && renderCard1Details()}
            {/* CARD1_PROFILE and CARD1_CONFIRM removed - Card 1 goes directly from CARD1_DETAILS to CARD1_CHAT */}
            {step === AppStep.CARD1_CHAT && renderCard1Chat()}
            {/* Card 2 Flow */}
            {step === AppStep.CARD2_DETAILS && renderCard2Details()}
            {step === AppStep.CARD2_RECOMMENDATION && renderCard2Recommendations()}
            {/* Card 3 Flow */}
            {step === AppStep.CARD3_OCCASION && renderCard3Occasion()}
            {step === AppStep.CARD3_CHAT && renderCard3Chat()}
            {/* Standard Flow */}
            {step === AppStep.IDEAL_STYLE && renderIdealStyle()}
            {step === AppStep.CONFIRMATION && renderConfirmation()}
            {step === AppStep.PREFERENCES_DASHBOARD && renderPreferencesDashboard()}
            {step === AppStep.OCCASION && renderOccasion()}
            {step === AppStep.STYLE && renderStyle()}
            {step === AppStep.COLOR && renderColor()}
            {step === AppStep.PRICE_RANGE && renderPriceRange()}
            {(step === AppStep.SEARCHING || step === AppStep.RESULTS) && renderResults()}
            {/* Profile Pages */}
            {step === AppStep.PROFILE_SETUP && renderProfileSetup()}
            {step === AppStep.PROFILE_VIEW && renderProfileView()}
        </main>
        
        {/* Bottom Navigation */}
        {showBottomNav && <BottomNav />}

        {step === AppStep.SEARCHING && (
             <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6">
                 <div className="w-16 h-16 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin mb-8"></div>
                 <h3 className="text-2xl font-bold font-sans text-stone-900 mb-2">Searching for you</h3>
                 <p className="text-stone-500 max-w-md animate-pulse">
                     Finding the best items across online stores...
                 </p>
                 {selectedItemTypes.length > 0 && (
                     <div className="mt-4 flex flex-wrap justify-center gap-2">
                         {selectedItemTypes.map((item, i) => (
                             <span key={i} className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full">
                                 <Search size={10} /> {item}
                             </span>
                         ))}
                     </div>
                 )}
             </div>
        )}
    </div>
  );
}