import React, { useState, useEffect } from 'react';
import { AppStep, UserProfile, Preferences, FashionPurpose, ChatMessage, StyleAnalysisResult } from './types';
import { analyzeUserPhoto, searchAndRecommend, searchAndRecommendCard1, generateStylistRecommendations } from './services/geminiService';
import { runStyleExampleAnalyzer } from './services/agent_style_analyzer';
import { analyzeUserIntent, refinePreferences } from './services/agent_router';
import { Upload, Camera, ArrowLeft, ShieldCheck, CheckCircle2, ChevronLeft, X, FileImage, ExternalLink, Layers, Search, Check, Sparkles, Plus, Edit2, AlertCircle, MessageSquare, ArrowRight } from 'lucide-react';
// import ReactMarkdown from 'react-markdown';

const DefaultProfile: UserProfile = {
  gender: 'Female',
  estimatedSize: 'M',
  currentStyle: '',
  keptItems: [],
  userImageBase64: null,
  idealStyleImages: [],
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
  <div className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-100 p-4 pb-8 z-10">
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
  const [minPrice, setMinPrice] = useState<number | string>(210);
  const [maxPrice, setMaxPrice] = useState<number | string>(1000);

  const [searchQuery, setSearchQuery] = useState(''); // For Landing & Refinement

  // --- CARD 1 FLOW STATE ---
  const [card1AnalysisPromise, setCard1AnalysisPromise] = useState<Promise<StyleAnalysisResult> | null>(null);
  
  // Card 2 State
  const [keptItems, setKeptItems] = useState<string[]>([]);
  const [stylistRecommendation, setStylistRecommendation] = useState<string>("");
  const [stylistSearchQueries, setStylistSearchQueries] = useState<Record<string, string>>({});
  const [isAnalyzingCard2, setIsAnalyzingCard2] = useState(false);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);

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

    setPreferences(prev => ({
      ...prev,
      itemType: processedItemTypes.join(', '),
      priceRange: `$${minPrice} - $${maxPrice}`
    }));
  }, [selectedItemTypes, customItemType, minPrice, maxPrice]);

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

    setPreferences(prev => ({
      ...prev,
      itemType: processedItemTypes.join(', '),
      priceRange: `$${minPrice} - $${maxPrice}`
    }));
  }, [selectedItemTypes, customItemType, minPrice, maxPrice]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'userImageBase64') => {
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

      if (field === 'userImageBase64') {
        setIsLoading(true);
        try {
          const analysis = await analyzeUserPhoto(base64String, preferences.purpose);
          setProfile(prev => ({
            ...prev,
            gender: analysis.gender || prev.gender,
            estimatedSize: analysis.estimatedSize || prev.estimatedSize,
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

    if (step === AppStep.CONFIRMATION || step === AppStep.CARD1_CONFIRM) {
       // Sync Confirmed Data to Preferences
       if (styleAnalysisResults) {
           const topStyle = styleAnalysisResults.suggestedStyles?.map(s => s.name).join(' OR ');
           const confirmedColors = styleAnalysisResults.detectedColors?.join(', ');

           setPreferences(prev => ({
               ...prev,
               // Use the confirmed style (fallback to empty if removed all)
               stylePreference: topStyle || prev.stylePreference || "", 
               // Use confirmed colors
               colors: confirmedColors || prev.colors || "Any",
               // Auto-fill occasion since we skipped it (optional, maybe leave blank or infer)
               occasion: prev.occasion || "General" 
           }));
       }
       
       if (step === AppStep.CARD1_CONFIRM) {
           handleCard1Search();
           return;
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

  const handleCard1Search = async () => {
    setStep(AppStep.SEARCHING);
    setIsLoading(true);

    try {
      // Use the specialized pipeline
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

  // PAGE 1A: Categories & Photos
  const renderCard1Details = () => {
      const types = ["Dress", "Top", "Bottom", "Shoes", "Outerwear", "Handbags", "Hair Accessories", "Jewelries"];
      
      const onNext = () => {
          // Trigger Analysis in Background
          if (profile.idealStyleImages.length > 0) {
              const promise = runStyleExampleAnalyzer(profile, preferences);
              setCard1AnalysisPromise(promise);
              // We don't await here, we move to next page
          }
          setStep(AppStep.CARD1_PROFILE);
      };

      return (
        <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">What items to include?</h1>
          <p className="text-stone-500 mb-6 text-sm">Select all that apply</p>

          <div className="grid grid-cols-2 gap-3 mb-8">
             {types.map(type => {
               const isSelected = selectedItemTypes.includes(type);
               return (
                 <button
                   key={type}
                   onClick={() => toggleItemType(type)}
                   className={`p-4 rounded-xl border text-sm font-bold transition-all ${isSelected ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-900 hover:border-stone-300'}`}
                 >
                   {type}
                 </button>
               )
             })}
          </div>

          <h2 className="text-xl font-bold font-sans text-stone-900 mb-2">Example Photos</h2>
          <p className="text-stone-500 mb-6 text-sm">Upload up to 3 photos of the style you want</p>

          <div className="grid grid-cols-3 gap-2 mb-6">
             {profile.idealStyleImages.map((img, idx) => (
                 <div key={idx} className="relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200">
                     <img src={img} alt={`Example ${idx+1}`} className="w-full h-full object-cover" />
                     <button 
                        onClick={() => removeIdealImage(idx)}
                        className="absolute top-1 right-1 bg-white/90 p-1 rounded-full shadow-sm hover:bg-white text-stone-500 hover:text-red-500"
                     >
                        <X size={12} />
                     </button>
                 </div>
             ))}
             
             {profile.idealStyleImages.length < 3 && (
                 <label className="aspect-square bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-stone-100 transition-all text-stone-400 hover:text-stone-600">
                     <Plus size={24} />
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

          <NavigationButtons 
            onContinue={onNext} 
            onBack={() => setStep(AppStep.GOAL_SELECTION)}
            disabled={selectedItemTypes.length === 0 || profile.idealStyleImages.length === 0}
            continueLabel="Analyze & Continue"
          />
        </div>
      );
  };

  // PAGE 1B: Budget & Profile
  const renderCard1Profile = () => {
      // Re-use renderPriceRange logic partially but inline for simplicity or reuse components?
      // Let's implement a simplified version as per request "Just a few more questions..."
      
      const [useManual, setUseManual] = useState(false);

      return (
        <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Just a few more questions...</h1>
          
          {/* Budget */}
          <div className="mb-8">
              <label className="block text-sm font-bold text-stone-900 mb-2">What's your budget?</label>
              <div className="flex items-center gap-2">
                  <span className="text-stone-400 font-bold">$</span>
                  <input 
                      type="number" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="flex-1 p-4 bg-white border border-stone-200 rounded-xl font-bold outline-none focus:border-stone-900"
                      placeholder="Max Budget"
                  />
              </div>
          </div>

          {/* Size/Gender */}
          <div className="mb-8">
              <label className="block text-sm font-bold text-stone-900 mb-4">Size & Fit</label>
              
              <div className="flex gap-4 mb-4">
                  <button 
                    onClick={() => setUseManual(false)}
                    className={`flex-1 p-3 rounded-xl border text-sm font-bold ${!useManual ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'}`}
                  >
                    AI Estimate
                  </button>
                  <button 
                    onClick={() => setUseManual(true)}
                    className={`flex-1 p-3 rounded-xl border text-sm font-bold ${useManual ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'}`}
                  >
                    Manual Input
                  </button>
              </div>

              {useManual ? (
                  <div className="space-y-4 animate-fade-in">
                      <select 
                         value={profile.gender}
                         onChange={(e) => setProfile(p => ({...p, gender: e.target.value}))}
                         className="w-full p-4 bg-white border border-stone-200 rounded-xl outline-none"
                      >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                      </select>
                      <input 
                         placeholder="Size (e.g. M, US 6)"
                         value={profile.estimatedSize}
                         onChange={(e) => setProfile(p => ({...p, estimatedSize: e.target.value}))}
                         className="w-full p-4 bg-white border border-stone-200 rounded-xl outline-none"
                      />
                  </div>
              ) : (
                  <div className="animate-fade-in">
                      <div className="bg-stone-100 rounded-xl p-4 flex items-center justify-center border-2 border-dashed border-stone-200 relative min-h-[150px]">
                          {profile.userImageBase64 ? (
                              <img src={profile.userImageBase64} className="h-32 object-contain rounded" />
                          ) : (
                              <label className="flex flex-col items-center cursor-pointer text-stone-400">
                                  <Camera size={24} className="mb-2"/>
                                  <span className="text-xs font-bold">Upload Body Photo</span>
                                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'userImageBase64')} />
                              </label>
                          )}
                      </div>
                      {profile.estimatedSize && !isLoading && (
                          <div className="mt-2 text-xs font-bold text-green-600 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Estimated: {profile.estimatedSize}
                          </div>
                      )}
                  </div>
              )}
          </div>

          <NavigationButtons 
            onContinue={() => setStep(AppStep.CARD1_CONFIRM)} 
            onBack={() => setStep(AppStep.CARD1_DETAILS)}
            continueLabel="Review Analysis"
          />
        </div>
      );
  };

  // PAGE 1C: Confirmation
  const renderCard1Confirm = () => {
      // Check if analysis is ready
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
      }, []);

      // Show loading state if analysis is running OR if results aren't ready yet
      if (isLoading || !styleAnalysisResults) {
          return (
              <div className="flex flex-col items-center justify-center h-screen">
                  <div className="animate-spin w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full mb-4"></div>
                  <p className="text-stone-500 font-bold animate-pulse">Analyzing your style...</p>
              </div>
          );
      }

      return renderConfirmation(); // Re-use existing confirmation page? 
      // The user wants a specific list: Style, Color, Features.
      // The existing renderConfirmation does exactly this (Styles, Colors).
      // But we might want to show "Basics" too?
      // Existing confirmation shows "Detected Aesthetics" and "Detected Palette".
      // Let's reuse it for now, but override the "Continue" action.
      // Actually, I need to inject the "Basics" list if possible.
      // `renderConfirmation` reads from `styleAnalysisResults`.
      // I'll just use `renderConfirmation` but wrap the `onContinue` in `nextStep` to handle `CARD1_CONFIRM`.
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
                 setStep(AppStep.ITEM_TYPE);
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
                 setStep(AppStep.ITEM_TYPE); // Start standard flow
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
    const [heightVal, setHeightVal] = useState('');
    const [heightUnit, setHeightUnit] = useState('cm');

    // Update profile height when inputs change
    useEffect(() => {
        if (heightVal) {
            setProfile(p => ({...p, height: `${heightVal} ${heightUnit}`}));
        }
    }, [heightVal, heightUnit]);

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
            onBack={() => {
                if (step === AppStep.CARD1_CONFIRM) {
                    setStep(AppStep.CARD1_PROFILE);
                } else {
                    setStep(AppStep.IDEAL_STYLE);
                }
            }}
            continueLabel={step === AppStep.CARD1_CONFIRM ? "Find My Style" : "Confirm & Continue"}
          />
        </div>
    );
  };

  // --- CARD 2 LOGIC ---

  const handleCard2Analysis = async () => {
      if (!profile.userImageBase64) return;
      
      setIsAnalyzingCard2(true);
      try {
          // 1. Vision Analysis (Agent 1)
          const analysis = await analyzeUserPhoto(profile.userImageBase64, preferences.purpose, profile.height);
          
          // Update Profile with detected attributes
          setProfile(prev => ({
              ...prev,
              gender: analysis.gender,
              estimatedSize: analysis.estimatedSize,
              currentStyle: analysis.currentStyle,
              keptItems: analysis.keptItems || []
          }));
          
          setKeptItems(analysis.keptItems || []);

          // 2. Style Analysis (Agent 1.5) - on the same photo
          // We treat the user photo as an "ideal style" example for vibe analysis
          const styleResult = await runStyleExampleAnalyzer(
              { ...profile, idealStyleImages: [profile.userImageBase64] }, 
              preferences
          );
          
          setCard1AnalysisPromise(Promise.resolve(styleResult)); // Reuse this state or create new one? 
          // Let's reuse card1AnalysisPromise as a generic "style analysis" holder or create a specific one.
          // Actually, we need the result for the next step immediately.
          
      } catch (e) {
          console.error("Card 2 Analysis Failed", e);
      } finally {
          setIsAnalyzingCard2(false);
      }
  };

  const handleGenerateStylistRecs = async () => {
      setIsGeneratingRecs(true);
      try {
          // Resolve the style analysis (should be done by now)
          // For now, we'll re-run or assume it's cached/available. 
          // Ideally we pass the result from step 2A to 2B.
          
          // Let's re-run style analyzer quickly or use cached if we stored it.
          // For simplicity, we'll re-trigger it or assume we have the data in 'profile' and 'preferences'.
          // But 'styleResult' contains the vibe/colors which are crucial.
          
          // Better approach: Store styleAnalysisResult in state.
          // I'll add a state for it.
          
          const styleResult = await runStyleExampleAnalyzer(
              { ...profile, idealStyleImages: [profile.userImageBase64!] }, 
              preferences
          );

          const recs = await generateStylistRecommendations(profile, preferences, styleResult);
          setStylistRecommendation(recs.userMessage);
          setStylistSearchQueries(recs.searchQueries);
          setStep(AppStep.CARD2_RECOMMENDATION);
      } catch (e) {
          console.error("Stylist Recs Failed", e);
      } finally {
          setIsGeneratingRecs(false);
      }
  };

  const handleCard2Search = async () => {
      setStep(AppStep.SEARCHING);
      
      // Use the stylist recommendation as the "style preference" to guide the search
      // We now pass the specific queries map
      const enhancedPreferences = {
          ...preferences,
          // We don't overwrite stylePreference globally here, instead we pass the map
      };

      try {
          // Use the standard search pipeline, but it will now use the specific recommendations
          const result = await searchAndRecommend(
              profile, 
              enhancedPreferences, 
              undefined, 
              styleAnalysisResults || undefined,
              stylistSearchQueries // Pass the map
          );
          
          const newMsg: ChatMessage = {
            role: 'model',
            content: result.reflectionNotes,
            data: result
          };
          setMessages(prev => [...prev, newMsg]);
          setStep(AppStep.RESULTS);
      } catch (error) {
          console.error("Card 2 Search Failed", error);
          setStep(AppStep.CARD2_RECOMMENDATION); // Go back on error
      }
  };

  const renderCard2Details = () => (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
          <ProgressBar currentStep={step} />
          <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">What are we matching?</h1>
          <p className="text-stone-500 mb-6">Upload your current outfit and tell us what you need to complete the look.</p>

          {/* 1. Target Categories */}
          <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">I am looking for:</label>
              <div className="flex flex-wrap gap-2">
                  {['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories'].map((type) => (
                      <button
                          key={type}
                          onClick={() => {
                              const current = preferences.itemType ? preferences.itemType.split(', ') : [];
                              const updated = current.includes(type)
                                  ? current.filter(t => t !== type)
                                  : [...current, type];
                              setPreferences(p => ({ ...p, itemType: updated.join(', ') }));
                          }}
                          className={`px-4 py-2 rounded-full text-sm border transition-all ${
                              preferences.itemType.includes(type)
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                          }`}
                      >
                          {type}
                      </button>
                  ))}
              </div>
          </div>

          {/* 2. Upload Photo */}
          <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">My Current Outfit:</label>
              <div className="relative aspect-[3/4] bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl overflow-hidden hover:bg-stone-100 transition-all group">
                  {profile.userImageBase64 ? (
                      <>
                          <img src={profile.userImageBase64} alt="Current Outfit" className="w-full h-full object-cover" />
                          <button 
                              onClick={() => setProfile(p => ({...p, userImageBase64: null, keptItems: []}))}
                              className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-sm text-stone-500 hover:text-red-500"
                          >
                              <X size={16} />
                          </button>
                      </>
                  ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                          <Camera size={32} className="text-stone-400 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-sm text-stone-500">Tap to upload photo</span>
                          <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={async (e) => {
                                  await handleFileUpload(e, 'userImageBase64');
                                  // Auto-trigger analysis after upload
                                  // We need to wait for state update, so we'll do it in useEffect or just let user click "Analyze"
                              }}
                          />
                      </label>
                  )}
              </div>
          </div>

          {/* 3. Analysis & Confirmation Section */}
          {profile.userImageBase64 && (
             <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 animate-fade-in">
                 {!isAnalyzingCard2 && keptItems.length === 0 && (
                     <button 
                        onClick={handleCard2Analysis}
                        className="w-full py-3 bg-stone-900 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                     >
                        <Sparkles size={16} />
                        Analyze Outfit
                     </button>
                 )}

                 {isAnalyzingCard2 && (
                     <div className="flex flex-col items-center py-4">
                         <div className="w-6 h-6 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mb-2" />
                         <span className="text-xs text-stone-500">Scanning items & style...</span>
                     </div>
                 )}

                 {keptItems.length > 0 && (
                     <div className="space-y-4">
                         <div>
                             <h4 className="text-sm font-bold text-stone-900 mb-2">I am wearing (Keep selected):</h4>
                             <div className="flex flex-wrap gap-2">
                                 {keptItems.map((item, idx) => (
                                     <button
                                         key={idx}
                                         onClick={() => {
                                             // Toggle keep status (for now just UI, strictly we should update profile.keptItems)
                                             const newKept = keptItems.includes(item) 
                                                ? keptItems.filter(i => i !== item)
                                                : [...keptItems, item]; // This logic is weird if we are iterating keptItems.
                                             // Better:
                                             // If it's in the list, we show it as selected.
                                             // If user clicks, we remove it? Or just toggle visual state?
                                             // Let's assume all in keptItems are "detected". User confirms which to "keep".
                                             // We need a separate state for "confirmedKeptItems" or just filter the main list.
                                             // For simplicity: Click to remove.
                                             setKeptItems(prev => prev.filter((_, i) => i !== idx));
                                             setProfile(p => ({...p, keptItems: p.keptItems?.filter((_, i) => i !== idx)}));
                                         }}
                                         className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 flex items-center gap-2 hover:border-red-200 hover:bg-red-50 group"
                                     >
                                         {item}
                                         <X size={12} className="text-stone-400 group-hover:text-red-500" />
                                     </button>
                                 ))}
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="text-xs font-medium text-stone-500">Gender</label>
                                 <select 
                                    value={profile.gender}
                                    onChange={(e) => setProfile(p => ({...p, gender: e.target.value}))}
                                    className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-sm"
                                 >
                                     <option value="Female">Female</option>
                                     <option value="Male">Male</option>
                                     <option value="Non-binary">Non-binary</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="text-xs font-medium text-stone-500">Size</label>
                                 <input 
                                    type="text"
                                    value={profile.estimatedSize}
                                    onChange={(e) => setProfile(p => ({...p, estimatedSize: e.target.value}))}
                                    className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-sm"
                                 />
                             </div>
                         </div>
                     </div>
                 )}
             </div>
          )}

          <NavigationButtons 
              onContinue={handleGenerateStylistRecs}
              disabled={!profile.userImageBase64 || keptItems.length === 0 || !preferences.itemType}
              continueLabel={isGeneratingRecs ? "Designing..." : "Get Recommendations"}
              onBack={() => setStep(AppStep.GOAL_SELECTION)}
          />
      </div>
  );

  const renderCard2Recommendations = () => (
      <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32 h-[100dvh] flex flex-col">
          <ProgressBar currentStep={step} />
          <div className="flex-1 overflow-y-auto">
              <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Stylist Recommendations</h1>
              <p className="text-stone-500 mb-6">Here is what I recommend to complete your look.</p>

              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 prose prose-stone prose-sm max-w-none mb-6">
                  <div className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                      {stylistRecommendation}
                  </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
                      <MessageSquare size={16} />
                      Refine Suggestions
                  </h4>
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder="e.g., No silk, I prefer cotton..." 
                          className="flex-1 bg-stone-50 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-stone-900"
                          onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                  const input = e.currentTarget;
                                  const feedback = input.value;
                                  input.value = "Updating...";
                                  input.disabled = true;
                                  
                                  // Quick hack: Append feedback to preferences and re-run
                                  // Ideally we have a dedicated refinement agent
                                  const newRecs = await generateStylistRecommendations(
                                      profile, 
                                      {...preferences, stylePreference: feedback}, // Inject feedback
                                      { analysisStatus: 'success' } // Mock analysis result for speed or fetch real one
                                  );
                                  setStylistRecommendation(newRecs.userMessage);
                                  setStylistSearchQueries(newRecs.searchQueries);
                                  
                                  input.value = "";
                                  input.disabled = false;
                              }
                          }}
                      />
                      <button className="bg-stone-100 p-2 rounded-lg text-stone-600 hover:bg-stone-200">
                          <ArrowRight size={16} />
                      </button>
                  </div>
              </div>
          </div>

          <NavigationButtons 
              onContinue={handleCard2Search}
              continueLabel="Find These Items"
              onBack={() => setStep(AppStep.CARD2_DETAILS)}
          />
      </div>
  );

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
       <div className="flex-1 overflow-y-auto space-y-6 pb-24 px-4 pt-6">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setStep(AppStep.PREFERENCES_DASHBOARD)}
                className="p-2 -ml-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold font-sans text-stone-900">Elite Forensic Stylist</h2>
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

                      <div className="bg-stone-900 text-stone-50 p-6 rounded-2xl shadow-lg">
                          <h3 className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 flex items-center gap-2">
                             <ShieldCheck size={14}/> Forensic Audit Log
                          </h3>
                          <p className="font-serif leading-relaxed text-lg whitespace-pre-line">{msg.data?.reflectionNotes}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {msg.data?.recommendations.map((outfit, rIdx) => (
                              <div key={rIdx} className="bg-white rounded-3xl overflow-hidden flex flex-col shadow-xl border border-stone-100 ring-1 ring-stone-900/5">
                                  <div className="p-6 pb-4 bg-stone-50 border-b border-stone-100">
                                      <h4 className="font-serif text-xl font-bold text-stone-900 leading-tight mb-1">{outfit.name}</h4>
                                      <p className="text-xs font-sans text-stone-500 uppercase tracking-widest">{outfit.totalPrice || 'Estimating...'} Est. Total</p>
                                  </div>

                                  <div className="p-4 flex-1 space-y-4">
                                     <div className="space-y-3">
                                        {outfit.components && outfit.components.map((comp, cIdx) => (
                                          <div key={cIdx} className="flex flex-col gap-2 p-3 rounded-xl bg-white border border-stone-100 hover:border-stone-200 transition-colors shadow-sm">
                                              <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                                                    <Layers size={16} className="text-stone-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-0.5">{comp.category}</p>
                                                    <h5 className="text-sm font-semibold text-stone-900 leading-snug truncate">{comp.name}</h5>
                                                    <p className="text-xs text-stone-500 truncate">{comp.brand} • {comp.price}</p>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    {/* Force Absolute URL or Show Error */}
                                                    {comp.purchaseUrl && comp.purchaseUrl.startsWith('http') ? (
                                                        <a 
                                                            href={comp.purchaseUrl}
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="self-center p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                                                            title="Buy Item"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    ) : (
                                                        <div className="self-center p-2 text-red-300 cursor-not-allowed" title="Link Unavailable">
                                                            <ExternalLink size={16} />
                                                        </div>
                                                    )}
                                                    
                                                    {comp.fallbackSearchUrl && (
                                                      <a 
                                                        href={comp.fallbackSearchUrl}
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="self-center p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                                                        title="Find Similar (Backup Link)"
                                                    >
                                                        <Search size={16} />
                                                    </a>
                                                    )}
                                                </div>
                                              </div>
                                              
                                              {comp.validationNote && (
                                                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-100">
                                                      <div className="flex flex-wrap gap-1.5">
                                                          {comp.validationNote.split('|').map((note, nIdx) => (
                                                              <span key={nIdx} className="inline-flex items-center gap-1 text-[9px] font-bold text-stone-600 bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">
                                                                  <CheckCircle2 size={8} className="text-green-600" /> {note.trim().replace('Verified: ', '')}
                                                              </span>
                                                          ))}
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                        ))}
                                     </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      {msg.data?.recommendations.length === 0 && (
                          <div className="text-center p-8 bg-white rounded-2xl border border-red-100">
                              <p className="text-red-600 font-bold mb-2">Forensic Audit Failed</p>
                              <p className="text-sm text-stone-500">Logistics or aesthetic audits rejected all potential combinations. Please relax constraints.</p>
                          </div>
                      )}
                  </div>
              );
          })}
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans selection:bg-stone-200">
        <main className="min-h-screen">
            {step === AppStep.GOAL_SELECTION && renderLanding()}
            {step === AppStep.ITEM_TYPE && renderItemType()}
            {step === AppStep.UPLOAD_PHOTO && renderUploadPhoto()}
            {step === AppStep.PROFILE_MANUAL && renderProfileManual()}
            {/* Card 1 Flow */}
            {step === AppStep.CARD1_DETAILS && renderCard1Details()}
            {step === AppStep.CARD1_PROFILE && renderCard1Profile()}
            {step === AppStep.CARD1_CONFIRM && renderCard1Confirm()}
            {/* Card 2 Flow */}
            {step === AppStep.CARD2_DETAILS && renderCard2Details()}
            {step === AppStep.CARD2_RECOMMENDATION && renderCard2Recommendations()}
            {/* Standard Flow */}
            {step === AppStep.IDEAL_STYLE && renderIdealStyle()}
            {step === AppStep.CONFIRMATION && renderConfirmation()}
            {step === AppStep.PREFERENCES_DASHBOARD && renderPreferencesDashboard()}
            {step === AppStep.OCCASION && renderOccasion()}
            {step === AppStep.STYLE && renderStyle()}
            {step === AppStep.COLOR && renderColor()}
            {step === AppStep.PRICE_RANGE && renderPriceRange()}
            {(step === AppStep.SEARCHING || step === AppStep.RESULTS) && renderResults()}
        </main>
        
        {step === AppStep.SEARCHING && (
             <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6">
                 <div className="w-16 h-16 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin mb-8"></div>
                 <h3 className="text-2xl font-bold font-sans text-stone-900 mb-2">Running Forensic Audit</h3>
                 <p className="text-stone-500 max-w-md animate-pulse">
                     Checking stock levels, aesthetic anchors, and link integrity...
                 </p>
                 {profile.idealStyleImages.length > 0 && (
                     <div className="mt-4 flex items-center gap-2 text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                         <Sparkles size={12} />
                         Analyzing {profile.idealStyleImages.length} Example Images
                     </div>
                 )}
             </div>
        )}
    </div>
  );
}