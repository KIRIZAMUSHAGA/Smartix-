import axios from 'axios';

const API_URL = '/api';

export const favoritesApi = {
    // Ajouter un favori
    add: async (contentId, contentType, metadata = {}) => {
        const response = await axios.post(`${API_URL}/api/favorites/`, {
            content_id: contentId,
            content_type: contentType,
            metadata: metadata
        });
        return response.data;
    },

    // Supprimer un favori
    remove: async (favId) => {
        const response = await axios.delete(`${API_URL}/api/favorites/${favId}`);
        return response.data;
    },

    // Récupérer tous les favoris (avec filtre optionnel)
    getAll: async (contentType = null) => {
        const params = contentType ? { content_type: contentType } : {};
        const response = await axios.get(`${API_URL}/api/favorites/`, { params });
        return response.data;
    }
};
