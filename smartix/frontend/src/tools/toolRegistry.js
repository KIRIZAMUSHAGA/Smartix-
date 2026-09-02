// =============================
// IMPORT DES OUTILS
// =============================
import { webSearchTool } from './webSearchTool';
import { imageTool } from './imageTool';
import { codeTool } from './codeTool';

// =============================
// CONFIGURATION DES QUOTAS SIMPLIFIÉE
// =============================
export const TOOL_QUOTAS = {
  web_search: {
    limit: 30,
    period: 'minute', // 30 recherches par minute
    cost: 1
  },
  generate_image: {
    limit: 1,
    period: 'day',    // ✅ 1 image par jour
    cost: 1
  },
  run_code: {
    limit: 20,
    period: 'hour',   // 20 exécutions par heure
    cost: 1
  }
};

// =============================
// DÉFINITION DES OUTILS (sans permissions)
// =============================
export const toolRegistry = {
  // Outils principaux
  web_search: {
    ...webSearchTool,
    id: 'web_search',
    displayName: 'Recherche Web',
    category: 'recherche',
    icon: '🔍',
    color: 'blue',
    quota: TOOL_QUOTAS.web_search,
    examples: [
      { query: 'dernières actualités IA', description: 'Rechercher des informations' }
    ],
    parameters: {
      query: { type: 'string', required: true, description: 'Termes de recherche' },
      maxResults: { type: 'number', default: 10, description: 'Nombre max de résultats' }
    }
  },
  
  generate_image: {
    ...imageTool,
    id: 'generate_image',
    displayName: 'Génération d\'image',
    category: 'création',
    icon: '🎨',
    color: 'purple',
    quota: TOOL_QUOTAS.generate_image, // ✅ 1 par jour
    examples: [
      { prompt: 'un chat cybernétique', description: 'Générer une image' }
    ],
    parameters: {
      prompt: { type: 'string', required: true, description: 'Description de l\'image' },
      size: { type: 'string', default: '1024x1024', description: 'Taille de l\'image' },
      n: { type: 'number', default: 1, description: 'Nombre d\'images' }
    }
  },
  
  run_code: {
    ...codeTool,
    id: 'run_code',
    displayName: 'Exécution de code',
    category: 'développement',
    icon: '💻',
    color: 'green',
    quota: TOOL_QUOTAS.run_code,
    examples: [
      { code: 'console.log("Hello")', description: 'Exécuter du code' }
    ],
    parameters: {
      code: { type: 'string', required: true, description: 'Code à exécuter' },
      language: { type: 'string', default: 'javascript', description: 'Langage de programmation' },
      mode: { type: 'string', default: 'execute', description: "Mode d'exécution" }
    }
  },

  // Aliases (pour compatibilité)
  search_web: { alias: true, target: 'web_search' },
  create_image: { alias: true, target: 'generate_image' },
  image_generation: { alias: true, target: 'generate_image' },
  execute_code: { alias: true, target: 'run_code' },
  analyze_code: { alias: true, target: 'run_code', defaultMode: 'analyze' }
};

// =============================
// GESTIONNAIRE DE QUOTAS SIMPLIFIÉ
// =============================
const quotaUsage = new Map(); // userId -> Map<toolId, {count, resetTime}>

const getPeriodMs = (period) => {
  switch(period) {
    case 'minute': return 60 * 1000;
    case 'hour': return 60 * 60 * 1000;
    case 'day': return 24 * 60 * 60 * 1000;
    default: return 60 * 1000;
  }
};

const checkQuota = (userId, toolId) => {
  if (!userId) return { allowed: true }; // Pas de quota pour anonyme

  const tool = getTool(toolId);
  if (!tool || !tool.quota) return { allowed: true };

  const now = Date.now();
  const userQuota = quotaUsage.get(userId) || new Map();
  const toolUsage = userQuota.get(toolId) || { count: 0, resetTime: now };

  const periodMs = getPeriodMs(tool.quota.period);

  // Réinitialiser si la période est dépassée
  if (now - toolUsage.resetTime > periodMs) {
    toolUsage.count = 0;
    toolUsage.resetTime = now;
  }

  // Vérifier la limite
  if (toolUsage.count + tool.quota.cost > tool.quota.limit) {
    const timeLeft = Math.ceil((toolUsage.resetTime + periodMs - now) / 1000);
    return {
      allowed: false,
      reason: 'QUOTA_EXCEEDED',
      limit: tool.quota.limit,
      timeLeft,
      period: tool.quota.period
    };
  }

  return { allowed: true };
};

