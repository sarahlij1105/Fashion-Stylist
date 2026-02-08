export const masterStyleGuide = {
  "master_style_guide": {
    "version": "1.0",
    "last_updated": "2026-02-08",
    "description": "AI-optimized styling principles for outfit recommendations. Each rule is actionable and based on established fashion conventions.",
    
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
          "rule": "Never go all-matte or all-shine"
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
        "elements": ["top", "bottom (or dress)", "footwear", "outerwear (jacket/coat/cardigan)", "accessories (bag/jewelry/belt/scarf)"],
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
        "proven_formulas": ["stripes + florals", "polka dots + stripes", "animal print + geometric", "plaid + floral"],
        "avoid": ["two large-scale bold patterns together", "more than 3 patterns in one outfit"]
      }
    },
    
    "occasion_specific_rules": {
      "professional_workplace": {
        "corporate_traditional": {
          "formula": "tailored suit OR blazer + trousers/pencil skirt",
          "colors": ["navy", "charcoal", "black", "camel", "ivory", "burgundy"],
          "footwear": ["closed-toe pumps", "loafers", "oxfords"],
          "avoid": ["loud patterns", "casual fabrics", "excessive jewelry"]
        },
        "business_casual": {
          "formula": "blazer optional; smart separates",
          "footwear": ["loafers", "ankle boots", "clean sneakers", "low heels"],
          "avoid": ["ripped jeans", "flip-flops", "athletic wear"]
        },
        "creative_professional": {
          "formula": "trend-aware, personal style emphasized",
          "pattern_mixing": "encouraged",
          "accessories": "statement pieces encouraged"
        }
      },
      "social_events": {
        "cocktail_attire": {
          "women": ["knee-length to midi dress", "dressy separates (silk blouse + tailored pants)"],
          "colors": ["jewel tones", "metallics", "black", "navy", "emerald", "burgundy"],
          "footwear": ["heeled sandals", "pumps", "heeled booties"],
          "avoid": ["floor-length gowns", "casual day dresses", "flats"]
        },
        "casual_daytime": {
          "formula": ["sundress", "jumpsuit", "smart separates"],
          "footwear": ["wedges", "block-heel sandals", "espadrilles", "dressy flats"],
          "avoid": ["overly revealing items", "denim shorts", "flip-flops"]
        }
      },
      "wedding_guest_rules": {
        "forbidden": ["white/ivory/cream (reserved for bride)", "black at daytime outdoor weddings", "red at Chinese weddings"],
        "safe_colors": ["navy", "burgundy", "emerald green", "dusty rose", "lavender", "taupe", "champagne gold", "cobalt blue"]
      }
    },
    
    "styling_techniques": {
      "elevated_casual": {
        "formula": "1 elevated piece + 2 casual staples + 1 unexpected detail",
        "third_piece_rule": "always add jacket, cardigan, vest, scarf, or coat for instant polish"
      },
      "accessory_optimization": {
        "bag_proportions": {
          "petite_frame": "small to medium bags",
          "average_frame": "any size",
          "tall_frame": "medium to large bags"
        },
        "jewelry_odd_rule": "Style in sets of 1, 3, or 5 pieces",
        "metal_mixing": "let one metal dominate (60% gold, 40% silver)"
      }
    },
    
    "recommendation_workflow": {
      "step_1_identify_occasion": "Determine dress code and context",
      "step_2_establish_base": "Select primary garment + color palette (60-30-10 rule)",
      "step_3_apply_proportion": "Ensure deliberate imbalance (fitted top = loose bottom, vice versa)",
      "step_4_add_texture": "Mix structured and fluid materials (hard-soft contrast)",
      "step_5_layer_appropriately": "Add third piece (jacket/cardigan/vest) for polish",
      "step_6_complete_with_accessories": "Minimum 5 pieces total. Footwear + bag + jewelry following one-statement rule",
      "step_7_final_check": "Verify occasion appropriateness, color harmony, texture contrast, proportions, one statement piece"
    },
    
    "absolute_rules": [
      "Well-fitted affordable clothes > ill-fitting expensive clothes",
      "Quality basics outlast trends (white tee, black pants, nude heels, camel coat)",
      "Scuffed shoes ruin even the best outfit",
      "Less is more when in doubt - remove one accessory/pattern/color",
      "Err on slightly overdressed rather than underdressed"
    ]
  }
};
