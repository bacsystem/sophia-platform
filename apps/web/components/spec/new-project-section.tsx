'use client';

import { useState } from 'react';
import { ProjectForm, type TemplateFormValues } from '@/components/projects/project-form';
import { TemplateGallery } from '@/components/spec/template-gallery';

/** @description Client wrapper that wires TemplateGallery selection into ProjectForm defaults. Remounts the form (via key) when a template is selected so react-hook-form picks up new defaultValues. */
export function NewProjectSection() {
  const [templateKey, setTemplateKey] = useState(0);
  const [templateValues, setTemplateValues] = useState<Partial<TemplateFormValues> | undefined>(undefined);

  const handleTemplateSelect = (values: TemplateFormValues) => {
    setTemplateValues(values);
    setTemplateKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <TemplateGallery onSelect={handleTemplateSelect} />
      <div className="border-t border-white/10" />
      <ProjectForm key={templateKey} templateValues={templateValues} />
    </div>
  );
}
