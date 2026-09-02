import { useState, useEffect } from 'react';

export const useSkeletonLoader = (duration = 1500) => {
  const [isLoading, setIsLoading] = useState(true);

  const stopLoading = () => setIsLoading(false);
  const startLoading = () => setIsLoading(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return { isLoading, stopLoading, startLoading };
};

export default useSkeletonLoader;
