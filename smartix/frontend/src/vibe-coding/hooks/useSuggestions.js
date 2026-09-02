import { useState, useCallback } from 'react';
import { api } from '../services/api';

export const useSuggestions = () => {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [applyingSuggestionId, setApplyingSuggestionId] = useState(null);

    const fetchSuggestions = useCallback(async (projectId, eventType, filePath, fileContent) => {
        setIsLoading(true);
        try {
            const response = await api.post('/api/ai/suggestions', {
                project_id: projectId,
                event_type: eventType,
                file_path: filePath,
                file_content: fileContent,
            });
            if (response.data.suggestions && response.data.suggestions.length > 0) {
                setSuggestions(response.data.suggestions);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des suggestions:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const applySuggestion = useCallback(async (suggestionId, projectId) => {
        setApplyingSuggestionId(suggestionId);
        try {
            const response = await api.post(`/api/ai/suggestions/${suggestionId}/apply`, {
                project_id: projectId,
            });
            if (response.data.success) {
                setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Erreur lors de l'application de la suggestion:", error);
            return false;
        } finally {
            setApplyingSuggestionId(null);
        }
    }, []);

    const dismissSuggestion = useCallback((suggestionId) => {
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    }, []);

    const clearAllSuggestions = useCallback(() => {
        setSuggestions([]);
    }, []);

    return {
        suggestions,
        isLoading,
        applyingSuggestionId,
        fetchSuggestions,
        applySuggestion,
        dismissSuggestion,
        clearAllSuggestions,
    };
};

export default useSuggestions;
