import axios from 'axios';

const baseURL = '/api';

export const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
});

export default api;
