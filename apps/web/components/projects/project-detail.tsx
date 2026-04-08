import type { Project } from '@sophia/shared';
import { ProjectHeader } from './project-header';
import { ProjectActions } from './project-actions';
import { ProjectTabs } from './project-tabs';

interface ProjectDetailProps {
  project: Project;
}

/** @description Composes the project detail view: header + actions + tabs */
export function ProjectDetail({ project }: ProjectDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <ProjectHeader project={project} />
        </div>
        <div className="shrink-0">
          <ProjectActions project={project} />
        </div>
      </div>

      <ProjectTabs project={project} />
    </div>
  );
}
