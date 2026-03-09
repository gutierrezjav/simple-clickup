import { useEffect, useRef, useState } from "react";

export interface ResourceLoaderState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
}

export function useResourceLoader<T>(loader: () => Promise<T>): ResourceLoaderState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const hasLoadedDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const isBackgroundRefresh = hasLoadedDataRef.current;

    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    void loader()
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        setData(nextData);
        setError(null);
        hasLoadedDataRef.current = true;
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Unexpected frontend error.")
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, refreshToken]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh() {
      setRefreshToken((value) => value + 1);
    }
  };
}
