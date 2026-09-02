import { useState, useCallback } from 'react';

export const useMessageReactions = (messageId) => {
  const [reactions, setReactions] = useState([]);

  const addReaction = useCallback(async (emoji) => {}, []);
  const removeReaction = useCallback(async (emoji) => {}, []);

  return { reactions, addReaction, removeReaction };
};

export default useMessageReactions;
