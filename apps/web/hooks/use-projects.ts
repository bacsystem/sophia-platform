import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from '@sophia/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** @description HTTP client hook for all project API operations */
export function useProjects() {
  const fetchProjects = async (query?: ListProjectsQuery) => {
    const params = new URLSearchParams({
      page: String(query?.page ?? 1),
      limit: String(query?.limit ?? 12),
    });
    if (query?.status) params.set('status', query.status);
    if (query?.search) params.set('search', query.search);

    const res = await fetch(`${API_URL}/api/projects?${params.toString()}`, {
      credentials: 'include',
    });
    return res.json();
  };

  const createProject = async (input: CreateProjectInput) => {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    return res.json();
  };

  const updateProject = async (id: string, input: UpdateProjectInput) => {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    return res.json();
  };

  const deleteProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.json();
  };

  const startProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/projects/${id}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  };

  const pauseProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/projects/${id}/pause`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  };

  const continueProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/projects/${id}/continue`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  };

  const retryProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/projects/${id}/retry`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  };

  return {
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    startProject,
    pauseProject,
    continueProject,
    retryProject,
  };
}
