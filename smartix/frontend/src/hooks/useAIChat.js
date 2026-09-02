import { useState, useCallback, useEffect } from 'react';
import { useStreaming } from './useStreaming';
import { 
  getMessagesAPI,
  editMessageAPI,
  regenerateMessageAPI
} from '../services/aiService';
import {
  getThreads,
  createThread,
  renameThread,
  deleteThread,
  saveMessage
} from '../services/threadService';
import {
  summarizeConversation,
  getConversationMemory,
  updateMemory,
  deleteMemory
} from '../services/memoryService';
import { executeTool, getUserQuotas } from '../tools/toolRegistry';
import { useQuota } from './useQuota';
import { toast } from 'sonner';

// =============================
// PROMPT SYSTÈME POUR LES OUTILS
// =============================
const TOOL_SYSTEM_PROMPT = `
Tu es un assistant IA intelligent. Tu peux utiliser des outils pour répondre aux demandes des utilisateurs.

OUTILS DISPONIBLES :

1. web_search(query: string) - Recherche sur le web
   - Utilise-le pour : actualités, définitions, informations générales, recherche
   - Exemple: "Quelles sont les dernières nouvelles sur l'IA ?" → web_search("dernières nouvelles IA")

2. generate_image(prompt: string, size?: string) - Génère une image
   - Utilise-le pour : "dessine", "crée une image", "génère une illustration"
   - Exemple: "Dessine un chat cybernétique" → generate_image("un chat cybernétique")

3. run_code(code: string, language?: string) - Exécute du code
   - Utilise-le pour : questions de programmation, debugging, tests
   - Exemple: "Comment faire une boucle en JS ?" → run_code("for(let i=0; i<10; i++) { console.log(i); }")

RÈGLES :
- Si l'utilisateur demande quelque chose qui correspond à un outil, retourne UNIQUEMENT un objet JSON avec :
  {
    "tool": "nom_de_l_outil",
    "params": { ... },
    "needsTool": true
  }
- Si pas besoin d'outil, retourne une réponse normale.

EXEMPLES DE RÉPONSES AVEC OUTIL :
{
  "tool": "web_search",
  "params": { "query": "dernières nouvelles intelligence artificielle" },
  "needsTool": true
}

{
  "tool": "generate_image", 
  "params": { "prompt": "chat robotique style cyberpunk" },
  "needsTool": true
}

{
  "tool": "run_code",
  "params": { "code": "console.log('Hello World');", "language": "javascript" },
  "needsTool": true
}

Ne retourne que du JSON si un outil est nécessaire. Sinon, réponds normalement.
`;

