import axios from 'axios';

const API_BASE = '/api';

export const orderService = {
  getOrder: async (orderId, token) => {
    const res = await axios.get(`${API_BASE}/marketplace/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  },
  getUserOrders: async (token) => {
    const res = await axios.get(`${API_BASE}/marketplace/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  },
  updateOrderStatus: async (orderId, status, token) => {
    const res = await axios.put(`${API_BASE}/marketplace/orders/${orderId}/status`, { status }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  }
};

export default orderService;
