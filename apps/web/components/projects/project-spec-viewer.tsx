import type { Project } from '@sophia/shared';
import { FileText } from 'lucide-react';

interface ProjectSpecViewerProps {
  project: Project;
}

/** @description Read-only viewer for project spec content */
export function ProjectSpecViewer({ project }: ProjectSpecViewerProps) {
  const spec = (project as Project & { spec?: { content?: Record<string, unknown> } }).spec;

  if (!spec?.content) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-8 h-8 text-white/20 mb-3" />
        <p className="text-white/30 text-sm">
          {project.status === 'idle'
            ? 'La spec se generará al iniciar el proyecto'
            : 'Sin spec disponible'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-[600px] rounded-xl bg-black/20 p-4">
        {JSON.stringify(spec.content, null, 2)}
      </pre>
    </div>
  );
}