const consumeQuota = (userId, toolId) => {
  if (!userId) return;

  const tool = getTool(toolId);
  if (!tool || !tool.quota) return;

  const now = Date.now();
  if (!quotaUsage.has(userId)) {
    quotaUsage.set(userId, new Map());
  }
  
  const userQuota = quotaUsage.get(userId);
  const toolUsage = userQuota.get(toolId) || { count: 0, resetTime: now };

  toolUsage.count += tool.quota.cost;
  userQuota.set(toolId, toolUsage);
};

// =============================
// RÉSOLUTION D'ALIAS
// =============================
const resolveAlias = (toolName) => {
  const entry = toolRegistry[toolName];
  if (entry && entry.alias) {
    return toolRegistry[entry.target];
  }
  return entry;
};

// =============================
// API PUBLIQUE
// =============================

/**
 * Récupérer un outil par son nom
 */
export const getTool = (toolName) => {
  return resolveAlias(toolName) || null;
};

/**
 * Lister tous les outils disponibles (sans les alias)
 */
export const listTools = () => {
  return Object.entries(toolRegistry)
    .filter(([, tool]) => !tool.alias)
    .map(([key, tool]) => ({
      id: tool.id || key,
      name: key,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      icon: tool.icon,
      color: tool.color,
      quota: tool.quota,
      parameters: tool.parameters,
      examples: tool.examples
    }));
};

/**
 * Exécuter un outil avec vérification des quotas
 */
export const executeTool = async (toolName, params = {}, options = {}) => {
  const { userId = 'anonymous' } = options;

  // Résoudre l'outil
  const tool = getTool(toolName);
  
  if (!tool) {
    return {
      error: true,
      message: `Outil "${toolName}" non trouvé`,
      code: 'TOOL_NOT_FOUND'
    };
  }

  // ✅ Vérifier le quota
  const quotaCheck = checkQuota(userId, tool.id || toolName);
  if (!quotaCheck.allowed) {
    const periodText = {
      minute: 'minute',
      hour: 'heure',
      day: 'jour'
    }[quotaCheck.period] || 'période';

    return {
      error: true,
      message: `Limite atteinte : ${quotaCheck.limit} par ${periodText}`,
      code: 'QUOTA_EXCEEDED',
      details: quotaCheck
    };
  }

  // ✅ Exécution
  try {
    const result = await tool.execute(params, { userId, ...options });
    
    // Consommer le quota seulement si succès
    if (result && !result.error) {
      consumeQuota(userId, tool.id || toolName);
    }
    
    return {
      ...result,
      tool: tool.id || toolName,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      error: true,
      message: error.message || `Erreur lors de l'exécution`,
      code: 'TOOL_EXECUTION_ERROR'
    };
  }
};

/**
 * Obtenir les quotas restants pour un utilisateur
 */
export const getUserQuotas = (userId) => {
  if (!userId) return {};

  const userQuota = quotaUsage.get(userId) || new Map();
  const result = {};

  Object.entries(TOOL_QUOTAS).forEach(([toolId, config]) => {
    const usage = userQuota.get(toolId) || { count: 0 };
    const periodText = {
      minute: 'par minute',
      hour: 'par heure',
      day: 'par jour'
    }[config.period] || '';

    result[toolId] = {
      used: usage.count,
      limit: config.limit,
      period: config.period,
      remaining: Math.max(0, config.limit - usage.count),
      displayText: `${Math.max(0, config.limit - usage.count)}/${config.limit} ${periodText}`
    };
  });

  // Message spécial pour l'image (1 par jour)
  if (result.generate_image) {
    result.generate_image.displayText = `Images restantes aujourd'hui : ${result.generate_image.remaining}`;
  }

  return result;
};

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default toolRegistry;
