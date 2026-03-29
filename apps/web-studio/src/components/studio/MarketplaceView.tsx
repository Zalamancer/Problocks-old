import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  Star,
  Users,
  Play,
  Download,
  FolderOpen,
  Atom,
  Cpu,
  FlaskConical,
  Cog,
  Dna,
  Calculator,
  Code,
  Globe,
  Flame,
} from 'lucide-react';

/* ── API ────────────────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api';

interface Simulation {
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

async function fetchSimulations(params?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<Simulation[]> {
  const url = new URL(`${API_BASE}/simulations`);
  if (params?.category && params.category !== 'all') url.searchParams.set('category', params.category);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.simulations;
}

/* ── Constants ──────────────────────────────────── */

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Flame },
  { id: 'physics', name: 'Physics', icon: Atom },
  { id: 'circuits', name: 'Circuits', icon: Cpu },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical },
  { id: 'engineering', name: 'Engineering', icon: Cog },
  { id: 'biology', name: 'Biology', icon: Dna },
  { id: 'math', name: 'Math', icon: Calculator },
  { id: 'cs', name: 'CS', icon: Code },
  { id: 'earth', name: 'Earth Science', icon: Globe },
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  physics: 'linear-gradient(135deg, #2d1b69, #11998e)',
  circuits: 'linear-gradient(135deg, #1f1c2c, #928dab)',
  chemistry: 'linear-gradient(135deg, #134e5e, #71b280)',
  engineering: 'linear-gradient(135deg, #4a1942, #c74b50)',
  biology: 'linear-gradient(135deg, #56ab2f, #a8e063)',
  math: 'linear-gradient(135deg, #667eea, #764ba2)',
  cs: 'linear-gradient(135deg, #fc5c7d, #6a82fb)',
  earth: 'linear-gradient(135deg, #373b44, #4286f4)',
  general: 'linear-gradient(135deg, #1a1a2e, #16213e)',
};

function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/* ── Left Panel: Categories ─────────────────────── */

function CategoriesPanel({
  category,
  onSelect,
}: {
  category: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Marketplace
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {CATEGORIES.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-1">
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            className={`flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${
              category === cat.id
                ? 'bg-primary/20 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            onClick={() => onSelect(cat.id)}
          >
            <cat.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{cat.name}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

/* ── Center: Simulation Grid ────────────────────── */

function GridPanel({
  category,
  search,
  onSearch,
  onSelect,
  selectedId,
}: {
  category: string;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (sim: Simulation) => void;
  selectedId?: string;
}) {
  const [sims, setSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      fetchSimulations({
        category: category === 'all' ? undefined : category,
        search: search || undefined,
        limit: 20,
      })
        .then(setSims)
        .catch(() => setSims([]))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [category, search]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Search header — matches Cinema standard */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search simulations..."
            className="h-7 pl-8 text-xs"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {loading ? '...' : sims.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-xs text-muted-foreground">Loading simulations...</span>
          </div>
        ) : sims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-sm font-medium">No simulations found</span>
            <span className="mt-1 text-xs text-muted-foreground">
              {search ? `No results for "${search}"` : 'Be the first to publish in this category!'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {sims.map(sim => (
              <Card
                key={sim.id}
                className={`group cursor-pointer overflow-hidden transition-all ${
                  selectedId === sim.id
                    ? 'ring-2 ring-primary'
                    : 'hover:ring-1 hover:ring-primary/30'
                }`}
                onClick={() => onSelect(sim)}
              >
                <div
                  className="relative aspect-video"
                  style={{ background: CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general }}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                    <div className="scale-0 rounded-full bg-white/90 p-2 transition-transform group-hover:scale-100">
                      <Play className="h-4 w-4 text-black" fill="black" />
                    </div>
                  </div>
                  <Badge variant="secondary" className="absolute right-1.5 top-1.5 text-[9px]">
                    {sim.category}
                  </Badge>
                </div>
                <div className="p-2">
                  <h3 className="truncate text-xs font-semibold">{sim.name}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">{sim.author_name ?? sim.username ?? 'Unknown'}</span>
                    <span className="ml-auto flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {formatPlays(sim.plays)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Right Panel: Simulation Details ────────────── */

function DetailPanel({ sim }: { sim: Simulation | null }) {
  if (!sim) {
    return (
      <div className="flex h-full flex-col border-l bg-card">
        <div className="flex items-center border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Details
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <span className="text-sm text-muted-foreground">Select a simulation</span>
        </div>
      </div>
    );
  }

  const initials = sim.author_name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </span>
        <Badge variant="outline" className="text-[10px]">
          v{sim.version}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-3">
        {/* Thumbnail */}
        <div
          className="mb-3 aspect-video rounded-md"
          style={{ background: CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general }}
        />

        {/* Name + category */}
        <h3 className="mb-1 text-sm font-bold">{sim.name}</h3>
        <Badge variant="secondary" className="mb-3 text-[10px]">
          {sim.category}
        </Badge>

        {/* Author */}
        <div className="mb-3 flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-muted text-[8px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="text-xs font-medium">{sim.author_name ?? sim.username ?? 'Unknown'}</span>
            {sim.username && (
              <span className="ml-1 text-[10px] text-muted-foreground">@{sim.username}</span>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        {/* Description */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {sim.description || 'No description provided.'}
          </p>
        </div>

        <Separator className="my-3" />

        {/* Stats */}
        <div className="mb-3">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stats
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold">{formatPlays(sim.plays)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">plays</span>
            </div>
            {sim.rating && (
              <div className="rounded-md bg-muted/50 p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-bold">{sim.rating}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{sim.rating_count} ratings</span>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        {/* Actions */}
        <div className="space-y-2">
          <Button className="w-full gap-1.5" size="sm">
            <FolderOpen className="h-3.5 w-3.5" /> Open in Editor
          </Button>
          <Button variant="outline" className="w-full gap-1.5" size="sm">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Main Marketplace View ──────────────────────── */

export function MarketplaceView() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedSim, setSelectedSim] = useState<Simulation | null>(null);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-[220px] shrink-0 overflow-hidden">
        <CategoriesPanel category={category} onSelect={setCategory} />
      </div>
      <div className="flex-1 overflow-hidden">
        <GridPanel
          category={category}
          search={search}
          onSearch={setSearch}
          onSelect={setSelectedSim}
          selectedId={selectedSim?.id}
        />
      </div>
      <div className="w-[280px] shrink-0 overflow-hidden">
        <DetailPanel sim={selectedSim} />
      </div>
    </div>
  );
}
