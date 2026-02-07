import React, { useState, useEffect } from 'react';
import { AppStep, UserProfile, Preferences, FashionPurpose, ChatMessage, StyleAnalysisResult } from './types';
import { analyzeUserPhoto, searchAndRecommend } from './services/geminiService';
import { runStyleExampleAnalyzer } from './services/agent_style_analyzer';
import { Upload, Camera, ArrowLeft, ShieldCheck, CheckCircle2, ChevronLeft, X, FileImage, ExternalLink, Layers, Search, Check, Sparkles, Plus, Edit2, AlertCircle } from 'lucide-react';

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
  AppStep.GOAL_SELECTION,
  AppStep.UPLOAD_PHOTO,
  AppStep.ITEM_TYPE,
  AppStep.IDEAL_STYLE, // Moved up
  AppStep.CONFIRMATION, // Moved up
  AppStep.OCCASION,
  AppStep.STYLE,
  AppStep.COLOR,
  AppStep.PRICE_RANGE,
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
                     setStep(AppStep.OCCASION);
                }
            } catch (e) {
                console.error("Analyzer error", e);
                // Proceed without analysis
                setStep(AppStep.OCCASION);
            } finally {
                setIsLoading(false);
            }
            return;
        } else {
             // No images, skip Confirmation and go to Manual Path
             setStep(AppStep.OCCASION);
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
               // Use the confirmed style (fallback to empty if removed all)
               stylePreference: topStyle || prev.stylePreference || "", 
               // Use confirmed colors
               colors: confirmedColors || prev.colors || "Any",
               // Auto-fill occasion since we skipped it (optional, maybe leave blank or infer)
               occasion: prev.occasion || "General" 
           }));
       }
       // Skip Occasion/Style/Color -> Jump to Price Range
       setStep(AppStep.PRICE_RANGE);
       return;
    }

    if (currentIndex >= 0 && currentIndex < WIZARD_STEPS.length - 1) {
      setStep(WIZARD_STEPS[currentIndex + 1]);
    } else if (step === AppStep.PRICE_RANGE) {
      handleSearch();
    }
  };

  const prevStep = () => {
    // Custom Back Logic for Branching
    if (step === AppStep.OCCASION) {
        // Occasion comes after Ideal Style (Manual Path)
        setStep(AppStep.IDEAL_STYLE);
        return;
    }

    if (step === AppStep.PRICE_RANGE) {
        // Price Range comes from EITHER Confirmation OR Color
        if (styleAnalysisResults && profile.idealStyleImages.length > 0) {
            setStep(AppStep.CONFIRMATION);
        } else {
            setStep(AppStep.COLOR);
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

  // --- Render Steps ---

  const renderGoalSelection = () => (
    <div className="max-w-md mx-auto px-6 pt-8 animate-fade-in pb-32">
       <h1 className="text-3xl font-bold font-sans text-stone-900 mb-2">What would you like to do today?</h1>
       <p className="text-stone-500 mb-8">Choose your fashion goal</p>

       <div className="space-y-4">
          {[FashionPurpose.MATCHING, FashionPurpose.NEW_OUTFIT].map((purpose) => {
             const isSelected = preferences.purpose === purpose;
             const isMatching = purpose === FashionPurpose.MATCHING;
             return (
                 <button
                   key={purpose}
                   onClick={() => setPreferences(p => ({ ...p, purpose }))}
                   className={`w-full text-left p-6 rounded-2xl border transition-all group ${isSelected ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900 shadow-sm' : 'border-stone-200 bg-white hover:border-stone-900 hover:shadow-md'}`}
                 >
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-stone-900">{purpose}</h3>
                        {isMatching && <span className="bg-stone-200 text-stone-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Path A</span>}
                        {!isMatching && <span className="bg-stone-900 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">Path B</span>}
                    </div>
                    <p className="text-stone-500 text-sm leading-relaxed mt-1">
                      {isMatching
                        ? "Inventory Mode: Keep items from your photo and find new pieces to bridge the look."
                        : "Mannequin Mode: Disregard current clothes. Build a fresh look from scratch."}
                    </p>
                 </button>
             );
          })}
       </div>

       <NavigationButtons onContinue={nextStep} showBack={false} onBack={prevStep} />
    </div>
  );

  const renderUploadPhoto = () => {
    const isHeic = profile.userImageBase64?.toLowerCase().includes('image/heic') || profile.userImageBase64?.toLowerCase().includes('image/heif');

    return (
    <div className="max-w-md mx-auto px-6 pt-4 animate-fade-in pb-32">
      <h1 className="text-2xl font-bold font-sans text-stone-900 mb-2">Upload Your Photo</h1>
      <p className="text-stone-500 mb-6 text-sm">Nano Banana will analyze your silhouette and inventory</p>

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

      <div className="bg-stone-50 p-6 rounded-3xl space-y-4">
        <h3 className="text-stone-500 text-sm font-medium">Nano Banana Analysis</h3>
        
        <div>
           <label className="block text-sm font-bold text-stone-900 mb-1.5">Gender</label>
           <select 
               value={profile.gender}
               onChange={(e) => setProfile(p => ({...p, gender: e.target.value}))}
               className="w-full p-4 bg-white border border-stone-200 rounded-xl appearance-none font-medium focus:ring-1 focus:ring-stone-900 outline-none"
             >
               <option>Female</option>
               <option>Male</option>
               <option>Non-Binary</option>
             </select>
        </div>

        <div>
           <label className="block text-sm font-bold text-stone-900 mb-1.5">Size</label>
           <select 
               value={profile.estimatedSize}
               onChange={(e) => setProfile(p => ({...p, estimatedSize: e.target.value}))}
               className="w-full p-4 bg-white border border-stone-200 rounded-xl appearance-none font-medium focus:ring-1 focus:ring-stone-900 outline-none"
             >
               <option>XS</option>
               <option>S</option>
               <option>M</option>
               <option>L</option>
               <option>XL</option>
               <option>XXL</option>
             </select>
        </div>

        {profile.keptItems && profile.keptItems.length > 0 && (
             <div className="pt-2">
                <label className="flex items-center justify-between text-sm font-bold text-stone-900 mb-1.5">
                    <span>Detected Inventory (Kept Items)</span>
                    <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wide">Tap 'X' to remove</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {profile.keptItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs bg-white text-stone-700 pl-3 pr-1.5 py-1.5 rounded-lg font-medium border border-stone-200 shadow-sm hover:border-red-200 hover:bg-red-50 transition-all group">
                            {item}
                            <button 
                                onClick={() => removeKeptItem(idx)}
                                className="p-0.5 hover:bg-red-100 rounded-md text-stone-400 group-hover:text-red-500 transition-colors"
                                title="Remove item"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
             </div>
        )}
      </div>

      <NavigationButtons onContinue={nextStep} onBack={prevStep} />
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
                onClick={() => setStep(AppStep.PRICE_RANGE)}
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
            {step === AppStep.GOAL_SELECTION && renderGoalSelection()}
            {step === AppStep.UPLOAD_PHOTO && renderUploadPhoto()}
            {step === AppStep.ITEM_TYPE && renderItemType()}
            {/* New Order: Ideal Style -> Confirmation -> (Maybe Skip) -> Occasion... */}
            {step === AppStep.IDEAL_STYLE && renderIdealStyle()}
            {step === AppStep.CONFIRMATION && renderConfirmation()}
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