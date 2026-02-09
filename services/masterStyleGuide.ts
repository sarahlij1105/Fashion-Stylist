export const masterStyleGuide =
{
  "master_style_guide": {
    "version": "2.0",
    "last_updated": "2026-02-08",
    "description": "AI-optimized styling principles for outfit recommendations. Includes individual styling rules and group coordination strategies. Each rule is actionable and based on established fashion conventions.",
    
    "core_principles": {
      "color_harmony": {
        "60_30_10_rule": {
          "description": "Standard color distribution for balanced outfits",
          "application": {
            "60_percent_dominant": {
              "definition": "Main base color, typically neutral",
              "examples": ["black", "navy", "charcoal", "camel", "cream", "taupe", "espresso", "gray"],
              "typical_items": ["pants", "skirts", "coats", "blazers"]
            },
            "30_percent_secondary": {
              "definition": "Supporting color that complements dominant",
              "examples": ["If dominant is navy: cream, light blue, gray", "If dominant is black: white, burgundy, tan"],
              "typical_items": ["tops", "blouses", "secondary layers"]
            },
            "10_percent_accent": {
              "definition": "Bold pop color for visual interest",
              "examples": ["bright red", "cobalt blue", "mustard yellow", "emerald green"],
              "typical_items": ["accessories", "shoes", "handbags", "scarves"]
            }
          }
        },
        
        "monochromatic_styling": {
          "rule": "When using single color family, vary tones and textures",
          "requirements": [
            "Use 3-4 different shades (light to dark)",
            "Mix textures (matte + shine, hard + soft)",
            "Example: cream sweater + taupe pants + camel boots + ivory bag"
          ]
        },
        
        "complementary_colors": {
          "definition": "Opposite colors on color wheel for high contrast",
          "pairs": [
            {"color1": "blue", "color2": "orange"},
            {"color1": "red", "color2": "green"},
            {"color1": "purple", "color2": "yellow"}
          ],
          "usage": "Use one as dominant (60%), other as accent (10%)",
          "best_for": ["statement looks", "evening wear", "creative settings"]
        },
        
        "analogous_colors": {
          "definition": "Adjacent colors on color wheel for harmony",
          "examples": [
            ["blue", "blue-green", "green"],
            ["red", "red-orange", "orange"],
            ["purple", "blue-purple", "blue"]
          ],
          "best_for": ["professional settings", "daytime events", "classic looks"]
        },
        
        "neutral_pairing": {
          "warm_neutrals": {
            "colors": ["camel", "tan", "beige", "cream", "chocolate", "rust"],
            "pair_with": "gold jewelry"
          },
          "cool_neutrals": {
            "colors": ["gray", "charcoal", "navy", "black", "ice blue"],
            "pair_with": "silver jewelry"
          },
          "rule": "Avoid mixing warm and cool neutrals without a bridge color",
          "bridge_colors": ["white", "ivory", "denim"]
        }
      },
      
      "texture_contrast": {
        "hard_soft_rule": {
          "description": "Mix structured and flowing materials for visual interest",
          "required": true,
          "hard_structured": ["wool", "tweed", "denim", "leather", "suede", "canvas", "crisp cotton"],
          "soft_fluid": ["silk", "satin", "chiffon", "jersey", "modal", "lace", "tulle"],
          "applications": [
            "tweed blazer + silk blouse + wool trousers",
            "leather jacket + satin slip dress",
            "denim jacket + linen tunic + leather sandals"
          ]
        },
        
        "shine_matte_balance": {
          "formula": "70% matte + 30% shine",
          "rule": "Never go all-matte or all-shine",
          "example": "matte wool coat + patent leather boots + satin blouse"
        },
        
        "seasonal_materials": {
          "spring": ["lightweight cotton", "linen", "soft leather"],
          "summer": ["linen", "silk", "canvas", "breathable cotton"],
          "fall": ["cashmere", "suede", "wool", "corduroy"],
          "winter": ["heavy wool", "shearling", "velvet", "fleece"]
        }
      },
      
      "proportion_balance": {
        "golden_rule": {
          "principle": "Never balance top and bottom equally",
          "description": "Deliberate imbalance creates visual interest"
        },
        
        "proportion_pairs": {
          "oversized_top": ["slim bottom", "fitted bottom", "tailored bottom"],
          "fitted_top": ["wide-leg bottom", "flowing bottom", "a-line bottom"],
          "loose_top": ["structured bottom", "defined bottom"],
          "cropped_top": ["wide-leg bottom", "maxi bottom", "high-waisted bottom"]
        },
        
        "examples": [
          {"top": "oversized blazer", "bottom": "skinny jeans"},
          {"top": "fitted crop top", "bottom": "wide-leg trousers"},
          {"top": "voluminous puff-sleeve blouse", "bottom": "straight-leg pants"},
          {"top": "bodycon dress", "outfit_addition": "oversized coat"}
        ],
        
        "waist_definition": {
          "when_both_loose": "Add belt to define waist",
          "when_all_fitted": "Add one oversized element (coat, bag, scarf)"
        },
        
        "leg_lengthening": [
          "high-waisted bottoms + tucked top",
          "monochrome head-to-toe dressing",
          "nude shoes matching skin tone",
          "vertical stripes or seams on pants"
        ]
      },
      
      "five_piece_rule": {
        "description": "Complete outfit requires minimum 4-5 visual elements",
        "elements": [
          "top",
          "bottom (or dress)",
          "footwear",
          "outerwear (jacket/coat/cardigan)",
          "accessories (bag/jewelry/belt/scarf)"
        ],
        "completeness": {
          "4_pieces": "Minimum acceptable",
          "5_pieces": "Polished and complete",
          "6_7_pieces": "Elevated/editorial"
        },
        "accessory_levels": {
          "minimal": {
            "count": "1-2 accessories",
            "example": "One statement necklace OR bold bag"
          },
          "moderate": {
            "count": "3 accessories",
            "example": "Watch + stud earrings + tote bag"
          },
          "maximum": {
            "count": "4-5 accessories",
            "example": "Layered necklaces + earrings + rings + bag + belt"
          }
        },
        "one_statement_rule": {
          "principle": "Choose ONE bold element, keep rest understated",
          "examples": [
            {"statement": "sequin blazer", "rest": "simple black pants + nude heels + minimal jewelry"},
            {"statement": "bright red bag", "rest": "neutral outfit (beige, cream, tan)"},
            {"statement": "bold patterned dress", "rest": "simple nude sandals + delicate jewelry"}
          ]
        }
      },
      
      "pattern_mixing": {
        "beginner": {
          "rule": "Mix patterns in same color family",
          "example": "navy striped top + navy polka dot skirt",
          "safe_combinations": ["stripes + dots (same color)", "stripes + florals (same color)"]
        },
        "intermediate": {
          "rule": "Mix patterns of different scales",
          "principle": "One pattern should be 3x the size of the other",
          "example": "small gingham check + large floral print"
        },
        "advanced": {
          "rule": "Mix different pattern families with common color",
          "example": "floral blouse with blue flowers + blue-and-white striped pants",
          "key": "Shared color creates cohesion"
        },
        "proven_formulas": [
          "stripes + florals",
          "polka dots + stripes",
          "animal print + geometric",
          "plaid + floral"
        ],
        "avoid": [
          "two large-scale bold patterns together",
          "more than 3 patterns in one outfit",
          "clashing pattern directions (diagonal + horizontal + vertical)"
        ]
      }
    },
    
    "occasion_specific_rules": {
      "graduation": {
        "high_school": {
          "formula": "semi-formal, comfortable for outdoor ceremony",
          "dress_options": ["midi dress", "knee-length dress", "dressy jumpsuit", "skirt + blouse"],
          "colors": ["pastels", "bright spring colors", "white", "florals", "school colors as accent"],
          "consider": "outfit must work under graduation gown",
          "footwear": ["block heels", "wedges", "dressy flats", "sandals"],
          "avoid": ["stilettos (grass/outdoor ceremonies)", "overly casual (jeans, sneakers)", "too revealing (low-cut, very short)"],
          "accessories": ["crossbody bag or small clutch", "minimal jewelry", "sunglasses for outdoor"]
        },
        "college_university": {
          "formula": "polished, professional, photo-ready",
          "dress_options": ["midi dress", "sheath dress", "suit", "blazer + dress pants", "dressy separates"],
          "colors": ["sophisticated palette", "jewel tones", "neutrals with pop of color", "avoid all black (looks somber)"],
          "footwear": ["block heels", "pumps", "loafers", "dressy flats"],
          "accessories": ["structured bag", "watch", "statement earrings", "minimal necklace"],
          "avoid": ["overly casual", "club wear", "flip-flops", "distressed denim"],
          "practical_notes": ["comfortable for sitting 2+ hours", "layers for temperature changes", "consider gown color (typically black)"]
        },
        "graduate_school": {
          "formula": "professional, refined, networking-appropriate",
          "dress_options": ["tailored suit", "sheath dress + blazer", "midi dress", "sophisticated separates"],
          "colors": ["navy", "charcoal", "burgundy", "forest green", "sophisticated neutrals"],
          "footwear": ["pumps", "heeled ankle boots", "loafers", "elegant flats"],
          "accessories": ["professional tote or satchel", "watch", "minimal jewelry"],
          "avoid": ["overly trendy", "too casual", "club attire"],
          "note": "often followed by networking events; dress accordingly"
        }
      },
      
      "weddings": {
        "bride": {
          "traditional_white_wedding": {
            "colors": ["white", "ivory", "cream", "champagne", "blush"],
            "silhouettes": ["ball gown", "a-line", "mermaid", "sheath", "fit-and-flare"],
            "considerations": ["venue formality", "season", "time of day", "body type", "mobility needs"],
            "fabrics": {
              "spring_summer": ["chiffon", "organza", "lace", "satin"],
              "fall_winter": ["mikado", "satin", "velvet", "heavier lace"]
            },
            "accessories": ["veil (cathedral, chapel, fingertip, birdcage)", "jewelry (something borrowed, something blue)", "white or nude shoes", "clutch for reception"],
            "undergarments": ["shapewear if desired", "strapless or appropriate bra", "comfortable undergarments"]
          },
          "non_traditional": {
            "colors": ["any color acceptable", "popular: blush, champagne, light blue, lavender, even black"],
            "styles": ["short dress", "jumpsuit", "suit", "pantsuit", "two-piece", "colored gown"],
            "modern_trends": ["cape dress", "separates", "suit with sneakers", "minimalist slip dress"]
          },
          "destination_beach": {
            "formula": "lightweight, flowing, easy to move in",
            "fabrics": ["chiffon", "organza", "light lace", "breathable materials"],
            "silhouettes": ["flowy a-line", "sheath", "bohemian", "short dress"],
            "footwear": ["barefoot", "flat sandals", "low wedges"],
            "avoid": ["heavy fabrics", "long trains", "restrictive silhouettes"]
          },
          "courthouse_elopement": {
            "formula": "chic, simple, photo-worthy",
            "options": ["midi dress", "suit", "cocktail dress", "jumpsuit"],
            "colors": ["white", "ivory", "cream", "or any color"],
            "footwear": ["pumps", "heeled sandals", "loafers"],
            "accessories": ["minimal jewelry", "small bouquet", "structured bag"]
          }
        },
        
        "wedding_guest": {
          "forbidden_universal": [
            {
              "rule": "never_wear_white",
              "details": "No white, ivory, cream, off-white, or champagne that looks white",
              "applies_to": "all weddings globally"
            },
            {
              "rule": "no_black_daytime",
              "details": "Avoid black for daytime or outdoor weddings unless explicitly stated",
              "acceptable": "evening or formal weddings"
            },
            {
              "rule": "no_red_asian_weddings",
              "details": "Red symbolizes bride in Chinese, Vietnamese, and many Asian cultures",
              "applies_to": "Chinese, Vietnamese, Korean, and other Asian weddings"
            },
            {
              "rule": "modest_religious_venues",
              "details": "Cover shoulders, arms, knees; no plunging necklines",
              "applies_to": "churches, mosques, temples, synagogues",
              "solution": "bring shawl or bolero"
            },
            {
              "rule": "no_upstaging",
              "details": "Avoid overly dramatic, sequined gowns, or anything bridal-looking",
              "applies_to": "all weddings"
            },
            {
              "rule": "no_bridal_party_colors",
              "details": "Avoid matching bridesmaid dress colors if known",
              "action": "ask bride or check wedding website"
            }
          ],
          "safe_colors": {
            "universal": ["navy", "burgundy", "emerald green", "dusty rose", "lavender", "taupe", "sage green", "cobalt blue", "mauve"],
            "spring": ["blush pink", "mint green", "lilac", "sky blue", "peach", "soft yellow"],
            "summer": ["coral", "turquoise", "fuchsia", "bright florals", "tropical prints"],
            "fall": ["ruby", "sapphire", "emerald", "rust", "burnt orange", "deep purple", "forest green"],
            "winter": ["plum", "forest green", "wine", "navy", "emerald", "metallics (gold, silver, rose gold)"]
          },
          "dress_code_interpretation": {
            "black_tie": {
              "women": "floor-length gown",
              "men": "tuxedo",
              "colors": "formal palette (jewel tones, metallics, black, navy)"
            },
            "black_tie_optional": {
              "women": "floor-length gown OR elegant cocktail dress",
              "men": "tuxedo OR dark suit",
              "flexibility": "more lenient than strict black tie"
            },
            "formal_black_tie_invited": {
              "women": "floor-length encouraged but midi acceptable",
              "men": "dark suit and tie, tuxedo welcomed",
              "interpretation": "dress up but not strictly black tie"
            },
            "cocktail_attire": {
              "women": "knee to midi dress, dressy jumpsuit, dressy separates",
              "men": "suit and tie",
              "time": "typically 5pm-10pm events"
            },
            "semi_formal": {
              "women": "cocktail dress, midi dress, dressy separates",
              "men": "suit or dress pants + blazer",
              "similar_to": "cocktail attire"
            },
            "dressy_casual": {
              "women": "sundress, midi skirt + blouse, jumpsuit",
              "men": "dress pants + button-down (tie optional)",
              "avoid": "jeans, t-shirts, sneakers"
            },
            "casual": {
              "women": "sundress, nice top + skirt/pants, maxi dress",
              "men": "khakis + polo or button-down",
              "note": "still elevated; not everyday casual"
            },
            "beach_formal": {
              "women": "maxi dress, flowy midi dress, linen suit",
              "men": "linen suit, dress pants + guayabera",
              "footwear": "wedges, flat sandals (heels sink in sand)",
              "fabrics": "lightweight, breathable"
            },
            "garden_party": {
              "women": "midi or tea-length dress, floral prints welcome",
              "men": "light suit, blazer + dress pants",
              "footwear": "wedges, block heels (grass-friendly)",
              "accessories": "sun hat acceptable"
            }
          },
          "venue_specific": {
            "beach": {
              "dress": "flowy maxi or midi, light fabrics",
              "fabrics": ["linen", "chiffon", "light cotton"],
              "footwear": "flat sandals, wedges",
              "avoid": "stilettos, heavy fabrics",
              "accessories": "sunglasses, light shawl for breeze"
            },
            "garden_outdoor": {
              "dress": "midi or tea-length, florals appropriate",
              "footwear": "wedges, block heels, dressy flats",
              "avoid": "thin stilettos (sink in grass)",
              "accessories": "sun hat, sunglasses",
              "practical": "bring shawl for temperature changes"
            },
            "barn_rustic": {
              "dress": "flowy dress, boots acceptable",
              "colors": "earth tones, florals, bohemian",
              "footwear": "wedges, ankle boots, block heels",
              "avoid": "overly formal gowns, delicate fabrics",
              "note": "dusty environment; choose accordingly"
            },
            "ballroom_hotel": {
              "dress": "formal to cocktail based on dress code",
              "footwear": "heels appropriate",
              "formality": "higher; err on dressier side"
            },
            "church_religious": {
              "requirements": ["covered shoulders", "modest neckline", "knee-length or longer"],
              "solution": "bring shawl, bolero, or cardigan",
              "footwear": "closed-toe preferred",
              "jewelry": "modest, not distracting"
            },
            "destination_tropical": {
              "dress": "light, breathable, colorful",
              "fabrics": ["linen", "cotton", "chiffon"],
              "colors": "bright, tropical prints welcome",
              "footwear": "sandals, wedges",
              "accessories": "minimal; heat considerations"
            }
          },
          "cultural_specific": {
            "chinese_wedding": {
              "avoid_colors": ["white (death)", "black (mourning)", "red (bride's color)"],
              "safe_colors": ["pink", "peach", "purple", "blue", "gold"],
              "gift_etiquette": "cash in red envelope (even amounts)",
              "multiple_outfit_changes": "bride may change 3-5 times; stay seated"
            },
            "indian_wedding": {
              "encouraged": "bright colors, gold jewelry, cultural dress welcome",
              "avoid_colors": ["white (mourning)", "red (bride)", "black (inauspicious)"],
              "safe_colors": ["jewel tones", "bright pink", "orange", "green", "blue", "purple"],
              "dress_options": ["saree", "lehenga", "salwar kameez", "western formal in bright colors"],
              "note": "multiple events (mehndi, sangeet, ceremony, reception)",
              "accessories": "gold jewelry encouraged; bindi welcome"
            },
            "jewish_wedding": {
              "requirements": ["modest dress for orthodox", "head covering for married women in orthodox"],
              "timing": "no weddings on Shabbat (Friday sunset to Saturday sunset)",
              "ceremony": "standing room; may be long",
              "reception": "often involves hora dance"
            },
            "muslim_wedding": {
              "requirements": ["modest dress", "covered shoulders and knees", "headscarf for women in mosque"],
              "colors": "bright colors welcome",
              "avoid": "tight or revealing clothing",
              "men_women_separate": "may have separate seating or events"
            },
            "latinx_wedding": {
              "dress": "formal, colorful welcome",
              "note": "late reception (may go past midnight)",
              "dancing": "expect lots of dancing; comfortable shoes recommended",
              "colors": "vibrant colors, patterns welcome"
            }
          }
        }
      },
      
      "holidays": {
        "christmas": {
          "party_formal": {
            "formula": "festive, elegant, celebratory",
            "colors": ["red", "green", "gold", "silver", "burgundy", "emerald", "navy", "white"],
            "dress_options": ["cocktail dress", "velvet dress", "sequin dress", "dressy jumpsuit", "midi dress"],
            "fabrics": ["velvet", "satin", "silk", "sequins", "metallic"],
            "footwear": ["heels", "heeled booties", "dressy flats"],
            "accessories": ["statement earrings", "clutch", "metallic accessories"],
            "avoid": ["overly casual", "beachwear colors"]
          },
          "casual_family_gathering": {
            "formula": "comfortable, festive, photo-ready",
            "colors": ["festive but not costume-y", "reds", "greens", "creams", "plaids", "fair isle patterns"],
            "options": ["sweater + jeans", "midi skirt + knit top", "dress + cardigan", "smart separates"],
            "footwear": ["ankle boots", "loafers", "flats"],
            "accessories": ["festive jewelry", "cozy scarf"],
            "balance": "festive without looking like Christmas sweater party"
          },
          "ugly_sweater_party": {
            "formula": "intentionally tacky, fun, themed",
            "required": "Christmas sweater (kitschy, lights, 3D elements)",
            "bottoms": ["jeans", "leggings", "casual pants"],
            "footwear": ["sneakers", "boots", "casual"],
            "accessories": ["Santa hat", "reindeer antlers", "jingle bells"]
          },
          "christmas_eve_service": {
            "formula": "modest, respectful, festive-elegant",
            "dress_options": ["midi dress", "skirt + blouse", "dress pants + sweater", "suit"],
            "colors": ["traditional festive or elegant neutrals"],
            "requirements": ["covered shoulders", "modest neckline", "knee-length or longer"],
            "footwear": ["closed-toe heels", "loafers", "ankle boots"],
            "avoid": ["overly revealing", "too casual", "loud patterns"]
          }
        },
        
        "new_years_eve": {
          "party": {
            "formula": "glamorous, sparkly, celebratory",
            "colors": ["metallics (gold, silver, rose gold)", "black", "navy", "sequins", "jewel tones"],
            "dress_options": ["sequin dress", "metallic dress", "velvet dress", "cocktail dress", "jumpsuit"],
            "fabrics": ["sequins", "metallic", "satin", "velvet", "silk"],
            "footwear": ["statement heels", "metallic heels", "strappy sandals"],
            "accessories": ["clutch", "statement jewelry", "metallic accessories"],
            "rule": "go bold; this is the night for sparkle"
          },
          "casual_gathering": {
            "formula": "elevated casual with festive touch",
            "options": ["metallic top + jeans", "sequin skirt + sweater", "velvet pants + blouse"],
            "footwear": ["heeled booties", "loafers", "dressy sneakers"],
            "accessories": ["statement earrings", "metallic bag"],
            "balance": "casual but with celebratory element"
          }
        },
        
        "valentines_day": {
          "date_night": {
            "formula": "romantic, feminine, elegant",
            "colors": ["red", "pink", "burgundy", "blush", "black", "white"],
            "dress_options": ["midi dress", "cocktail dress", "silk blouse + skirt", "romantic separates"],
            "fabrics": ["silk", "satin", "lace", "chiffon", "soft knits"],
            "footwear": ["heels", "strappy sandals", "heeled booties"],
            "accessories": ["delicate jewelry", "small clutch or crossbody"],
            "avoid": ["overly casual", "gym wear", "sloppy"]
          },
          "galentines_brunch": {
            "formula": "cute, casual, pink-friendly",
            "colors": ["pink", "red", "white", "pastels"],
            "options": ["midi dress", "sweater + midi skirt", "blouse + jeans", "jumpsuit"],
            "footwear": ["flats", "ankle boots", "low heels"],
            "accessories": ["fun jewelry", "crossbody bag"]
          }
        },
        
        "st_patricks_day": {
          "casual_celebration": {
            "colors": ["green (any shade)", "white", "orange (Irish flag colors)"],
            "formula": "incorporate green without costume",
            "options": ["green top + jeans", "green dress", "green accessories", "green shoes"],
            "avoid": ["head-to-toe leprechaun costume for non-costume events"],
            "footwear": ["sneakers", "boots", "casual shoes"],
            "accessories": ["green jewelry", "shamrock pin"]
          },
          "parade_outdoor": {
            "formula": "layered, comfortable, weather-appropriate (March)",
            "required": "something green",
            "layers": ["jacket or coat", "sweater", "comfortable bottom"],
            "footwear": ["comfortable boots", "sneakers (standing/walking)"],
            "practical": ["waterproof jacket", "layers for temperature changes"]
          }
        },
        
        "halloween": {
          "costume_party": {
            "formula": "costume required unless specified",
            "categories": ["scary", "funny", "pop culture", "group costume", "sexy", "creative"],
            "considerations": ["venue (outdoor/indoor)", "temperature", "mobility", "sitting"],
            "footwear": "comfortable if walking/dancing",
            "accessories": "complete the look"
          },
          "non_costume_event": {
            "formula": "Halloween-themed but not costume",
            "colors": ["black", "orange", "purple", "dark colors"],
            "options": ["black dress", "orange accessories", "Halloween prints (subtle)", "dark romantic"],
            "avoid": ["full costume if not specified"]
          }
        },
        
        "thanksgiving": {
          "family_dinner": {
            "formula": "comfortable, elevated casual, elastic waist friendly",
            "colors": ["fall colors (burgundy, rust, mustard, forest green)", "neutrals", "earth tones"],
            "options": ["midi dress", "sweater + wide-leg pants", "tunic + leggings", "maxi skirt + sweater"],
            "fabrics": ["soft knits", "stretchy fabrics", "comfortable materials"],
            "footwear": ["ankle boots", "loafers", "flats"],
            "avoid": ["restrictive waistbands", "dry-clean-only", "white (stain risk)"],
            "practical": ["machine-washable preferred", "forgiving silhouettes", "layers for temperature"]
          }
        },
        
        "fourth_of_july": {
          "casual_celebration": {
            "colors": ["red", "white", "blue", "American flag themed"],
            "formula": "casual, comfortable, patriotic",
            "options": ["striped top + denim", "white dress + red accessories", "blue dress", "stars/stripes"],
            "footwear": ["sneakers", "sandals", "casual shoes"],
            "accessories": ["sunglasses", "sun hat", "American flag accessories"],
            "practical": ["sunscreen-friendly fabrics", "comfortable for outdoor activities"]
          }
        },
        
        "easter": {
          "church_service": {
            "formula": "modest, spring-appropriate, pastel-friendly",
            "colors": ["pastels (pink, lilac, mint, baby blue)", "white", "floral prints", "spring colors"],
            "dress_options": ["midi dress", "skirt + blouse", "dress + cardigan", "suit"],
            "requirements": ["covered shoulders", "knee-length or longer", "modest neckline"],
            "footwear": ["closed-toe heels", "flats", "dressy sandals"],
            "accessories": ["small hat or fascinator (optional)", "delicate jewelry", "structured bag"],
            "avoid": ["black (too somber)", "overly revealing", "casual"]
          },
          "brunch": {
            "formula": "spring-fresh, cheerful, comfortable",
            "colors": ["pastels", "bright spring colors", "florals", "white"],
            "options": ["sundress", "midi dress", "skirt + blouse", "jumpsuit"],
            "footwear": ["wedges", "block heels", "dressy flats", "sandals"],
            "accessories": ["straw bag", "delicate jewelry", "sunglasses"]
          }
        }
      },
      
      "date_night": {
        "first_date": {
          "formula": "polished, confident, true to style",
          "principles": ["dress like yourself", "appropriate for venue", "comfortable", "not trying too hard"],
          "casual_venue": {
            "options": ["jeans + nice top", "midi dress", "jumpsuit", "skirt + blouse"],
            "footwear": ["ankle boots", "loafers", "low heels", "clean sneakers"],
            "avoid": ["gym wear", "pajama-like", "overly sexy"]
          },
          "nice_restaurant": {
            "options": ["midi dress", "cocktail dress", "silk blouse + trousers", "elegant separates"],
            "footwear": ["heels", "heeled booties", "dressy flats"],
            "accessories": ["minimal jewelry", "small bag or clutch"],
            "avoid": ["overly casual", "too revealing", "uncomfortable"]
          },
          "activity_date": {
            "examples": ["mini golf", "bowling", "arcade", "museum"],
            "formula": "casual but cute",
            "options": ["jeans + cute top", "casual dress + sneakers", "skirt + t-shirt"],
            "footwear": ["sneakers", "flat sandals", "comfortable shoes"],
            "practical": "moveable, activity-appropriate"
          },
          "coffee_date": {
            "formula": "casual, approachable, comfortable",
            "options": ["jeans + sweater", "casual dress", "blouse + pants", "skirt + top"],
            "footwear": ["ankle boots", "loafers", "sneakers", "flats"],
            "accessories": ["crossbody bag", "minimal jewelry"]
          }
        },
        
        "anniversary_romantic": {
          "formula": "elevated, romantic, special",
          "colors": ["romantic (red, burgundy, blush, black)", "jewel tones", "elegant neutrals"],
          "dress_options": ["midi or cocktail dress", "silk blouse + midi skirt", "elegant jumpsuit", "dressy separates"],
          "fabrics": ["silk", "satin", "lace", "velvet", "chiffon"],
          "footwear": ["heels", "strappy sandals", "heeled booties"],
          "accessories": ["delicate jewelry", "clutch", "statement earrings"],
          "effort_level": "high; special occasion"
        }
      },
      
      "professional_workplace": {
        "corporate_traditional": {
          "industries": ["finance", "law", "consulting", "government"],
          "formula": "tailored suit OR blazer + trousers/pencil skirt",
          "colors": ["navy", "charcoal", "black", "camel", "ivory", "burgundy", "gray"],
          "dress_options": ["suit", "blazer + trousers", "blazer + pencil skirt", "sheath dress + blazer"],
          "fabrics": ["wool", "wool blend", "cotton twill", "quality polyester blend"],
          "footwear": ["closed-toe pumps", "loafers", "oxfords", "ankle boots (conservative)"],
          "heel_height": "3 inches maximum",
          "accessories": ["structured tote or briefcase", "watch", "minimal jewelry (stud earrings, simple necklace)"],
          "avoid": ["loud patterns", "casual fabrics (denim, jersey)", "excessive jewelry", "open-toe shoes", "visible tattoos"]
        },
        
        "business_casual": {
          "industries": ["tech", "creative agencies", "startups", "healthcare (non-clinical)", "education"],
          "formula": "blazer optional; smart separates",
          "dress_options": ["blouse + chinos", "sweater + tailored pants", "shirt dress", "midi skirt + blouse"],
          "colors": "flexible - patterns and brighter hues acceptable",
          "fabrics": ["cotton", "linen blend", "knits", "chambray", "ponte"],
          "footwear": ["loafers", "ankle boots", "clean sneakers (leather/minimal)", "low heels", "ballet flats"],
          "accessories": ["tote bag", "backpack", "watch", "moderate jewelry"],
          "avoid": ["ripped jeans", "graphic t-shirts", "flip-flops", "athletic wear", "club wear"],
          "jeans": "dark wash, no distressing, if allowed"
        },
        
        "creative_professional": {
          "industries": ["design", "media", "fashion", "advertising", "entertainment"],
          "formula": "trend-aware, personal style emphasized",
          "dress_options": "wide range - from edgy to classic",
          "colors": "all colors welcome; bold acceptable",
          "pattern_mixing": "encouraged",
          "footwear": ["heeled boots", "fashion sneakers", "statement shoes", "anything stylish"],
          "accessories": "statement pieces encouraged (bold jewelry, unique bags)",
          "rule": "express personality while maintaining professionalism",
          "avoid": ["looking dated", "overly corporate"]
        },
        
        "business_formal": {
          "occasions": ["client meetings", "presentations", "conferences", "important meetings"],
          "formula": "suit required",
          "dress_options": ["matching suit (pants or skirt)", "conservative dress + blazer"],
          "colors": ["navy", "charcoal", "black", "dark gray"],
          "footwear": ["closed-toe pumps", "oxfords", "loafers"],
          "accessories": ["professional bag", "watch", "minimal jewelry"],
          "grooming": ["polished", "conservative hairstyle", "neutral makeup"],
          "avoid": ["casual elements", "bright colors", "trendy items"]
        },
        
        "casual_friday": {
          "formula": "relaxed but still professional",
          "dress_options": ["jeans (dark, clean) + blouse", "chinos + sweater", "casual dress", "midi skirt + t-shirt"],
          "footwear": ["clean sneakers", "loafers", "ankle boots", "flats"],
          "still_avoid": ["athletic wear", "beachwear", "pajama-like", "ripped jeans", "graphic tees"],
          "rule": "casual but polished; could still see clients"
        },
        
        "remote_work": {
          "video_calls": {
            "focus": "top half visible",
            "formula": "polished top + comfortable bottom",
            "tops": ["blouse", "sweater", "button-down", "blazer"],
            "colors": "solid or subtle patterns (avoid busy patterns on camera)",
            "avoid": ["white (washes out)", "neon", "busy patterns", "pajamas"],
            "accessories": ["minimal jewelry", "good lighting setup"],
            "bottoms": "comfortable (joggers, leggings acceptable if not on camera)"
          },
          "no_calls": {
            "formula": "comfortable, productive",
            "options": ["loungewear", "joggers + t-shirt", "leggings + sweater", "casual dress"],
            "rule": "be ready to turn on camera within 5 minutes if needed"
          }
        }
      },
      
      "fitness_activities": {
        "gym_general": {
          "formula": "moisture-wicking, supportive, functional",
          "tops": ["sports bra", "tank top", "t-shirt", "long-sleeve athletic top"],
          "bottoms": ["leggings", "bike shorts", "athletic shorts", "joggers"],
          "fabrics": ["moisture-wicking polyester", "spandex blend", "performance fabric"],
          "footwear": ["cross-training shoes", "running shoes (if running)", "athletic sneakers"],
          "avoid": ["cotton (holds sweat)", "loose clothing (machinery hazard)", "jewelry (safety)"],
          "fit": "fitted but not restrictive; moveable"
        },
        
        "yoga": {
          "formula": "stretchy, non-restrictive, stay-in-place",
          "tops": ["fitted tank", "sports bra", "cropped top", "fitted t-shirt"],
          "bottoms": ["high-waisted leggings", "yoga pants", "bike shorts"],
          "requirements": ["high-waisted bottoms (no riding down in inversions)", "fitted top (no riding up)"],
          "fabrics": ["4-way stretch", "moisture-wicking", "squat-proof"],
          "footwear": "barefoot or yoga socks",
          "avoid": ["loose clothing", "low-rise pants", "baggy tops"]
        },
        
        "pilates": {
          "formula": "form-fitting, streamlined, supportive",
          "tops": ["fitted tank", "sports bra", "long-sleeve fitted top"],
          "bottoms": ["full-length leggings", "capri leggings", "bike shorts"],
          "requirements": "instructor needs to see form; fitted clothing",
          "footwear": "barefoot or grip socks",
          "avoid": ["loose clothing", "baggy items"]
        },
        
        "running": {
          "formula": "lightweight, moisture-wicking, reflective",
          "tops": ["moisture-wicking tank or t-shirt", "sports bra", "long-sleeve (cold weather)"],
          "bottoms": ["running shorts", "running leggings", "running tights"],
          "footwear": "running shoes (proper fit, replace every 300-500 miles)",
          "accessories": ["running belt or armband", "headphones", "hat or visor", "sunglasses"],
          "safety": ["reflective elements for outdoor", "bright colors for visibility"],
          "layers": "removable layers for temperature regulation"
        },
        
        "cycling_spin": {
          "formula": "padded, fitted, moisture-wicking",
          "tops": ["fitted tank or t-shirt", "sports bra", "cycling jersey"],
          "bottoms": ["padded bike shorts", "cycling leggings", "fitted athletic shorts"],
          "footwear": ["cycling shoes (clip-in)", "athletic sneakers"],
          "avoid": ["loose pants (chain hazard)", "long loose tops"],
          "accessories": ["water bottle", "towel", "cycling gloves (outdoor)"]
        },
        
        "hiking": {
          "formula": "layered, moisture-wicking, durable",
          "layers": ["base layer (moisture-wicking)", "mid layer (insulating)", "outer layer (weatherproof)"],
          "bottoms": ["hiking pants", "leggings", "convertible pants"],
          "footwear": "hiking boots or trail runners",
          "accessories": ["daypack", "hat", "sunglasses", "sunscreen", "water bottle"],
          "fabrics": ["moisture-wicking", "quick-dry", "durable"],
          "avoid": ["cotton", "jeans", "fashion sneakers"]
        },
        
        "sports_specific": {
          "tennis": {
            "tops": ["polo shirt", "tennis tank", "sports bra"],
            "bottoms": ["tennis skirt", "tennis dress", "athletic shorts"],
            "footwear": "tennis shoes (lateral support)",
            "colors": "traditionally white at some clubs; check rules"
          },
          "basketball": {
            "tops": ["tank top", "t-shirt", "jersey"],
            "bottoms": ["basketball shorts", "athletic shorts"],
            "footwear": "basketball shoes (ankle support)"
          },
          "swimming": {
            "required": "swimsuit (one-piece, bikini, swim trunks)",
            "accessories": ["swim cap", "goggles", "flip-flops for deck"],
            "cover_up": "for walking to/from pool"
          }
        }
      },
      
      "parties": {
        "house_party": {
          "formula": "casual-cute, comfortable, practical",
          "dress_options": ["jeans + nice top", "casual dress", "skirt + crop top", "jumpsuit", "romper"],
          "footwear": ["sneakers", "ankle boots", "flats", "low heels"],
          "accessories": ["crossbody bag (hands-free)", "minimal jewelry"],
          "avoid": ["overly formal", "uncomfortable shoes", "dry-clean-only"],
          "practical": "may be standing; may spill drinks"
        },
        
        "birthday_party": {
          "depends_on": "venue and formality",
          "restaurant_bar": {
            "formula": "cocktail-casual",
            "options": ["midi dress", "nice top + jeans", "jumpsuit", "skirt + blouse"],
            "footwear": ["heels", "ankle boots", "dressy flats"]
          },
          "nightclub": {
            "formula": "trendy, form-fitting, statement",
            "options": ["bodycon dress", "crop top + skirt", "sequin top + pants", "romper"],
            "footwear": ["heels", "heeled booties", "platform shoes"],
            "accessories": ["small clutch or wristlet", "statement jewelry"]
          },
          "daytime_casual": {
            "formula": "fun, relaxed, colorful",
            "options": ["sundress", "casual dress", "nice top + shorts", "romper"],
            "footwear": ["sandals", "sneakers", "flats"]
          }
        },
        
        "cocktail_party": {
          "formula": "semi-formal, elegant, sophisticated",
          "dress_options": ["cocktail dress", "midi dress", "dressy jumpsuit", "silk blouse + midi skirt"],
          "colors": ["jewel tones", "black", "navy", "metallics", "bold colors"],
          "fabrics": ["silk", "satin", "chiffon", "lace", "velvet"],
          "footwear": ["heels", "strappy sandals", "heeled booties"],
          "accessories": ["clutch", "statement jewelry", "elegant watch"],
          "avoid": ["casual fabrics", "overly casual shoes", "gym wear"]
        },
        
        "dinner_party": {
          "formula": "polished-casual, elegant-comfortable",
          "dress_options": ["midi dress", "blouse + trousers", "sweater + midi skirt", "jumpsuit", "nice separates"],
          "footwear": ["low heels", "loafers", "ankle boots", "dressy flats"],
          "accessories": ["small bag or clutch", "moderate jewelry"],
          "avoid": ["overly casual (jeans + t-shirt)", "too formal (ball gown)", "uncomfortable"],
          "practical": "sitting for extended period; conversation-friendly"
        },
        
        "themed_party": {
          "formula": "follow theme while remaining tasteful",
          "examples": {
            "decades": ["70s disco", "80s neon", "90s grunge", "Y2K"],
            "color": ["all white party", "black and white", "neon"],
            "cultural": ["luau", "fiesta", "mardi gras"],
            "costume": ["masquerade", "murder mystery", "Halloween"]
          },
          "rule": "commit to theme but keep practical (footwear, mobility)"
        }
      },
      
      "music_festival": {
        "outdoor_festival": {
          "formula": "comfortable, weather-appropriate, expressive",
          "tops": ["crop top", "tank top", "band t-shirt", "bralette", "crochet top", "mesh top"],
          "bottoms": ["denim shorts", "bike shorts", "flowy skirt", "high-waisted shorts", "joggers"],
          "layers": ["flannel shirt", "kimono", "denim jacket", "windbreaker"],
          "footwear": ["boots (ankle or combat)", "sneakers", "platform sandals"],
          "accessories": ["backpack or crossbody", "sunglasses", "bandana", "hat", "fanny pack"],
          "avoid": ["heels", "restrictive clothing", "valuable jewelry", "white (gets dirty)"],
          "practical": ["standing all day", "potential mud", "weather changes", "bathroom lines"],
          "fabrics": ["breathable", "washable", "durable"]
        },
        
        "desert_festival": {
          "examples": ["Coachella"],
          "formula": "bohemian, airy, sun-protective",
          "tops": ["crop top", "crochet", "off-shoulder", "flowy tank"],
          "bottoms": ["high-waisted shorts", "flowy pants", "maxi skirt"],
          "layers": ["kimono", "light cardigan"],
          "footwear": ["ankle boots", "gladiator sandals", "comfortable sandals"],
          "accessories": ["wide-brim hat", "sunglasses", "crossbody bag", "bandana"],
          "practical": ["sun protection", "extreme heat during day", "cold at night", "dust"],
          "essentials": ["sunscreen", "hydration pack", "layers for night"]
        },
        
        "indoor_concert": {
          "formula": "band-appropriate, comfortable, casual-cool",
          "tops": ["band t-shirt", "crop top", "tank top", "graphic tee"],
          "bottoms": ["jeans", "leather pants", "denim shorts", "skirt"],
          "layers": ["leather jacket", "denim jacket", "flannel"],
          "footwear": ["combat boots", "sneakers", "platform boots", "ankle boots"],
          "accessories": ["crossbody bag", "minimal jewelry"],
          "avoid": ["heels (standing, mosh pit)", "loose jewelry (gets lost)", "expensive items"],
          "practical": ["loud environment", "standing room", "potential crowd"]
        }
      },
      
      "job_interview": {
        "corporate": {
          "formula": "conservative suit, polished, professional",
          "dress_options": ["matched suit (skirt or pants)", "blazer + dress pants", "sheath dress + blazer"],
          "colors": ["navy", "charcoal", "black", "dark gray"],
          "footwear": ["closed-toe pumps (2-3 inch heel)", "loafers", "oxfords"],
          "accessories": ["structured bag or portfolio", "watch", "minimal jewelry"],
          "grooming": ["conservative hairstyle", "neutral makeup", "trimmed nails", "minimal fragrance"],
          "avoid": ["bright colors", "patterns", "casual fabrics", "trendy items", "excessive jewelry"],
          "rule": "err on conservative; can show personality after hired"
        },
        
        "business_casual": {
          "formula": "polished, professional, slightly relaxed",
          "dress_options": ["blazer + chinos", "blouse + dress pants", "sheath dress", "sweater + skirt"],
          "colors": ["navy", "gray", "camel", "burgundy", "muted tones"],
          "footwear": ["closed-toe flats", "low heels", "loafers", "ankle boots"],
          "accessories": ["professional bag", "watch", "simple jewelry"],
          "avoid": ["jeans", "sneakers", "overly casual", "club wear"],
          "rule": "one step more formal than daily dress code"
        },
        
        "creative_industry": {
          "formula": "polished with personality, trend-aware",
          "dress_options": ["blazer + interesting top + pants", "unique dress", "stylish separates"],
          "colors": "more flexible; can incorporate trends",
          "footwear": ["heeled booties", "loafers", "clean fashion sneakers", "statement shoes"],
          "accessories": ["interesting bag", "statement jewelry (tasteful)", "watch"],
          "rule": "show personal style while remaining professional",
          "avoid": ["sloppy", "overly casual", "costume-like"],
          "balance": "creative but competent"
        },
        
        "startup_tech": {
          "formula": "smart casual, polished but not stuffy",
          "dress_options": ["blazer + jeans (dark)", "button-down + chinos", "sweater + dress pants", "casual dress"],
          "colors": "flexible",
          "footwear": ["clean sneakers", "loafers", "ankle boots", "flats"],
          "accessories": ["backpack or messenger bag", "watch", "minimal jewelry"],
          "avoid": ["suit (overdressed)", "shorts", "flip-flops", "gym wear"],
          "rule": "polished casual; show you fit culture"
        },
        
        "retail_service": {
          "formula": "neat, approachable, brand-appropriate",
          "dress_options": "align with store aesthetic",
          "examples": {
            "upscale_retail": ["dress", "blazer + pants", "polished separates"],
            "casual_retail": ["nice jeans + blouse", "casual dress", "sweater + pants"],
            "athletic_retail": ["athletic-casual", "brand apparel if possible"]
          },
          "rule": "dress like target customer but polished",
          "grooming": ["neat", "friendly appearance", "minimal fragrance"],
          "avoid": ["competitor brands visible", "overly formal", "too casual"]
        },
        
        "virtual_interview": {
          "formula": "professional top, comfortable bottom",
          "tops": ["blazer", "blouse", "button-down", "professional sweater"],
          "colors": "solid or subtle patterns (avoid busy patterns on camera)",
          "avoid": ["white (washes out)", "neon", "stripes (camera distortion)"],
          "accessories": ["minimal jewelry", "watch"],
          "bottoms": "professional (in case you stand up)",
          "background": "clean, neutral, professional",
          "grooming": ["polished", "good lighting", "test camera beforehand"]
        }
      },
      
      "casual_social": {
        "hangout_with_friends": {
          "casual_daytime": {
            "formula": "comfortable, your style, no pressure",
            "options": ["jeans + t-shirt", "casual dress", "shorts + tank", "leggings + sweater", "joggers + hoodie"],
            "footwear": ["sneakers", "sandals", "flats", "casual boots"],
            "accessories": ["crossbody bag or backpack", "sunglasses", "casual jewelry"],
            "rule": "whatever you're comfortable in"
          },
          "coffee_brunch": {
            "formula": "casual-cute, Instagram-ready",
            "options": ["jeans + nice top", "casual dress", "skirt + sweater", "jumpsuit"],
            "footwear": ["sneakers", "ankle boots", "loafers", "sandals"],
            "accessories": ["tote or crossbody", "sunglasses", "delicate jewelry"],
            "level": "put-together but not trying too hard"
          },
          "shopping": {
            "formula": "comfortable, easy on/off for trying clothes",
            "options": ["jeans + t-shirt", "leggings + tunic", "dress", "casual separates"],
            "footwear": ["sneakers", "slip-on shoes", "comfortable flats"],
            "accessories": ["crossbody bag (hands-free)", "minimal jewelry"],
            "practical": ["easy to remove", "comfortable for walking", "hands-free bag"]
          },
          "movie_theater": {
            "formula": "comfortable, casual, cozy",
            "options": ["jeans + sweater", "leggings + hoodie", "casual dress + cardigan", "joggers + t-shirt"],
            "footwear": ["sneakers", "slip-on shoes", "uggs", "comfortable shoes"],
            "layers": "bring layer (theaters can be cold)",
            "accessories": ["crossbody or tote"]
          }
        },
        
        "game_night": {
          "formula": "comfortable, casual, moveable",
          "options": ["jeans + t-shirt", "leggings + sweater", "joggers + hoodie", "casual dress"],
          "footwear": ["sneakers", "slippers", "socks", "comfortable shoes"],
          "avoid": ["restrictive clothing", "uncomfortable items"],
          "practical": "sitting on floor potential"
        },
        
        "outdoor_activities": {
          "picnic": {
            "formula": "casual, outdoor-appropriate, comfortable",
            "options": ["sundress", "shorts + tank", "jeans + t-shirt", "romper"],
            "footwear": ["sandals", "sneakers", "espadrilles"],
            "accessories": ["sun hat", "sunglasses", "blanket-friendly bag"],
            "avoid": ["white (grass stains)", "dry-clean-only", "restrictive"]
          },
          "beach": {
            "formula": "swimsuit + cover-up",
            "swimwear": ["one-piece", "bikini", "tankini", "swim dress"],
            "cover_ups": ["sundress", "kaftan", "shorts + tank", "sarong"],
            "footwear": ["flip-flops", "sandals", "water shoes"],
            "accessories": ["beach bag", "sun hat", "sunglasses", "sunscreen"],
            "practical": ["sand-friendly", "easy to remove", "sun protection"]
          },
          "amusement_park": {
            "formula": "comfortable, secure, weather-appropriate",
            "tops": ["t-shirt", "tank top", "athletic top"],
            "bottoms": ["shorts", "jeans", "leggings", "athletic pants"],
            "footwear": ["sneakers", "comfortable sandals with straps"],
            "accessories": ["crossbody bag or backpack", "sunglasses", "hat"],
            "avoid": ["flip-flops", "heels", "loose items", "valuable jewelry"],
            "practical": ["walking all day", "rides (secure clothing)", "weather changes"]
          }
        }
      }
    },
    
    "seasonal_strategies": {
      "spring_fall_transitional": {
        "layering_formula": "base layer + mid-layer + outer layer (all removable)",
        "spring_example": {
          "base": "silk camisole",
          "mid": "lightweight cashmere cardigan",
          "outer": "trench coat",
          "bottom": "midi skirt or tailored pants"
        },
        "fall_example": {
          "base": "long-sleeve tee or turtleneck",
          "mid": "chunky knit sweater or vest",
          "outer": "denim or leather jacket",
          "bottom": "dark jeans or corduroy pants"
        },
        "fabrics": ["cotton", "linen blends", "lightweight wool", "silk", "cashmere"],
        "footwear_spring": "ankle boots → loafers → sandals (as weather warms)",
        "footwear_fall": "sandals → loafers → ankle boots → tall boots (as weather cools)"
      },
      
      "summer": {
        "fabric_priority": "breathability",
        "best_fabrics": ["linen", "cotton", "silk", "chambray", "lightweight jersey"],
        "avoid_fabrics": ["polyester", "heavy knits", "leather (except evening)"],
        "color_strategy": {
          "light_colors": "reflect heat (white, cream, pastels, light gray)",
          "dark_colors": "absorb heat (save for evening: black, navy, dark brown)"
        },
        "footwear": "prioritize open-toe (sandals, espadrilles, slides, mules)"
      },
      
      "winter": {
        "layering_hierarchy": [
          "base: thermal or silk underlayer",
          "second: blouse, turtleneck, or long-sleeve top",
          "third: sweater, cardigan, or vest",
          "fourth: blazer or structured jacket (optional)",
          "outer: coat, parka, or heavy jacket"
        ],
        "coat_types": {
          "warmest": "down/puffer coats",
          "elegant": "wool/cashmere coats (60% wool minimum)",
          "luxe": "shearling/fur-trim"
        },
        "color_palette": {
          "darks": ["charcoal", "black", "chocolate", "navy", "forest green"],
          "accents": ["burgundy", "rust", "camel", "burnt orange", "plum"]
        },
        "avoid_colors": ["pastels", "light colors (show dirt/salt stains)"],
        "footwear": ["waterproof", "insulated", "traction soles", "knee-high boots", "combat boots", "shearling-lined boots"]
      }
    },
    
    "styling_techniques": {
      "menswear_inspired": {
        "key_pieces": [
          "oversized blazer (1-2 sizes up)",
          "crisp white shirt (oversized, untucked or half-tucked)",
          "straight-leg jeans (relaxed, not skinny)",
          "loafers, oxfords, derby shoes",
          "large-face watch",
          "trench coat, peacoat"
        ],
        "balance_rule": "if top is oversized, bottom must be fitted",
        "femininity_adds": ["heels", "delicate jewelry", "sleek hair", "bold lip"]
      },
      
      "elevated_casual": {
        "formula": "1 elevated piece + 2 casual staples + 1 unexpected detail",
        "examples": [
          {
            "elevated": "cashmere sweater",
            "casual": ["jeans", "white tee underneath"],
            "unexpected": "metallic loafers"
          },
          {
            "elevated": "silk blouse",
            "casual": ["denim", "sneakers"],
            "unexpected": "statement belt"
          },
          {
            "elevated": "tailored blazer",
            "casual": ["t-shirt", "joggers"],
            "unexpected": "heeled mules"
          }
        ],
        "third_piece_rule": "always add jacket, cardigan, vest, scarf, or coat for instant polish"
      },
      
      "sneaker_sophistication": {
        "acceptable": "white leather sneakers (pair with anything)",
        "avoid": ["neon running shoes", "overly chunky sneakers (unless intentionally fashion-forward)"],
        "elevation_formula": "sneakers + tailored pants + blazer + structured bag + gold jewelry"
      },
      
      "accessory_optimization": {
        "bag_proportions": {
          "petite_frame": "small to medium bags (avoid oversized totes)",
          "average_frame": "any size - choose based on occasion",
          "tall_frame": "medium to large bags (tiny bags look disproportionate)"
        },
        "jewelry_odd_rule": {
          "principle": "Style in sets of 1, 3, or 5 pieces",
          "examples": [
            "1: one statement necklace alone",
            "3: stud earrings + delicate necklace + watch",
            "5: hoop earrings + 2 layered necklaces + stacked rings + bracelet"
          ]
        },
        "metal_mixing": {
          "modern_rule": "mixing metals is acceptable",
          "application": "layer gold + silver necklaces, wear gold rings + silver watch",
          "guideline": "let one metal dominate (60% gold, 40% silver)"
        },
        "belt_placement": {
          "natural_waist": "classic, defines waist on dresses and oversized tops",
          "low_hip": "bohemian, relaxed (over long cardigans, maxi dresses)",
          "high_waist": "empire waist effect, lengthens legs"
        }
      }
    },
    
    "group_coordination": {
      "description": "Rules for coordinating outfits when dressing with others (couples, families, events with VIPs)",
      
      "hierarchy_principle": {
        "definition": "In any group photo or event, establish visual hierarchy based on importance",
        "roles": {
          "primary_person": {
            "definition": "The main focus (bride, graduate, birthday person, honoree)",
            "visual_priority": "highest",
            "should_be": "most visually distinctive or statement-making"
          },
          "supporting_person": {
            "definition": "Companion or family member attending with primary person",
            "visual_priority": "medium",
            "should_be": "complementary but not competing"
          },
          "guest": {
            "definition": "General attendee at event",
            "visual_priority": "lowest",
            "should_be": "understated, adhering to dress code"
          }
        }
      },
      
      "no_upstaging_rule": {
        "principle": "Supporting persons should not compete visually with primary person",
        "application": {
          "if_primary_wears_white": {
            "supporting_should_avoid": ["white", "ivory", "cream", "off-white", "bright neon colors"],
            "supporting_should_choose": ["deep anchor colors", "jewel tones", "rich neutrals"],
            "reasoning": "Deep colors create contrast that makes white stand out more"
          },
          "if_primary_wears_bold_color": {
            "supporting_should_avoid": ["same color", "competing bold colors", "clashing patterns"],
            "supporting_should_choose": ["neutral anchors", "analogous colors", "complementary colors in muted tones"]
          },
          "if_primary_wears_pattern": {
            "supporting_should_avoid": ["competing patterns", "same pattern"],
            "supporting_should_choose": ["solid colors that pull from primary's pattern", "subtle texture instead of pattern"]
          }
        },
        "occasions": ["graduations", "birthdays", "anniversaries", "award ceremonies", "family photos"]
      },
      
      "complementary_anchor_strategy": {
        "definition": "Supporting person acts as visual anchor to make primary person stand out",
        "color_formulas": {
          "primary_white_or_light": {
            "description": "When primary wears white, cream, pastels, or light colors",
            "supporting_colors": ["navy", "charcoal", "forest green", "burgundy", "black", "deep purple"],
            "rationale": "Deep colors provide high contrast, making light colors appear brighter in photos",
            "example": "graduate in white dress + parent in navy suit"
          },
          "primary_bold_color": {
            "description": "When primary wears bright or saturated color",
            "supporting_colors": ["neutral anchor from primary's undertone"],
            "if_warm_color": ["camel", "chocolate", "cream"],
            "if_cool_color": ["charcoal", "navy", "gray"],
            "example": "birthday person in red dress + companion in charcoal gray"
          },
          "primary_neutral_dark": {
            "description": "When primary wears black, navy, or dark colors",
            "supporting_colors": ["complementary neutral", "analogous dark shade", "muted jewel tone"],
            "example": "honoree in black suit + companion in burgundy or charcoal"
          }
        }
      },
      
      "group_statement_rule": {
        "principle": "In a pair or group, only ONE person should be the visual statement",
        "application": {
          "primary_is_statement": {
            "description": "Primary person wears bold/eye-catching outfit",
            "supporting_role": "wear neutral anchor (60% dominant color from color harmony rules)",
            "supporting_examples": ["black", "navy", "charcoal", "camel", "gray"],
            "supporting_avoid": ["sequins", "metallics", "loud patterns", "bright colors", "statement accessories"]
          },
          "primary_is_subtle": {
            "description": "Primary person wears understated/classic outfit",
            "supporting_role": "also wear understated outfit in complementary color",
            "group_effect": "elegant uniformity, sophistication",
            "example": "both in navy and white, varying shades"
          }
        }
      },
      
      "couple_coordination": {
        "description": "Specific rules for romantic couples or pairs",
        
        "matching_vs_coordinating": {
          "avoid_exact_matching": {
            "rule": "Never wear identical outfits (looks costume-y)",
            "examples_to_avoid": ["both in same shade of blue", "matching patterns", "identical accessories"]
          },
          "coordinate_instead": {
            "rule": "Share ONE element while varying others",
            "coordination_methods": [
              "share color palette but different shades",
              "share formality level (both casual or both formal)",
              "share one accent color in accessories",
              "complementary colors from same family"
            ],
            "examples": [
              "person A: navy suit + burgundy tie, person B: burgundy dress + navy accessories",
              "person A: cream blouse + black pants, person B: black shirt + cream jacket",
              "person A: floral dress with blue flowers, person B: solid blue shirt"
            ]
          }
        },
        
        "formality_matching": {
          "rule": "Both people must match formality level",
          "incorrect": [
            "person A in ball gown + person B in khakis",
            "person A in suit + person B in sundress"
          ],
          "correct": [
            "both in cocktail attire",
            "both in business casual",
            "both in formal evening wear"
          ]
        },
        
        "proportion_balance_couples": {
          "rule": "Balance visual weight between two people",
          "if_one_person_bold": {
            "description": "One person wears statement piece or bright color",
            "other_person": "wear neutral anchor to balance",
            "example": "person A: bright red dress, person B: charcoal suit"
          },
          "if_both_neutral": {
            "description": "Both in neutral colors",
            "add_interest": "vary textures or use complementary neutrals",
            "example": "person A: navy wool suit, person B: navy silk dress (same color, different texture)"
          }
        },
        
        "photo_readiness": {
          "rule": "Ensure outfits photograph well together",
          "considerations": [
            "avoid_clashing_patterns: no competing busy prints",
            "ensure_contrast: enough color difference to distinguish individuals in photos",
            "avoid_all_same_tone: some tonal variation prevents blob effect",
            "test_together: view outfits side-by-side before event"
          ]
        }
      },
      
      "family_group_coordination": {
        "description": "Rules for families or groups of 3+ people",
        
        "color_palette_method": {
          "rule": "Choose 3-4 coordinating colors, assign to group members",
          "method": "Select one dominant neutral + 2-3 accent colors from same family",
          "example_palette_1": {
            "colors": ["navy", "cream", "burgundy"],
            "distribution": "person A: navy dress, person B: cream shirt + navy pants, person C: burgundy blouse + cream skirt"
          },
          "example_palette_2": {
            "colors": ["gray", "blush pink", "white"],
            "distribution": "person A: gray suit, person B: blush dress, person C: white shirt + gray pants"
          }
        },
        
        "formality_consistency": {
          "rule": "All members must match formality level",
          "correct": "all in dressy casual OR all in formal wear",
          "incorrect": "mixing jeans with ball gowns"
        },
        
        "pattern_distribution": {
          "rule": "Limit patterns in group photos",
          "guideline": "Maximum 1-2 people in patterns, rest in solids",
          "correct": "person A: floral dress, persons B & C: solid colors that pull from floral",
          "incorrect": "person A: stripes, person B: floral, person C: plaid (too busy)"
        },
        
        "hierarchy_visual_weight": {
          "rule": "Primary person has most visual interest",
          "method": "Give primary person the accent color or pattern, others wear neutrals",
          "example": "graduate in bright coral, parents in navy and gray"
        }
      },
      
      "event_specific_group_rules": {
        "graduation": {
          "primary_person": "graduate",
          "common_graduate_colors": ["white", "black", "school colors under gown"],
          "supporting_strategy": "wear deep anchor colors (navy, burgundy, forest green, charcoal)",
          "avoid": ["white", "cream", "competing bold colors", "overly casual attire"],
          "reasoning": "Deep colors make graduate's white/light outfit pop in photos"
        },
        
        "wedding": {
          "primary_person": "bride and groom",
          "supporting_roles": ["parents", "wedding party", "family"],
          "coordination": {
            "parents_of_couple": {
              "rule": "Mothers coordinate with each other and bridesmaids",
              "method": "Choose colors from wedding palette, avoid bride/bridesmaid colors",
              "formality": "match wedding formality level"
            },
            "family_members": {
              "rule": "Complement wedding party colors without matching exactly",
              "avoid": ["white", "ivory", "cream", "bridesmaid dress color", "mother-of-bride dress color"]
            }
          }
        },
        
        "family_portrait": {
          "primary_person": "none (all equal) OR designated (grandparents, parents)",
          "strategy": "cohesive color palette method",
          "guidelines": [
            "choose 3-4 coordinating colors from same family",
            "vary shades and tones within color family",
            "limit patterns to 1-2 people maximum",
            "ensure everyone matches formality level",
            "avoid all wearing same exact color (boring in photos)"
          ],
          "example": "beach family photo: navy, white, khaki, denim blue across 6 people in various combinations"
        },
        
        "couples_night_out": {
          "rule": "Coordinate without matching",
          "method": "Share one color in accessories or accents",
          "example": "person A: black dress + gold jewelry, person B: navy suit + gold tie bar",
          "avoid": "looking like uniforms (both in all black, both in denim)"
        }
      },
      
      "ai_decision_tree_group": {
        "step_1_identify_hierarchy": {
          "question": "Who is the primary person or VIP?",
          "options": {
            "has_primary": "proceed to step 2",
            "no_primary": "use family_group_coordination with equal visual weight"
          }
        },
        "step_2_determine_primary_outfit": {
          "question": "What is the primary person wearing?",
          "extract": ["primary_color", "primary_formality", "primary_pattern_status"],
          "action": "use this as anchor for supporting person recommendations"
        },
        "step_3_apply_complementary_anchor": {
          "if_primary_light_color": "recommend deep anchor colors for supporting person",
          "if_primary_bold_color": "recommend neutral anchors from matching temperature",
          "if_primary_pattern": "recommend solids for supporting person",
          "if_primary_neutral": "recommend complementary neutral or muted accent"
        },
        "step_4_ensure_no_upstaging": {
          "check": [
            "supporting person not wearing same color as primary",
            "supporting person not wearing competing bold color",
            "supporting person not wearing white if primary wears white",
            "supporting person formality matches primary"
          ]
        },
        "step_5_verify_photo_cohesion": {
          "check": [
            "sufficient contrast between people (not all same tone)",
            "shared color element exists (palette cohesion)",
            "no clashing patterns",
            "group reads as coordinated but not uniform"
          ]
        }
      },
      
      "quick_reference_group_pairings": {
        "primary_white": {
          "supporting_best": ["navy", "charcoal", "burgundy", "forest green", "black"],
          "supporting_avoid": ["white", "cream", "ivory", "pale yellow", "neon colors"]
        },
        "primary_black": {
          "supporting_best": ["burgundy", "emerald", "charcoal", "navy", "deep purple"],
          "supporting_avoid": ["black (unless intentionally all-black)", "brown", "orange"]
        },
        "primary_red": {
          "supporting_best": ["charcoal", "navy", "black", "cream", "gray"],
          "supporting_avoid": ["red", "pink", "orange", "purple (clashing)"]
        },
        "primary_navy": {
          "supporting_best": ["cream", "burgundy", "gray", "camel", "white"],
          "supporting_avoid": ["navy", "black (too similar)", "brown"]
        },
        "primary_pastel": {
          "supporting_best": ["navy", "gray", "white", "complementary pastel"],
          "supporting_avoid": ["neon", "black (too harsh contrast)", "same pastel"]
        },
        "primary_pattern": {
          "supporting_best": "solid color pulled from pattern",
          "supporting_avoid": ["any competing pattern", "unrelated colors"]
        }
      }
    },
    
    "cultural_guidelines": {
      "color_symbolism_by_culture": {
        "chinese_culture": {
          "auspicious_colors": {
            "red": {
              "meaning": "luck, prosperity, happiness, celebration",
              "occasions": ["Chinese New Year", "Lunar New Year", "weddings", "celebrations", "festivals"],
              "application": "wear red clothing, accessories, or incorporate red elements",
              "avoid": "funerals, mourning periods"
            },
            "gold": {
              "meaning": "wealth, prosperity, fortune",
              "occasions": ["Chinese New Year", "business events", "celebrations"],
              "application": "gold jewelry, gold accents, yellow-gold tones"
            },
            "pink_peach": {
              "meaning": "romance, love, happiness",
              "occasions": ["weddings", "celebrations", "spring festivals"],
              "application": "acceptable for festive occasions"
            }
          },
          "inauspicious_colors": {
            "white": {
              "meaning": "death, mourning, funerals",
              "avoid_occasions": ["Chinese New Year", "weddings", "celebrations", "business meetings"],
              "exception": "Western-style events, modern weddings may accept",
              "rule": "never give white flowers; never wear all-white to celebrations"
            },
            "black": {
              "meaning": "death, mourning, bad luck",
              "avoid_occasions": ["Chinese New Year", "weddings", "celebrations"],
              "exception": "modern business settings, Western-style events",
              "rule": "especially avoid as dominant color during festive times"
            },
            "blue_dark_blue": {
              "meaning": "associated with mourning in some contexts",
              "avoid_occasions": ["Chinese New Year (traditional families)"],
              "note": "less strict than white/black; modern acceptance varies"
            }
          },
          "cultural_taboos": {
            "green_hat": {
              "meaning": "infidelity, being cheated on (戴绿帽子)",
              "rule": "NEVER wear green hats or caps",
              "applies_to": "all occasions",
              "severity": "extremely offensive",
              "alternative": "green clothing acceptable; only green headwear is taboo"
            },
            "clock_gifts": {
              "meaning": "送钟 sounds like 'attending a funeral'",
              "rule": "never gift watches or clocks",
              "note": "not clothing-related but important cultural knowledge"
            }
          },
          "numbers": {
            "lucky": ["8 (wealth)", "6 (smooth, flowing)", "9 (longevity)"],
            "unlucky": ["4 (sounds like death)"],
            "application": "may influence number of buttons, layers, accessories"
          }
        },
        
        "indian_culture": {
          "auspicious_colors": {
            "red": {
              "meaning": "purity, fertility, prosperity, marriage",
              "occasions": ["weddings (bride)", "festivals", "Diwali", "religious ceremonies"],
              "application": "traditional wedding color for brides; appropriate for all celebrations",
              "rule": "wedding guests should avoid pure red (bride's color)"
            },
            "saffron_orange": {
              "meaning": "sacred, religious, spiritual",
              "occasions": ["religious ceremonies", "festivals", "Holi"],
              "application": "appropriate for religious events; festive occasions"
            },
            "yellow_turmeric": {
              "meaning": "auspicious, sacred, knowledge",
              "occasions": ["Haldi ceremony", "festivals", "spring celebrations"],
              "application": "traditional for pre-wedding ceremonies"
            },
            "green": {
              "meaning": "fertility, prosperity, new beginnings",
              "occasions": ["festivals", "celebrations", "Eid"],
              "application": "popular for festive wear"
            },
            "pink": {
              "meaning": "joy, celebration, playfulness",
              "occasions": ["weddings", "festivals", "celebrations"],
              "application": "popular for wedding guests and celebrations"
            }
          },
          "inauspicious_colors": {
            "black": {
              "meaning": "inauspicious, mourning in some contexts",
              "avoid_occasions": ["traditional weddings", "religious ceremonies", "festivals"],
              "exception": "modern fashion; acceptable in contemporary settings",
              "rule": "avoid as dominant color in traditional/religious settings"
            },
            "white": {
              "meaning": "mourning, widowhood",
              "avoid_occasions": ["weddings", "celebrations", "festivals"],
              "exception": "acceptable as accent; modern weddings may allow",
              "rule": "never wear all-white to traditional weddings"
            }
          },
          "cultural_dress": {
            "appropriate_attire": ["saree", "salwar kameez", "lehenga", "kurta", "sherwani"],
            "modesty": "cover shoulders, knees in religious settings",
            "head_covering": "required in some temples, gurudwaras",
            "footwear": "remove before entering homes, temples"
          }
        },
        
        "japanese_culture": {
          "color_meanings": {
            "red": {
              "meaning": "life, energy, protection from evil",
              "occasions": ["festivals", "celebrations", "New Year"],
              "application": "positive color; red accents welcome"
            },
            "white": {
              "meaning": "purity, sacred, death (context-dependent)",
              "occasions_positive": ["weddings", "celebrations"],
              "occasions_negative": ["funerals"],
              "rule": "context matters; white acceptable at weddings"
            },
            "black": {
              "meaning": "formality, sophistication, mourning",
              "occasions": ["formal events", "funerals", "business"],
              "application": "formal color; acceptable in most contexts"
            },
            "blue": {
              "meaning": "calmness, stability, cleanliness",
              "application": "positive color; widely acceptable"
            }
          },
          "cultural_dress": {
            "kimono_rules": {
              "left_over_right": "CRITICAL - right over left is for deceased only",
              "occasions": ["tea ceremony", "festivals", "formal events", "weddings"],
              "colors_by_age": {
                "young_unmarried": "bright colors, long sleeves (furisode)",
                "married_adult": "subdued colors, shorter sleeves",
                "older_adult": "darker, muted tones"
              }
            },
            "foot_etiquette": {
              "remove_shoes": "required indoors, temples, traditional restaurants",
              "tabi_socks": "white split-toe socks with kimono",
              "clean_socks": "always ensure clean socks when removing shoes"
            }
          }
        },
        
        "korean_culture": {
          "color_meanings": {
            "red": {
              "meaning": "passion, energy, celebration",
              "occasions": ["celebrations", "New Year", "festivals"],
              "application": "festive color; positive associations"
            },
            "white": {
              "meaning": "purity, truth, mourning",
              "occasions_avoid": ["weddings as guest"],
              "occasions_appropriate": ["traditional hanbok (acceptable)", "funerals"],
              "note": "context-dependent; white hanbok is traditional"
            },
            "yellow": {
              "meaning": "royalty, center (historically)",
              "application": "positive color; acceptable in modern contexts"
            },
            "blue": {
              "meaning": "calmness, integrity",
              "application": "positive color; widely acceptable"
            }
          },
          "hanbok_etiquette": {
            "occasions": ["Lunar New Year", "Chuseok", "weddings", "festivals", "celebrations"],
            "colors": "bright, vibrant colors encouraged for celebrations",
            "modern_hanbok": "acceptable in contemporary settings"
          },
          "gift_etiquette": {
            "avoid_red_ink": "writing names in red = death",
            "number_four": "unlucky (sounds like death)"
          }
        },
        
        "middle_eastern_culture": {
          "modesty_requirements": {
            "general": {
              "shoulders": "covered in religious settings, conservative areas",
              "knees": "covered; avoid shorts",
              "cleavage": "covered; high necklines preferred",
              "tight_clothing": "avoid body-con in conservative settings",
              "transparency": "avoid sheer, see-through fabrics"
            },
            "women_mosque": {
              "headscarf": "required; bring scarf",
              "abaya": "may be required; often provided at entrance",
              "loose_clothing": "non-form-fitting required",
              "full_coverage": "arms, legs, neck covered"
            },
            "men_mosque": {
              "long_pants": "required; no shorts",
              "shoulders_covered": "shirt with sleeves",
              "shoes_removed": "before entering prayer area"
            }
          },
          "color_guidance": {
            "conservative_countries": {
              "preferred": ["black", "navy", "brown", "beige", "muted tones"],
              "avoid": ["bright neon", "loud patterns", "overly colorful"],
              "women": "darker colors often preferred; colorful acceptable in private settings"
            },
            "celebrations": {
              "eid": "bright colors welcome; gold jewelry encouraged",
              "weddings": "vibrant colors; gold embroidery; elaborate embellishments"
            }
          },
          "regional_variations": {
            "uae_qatar_saudi": "very conservative; strict modesty rules",
            "lebanon_turkey": "more liberal; Western dress more acceptable",
            "morocco_tunisia": "moderate; tourist areas more relaxed"
          }
        },
        
        "african_cultures": {
          "general_note": "54 countries with diverse traditions; these are common themes",
          "colors": {
            "bright_vibrant": {
              "meaning": "joy, celebration, life, community",
              "occasions": ["weddings", "festivals", "celebrations", "church"],
              "application": "bright colors, bold patterns encouraged",
              "popular": ["red", "yellow", "orange", "green", "blue", "purple"]
            },
            "white": {
              "meaning": "purity, spirituality, peace",
              "occasions": ["ceremonies", "traditional events", "some funerals"],
              "note": "context varies by region"
            }
          },
          "traditional_dress": {
            "encouraged": "wearing traditional dress shows respect for culture",
            "examples": ["dashiki", "kaftan", "boubou", "kente", "ankara prints"],
            "occasions": ["weddings", "cultural events", "celebrations"],
            "cultural_appropriation": "if not from culture, ask permission or buy from local artisans"
          },
          "head_wraps": {
            "significance": "cultural and spiritual meaning in many communities",
            "respect": "ask before wearing if not from culture",
            "occasions": "appropriate for celebrations, church, cultural events"
          }
        },
        
        "latin_american_culture": {
          "colors": {
            "vibrant_welcome": {
              "meaning": "joy, celebration, life",
              "occasions": ["festivals", "weddings", "celebrations", "Día de los Muertos"],
              "colors": ["bright pink", "orange", "yellow", "turquoise", "red", "purple"],
              "application": "bold colors and patterns celebrated"
            },
            "dia_de_los_muertos": {
              "traditional": ["bright colors", "orange (marigolds)", "purple", "pink"],
              "meaning": "celebration of life, honoring deceased",
              "avoid": "somber mourning colors; this is a celebration"
            }
          },
          "cultural_dress": {
            "appropriate": "colorful traditional dress welcomed at celebrations",
            "examples": ["huipil", "rebozo", "pollera", "embroidered blouses"],
            "respect": "purchase from local artisans; understand significance"
          },
          "quinceañera": {
            "birthday_girl": "elaborate gown, often pink, purple, or pastels",
            "guests": "formal attire, avoid white (bride-like)"
          }
        }
      },
      
      "religious_dress_codes": {
        "christian": {
          "general_church": {
            "modesty": "shoulders covered, knee-length or longer",
            "avoid": ["deep cleavage", "very short skirts/shorts", "overly casual (ripped jeans, flip-flops)"],
            "acceptable": ["dresses", "skirts", "dress pants", "blouses", "suits"],
            "head_covering": "not required (except specific denominations)"
          },
          "catholic": {
            "traditional": "more formal; shoulders covered",
            "vatican_specific": {
              "required": ["knees covered", "shoulders covered", "no plunging necklines"],
              "strictly_enforced": "denied entry if not compliant"
            },
            "special_masses": "more formal; business casual minimum"
          },
          "conservative_evangelical": {
            "women": ["skirts/dresses preferred over pants in some churches", "modest lengths", "covered shoulders"],
            "avoid": ["pants for women (in very conservative)", "heavy makeup", "elaborate jewelry"]
          },
          "orthodox_christian": {
            "women": {
              "head_covering": "required (scarf or veil)",
              "skirts_only": "no pants",
              "long_sleeves": "preferred",
              "modesty": "high necklines, ankle-length preferred"
            },
            "men": {
              "long_pants": "required",
              "remove_hats": "before entering"
            }
          }
        },
        
        "jewish": {
          "orthodox_synagogue": {
            "women": {
              "married": "head covering required (hat, scarf, or wig)",
              "modesty": "elbows covered, knees covered, collarbone covered",
              "no_pants": "skirts/dresses only in very orthodox",
              "stockings": "required in very orthodox"
            },
            "men": {
              "head_covering": "kippah/yarmulke required",
              "long_pants": "required",
              "tzitzit": "prayer shawl for prayer services"
            }
          },
          "conservative_reform": {
            "more_lenient": "pants acceptable for women",
            "head_covering": "optional for women; required for men",
            "modesty": "shoulders and knees covered preferred"
          },
          "high_holidays": {
            "formality": "more formal dress expected",
            "colors": "white traditional for Yom Kippur",
            "avoid": ["leather shoes on Yom Kippur (some observe)", "overly casual attire"]
          }
        },
        
        "muslim": {
          "mosque": {
            "women": {
              "headscarf": "required (hijab)",
              "full_coverage": "arms, legs, torso covered",
              "loose_clothing": "not form-fitting",
              "long_skirt_pants": "ankle-length minimum",
              "bring_scarf": "often provided at mosque entrance"
            },
            "men": {
              "long_pants": "required; no shorts",
              "shirt": "required; shoulders covered",
              "remove_shoes": "before entering prayer area",
              "head_covering": "optional (taqiyah/kufi)"
            }
          },
          "general_modesty": {
            "hijab_wearing_women": {
              "covers": "hair, neck, ears",
              "clothing": "loose, non-revealing",
              "colors": "any color acceptable"
            },
            "niqab_abaya": {
              "note": "varies by region and personal choice",
              "abaya": "long robe-like dress",
              "niqab": "face veil (not universal)"
            }
          },
          "eid_celebrations": {
            "encouraged": "new clothes, best attire",
            "colors": "bright colors welcomed",
            "gold_jewelry": "encouraged for women",
            "formality": "dress up; celebratory"
          }
        },
        
        "hindu": {
          "temple": {
            "modesty": "shoulders and knees covered",
            "remove_shoes": "always before entering",
            "acceptable": ["traditional dress (saree, salwar)", "conservative Western wear"],
            "avoid": ["leather (some temples)", "shorts", "sleeveless tops"],
            "head_covering": "not required for women; men remove hats"
          },
          "puja_ceremonies": {
            "traditional_dress": "encouraged (saree, dhoti, kurta)",
            "colors": "bright colors welcomed",
            "avoid": "black, white in some traditions",
            "footwear": "removed for ceremony"
          }
        },
        
        "buddhist": {
          "temple": {
            "modesty": "shoulders and knees covered",
            "remove_shoes": "required before entering temple buildings",
            "avoid": ["tight clothing", "revealing attire", "shorts", "tank tops"],
            "colors": "muted, respectful tones preferred",
            "sitting": "feet should not point at Buddha images"
          },
          "monks": {
            "interaction": "women should not touch monks",
            "gifting": "place items down rather than hand directly (in some traditions)"
          }
        },
        
        "sikh": {
          "gurdwara": {
            "head_covering": "REQUIRED for all (scarves provided)",
            "remove_shoes": "required",
            "wash_hands": "before entering",
            "modesty": "shoulders and legs covered",
            "no_tobacco_alcohol": "do not wear symbols/clothing promoting these"
          },
          "five_ks": {
            "kesh": "uncut hair (may wear turban)",
            "respect": "never ask someone to remove turban"
          }
        }
      },
      
      "regional_dress_codes": {
        "middle_east": {
          "conservative_countries": {
            "countries": ["Saudi Arabia", "Iran", "Yemen", "Afghanistan"],
            "women": {
              "required": ["abaya or long robe", "headscarf", "full coverage"],
              "avoid": ["pants alone", "Western dress", "tight clothing", "makeup (some areas)"],
              "foreigners": "must comply; laws enforced"
            },
            "men": {
              "required": ["long pants", "shirt with sleeves"],
              "avoid": ["shorts", "sleeveless shirts", "tight clothing"],
              "traditional_dress": "thobe/dishdasha welcomed"
            }
          },
          "moderate_countries": {
            "countries": ["UAE (Dubai)", "Jordan", "Morocco", "Turkey"],
            "women": {
              "tourist_areas": "Western dress acceptable",
              "local_areas": "modest dress recommended",
              "mosques_religious_sites": "full coverage, headscarf",
              "beaches": "varies by location; some allow swimwear, others require coverage"
            }
          }
        },
        
        "south_asia": {
          "india_pakistan_bangladesh": {
            "women": {
              "urban_areas": "Western dress acceptable",
              "rural_areas": "traditional dress preferred",
              "temples_mosques": "modest, traditional dress",
              "weddings_events": "traditional dress encouraged (saree, salwar)"
            },
            "men": {
              "general": "Western or traditional acceptable",
              "religious_sites": "modest, covered",
              "weddings": "traditional dress (kurta, sherwani) common"
            }
          }
        },
        
        "southeast_asia": {
          "thailand_myanmar": {
            "temples": {
              "shoulders_knees_covered": "strictly enforced",
              "remove_shoes": "required",
              "avoid": ["Buddha image clothing", "tight clothing", "beachwear"]
            },
            "beaches": "swimwear acceptable at beaches; cover up elsewhere"
          },
          "indonesia_malaysia": {
            "muslim_majority": "modest dress recommended",
            "tourist_areas": "more relaxed",
            "mosques": "full coverage, headscarf required",
            "beaches": "varies; some areas conservative"
          }
        },
        
        "europe": {
          "general": "Western dress standard",
          "churches_cathedrals": {
            "required": ["shoulders covered", "knees covered"],
            "enforcement": "varies; major sites more strict (Vatican, etc.)",
            "scarves_available": "often available for purchase/loan at entrance"
          },
          "business": "formal; conservative dress expected"
        },
        
        "africa": {
          "north_africa": {
            "countries": ["Morocco", "Egypt", "Tunisia"],
            "similar_to": "Middle Eastern modesty standards",
            "women": "modest dress; cover shoulders, knees",
            "tourist_areas": "more relaxed but still conservative"
          },
          "sub_saharan_africa": {
            "varies_widely": "54 countries; diverse standards",
            "general": "modest dress appreciated",
            "traditional_dress": "welcomed and encouraged",
            "business": "formal Western attire standard"
          }
        }
      },
      
      "cultural_appropriation_guidelines": {
        "definition": "Wearing elements of a culture that is not your own, especially when done without understanding or respect",
        
        "problematic_items": {
          "native_american": {
            "avoid": ["war bonnets/headdresses", "face paint", "tribal regalia", "dreamcatcher fashion"],
            "reason": "sacred items with earned significance; not costumes",
            "severity": "highly offensive"
          },
          "religious_items": {
            "avoid": ["bindis (as fashion)", "hijabs (as fashion)", "turbans (as fashion)", "indigenous ceremonial dress"],
            "exception": "when invited by culture or participating in religious ceremony",
            "rule": "religious items are not fashion accessories"
          },
          "black_culture": {
            "avoid": ["locs/dreadlocks on non-Black people in professional settings (complicated)", "cornrows as 'boxer braids'", "durags as fashion"],
            "context": "historical oppression; Black people penalized for same styles",
            "note": "very nuanced; research and understand history"
          },
          "asian_cultures": {
            "complicated": ["qipao/cheongsam", "kimono", "hanbok", "sari"],
            "acceptable_if": ["purchased from culture", "worn respectfully", "appropriate occasion", "invited by culture"],
            "avoid": ["as costume", "with stereotypical elements", "sexualized versions"],
            "rule": "understand significance; some cultures welcome sharing, others don't"
          }
        },
        
        "respectful_appreciation": {
          "do": [
            "Buy from artisans of that culture",
            "Learn the significance and history",
            "Wear in appropriate contexts",
            "Ask permission or guidance from members of culture",
            "Give credit to the culture",
            "Respect sacred items by not wearing them"
          ],
          "dont": [
            "Wear as costume or Halloween outfit",
            "Cherry-pick aesthetic without understanding",
            "Wear sacred or ceremonial items casually",
            "Claim items as fashion without acknowledging origin",
            "Wear when members of culture are discriminated against for same item"
          ]
        },
        
        "when_invited": {
          "weddings": "If invited to cultural wedding and offered traditional dress, wearing it shows respect",
          "cultural_events": "When explicitly welcomed to wear traditional dress, it can be honoring",
          "guidance": "Always ask; follow guidance given; err on side of not wearing if unsure"
        }
      },
      
      "international_business_etiquette": {
        "east_asia": {
          "japan": {
            "formality": "high; conservative dress essential",
            "colors": ["dark suits (navy, charcoal, black)", "white shirts", "muted ties"],
            "women": ["conservative suits", "closed-toe shoes", "minimal jewelry", "natural makeup"],
            "avoid": ["bright colors", "flashy accessories", "casual wear"],
            "details": "meticulous grooming expected; shoes may be removed (clean socks)"
          },
          "south_korea": {
            "formality": "high; appearance very important",
            "similar_to": "Japanese business culture",
            "women": ["suits or conservative dresses", "modest hemlines", "closed-toe shoes"],
            "men": ["dark suits", "conservative ties", "polished shoes"],
            "grooming": "pristine; well-maintained appearance critical"
          },
          "china": {
            "formality": "moderate to high",
            "colors": ["dark suits", "avoid: excessive red (draws attention)", "avoid: white (mourning)", "avoid: green hats"],
            "women": ["conservative suits", "closed-toe shoes", "minimal jewelry"],
            "men": ["dark suits", "white shirts", "conservative ties"],
            "avoid": ["overly expensive displays", "flashy brands (can appear boastful)"]
          }
        },
        
        "middle_east": {
          "formality": "high; conservative essential",
          "men": ["dark suits", "long sleeves", "ties usually expected"],
          "women": ["very conservative", "full coverage", "loose-fitting suits", "high necklines", "long sleeves", "closed-toe shoes"],
          "avoid": ["tight clothing", "short skirts", "sleeveless", "low necklines"],
          "note": "women may not shake hands with men; follow their lead"
        },
        
        "europe": {
          "formality": "high; quality over flash",
          "colors": ["dark suits", "quality fabrics", "classic styling"],
          "women": ["elegant suits or dresses", "quality accessories", "understated jewelry"],
          "men": ["well-tailored suits", "quality shoes", "minimal accessories"],
          "note": "Europeans value quality and craftsmanship; understated elegance"
        },
        
        "latin_america": {
          "formality": "moderate; relationship-building important",
          "men": ["suits (can be lighter colors in tropical)", "conservative ties"],
          "women": ["business suits or dresses", "elegant and polished", "more color acceptable than Asia"],
          "note": "appearance important but slightly less formal than Asia; personal relationships valued"
        }
      },
      
      "ai_application_guide": {
        "when_to_apply": [
          "User mentions specific cultural event (Chinese New Year, Diwali, Eid, etc.)",
          "User identifies as member of specific culture",
          "User attending cultural wedding or event",
          "User traveling to specific region/country",
          "User asking about business attire in specific country",
          "User mentions religious service or temple visit"
        ],
        
        "query_workflow": {
          "step_1": "Identify culture/region mentioned by user",
          "step_2": "Check occasion type (religious, celebration, business, wedding)",
          "step_3": "Cross-reference with occasion_specific_rules",
          "step_4": "Apply cultural color symbolism if relevant",
          "step_5": "Check for cultural taboos and forbidden items",
          "step_6": "Provide culturally appropriate recommendations",
          "step_7": "Include respectful explanation of why (educate user)"
        },
        
        "sensitivity_rules": {
          "always_respectful": "Frame cultural rules as 'in this culture' not 'you must'",
          "acknowledge_diversity": "Note variations within cultures (modern vs traditional, urban vs rural)",
          "avoid_stereotypes": "Recognize individual variation; these are guidelines not absolute rules",
          "when_uncertain": "Suggest user consult with someone from that culture",
          "appropriation_check": "If user not from culture, gently explain significance and alternatives"
        },
        
        "example_queries": [
          {
            "user_query": "What should I wear to Chinese New Year celebration?",
            "ai_response_should_include": [
              "Recommend red clothing or accessories (luck, prosperity)",
              "Suggest gold jewelry or accents (wealth)",
              "WARN about avoiding white and black (mourning)",
              "CRITICAL WARNING: Never suggest green hat",
              "Mention festive, celebratory vibe"
            ]
          },
          {
            "user_query": "I'm attending an Indian wedding, what should I wear?",
            "ai_response_should_include": [
              "Encourage bright colors, jewel tones",
              "FORBID: red (bride's color), white (mourning), black (inauspicious)",
              "Suggest: saree, lehenga, or Western dress in appropriate colors",
              "Mention: gold jewelry welcomed",
              "Note: may be multiple events with different dress codes"
            ]
          },
          {
            "user_query": "Business meeting in Dubai, what's appropriate?",
            "ai_response_should_include": [
              "Women: full coverage, loose-fitting suit, high neckline, long sleeves, closed-toe",
              "Men: dark suit, long sleeves, tie",
              "Conservative approach essential",
              "Avoid tight, revealing, or casual clothing"
            ]
          }
        ]
      }
    },
    
    "absolute_rules": {
      "non_negotiable": [
        {
          "rule": "fit_is_everything",
          "description": "Well-fitted affordable clothes look better than ill-fitting expensive clothes",
          "action": "prioritize proper fit; consider tailoring"
        },
        {
          "rule": "invest_in_foundations",
          "description": "Quality basics outlast trends",
          "items": ["white tee", "black pants", "nude heels", "camel coat", "white button-down"]
        },
        {
          "rule": "shoes_matter",
          "description": "Scuffed or worn-out shoes ruin even the best outfit",
          "action": "maintain footwear; replace when visibly worn"
        },
        {
          "rule": "simplify_when_uncertain",
          "description": "Less is more when in doubt",
          "action": "remove one accessory, pattern, or color if outfit feels cluttered"
        },
        {
          "rule": "respect_occasion",
          "description": "Underdressing shows disrespect; overdressing shows effort",
          "guideline": "err on slightly overdressed"
        },
        {
          "rule": "quality_over_quantity",
          "description": "10 well-made versatile pieces > 50 trendy disposable items"
        }
      ]
    },
    
    "recommendation_workflow": {
      "step_0_check_group_context": {
        "question": "Is this outfit for attending event with others or for photos with specific people?",
        "if_yes": {
          "action": "proceed to group_coordination rules",
          "extract": [
            "who is primary person (if any)",
            "what is primary person wearing",
            "relationship to primary person",
            "event type (graduation, wedding, family photo, etc.)"
          ],
          "apply": "group_coordination > ai_decision_tree_group"
        },
        "if_no": "proceed to step 1"
      },
      "step_1_identify_occasion": {
        "categories": ["professional", "social_event", "casual", "wedding", "seasonal_activity"],
        "action": "determine dress code and context"
      },
      "step_2_establish_base": {
        "determine": ["primary garment (dress, pants + top, etc.)", "color palette (using 60-30-10 rule)"],
        "action": "select dominant neutral or appropriate color",
        "if_coordinating_with_others": "apply complementary_anchor_strategy from group_coordination"
      },
      "step_3_apply_proportion": {
        "check": "top-bottom balance",
        "action": "ensure deliberate imbalance (fitted top = loose bottom, vice versa)"
      },
      "step_4_add_texture": {
        "verify": "hard-soft contrast present",
        "action": "mix structured and fluid materials"
      },
      "step_5_layer_appropriately": {
        "consider": "season and temperature",
        "action": "add third piece (jacket/cardigan/vest) for polish"
      },
      "step_6_complete_with_accessories": {
        "ensure": "minimum 5 pieces total",
        "select": "footwear + bag + jewelry following one-statement rule",
        "verify": "odd number of jewelry pieces (1, 3, or 5)",
        "if_coordinating_with_others": "ensure accessories don't upstage primary person"
      },
      "step_7_final_check": {
        "confirm": [
          "occasion appropriateness",
          "color harmony (60-30-10 or monochromatic rules)",
          "texture contrast present",
          "proportions balanced",
          "no forbidden colors for occasion (especially weddings)",
          "patterns mixed correctly if applicable",
          "one statement piece, rest understated"
        ]
      },
      "step_8_group_coordination_check": {
        "only_if_applicable": "coordinating with others",
        "verify": [
          "no upstaging rule followed (not competing with primary person)",
          "formality levels match across group",
          "complementary color strategy applied (deep anchor for light primary, etc.)",
          "patterns limited in group (max 1-2 people)",
          "sufficient contrast for photo clarity",
          "shared color palette element exists"
        ]
      }
    }
  }
}
;
