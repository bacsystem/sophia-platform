'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface DailyUsagePoint {
  date: string;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
  executions: number;
}

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Todo', days: 365 },
] as const;

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** @description Daily usage bar chart — tokens consumed per day with period selector */
export function UsageChart() {
  const [data, setData] = useState<DailyUsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/settings/usage/daily?days=${days}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const body = await res.json();
      setData(body.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Consumo Diario</h2>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                days === opt.days
                  ? 'bg-violet-600 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
              aria-label={`Ver últimos ${opt.label}`}
              aria-pressed={days === opt.days}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Cargando gráfico...</span>
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-12">
          Sin datos en los últimos {days} días
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                tickFormatter={formatK}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,15,20,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'white',
                }}
                labelFormatter={(v) => new Date(String(v)).toLocaleDateString('es')}
                formatter={(value, name) => [
                  formatK(Number(value)),
                  name === 'tokensInput' ? 'Entrada' : 'Salida',
                ]}
              />
              <Bar
                dataKey="tokensInput"
                fill="#818cf8"
                radius={[4, 4, 0, 0]}
                name="tokensInput"
              />
              <Bar
                dataKey="tokensOutput"
                fill="#a78bfa"
                radius={[4, 4, 0, 0]}
                name="tokensOutput"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
