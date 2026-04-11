'use client';

import { useState } from 'react';
import { useDashboardStore, type CheckpointResult } from '@/hooks/use-dashboard-store';

const STATUS_STYLES = {
  pass: { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', label: 'Passed' },
  warn: { bg: 'bg-amber-500', ring: 'ring-amber-500/30', label: 'Warning' },
  fail: { bg: 'bg-red-500', ring: 'ring-red-500/30', label: 'Failed' },
} as const;

function CheckpointBadge({ checkpoint }: { checkpoint: CheckpointResult }) {
  const style = STATUS_STYLES[checkpoint.status];
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={`inline-flex h-3 w-3 rounded-full ${style.bg} ring-2 ${style.ring} cursor-pointer`}
        aria-label={`Checkpoint ${checkpoint.agentType}: ${style.label}`}
      />
      {open && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 rounded-md border bg-popover px-3 py-1.5 text-popover-foreground shadow-md max-w-xs whitespace-normal">
          <p className="font-medium text-sm">
            {checkpoint.agentType} — {style.label}
          </p>
          {checkpoint.details.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {checkpoint.details.map((d, i) => (
                <li key={i}>
                  <span className={
                    d.severity === 'CRITICAL' ? 'text-red-400' :
                    d.severity === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'
                  }>
                    [{d.severity}]
                  </span>{' '}
                  {d.message}
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </span>
  );
}

export function CheckpointIndicators() {
  const checkpoints = useDashboardStore((s) => s.checkpoints);

  if (checkpoints.size === 0) return null;

  const sorted = [...checkpoints.values()].sort((a, b) => a.layer - b.layer);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Checkpoints:</span>
      {sorted.map((cp) => (
        <CheckpointBadge key={cp.layer} checkpoint={cp} />
      ))}
    </div>
  );
}
