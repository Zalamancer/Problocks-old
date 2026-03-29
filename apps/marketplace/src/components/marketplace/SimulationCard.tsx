import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, Play, Users } from 'lucide-react';
import type { Simulation } from '@/lib/api';

function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getInitials(name?: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface SimulationCardProps {
  sim: Simulation;
  thumbnail: string;
  featured?: boolean;
}

export function SimulationCard({ sim, thumbnail, featured }: SimulationCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50"
      onClick={() => navigate(`/sim/${sim.slug}`)}
    >
      <div className="relative aspect-video overflow-hidden" style={{ background: thumbnail }}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
          <div className="scale-0 rounded-full bg-white/90 p-3 transition-transform group-hover:scale-100">
            <Play className="h-6 w-6 text-black" fill="black" />
          </div>
        </div>
        {featured && (
          <Badge className="absolute left-2 top-2 bg-yellow-500/90 text-black text-[10px]">Featured</Badge>
        )}
        <Badge variant="secondary" className="absolute right-2 top-2 text-[10px]">
          {sim.category}
        </Badge>
      </div>

      <CardContent className="p-3">
        <h3 className="mb-1 truncate font-semibold text-sm">{sim.name}</h3>
        <div
          className="flex items-center gap-2 hover:text-primary cursor-pointer"
          onClick={(e) => { e.stopPropagation(); navigate(`/user/${sim.username}`); }}
        >
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-muted">
              {getInitials(sim.author_name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground hover:text-primary">{sim.author_name ?? sim.username ?? 'Unknown'}</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {sim.rating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {sim.rating}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {formatPlays(sim.plays)}
          </span>
          <span className="ml-auto text-[10px]">v{sim.version}</span>
        </div>
      </CardContent>
    </Card>
  );
}
