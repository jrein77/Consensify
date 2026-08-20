import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";

/**
 * Loads a JSON endpoint, with optional polling. `path` may be null to hold off
 * until a dependency (a router query param, say) is ready.
 */
export function useApi(path, { interval = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!path) return null;
    if (!quiet) setLoading(true);
    try {
      const result = await api(path);
      if (!mounted.current) return null;
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      if (mounted.current) setError(err.message);
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) return undefined;
    reload();
    if (!interval) return undefined;
    // Quiet refreshes so the dashboard doesn't flash a spinner every few seconds.
    const timer = setInterval(() => reload({ quiet: true }), interval);
    return () => clearInterval(timer);
  }, [path, interval, reload]);

  return { data, error, loading, reload, setData };
}