export const useAIChat = () => {
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ État pour la mémoire conversationnelle
  const [conversationSummary, setConversationSummary] = useState('');
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  
  // ✅ État pour les quotas des outils
  const [toolQuotas, setToolQuotas] = useState({});
  const [processingTool, setProcessingTool] = useState(false);

  const { checkQuota, decrementQuota } = useQuota();
  const { startStream, stopStream } = useStreaming();

  // =============================
  // CHARGEMENT DES QUOTAS
  // =============================
  useEffect(() => {
    if (currentThread) {
      const quotas = getUserQuotas(currentThread);
      setToolQuotas(quotas);
    }
  }, [currentThread, messages.length]);

  // =============================
  // APPEL À L'IA POUR DÉCIDER DE L'OUTIL
  // =============================
  const callAItoDecideTool = useCallback(async (userMessage) => {
    try {
      const response = await fetch('/api/ai/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: TOOL_SYSTEM_PROMPT,
          userMessage,
          conversation: messages.slice(-5) // Contexte récent
        })
      });

      const data = await response.json();
      
      // Si l'IA retourne un JSON avec tool, on parse
      try {
        if (typeof data.response === 'string' && data.response.trim().startsWith('{')) {
          const parsed = JSON.parse(data.response);
          if (parsed.tool && parsed.needsTool) {
            return parsed;
          }
        }
      } catch (e) {
        // Pas du JSON, réponse normale
      }
      
      return { normalResponse: data.response };
    } catch (error) {
      console.error('Error calling AI decision:', error);
      return { error: true };
    }
  }, [messages]);

  // =============================
  // APPEL À L'IA POUR FORMULER LA RÉPONSE
  // =============================
  const callAI = useCallback(async (prompt) => {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      
      startStream({
        message: prompt,
        thread_id: currentThread,
        onToken: (token) => {
          fullResponse += token;
        },
        onDone: () => {
          resolve(fullResponse);
        },
        onError: reject,
        timeout: 30000
      });
    });
  }, [currentThread, startStream]);

  // =============================
  // ✅ FORMATAGE DES RÉSULTATS D'OUTILS
  // =============================
  const formatToolResult = (toolName, result) => {
    if (toolName === 'generate_image' && result.image_url) {
      // Formater l'image en markdown pour l'affichage
      return `![Image générée](${result.image_url})`;
    }
    if (toolName === 'web_search' && result.results) {
      // Formater les résultats de recherche
      let formatted = "Voici ce que j'ai trouvé :\n\n";
      result.results.slice(0, 3).forEach((r, i) => {
        formatted += `${i+1}. **${r.title}**\n`;
        formatted += `   ${r.snippet}\n\n`;
      });
      return formatted;
    }
    return JSON.stringify(result, null, 2);
  };

  // =============================
  // CHARGEMENT DE LA MÉMOIRE D'UN THREAD
  // =============================
  const loadMemory = useCallback(async (threadId) => {
    if (!threadId) return;
    
    try {
      const summary = await getConversationMemory(threadId);
      setConversationSummary(summary);
      setMemoryLoaded(true);
    } catch (err) {
      console.error('Failed to load memory:', err);
    }
  }, []);

  // =============================
  // RÉSUMÉ AUTOMATIQUE D'UNE CONVERSATION
  // =============================
  const summarizeCurrentConversation = useCallback(async () => {
    if (!currentThread || messages.length < 3) return; // Minimum 3 messages pour résumer
    
    try {
      const summary = await summarizeConversation(messages, currentThread);
      setConversationSummary(summary);
      
      // Afficher une notification seulement pour les longs résumés
      if (messages.length > 10) {
        toast.info('Conversation résumée automatiquement');
      }
    } catch (err) {
      console.error('Failed to summarize conversation:', err);
    }
  }, [currentThread, messages]);

  // =============================
  // CHARGEMENT DES THREADS (PERSISTANT)
  // =============================
  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getThreads();
      setThreads(data.threads || []);
      
      if (data.threads?.length > 0 && !currentThread) {
        setCurrentThread(data.threads[0].id);
        await loadMessages(data.threads[0].id);
        await loadMemory(data.threads[0].id);
      }
    } catch (err) {
      setError(err.message);
      toast.error('Impossible de charger vos conversations');
    } finally {
      setLoading(false);
    }
  }, [currentThread]);

  // =============================
  // CHARGEMENT DES MESSAGES D'UN THREAD
  // =============================
  const loadMessages = useCallback(async (threadId) => {
    try {
      setLoading(true);
      const data = await getMessagesAPI(threadId);
      setMessages(data.messages || []);
      
      // Charger la mémoire en parallèle
      await loadMemory(threadId);
      
    } catch (err) {
      setError(err.message);
      toast.error('Impossible de charger les messages');
    } finally {
      setLoading(false);
    }
  }, [loadMemory]);

  // =============================
  // SAUVEGARDE D'UN MESSAGE
  // =============================
  const saveMessageToThread = useCallback(async (message) => {
    if (!currentThread) return;
    
    try {
      await saveMessage(currentThread, message);
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  }, [currentThread]);

  // =============================
  // MISE À JOUR DE LA MÉMOIRE APRÈS MESSAGE
  // =============================
  const updateConversationMemory = useCallback(async (message) => {
    if (!currentThread) return;
    
    try {
      await updateMemory(currentThread, message);
      
      // Résumer automatiquement tous les 5 messages
      if (messages.length > 0 && messages.length % 5 === 0) {
        summarizeCurrentConversation();
      }
    } catch (err) {
      console.error('Failed to update memory:', err);
    }
  }, [currentThread, messages.length, summarizeCurrentConversation]);

  // =============================
  // ENVOI DE MESSAGE AVEC OUTILS AUTOMATIQUES
  // =============================
  const sendMessage = useCallback(async (text) => {
    // Vérifier le quota IA
    if (!(await checkQuota())) {
      toast.error('Quota dépassé');
      return;
    }

    const userMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    await saveMessageToThread(userMsg);
    await updateConversationMemory(userMsg);

    try {
      setIsStreaming(true);
      setError(null);
      setProcessingTool(false);

      // ÉTAPE 1 : Demander à l'IA quel outil utiliser
      const decision = await callAItoDecideTool(text);

      let finalResponse = '';

      // ÉTAPE 2 : Si un outil est nécessaire
      if (decision.tool && decision.needsTool) {
        setProcessingTool(true);
        
        // Vérifier le quota spécifique de l'outil
        const toolQuota = toolQuotas[decision.tool];
        if (toolQuota && toolQuota.remaining <= 0) {
          finalResponse = `Désolé, vous avez atteint votre quota pour cet outil (${toolQuota.displayText || 'limite atteinte'}).`;
        } else {
          // Exécuter l'outil
          const toolResult = await executeTool(decision.tool, decision.params, {
            userId: currentThread
          });

          if (toolResult.error) {
            finalResponse = `Erreur lors de l'exécution de l'outil: ${toolResult.message}`;
          } else {
            // ✅ Formater le résultat selon l'outil
            const formattedResult = formatToolResult(decision.tool, toolResult);
            
            // ÉTAPE 3 : Demander à l'IA de formuler la réponse avec le résultat
            const formulationPrompt = `
L'utilisateur a demandé: "${text}"

J'ai utilisé l'outil ${decision.tool} et obtenu ce résultat:
${formattedResult}

Formule une réponse claire et utile pour l'utilisateur basée sur ce résultat.
`;
            
            finalResponse = await callAI(formulationPrompt);
          }
        }
        setProcessingTool(false);
      } else {
        // Pas d'outil nécessaire, réponse normale
        finalResponse = decision.normalResponse || await callAI(text);
      }

      // Message assistant
      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);
      await saveMessageToThread(assistantMsg);
      await updateConversationMemory(assistantMsg);
      
      decrementQuota();

    } catch (err) {
      console.error('Error in sendMessage:', err);
      toast.error('Erreur lors de l\'envoi');
      setError(err.message);
    } finally {
      setIsStreaming(false);
      setProcessingTool(false);
    }
  }, [
    currentThread, 
    checkQuota, 
    decrementQuota, 
    saveMessageToThread, 
    updateConversationMemory, 
    startStream, 
    messages,
    callAItoDecideTool,
    toolQuotas,
    callAI
  ]);

  // =============================
  // CRÉATION D'UN THREAD (PERSISTANT)
  // =============================
  const createNewThread = useCallback(async (name = 'Nouvelle conversation') => {
    try {
      const data = await createThread({ name });
      setThreads(prev => [data.thread, ...prev]);
      setCurrentThread(data.thread.id);
      setMessages([]);
      setConversationSummary('');
      setMemoryLoaded(false);
      toast.success('Nouvelle conversation créée');
    } catch (err) {
      toast.error('Erreur lors de la création');
    }
  }, []);

  // =============================
  // RENOMMER UN THREAD (PERSISTANT)
  // =============================
  const renameThreadById = useCallback(async (threadId, newName) => {
    try {
      await renameThread(threadId, newName);
      setThreads(prev => prev.map(t => 
        t.id === threadId ? { ...t, title: newName } : t
      ));
      toast.success('Conversation renommée');
    } catch (err) {
      toast.error('Erreur lors du renommage');
    }
  }, []);

  // =============================
  // SUPPRESSION D'UN THREAD (PERSISTANT)
  // =============================
  const deleteThreadById = useCallback(async (id) => {
    if (!window.confirm('Supprimer cette conversation ?')) return;

    try {
      await deleteThread(id);
      await deleteMemory(id); // Supprimer aussi la mémoire associée
      
      setThreads(prev => prev.filter(t => t.id !== id));
      
      if (currentThread === id) {
        const nextThread = threads.find(t => t.id !== id);
        if (nextThread) {
          setCurrentThread(nextThread.id);
          await loadMessages(nextThread.id);
          await loadMemory(nextThread.id);
        } else {
          setCurrentThread(null);
          setMessages([]);
          setConversationSummary('');
        }
      }
      toast.success('Conversation supprimée');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  }, [currentThread, threads, loadMessages, loadMemory]);

  // =============================
  // ÉDITION D'UN MESSAGE (PAR ID)
  // =============================
  const editMessageById = useCallback(async (messageId, newContent) => {
    // Trouver l'index du message par son ID
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      toast.error('Message non trouvé');
      return;
    }

    const originalMsg = messages[messageIndex];
    
    // Optimistic update
    setMessages(prev => prev.map((msg, i) =>
      i === messageIndex ? { ...msg, content: newContent } : msg
    ));

    try {
      await editMessageAPI(messageId, newContent);
      toast.success('Message modifié');
    } catch (err) {
      // Rollback
      setMessages(prev => prev.map((msg, i) =>
        i === messageIndex ? originalMsg : msg
      ));
      toast.error('Erreur lors de la modification');
    }
  }, [messages]);

  // =============================
  // REGÉNÉRATION D'UNE RÉPONSE (par ID)
  // =============================
  const regenerateResponse = useCallback(async (messageId) => {
    // Trouver l'index du message par son ID
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      toast.error('Message non trouvé');
      return;
    }

    const assistantMsg = messages[messageIndex];
    if (assistantMsg.role !== 'assistant') {
      toast.error('Seuls les messages de l\'assistant peuvent être régénérés');
      return;
    }

    // Vérifier qu'il y a un message utilisateur avant
    if (messageIndex === 0) {
      toast.error('Impossible de régénérer le premier message');
      return;
    }

    const userMsg = messages[messageIndex - 1];
    
    // Supprimer les messages à partir de celui-ci
    setMessages(prev => prev.slice(0, messageIndex));

    // Renvoyer le message utilisateur
    await sendMessage(userMsg.content);
  }, [messages, sendMessage]);

  // =============================
  // STOP GENERATION
  // =============================
  const stopGeneration = useCallback(() => {
    stopStream();
    setIsStreaming(false);
    setProcessingTool(false);
  }, [stopStream]);

  // =============================
  // RÉSUMÉ MANUEL
  // =============================
  const summarizeManually = useCallback(async () => {
    if (!currentThread || messages.length === 0) {
      toast.error('Aucune conversation à résumer');
      return;
    }
    
    await summarizeCurrentConversation();
    toast.success('Conversation résumée');
  }, [currentThread, messages.length, summarizeCurrentConversation]);

  // =============================
  // EFFETS AUTOMATIQUES
  // =============================
  
  // Résumé périodique (tous les 10 messages)
  useEffect(() => {
    if (messages.length > 0 && messages.length % 10 === 0 && currentThread) {
      summarizeCurrentConversation();
    }
  }, [messages.length, currentThread, summarizeCurrentConversation]);

  // Chargement initial
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  return {
    messages,
    threads,
    currentThread,
    sendMessage,
    stopGeneration,
    loadThread: async (id) => {
      setCurrentThread(id);
      await loadMessages(id);
      await loadMemory(id);
    },
    createThread: createNewThread,
    renameThread: renameThreadById,
    deleteThread: deleteThreadById,
    editMessage: editMessageById,
    regenerate: regenerateResponse,
    isStreaming,
    loading,
    error,
    // ✅ FONCTIONS DE MÉMOIRE
    conversationSummary,
    memoryLoaded,
    summarizeManually,
    // ✅ FONCTIONS OUTILS
    toolQuotas,
    processingTool
  };
};
