import { useState, useCallback } from 'react';

export const useMessages = (conversationId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (content) => {}, []);
  const loadMore = useCallback(async () => {}, []);

  return { messages, loading, error, sendMessage, loadMore };
};

export default useMessages;
