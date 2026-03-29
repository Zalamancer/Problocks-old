import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, Terminal, BookOpen, Zap, Shield } from 'lucide-react';
import { useState } from 'react';

function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="relative group">
      <pre className="rounded-lg bg-[#1e1e1e] p-4 font-mono text-xs leading-relaxed text-gray-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost" size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white"
        onClick={copy}
      >
        {copied ? <span className="text-green-400 text-[10px]">OK</span> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function DocsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">P</div>
            <span className="font-bold text-sm">Problocks</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">SDK Documentation</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Problocks SDK Documentation</h1>
        <p className="text-muted-foreground mb-8">Everything you need to build educational simulations.</p>

        {/* Quick Start */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Zap className="h-5 w-5" /> Quick Start</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">1. Install the CLI:</p>
              <CodeBlock code="npm install -g @problocks/cli" language="bash" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">2. Create a simulation:</p>
              <CodeBlock code={`problocks init my-physics-lab --template physics\ncd my-physics-lab`} language="bash" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">3. Preview locally:</p>
              <CodeBlock code="problocks dev" language="bash" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">4. Publish to marketplace:</p>
              <CodeBlock code="problocks publish" language="bash" />
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Sandbox API */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Terminal className="h-5 w-5" /> Sandbox API Reference</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your code runs inside a QuickJS WASM sandbox. These are the available functions via the <code className="bg-muted px-1 rounded">pb</code> namespace:
          </p>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.createEntity(id, shape, optsJSON)</h3>
                <p className="text-sm text-muted-foreground mb-3">Create a 3D entity with physics in the scene.</p>
                <CodeBlock code={`pb.createEntity("ball", "sphere", JSON.stringify({
  radius: 0.5,
  position: { x: 0, y: 5, z: 0 },
  mass: 1.0,
  color: "#ff4444",
  restitution: 0.6,   // bounciness (0-1)
  friction: 0.3,       // surface friction
  isStatic: false,     // true = immovable
}));`} />
                <div className="mt-3 text-xs text-muted-foreground">
                  <strong>Shapes:</strong> <code>"box"</code>, <code>"sphere"</code>, <code>"cylinder"</code>
                  <br /><strong>Box options:</strong> width, height, depth
                  <br /><strong>Sphere options:</strong> radius
                  <br /><strong>Cylinder options:</strong> radius, height
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.removeEntity(id)</h3>
                <p className="text-sm text-muted-foreground mb-3">Remove an entity from the scene.</p>
                <CodeBlock code={`pb.removeEntity("ball");`} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.applyForce(id, fx, fy, fz)</h3>
                <p className="text-sm text-muted-foreground mb-3">Apply a continuous force to an entity.</p>
                <CodeBlock code={`// Push ball upward\npb.applyForce("ball", 0, 50, 0);`} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.applyImpulse(id, ix, iy, iz)</h3>
                <p className="text-sm text-muted-foreground mb-3">Apply an instant velocity change (like a kick).</p>
                <CodeBlock code={`// Launch ball\npb.applyImpulse("ball", 5, 10, 0);`} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.getPosition(id) → "x,y,z"</h3>
                <p className="text-sm text-muted-foreground mb-3">Get entity position as a string. Use <code>parseVec3()</code> to convert.</p>
                <CodeBlock code={`var pos = parseVec3(pb.getPosition("ball"));\n// pos.x, pos.y, pos.z`} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.getVelocity(id) → "vx,vy,vz"</h3>
                <p className="text-sm text-muted-foreground mb-3">Get entity velocity as a string.</p>
                <CodeBlock code={`var vel = parseVec3(pb.getVelocity("ball"));\nvar speed = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);`} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-mono font-semibold text-sm mb-1">pb.log(...args)</h3>
                <p className="text-sm text-muted-foreground mb-3">Log to the console (visible in Studio and browser dev tools).</p>
                <CodeBlock code={`pb.log("Ball position:", pos.x, pos.y);`} />
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Lifecycle */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5" /> Simulation Lifecycle</h2>
          <p className="text-sm text-muted-foreground mb-4">Your simulation defines two functions:</p>

          <CodeBlock code={`// Called once when simulation starts
function onStart() {
  // Create your entities here
  pb.createEntity("ground", "box", JSON.stringify({
    width: 10, height: 0.2, depth: 10,
    position: { x: 0, y: 0, z: 0 },
    isStatic: true,
    color: "#333333",
  }));
}

// Called every frame (~60 times per second)
function onTick(dt) {
  // dt = seconds since last frame (~0.016)
  // Put game logic here: check positions, apply forces, etc.
}`} />
        </section>

        <Separator className="my-8" />

        {/* Security */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Sandbox Rules</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm text-green-400 mb-2">Allowed</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>All <code>pb.*</code> functions</li>
                  <li>Math operations (Math.sin, Math.random, etc.)</li>
                  <li>JSON.parse / JSON.stringify</li>
                  <li>Variables, functions, loops, arrays, objects</li>
                  <li>String manipulation</li>
                  <li><code>parseVec3()</code> helper</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm text-red-400 mb-2">Not Available</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>DOM access (document, window)</li>
                  <li>Network requests (fetch, XMLHttpRequest)</li>
                  <li>File system access</li>
                  <li>eval() / Function()</li>
                  <li>setTimeout / setInterval</li>
                  <li>npm packages / imports</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Limits: 100ms max per frame, 10MB memory, 60 API calls/second. Physics runs on the host (Rapier), not in your sandbox.
          </p>
        </section>

        {/* Templates */}
        <Separator className="my-8" />
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">CLI Templates</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {['physics', 'circuits', 'chemistry', 'blank'].map(t => (
              <Card key={t}>
                <CardContent className="p-4 text-center">
                  <code className="text-sm">--template {t}</code>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
