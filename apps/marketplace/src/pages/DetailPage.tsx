import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchSimulation, fetchVersions, downloadProject, API_BASE, type Simulation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft, Play, Star, Users, Calendar, Code, Shield, ExternalLink, Heart, GitFork, Download, History,
} from 'lucide-react';

const CATEGORY_GRADIENTS: Record<string, string> = {
  physics: 'linear-gradient(135deg, #2d1b69, #11998e)',
  circuits: 'linear-gradient(135deg, #1f1c2c, #928dab)',
  chemistry: 'linear-gradient(135deg, #134e5e, #71b280)',
  engineering: 'linear-gradient(135deg, #4a1942, #c74b50)',
  biology: 'linear-gradient(135deg, #56ab2f, #a8e063)',
  math: 'linear-gradient(135deg, #667eea, #764ba2)',
  cs: 'linear-gradient(135deg, #fc5c7d, #6a82fb)',
  general: 'linear-gradient(135deg, #1a1a2e, #16213e)',
};

export function DetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sim, setSim] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchSimulation(slug)
      .then(setSim)
      .finally(() => setLoading(false));
    fetchVersions(slug).then(setVersions);
  }, [slug]);

  const handleDownload = async () => {
    if (!slug) return;
    const project = await downloadProject(slug);
    if (!project) return;

    // Create a downloadable JSON file with the project structure
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.problocks.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <span className="text-lg">Simulation not found</span>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Back</Button>
      </div>
    );
  }

  const rating = sim.rating ? parseFloat(sim.rating) : null;
  const initials = sim.author_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? '??';
  const gradient = CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general;
  const date = new Date(sim.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">P</div>
            <span className="font-bold text-sm">Problocks</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">{sim.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left — main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero thumbnail */}
            <div
              className="aspect-video rounded-xl overflow-hidden"
              style={{ background: gradient }}
            >
              <div className="flex h-full items-center justify-center">
                <Button
                  size="lg"
                  className="gap-2 bg-white/20 backdrop-blur hover:bg-white/30 text-white text-lg px-8 py-6"
                  onClick={() => navigate(`/play/${slug}`)}
                >
                  <Play className="h-6 w-6" fill="white" /> Play Simulation
                </Button>
              </div>
            </div>

            {/* Title + meta */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{sim.name}</h1>
                  <div className="mt-2 flex items-center gap-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{sim.author_name}</span>
                    <span className="text-sm text-muted-foreground">@{sim.username}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={async () => {
                      const user = localStorage.getItem('pb_user');
                      if (!user) { navigate('/login'); return; }
                      const userId = JSON.parse(user).id;
                      const res = await fetch(`${API_BASE}/simulations/${slug}/fork`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: userId }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        navigate(`/sim/${data.slug}`);
                      }
                    }}
                  >
                    <GitFork className="h-4 w-4" /> Fork
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={handleDownload}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Heart className="h-4 w-4" /> Favorite
                  </Button>
                </div>
              </div>

              {/* Forked from attribution */}
              {(sim as any).forked_from && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Forked from <Link to={`/sim/${(sim as any).forked_from}`} className="text-primary hover:underline">
                    {(sim as any).forked_from}
                  </Link>
                </div>
              )}
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h2>
              <p className="text-sm leading-relaxed">{sim.description || 'No description provided.'}</p>
            </div>

            <Separator />

            {/* Source code preview */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Source Code</h2>
              <Card>
                <CardContent className="p-0">
                  <pre className="max-h-[300px] overflow-auto rounded-lg bg-[#1e1e1e] p-4 font-mono text-xs leading-relaxed text-gray-300">
                    <code>{sim.source_code}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>

            {/* Version history */}
            {versions.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 hover:text-foreground"
                  onClick={() => setShowVersions(!showVersions)}
                >
                  <History className="h-4 w-4" />
                  Version History ({versions.length})
                  <span className="text-xs">{showVersions ? '▼' : '▶'}</span>
                </button>
                {showVersions && (
                  <div className="space-y-2">
                    {versions.map((v: any, i: number) => (
                      <Card key={i}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {v.changelog && <p className="text-xs text-muted-foreground">{v.changelog}</p>}
                          <details className="mt-2">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">View source</summary>
                            <pre className="mt-1 max-h-[150px] overflow-auto rounded bg-[#1e1e1e] p-2 font-mono text-[10px] text-gray-400">
                              {v.source_code}
                            </pre>
                          </details>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Play CTA */}
            <Card>
              <CardContent className="p-4">
                <Button
                  className="w-full gap-2 text-base py-5 bg-green-600 hover:bg-green-700"
                  onClick={() => navigate(`/play/${slug}`)}
                >
                  <Play className="h-5 w-5" fill="white" /> Play Now
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stats</h3>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{sim.plays.toLocaleString()} plays</span>
                </div>
                {rating && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>{rating.toFixed(1)} / 5.0</span>
                    <span className="text-muted-foreground">({sim.rating_count} ratings)</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{date}</span>
                </div>
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary">{sim.category}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span>v{sim.version}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Engine</span>
                  <span>Babylon.js + Rapier</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sandbox</span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-green-500" /> QuickJS WASM
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Open in Studio */}
            <Card>
              <CardContent className="p-4">
                <Button variant="outline" className="w-full gap-2" onClick={() => window.open('http://localhost:4000', '_blank')}>
                  <Code className="h-4 w-4" /> Open in Studio
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
