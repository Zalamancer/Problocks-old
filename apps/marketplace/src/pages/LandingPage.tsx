import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Atom, Cpu, FlaskConical, Cog, Code, Play, Sparkles,
  GraduationCap, Rocket, Shield, Users, Zap,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Atom,
    title: '3D Physics Engine',
    description: 'Babylon.js rendering + Rapier physics. Build interactive simulations with real gravity, collisions, and forces.',
  },
  {
    icon: Shield,
    title: 'Secure Sandbox',
    description: 'Student code runs in QuickJS WASM with zero access to files, network, or DOM. Safe by design.',
  },
  {
    icon: Sparkles,
    title: 'Vibecode with AI',
    description: 'Students use Claude Code CLI to build simulations on their own laptops. No expensive in-platform AI needed.',
  },
  {
    icon: Code,
    title: 'Monaco Editor',
    description: 'VS Code-quality editor built into the web studio. IntelliSense, syntax highlighting, error detection.',
  },
  {
    icon: Users,
    title: 'Marketplace',
    description: 'Browse, search, and play simulations built by students worldwide. Rate, favorite, and fork.',
  },
  {
    icon: GraduationCap,
    title: 'Classroom Tools',
    description: 'Educators assign simulations, track completion, pin versions. Built for schools and universities.',
  },
];

const CATEGORIES = [
  { icon: Atom, name: 'Physics', color: 'text-cyan-400' },
  { icon: Cpu, name: 'Circuits', color: 'text-purple-400' },
  { icon: FlaskConical, name: 'Chemistry', color: 'text-green-400' },
  { icon: Cog, name: 'Engineering', color: 'text-orange-400' },
  { icon: Code, name: 'Computer Science', color: 'text-blue-400' },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">P</div>
            <span className="text-lg font-bold">Problocks</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/explore')}>Explore</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
            <Button size="sm" onClick={() => navigate('/register')}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="mx-auto max-w-4xl text-center relative">
          <Badge variant="secondary" className="mb-4 text-xs">Open Source Educational Platform</Badge>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Build the Future of
            <span className="block text-primary">Education Labs</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Problocks is where students create, share, and monetize interactive lab simulations.
            Physics engines, circuit designers, chemistry experiments — vibecoded with AI, played by millions.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2 text-base px-8" onClick={() => navigate('/explore')}>
              <Play className="h-5 w-5" /> Explore Simulations
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base px-8" onClick={() => navigate('/register')}>
              <Rocket className="h-5 w-5" /> Start Building
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free to use. No credit card required.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-4 border-y bg-card/30">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {CATEGORIES.map(cat => (
              <div key={cat.name} className="flex items-center gap-2">
                <cat.icon className={`h-5 w-5 ${cat.color}`} />
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
            ))}
            <span className="text-sm text-muted-foreground">and more...</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Vibecode</h3>
              <p className="text-sm text-muted-foreground">
                Use Claude Code CLI or our web studio to build your simulation. Write TypeScript, see it render in 3D instantly.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Rocket className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Publish</h3>
              <p className="text-sm text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">problocks publish</code> and your simulation is live on the marketplace. Instant for basic sims.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. Earn</h3>
              <p className="text-sm text-muted-foreground">
                Students play your simulation, you earn. Educators assign it to classes. Build once, impact thousands.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-4 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold mb-12">Built for Education</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <Card key={f.title}>
                <CardContent className="p-6">
                  <f.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to build?</h2>
          <p className="text-muted-foreground mb-8">
            Join students and educators creating the next generation of interactive learning tools.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2 px-8" onClick={() => navigate('/register')}>
              Create Account
            </Button>
            <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => navigate('/explore')}>
              Browse Simulations
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-[10px]">P</div>
            <span className="text-sm font-semibold">Problocks</span>
          </div>
          <p className="text-xs text-muted-foreground">
            An educational simulation platform. Built with Babylon.js, Rapier, QuickJS.
          </p>
        </div>
      </footer>
    </div>
  );
}
