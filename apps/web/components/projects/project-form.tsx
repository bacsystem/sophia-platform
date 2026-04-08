'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import type { Project, AgentName, ProjectStack, ProjectModel } from '@sophia/shared';
import { StackSelector } from './stack-selector';
import { AgentSelector } from './agent-selector';

const REQUIRED_AGENTS: AgentName[] = ['seed', 'security', 'integration'];
const ALL_AGENTS: AgentName[] = [
  'dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration',
];

const projectFormSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(5000, 'Máximo 5000 caracteres'),
  stack: z.enum(['node-nextjs', 'laravel-nextjs', 'python-nextjs'] as const),
  model: z.enum(['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'] as const),
  agents: z
    .array(z.string())
    .min(1, 'Selecciona al menos un agente')
    .refine(
      (agents) => REQUIRED_AGENTS.every((a) => agents.includes(a)),
      'seed, security e integration son obligatorios',
    )
    .refine(
      (agents) => ['dba', 'backend', 'frontend', 'qa', 'docs', 'deploy'].some((a) => agents.includes(a)),
      'Incluye al menos un agente generador',
    ),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TEMPLATE_VALUES: ProjectFormData = {
  name: 'Mi proyecto Sophia',
  description: 'Sistema web full-stack con autenticación, CRUD de recursos, dashboard y API REST. Generado por Sophia Platform con agentes IA especializados.',
  stack: 'node-nextjs',
  model: 'claude-sonnet-4-6',
  agents: ALL_AGENTS,
};

const MODEL_OPTIONS: { value: ProjectModel; label: string; description: string }[] = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Equilibrio calidad/velocidad · Recomendado' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Mayor capacidad · Más lento' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Más rápido · Proyectos simples' },
];

/** Values pre-filled from a template selection */
export interface TemplateFormValues {
  name: string;
  description: string;
  stack: string;
  model: string;
  agents: string[];
}

interface ProjectFormProps {
  project?: Project;
  templateValues?: Partial<TemplateFormValues>;
}

/** @description Controlled form for creating or editing a Sophia project */
export function ProjectForm({ project, templateValues }: ProjectFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: project
      ? {
          name: project.name,
          description: project.description,
          stack: project.stack as ProjectStack,
          model: project.config.model as ProjectModel,
          agents: project.config.agents as AgentName[],
        }
      : {
          name: templateValues?.name ?? '',
          description: templateValues?.description ?? '',
          stack: (templateValues?.stack as ProjectStack) ?? 'node-nextjs',
          model: (templateValues?.model as ProjectModel) ?? 'claude-sonnet-4-6',
          agents: (templateValues?.agents as AgentName[]) ?? REQUIRED_AGENTS,
        },
  });

  const watchedName = useWatch({ control, name: 'name' });
  const watchedDescription = useWatch({ control, name: 'description' });
  const watchedStack = useWatch({ control, name: 'stack' });
  const watchedModel = useWatch({ control, name: 'model' });
  const watchedAgents = useWatch({ control, name: 'agents' });

  const onSubmit = async (data: ProjectFormData) => {
    setServerError(null);
    const payload = {
      name: data.name,
      description: data.description,
      stack: data.stack,
      config: { model: data.model, agents: data.agents },
    };

    try {
      const url = isEdit ? `${API_URL}/api/projects/${project.id}` : `${API_URL}/api/projects`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.errors) {
          setServerError(body.errors.map((e: { message: string }) => e.message).join('. '));
        } else {
          setServerError(body.message ?? 'Error al guardar el proyecto');
        }
        return;
      }

      const id = isEdit ? project.id : body.data.id;
      router.push(`/projects/${id}`);
    } catch {
      setServerError('Error de conexión');
    }
  };

  const applyTemplate = () => {
    setValue('name', TEMPLATE_VALUES.name);
    setValue('description', TEMPLATE_VALUES.description);
    setValue('stack', TEMPLATE_VALUES.stack);
    setValue('model', TEMPLATE_VALUES.model);
    setValue('agents', TEMPLATE_VALUES.agents);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Header actions */}
      {!isEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={applyTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Usar template
          </button>
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="proj-name" className="label-premium">
          Nombre del proyecto *
        </label>
        <input
          id="proj-name"
          type="text"
          {...register('name')}
          placeholder="ej. Mi SaaS de facturación"
          className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
        />
        {errors.name && <p className="error-text">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="proj-desc" className="label-premium">
          Descripción del proyecto *
        </label>
        <textarea
          id="proj-desc"
          {...register('description')}
          rows={5}
          placeholder="Describe en detalle qué debe hacer tu aplicación: funcionalidades, usuarios, flujos principales..."
          className="glass-input w-full px-4 py-2.5 rounded-xl text-sm resize-none"
        />
        <div className="flex justify-between items-start">
          <div>{errors.description && <p className="error-text">{errors.description.message}</p>}</div>
          <p className="text-xs text-white/30">{watchedDescription?.length ?? 0}/5000</p>
        </div>
      </div>

      {/* Stack */}
      <div className="space-y-2">
        <label className="label-premium">Stack tecnológico *</label>
        <Controller
          name="stack"
          control={control}
          render={({ field }) => (
            <StackSelector
              value={field.value as ProjectStack | ''}
              onChange={(v) => field.onChange(v)}
              error={errors.stack?.message}
            />
          )}
        />
      </div>

      {/* Model */}
      <div className="space-y-2">
        <label className="label-premium">Modelo de IA *</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODEL_OPTIONS.map((opt) => {
            const isSelected = watchedModel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('model', opt.value)}
                aria-pressed={isSelected}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 ${
                  isSelected
                    ? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]'
                    : 'border-white/10 bg-white/3 hover:border-white/20'
                }`}
              >
                <p className="text-sm font-semibold text-white">{opt.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{opt.description}</p>
              </button>
            );
          })}
        </div>
        {errors.model && <p className="error-text">{errors.model.message}</p>}
      </div>

      {/* Agents */}
      <div className="space-y-2">
        <label className="label-premium">Agentes *</label>
        <Controller
          name="agents"
          control={control}
          render={({ field }) => (
            <AgentSelector
              value={field.value as AgentName[]}
              onChange={(v) => field.onChange(v)}
              error={errors.agents?.message as string | undefined}
            />
          )}
        />
      </div>

      {/* Preview */}
      <div className="glass rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/60 hover:text-white/80 transition-colors"
        >
          <span className="font-medium">Vista previa del prompt</span>
          {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPreview && (
          <div className="border-t border-white/10 px-4 py-4">
            <pre className="text-xs text-white/50 whitespace-pre-wrap font-mono leading-relaxed">
              {`Proyecto: ${watchedName || '(sin nombre)'}
Stack: ${watchedStack || '(sin stack)'}
Agentes: ${watchedAgents?.join(', ') || '(ninguno)'}

Descripción:
${watchedDescription || '(sin descripción)'}`}
            </pre>
          </div>
        )}
      </div>

      {/* Error */}
      {serverError && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  );
}
