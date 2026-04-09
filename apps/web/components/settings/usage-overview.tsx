'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, DollarSign, Cpu, ArrowUpRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface UsageTotals {
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
}

interface ProjectUsage {
  projectId: string;
  projectName: string;
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
  lastExecutionAt: string | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('es');
}

/** @description Usage overview — summary cards and per-project token breakdown table */
export function UsageOverview() {
  const [totals, setTotals] = useState<UsageTotals | null>(null);
  const [byProject, setByProject] = useState<ProjectUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/usage`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError('No se pudo cargar el uso de tokens');
        return;
      }
      const body = await res.json();
      setTotals(body.data.totals);
      setByProject(body.data.byProject);
    } catch {
      setError('Error de conexión al cargar uso');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando uso...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-red-400">
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </section>
    );
  }

  if (!totals) return null;

  const stats = [
    {
      label: 'Tokens entrada',
      value: formatNumber(totals.tokensInput),
      icon: ArrowUpRight,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Tokens salida',
      value: formatNumber(totals.tokensOutput),
      icon: Cpu,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      label: 'Costo estimado',
      value: `$${totals.estimatedCostUsd.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-white">Uso de Tokens</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} rounded-xl px-4 py-3 flex items-center gap-3`}
          >
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <p className="text-xs text-white/40">{stat.label}</p>
              <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-project table */}
      {byProject.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs">
                <th className="text-left py-2 font-medium">Proyecto</th>
                <th className="text-right py-2 font-medium">Entrada</th>
                <th className="text-right py-2 font-medium">Salida</th>
                <th className="text-right py-2 font-medium">Costo</th>
                <th className="text-right py-2 font-medium">Última ejecución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {byProject.map((p) => (
                <tr key={p.projectId} className="text-white/70 hover:bg-white/5 transition-colors">
                  <td className="py-2 text-white">{p.projectName}</td>
                  <td className="py-2 text-right">{formatNumber(p.tokensInput)}</td>
                  <td className="py-2 text-right">{formatNumber(p.tokensOutput)}</td>
                  <td className="py-2 text-right text-green-400">${p.estimatedCostUsd.toFixed(2)}</td>
                  <td className="py-2 text-right text-white/40 text-xs">
                    {p.lastExecutionAt
                      ? new Date(p.lastExecutionAt).toLocaleDateString('es')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {byProject.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">
          Sin datos de uso — ejecuta un proyecto para ver las estadísticas
        </p>
      )}

      <p className="text-xs text-white/30 italic">
        Los precios son estimados basados en tarifas públicas de Anthropic y pueden variar.
      </p>
    </section>
  );
}
