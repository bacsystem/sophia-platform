'use client';

/** @description Timer hook — counts elapsed time from a start date, updates every second */

import { useState, useEffect, useRef } from 'react';

export function useElapsedTime(startDate: string | null): string {
  const [elapsed, setElapsed] = useState('00:00');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startDate) {
      setElapsed('00:00');
      return;
    }

    const start = new Date(startDate).getTime();

    function tick() {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startDate]);

  return elapsed;
}
