import axios from 'axios';

const API_BASE = '/api';

export const pdfService = {
  getPdf: async (pdfId, token) => {
    const res = await axios.get(`${API_BASE}/pdf/${pdfId}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
    return res.data;
  },
  listPdfs: async (token) => {
    const res = await axios.get(`${API_BASE}/pdfs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  }
};

export default pdfService;
