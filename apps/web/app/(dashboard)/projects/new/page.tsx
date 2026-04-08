import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { NewProjectSection } from '@/components/spec/new-project-section';

/** @description New project creation page — renders TemplateGallery + ProjectForm */
export default function NewProjectPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
      <div className="space-y-1">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Mis proyectos
        </Link>
        <h1 className="text-2xl font-bold text-white">Nuevo proyecto</h1>
        <p className="text-sm text-white/40">
          Define tu proyecto y Sophia generará el código capa por capa con agentes especializados.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <NewProjectSection />
      </div>
    </div>
  );
}
