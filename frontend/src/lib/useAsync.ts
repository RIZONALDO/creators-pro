import { useEffect, useState, useCallback } from 'react';

/** Hook simples de carregamento assíncrono com refetch. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setLoading(false); } })
        .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);
  return { data, loading, reload: run, setData };
}
