'use client';

import { Download, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DISABLED_TOOLTIPS: Record<string, string> = {
  idle: 'El proyecto aún no ha sido ejecutado',
  running: 'Espera a que el proyecto termine de ejecutarse',
  error: 'El proyecto terminó con errores',
};

interface DownloadButtonProps {
  projectId: string;
  projectStatus: string;
  totalSizeBytes: number;
}

/** @description ZIP download button with estimated size and disabled states */
export function DownloadButton({ projectId, projectStatus, totalSizeBytes }: DownloadButtonProps) {
  const canDownload = projectStatus === 'done' || projectStatus === 'paused';
  const estimatedZipSize = Math.round(totalSizeBytes * 0.6);
  const tooltip = canDownload
    ? `Descargar ZIP (~${formatSize(estimatedZipSize)})`
    : DISABLED_TOOLTIPS[projectStatus] ?? 'Descarga no disponible';

  const handleDownload = () => {
    if (!canDownload) return;
    window.location.href = `${API_URL}/api/projects/${projectId}/download`;
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={!canDownload}
      title={tooltip}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        canDownload
          ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
          : 'bg-white/5 text-white/25 cursor-not-allowed'
      }`}
    >
      {canDownload ? (
        <Download className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      <span>Descargar ZIP</span>
      {totalSizeBytes > 0 && (
        <span className="text-xs opacity-60">~{formatSize(estimatedZipSize)}</span>
      )}
    </button>
  );
}
