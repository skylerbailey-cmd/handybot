// Claude (Anthropic) API tool schemas, shared with claude_service.dart.
// Matches the shapes defined in the TypeScript source lib/claude.ts.

const createPlanTool = {
  'name': 'create_repair_plan',
  'description':
      'Creates a structured, actionable repair plan for a homeowner based on the photo and description they shared.',
  'input_schema': {
    'type': 'object',
    'properties': {
      'title': {
        'type': 'string',
        'description': 'A short 3-6 word title for this repair.',
      },
      'summary': {
        'type': 'string',
        'description':
            'A one-sentence plain-English description of the problem.',
      },
      'difficulty': {
        'type': 'string',
        'enum': ['Easy', 'Medium', 'Hard', 'Call a pro'],
        'description':
            "How difficult this repair is for an average homeowner. Use 'Call a pro' for anything structural, gas-related, high-voltage, or otherwise unsafe for a DIYer.",
      },
      'estimated_minutes': {
        'type': 'integer',
        'description':
            'Total realistic time to complete the repair in minutes, including setup and cleanup.',
      },
      'estimated_savings_usd': {
        'type': 'integer',
        'description':
            'Realistic LABOR cost in USD that a licensed professional would charge to do this repair. Does NOT include materials. Set to 0 only if the image does not show something that needs fixing.',
      },
      'tools': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': {'type': 'string'},
            'required': {'type': 'boolean'},
          },
          'required': ['name', 'required'],
        },
      },
      'materials': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': {'type': 'string'},
            'quantity': {'type': 'string'},
            'notes': {'type': 'string'},
            'estimated_price_usd': {'type': 'number'},
          },
          'required': ['name', 'quantity', 'estimated_price_usd'],
        },
      },
      'steps': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'title': {'type': 'string'},
            'detail': {'type': 'string'},
            'estimated_minutes': {'type': 'integer'},
            'critical_warning': {'type': 'string'},
          },
          'required': ['title', 'detail', 'estimated_minutes'],
        },
      },
      'safety_notes': {
        'type': 'array',
        'items': {'type': 'string'},
      },
      'suggested_reminders': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'title': {'type': 'string'},
            'description': {'type': 'string'},
            'frequency_days': {'type': 'integer'},
            'icon': {'type': 'string'},
          },
          'required': ['title', 'description', 'frequency_days'],
        },
      },
      'risk': {
        'type': 'object',
        'properties': {
          'severity': {
            'type': 'string',
            'enum': ['low', 'medium', 'high'],
          },
          'category': {
            'type': 'string',
            'enum': [
              'electrical',
              'plumbing',
              'gas',
              'structural',
              'height',
              'chemical',
              'fire',
              'sharps',
              'general',
            ],
          },
          'headline': {'type': 'string'},
          'rationale': {'type': 'string'},
          'call_a_pro_recommended': {'type': 'boolean'},
        },
        'required': [
          'severity',
          'category',
          'headline',
          'rationale',
          'call_a_pro_recommended',
        ],
      },
      'opening_message': {'type': 'string'},
    },
    'required': [
      'title',
      'summary',
      'difficulty',
      'estimated_minutes',
      'estimated_savings_usd',
      'tools',
      'materials',
      'steps',
      'safety_notes',
      'opening_message',
    ],
  },
};

const verifyRepairTool = {
  'name': 'verify_repair_from_photo',
  'description':
      "Analyze a photo of the user's completed repair and verify whether it looks correctly done.",
  'input_schema': {
    'type': 'object',
    'properties': {
      'verified': {'type': 'boolean'},
      'feedback': {'type': 'string'},
      'fix_steps': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'title': {'type': 'string'},
            'detail': {'type': 'string'},
            'estimated_minutes': {'type': 'integer'},
            'critical_warning': {'type': 'string'},
          },
          'required': ['title', 'detail', 'estimated_minutes'],
        },
      },
    },
    'required': ['verified', 'feedback'],
  },
};

const proposeUpdatesTool = {
  'name': 'propose_plan_updates',
  'description':
      'Propose additive changes to the current repair plan when new information from the user changes what needs to happen.',
  'input_schema': {
    'type': 'object',
    'properties': {
      'rationale': {'type': 'string'},
      'new_steps': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'title': {'type': 'string'},
            'detail': {'type': 'string'},
            'estimated_minutes': {'type': 'integer'},
            'critical_warning': {'type': 'string'},
          },
          'required': ['title', 'detail', 'estimated_minutes'],
        },
      },
      'new_tools': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': {'type': 'string'},
            'required': {'type': 'boolean'},
          },
          'required': ['name', 'required'],
        },
      },
      'new_materials': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': {'type': 'string'},
            'quantity': {'type': 'string'},
            'notes': {'type': 'string'},
          },
          'required': ['name', 'quantity'],
        },
      },
      'new_safety_notes': {
        'type': 'array',
        'items': {'type': 'string'},
      },
      'new_difficulty': {
        'type': 'string',
        'enum': ['Easy', 'Medium', 'Hard', 'Call a pro'],
      },
      'new_total_minutes': {'type': 'integer'},
      'new_total_savings_usd': {'type': 'integer'},
    },
    'required': ['rationale'],
  },
};

const analyzeItemTool = {
  'name': 'analyze_home_item',
  'description':
      'Analyze a photo of a home item and identify it with estimated age and condition.',
  'input_schema': {
    'type': 'object',
    'properties': {
      'name': {'type': 'string'},
      'category': {
        'type': 'string',
        'enum': [
          'hvac',
          'plumbing',
          'electrical',
          'appliance',
          'structural',
          'exterior',
          'safety',
          'other',
        ],
      },
      'estimated_age_years': {'type': 'integer'},
      'typical_lifespan_years': {'type': 'integer'},
      'condition': {
        'type': 'string',
        'enum': ['good', 'fair', 'poor', 'replace_soon'],
      },
      'condition_notes': {'type': 'string'},
      'maintenance_tips': {
        'type': 'array',
        'items': {'type': 'string'},
      },
      'icon': {'type': 'string'},
      'suggested_reminders': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'title': {'type': 'string'},
            'description': {'type': 'string'},
            'frequency_days': {'type': 'integer'},
            'icon': {'type': 'string'},
          },
          'required': ['title', 'description', 'frequency_days'],
        },
      },
    },
    'required': [
      'name',
      'category',
      'estimated_age_years',
      'typical_lifespan_years',
      'condition',
      'condition_notes',
      'maintenance_tips',
      'icon',
      'suggested_reminders',
    ],
  },
};
