import { useState, useEffect, useRef, useCallback } from 'react';

export function useApi(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const cancelRef = useRef(false);

  const run = useCallback(async () => {
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    const result = await fetchFn();
    if (cancelRef.current) return;
    if (result === null || result === undefined) {
      setError('No data returned from API.');
      setData(null);
    } else if (result?.ok === false) {
      setError(result.error || 'Request failed.');
      setData(null);
    } else {
      setData(result);
      setError(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => { cancelRef.current = true; };
  }, [run]);

  return { data, loading, error, reload: run };
}
