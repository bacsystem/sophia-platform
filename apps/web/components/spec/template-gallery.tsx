'use client';

import { useEffect, useState } from 'react';
import { Building2, Rocket, Plug, Monitor, BookOpen, Loader2, LucideIcon } from 'lucide-react';
import type { TemplateFormValues } from '@/components/projects/project-form';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Rocket,
  Plug,
  Monitor,
  BookOpen,
};

interface ApiTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  stack: string;
  tags: string[];
  defaults: {
    agents: string[];
    model: string;
  };
}

interface TemplateGalleryProps {
  /** Called when the user selects a template — values pre-fill the project form */
  onSelect: (values: TemplateFormValues) => void;
}

/** @description Gallery of pre-defined project templates. Fetches from GET /api/templates and renders cards with Lucide icons. */
export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/templates`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((body: { data: ApiTemplate[] }) => {
        if (!cancelled) setTemplates(body.data);
      })
      .catch(() => {
        // Silently fail — gallery is optional sugar
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando templates…
      </div>
    );
  }

  if (templates.length === 0) return null;

  const handleSelect = (template: ApiTemplate) => {
    setSelectedId(template.id);
    onSelect({
      name: template.name,
      description: template.description,
      stack: template.stack,
      model: template.defaults.model,
      agents: template.defaults.agents,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Templates</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const Icon = ICON_MAP[tpl.icon] ?? Plug;
          const isSelected = selectedId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(tpl)}
              className={[
                'flex flex-col items-start gap-2 rounded-xl p-3 text-left transition-all border',
                isSelected
                  ? 'border-violet-500/60 bg-violet-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
              ].join(' ')}
            >
              <Icon className={`w-5 h-5 ${isSelected ? 'text-violet-400' : 'text-white/60'}`} />
              <div>
                <p className={`text-sm font-medium leading-tight ${isSelected ? 'text-white' : 'text-white/80'}`}>
                  {tpl.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tpl.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
