export type ProjectStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
export type ProjectStack = 'node-nextjs' | 'laravel-nextjs' | 'python-nextjs';
export type ProjectModel = 'claude-sonnet-4-6' | 'claude-opus-4-6' | 'claude-haiku-4-5';
export type AgentName =
  | 'dba'
  | 'seed'
  | 'backend'
  | 'frontend'
  | 'qa'
  | 'security'
  | 'docs'
  | 'deploy'
  | 'integration';

export interface ProjectConfig {
  model: ProjectModel;
  agents: AgentName[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  stack: ProjectStack;
  status: ProjectStatus;
  progress: number;
  currentLayer: number;
  currentLayerName: string;
  config: ProjectConfig;
  tokensUsed: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSpec {
  id: string;
  projectId: string;
  version: number;
  content: Record<string, unknown>;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  stack: ProjectStack;
  config: ProjectConfig;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  stack?: ProjectStack;
  config?: ProjectConfig;
}

export interface ListProjectsQuery {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  search?: string;
}

export interface ProjectListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
