/**
 * Simple Admin Data Cache Hook
 * Prevents unnecessary API calls when navigating between admin sections
 */

import { useState, useEffect, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  loading: boolean;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Global cache store (persists across component mounts/unmounts)
const adminCache = new Map<string, CacheEntry<any>>();

export function useAdminCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isStale = (entry: CacheEntry<T>) => {
    return Date.now() - entry.timestamp > CACHE_DURATION;
  };

  const fetchData = async (force = false) => {
    const cacheKey = `${key}_${JSON.stringify(dependencies)}`;
    const cached = adminCache.get(cacheKey);

    // Return cached data if fresh and not forcing refresh
    if (!force && cached && !isStale(cached)) {
      setData(cached.data);
      setLoading(cached.loading);
      return cached.data;
    }

    // Set loading state
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
        
        // Cache the result
        adminCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          loading: false
        });
      }
      
      return result;
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        setLoading(false);
      }
      throw err;
    }
  };

  // Load cached data on mount
  useEffect(() => {
    const cacheKey = `${key}_${JSON.stringify(dependencies)}`;
    const cached = adminCache.get(cacheKey);

    if (cached && !isStale(cached)) {
      // Use cached data immediately
      setData(cached.data);
      setLoading(cached.loading);
    } else {
      // Fetch fresh data
      fetchData();
    }
  }, [key, ...dependencies]);

  const refresh = () => fetchData(true);
  
  const clearCache = () => {
    const cacheKey = `${key}_${JSON.stringify(dependencies)}`;
    adminCache.delete(cacheKey);
  };

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    isStale: () => {
      const cacheKey = `${key}_${JSON.stringify(dependencies)}`;
      const cached = adminCache.get(cacheKey);
      return !cached || isStale(cached);
    }
  };
}

// Utility to clear all admin cache
export const clearAllAdminCache = () => {
  adminCache.clear();
};
