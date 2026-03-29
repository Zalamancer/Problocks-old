export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api';

export interface Simulation {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  version: string;
  plays: number;
  rating: string | null;
  rating_count: number;
  username: string;
  author_name: string;
  source_code: string;
  created_at: string;
}

export interface UserProfile {
  user: {
    id: string;
    username: string;
    display_name: string;
    bio: string;
    is_educator: boolean;
    created_at: string;
  };
  simulations: Simulation[];
  stats: {
    totalSimulations: number;
    totalPlays: number;
    avgRating: number | null;
  };
}

export async function fetchSimulations(params?: {
  category?: string;
  search?: string;
  sort?: string;
  limit?: number;
}): Promise<Simulation[]> {
  const url = new URL(`${API_BASE}/simulations`);
  if (params?.category && params.category !== 'all') url.searchParams.set('category', params.category);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.sort) url.searchParams.set('sort', params.sort);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString());
  const data = await res.json();
  return data.simulations;
}

export async function fetchSimulation(slug: string): Promise<Simulation | null> {
  const res = await fetch(`${API_BASE}/simulations/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.simulation;
}

export async function fetchSource(slug: string): Promise<{ name: string; version: string; source: string } | null> {
  const res = await fetch(`${API_BASE}/simulations/${slug}/source`);
  if (!res.ok) return null;
  return res.json();
}

export async function recordPlay(slug: string): Promise<void> {
  await fetch(`${API_BASE}/simulations/${slug}/play`, { method: 'POST' });
}

export async function fetchUserProfile(username: string): Promise<UserProfile | null> {
  const res = await fetch(`${API_BASE}/users/${username}`);
  if (!res.ok) return null;
  return res.json();
}

export async function downloadProject(slug: string): Promise<any> {
  const res = await fetch(`${API_BASE}/simulations/${slug}/download`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateSimulation(slug: string, data: { source_code: string; version?: string; changelog?: string }): Promise<boolean> {
  const res = await fetch(`${API_BASE}/simulations/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function fetchVersions(slug: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/simulations/${slug}/versions`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.versions;
}
