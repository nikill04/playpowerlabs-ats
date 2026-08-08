import { useEffect, useState } from "react";
import { getJSON } from "./apiClient.js";

export function useApiResource(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return undefined;

    let cancelled = false;

    async function loadResource() {
      setLoading(true);
      setError(null);
      try {
        const json = await getJSON(path);
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load page data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResource();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}
