import { useCallback, useEffect, useState, type DependencyList } from "react";
import { friendlyErrorMessage } from "./errors";

export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    try {
      setData(await run());
      setError(null);
    } catch (err) {
      setError(friendlyErrorMessage(err as { message?: string }));
    }
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
