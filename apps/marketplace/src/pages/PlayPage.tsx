import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSimulation, fetchSource, recordPlay, type Simulation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Star, Users, Play, Maximize, Info } from 'lucide-react';

/**
 * Play page — loads a simulation from the API and runs it
 * in Babylon.js + Rapier + QuickJS sandbox.
 */
export function PlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sim, setSim] = useState<Simulation | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [engineReady, setEngineReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);

  // Fetch simulation data
  useEffect(() => {
    if (!slug) return;
    Promise.all([fetchSimulation(slug), fetchSource(slug)])
      .then(([simData, sourceData]) => {
        setSim(simData);
        if (sourceData) setSource(sourceData.source);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Initialize engine when canvas is ready
  useEffect(() => {
    if (!canvasRef.current || !source || engineRef.current) return;

    let disposed = false;

    async function initEngine() {
      const canvas = canvasRef.current!;
      const rect = canvas.parentElement?.getBoundingClientRect() ?? { width: 800, height: 600 };
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Load engine from CDN (works without local monorepo packages)
      const BABYLON = await import('https://esm.sh/@babylonjs/core@9' as any);
      const RAPIER = await import('https://esm.sh/@dimforge/rapier3d-compat@0.14' as any);
      await RAPIER.init();
      const { getQuickJS } = await import('https://esm.sh/quickjs-emscripten@0.31' as any);

      if (disposed) return;

      // Babylon.js setup
      const bEngine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(bEngine);
      scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.12, 1);
      const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI/4, Math.PI/3, 15, new BABYLON.Vector3(0,2,0), scene);
      camera.attachControl(canvas, true);
      camera.lowerRadiusLimit = 2;
      camera.upperRadiusLimit = 100;
      new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0,1,0), scene).intensity = 0.9;
      new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1,-2,-1), scene).intensity = 0.7;

      // Ground
      const ground = BABYLON.MeshBuilder.CreateGround('ground', {width:30, height:30}, scene);
      const gmat = new BABYLON.StandardMaterial('gmat', scene);
      gmat.diffuseColor = new BABYLON.Color3(0.18,0.18,0.22);
      ground.material = gmat;

      // Physics world + ground collider
      const world = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
      const gb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(RAPIER.ColliderDesc.cuboid(15, 0.05, 15), gb);

      // Entity tracking
      const entities: Record<string, { mesh: any; body: any }> = {};

      function hostCreate(id: string, shape: string, optsJSON: string) {
        const opts = JSON.parse(optsJSON);
        const pos = opts.position || {x:0,y:0,z:0};
        let mesh: any;
        switch(shape) {
          case 'sphere': mesh = BABYLON.MeshBuilder.CreateSphere(id, {diameter:(opts.radius||0.5)*2}, scene); break;
          case 'cylinder': mesh = BABYLON.MeshBuilder.CreateCylinder(id, {diameter:(opts.radius||0.5)*2, height:opts.height||1}, scene); break;
          default: mesh = BABYLON.MeshBuilder.CreateBox(id, {width:opts.width||1, height:opts.height||1, depth:opts.depth||1}, scene);
        }
        const mat = new BABYLON.StandardMaterial(id+'_m', scene);
        if (opts.color) mat.diffuseColor = BABYLON.Color3.FromHexString(opts.color);
        mesh.material = mat;
        mesh.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        const bd = opts.isStatic ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
        bd.setTranslation(pos.x, pos.y, pos.z);
        const body = world.createRigidBody(bd);
        let cd: any;
        switch(shape) {
          case 'sphere': cd = RAPIER.ColliderDesc.ball(opts.radius||0.5); break;
          case 'cylinder': cd = RAPIER.ColliderDesc.cylinder((opts.height||1)/2, opts.radius||0.5); break;
          default: cd = RAPIER.ColliderDesc.cuboid((opts.width||1)/2,(opts.height||1)/2,(opts.depth||1)/2);
        }
        if (opts.friction !== undefined) cd.setFriction(opts.friction);
        if (opts.restitution !== undefined) cd.setRestitution(opts.restitution);
        if (!opts.isStatic && opts.mass) cd.setMass(opts.mass);
        world.createCollider(cd, body);
        entities[id] = { mesh, body };
      }

      // QuickJS sandbox
      const QuickJS = await getQuickJS();
      const vm = QuickJS.newContext();
      const pbObj = vm.newObject();

      // Register host functions
      const fns: any[] = [];
      function reg(name: string, fn: any) { const h = vm.newFunction(name, fn); vm.setProp(pbObj, name, h); fns.push(h); }
      reg('log', (...a: any[]) => { console.log('[sandbox]', ...a.map((x: any) => vm.dump(x))); return vm.undefined; });
      reg('createEntity', (...a: any[]) => { hostCreate(vm.getString(a[0]), vm.getString(a[1]), vm.getString(a[2])); return vm.undefined; });
      reg('removeEntity', (...a: any[]) => { const id = vm.getString(a[0]); if(entities[id]){entities[id].mesh.dispose();world.removeRigidBody(entities[id].body);delete entities[id];} return vm.undefined; });
      reg('applyForce', (...a: any[]) => { const id=vm.getString(a[0]); if(entities[id]) entities[id].body.addForce(new RAPIER.Vector3(vm.getNumber(a[1]),vm.getNumber(a[2]),vm.getNumber(a[3])),true); return vm.undefined; });
      reg('applyImpulse', (...a: any[]) => { const id=vm.getString(a[0]); if(entities[id]) entities[id].body.applyImpulse(new RAPIER.Vector3(vm.getNumber(a[1]),vm.getNumber(a[2]),vm.getNumber(a[3])),true); return vm.undefined; });
      reg('getPosition', (...a: any[]) => { const id=vm.getString(a[0]); if(!entities[id]) return vm.newString('0,0,0'); const p=entities[id].body.translation(); return vm.newString(p.x+','+p.y+','+p.z); });
      reg('getVelocity', (...a: any[]) => { const id=vm.getString(a[0]); if(!entities[id]) return vm.newString('0,0,0'); const v=entities[id].body.linvel(); return vm.newString(v.x+','+v.y+','+v.z); });
      vm.setProp(vm.global, 'pb', pbObj); pbObj.dispose(); fns.forEach(f => f.dispose());
      vm.evalCode('function parseVec3(s){var p=s.split(",").map(Number);return{x:p[0],y:p[1],z:p[2]};}');

      // Execute student code
      const r1 = vm.evalCode(source!); if(r1.error) r1.error.dispose(); else r1.value.dispose();
      const sf = vm.getProp(vm.global, 'onStart');
      if(vm.typeof(sf)==='function'){const r=vm.callFunction(sf,vm.global);if(r.error)r.error.dispose();else r.value.dispose();}
      sf.dispose();
      const tf = vm.getProp(vm.global, 'onTick');
      const hasTick = vm.typeof(tf)==='function';

      engineRef.current = { bEngine, scene, world, vm, tf, hasTick, entities, BABYLON, RAPIER };

      // Handle resize
      const observer = new ResizeObserver(() => bEngine.resize());
      if (canvas.parentElement) observer.observe(canvas.parentElement);

      // Render loop
      let lastTime = performance.now();
      bEngine.runRenderLoop(() => {
        if (!playing) { scene.render(); return; }
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        if (hasTick) { const d=vm.newNumber(dt); const r=vm.callFunction(tf,vm.global,d); d.dispose(); if(r.error)r.error.dispose();else r.value.dispose(); }
        world.step();
        for (const id in entities) { const e=entities[id]; const p=e.body.translation(); const rot=e.body.rotation(); e.mesh.position.set(p.x,p.y,p.z); e.mesh.rotationQuaternion=new BABYLON.Quaternion(rot.x,rot.y,rot.z,rot.w); }
        scene.render();
      });

      setEngineReady(true);
      if (slug) recordPlay(slug);
    }

    initEngine().catch(err => console.error('[PlayPage] Engine init failed:', err));

    return () => {
      disposed = true;
      if (engineRef.current) {
        engineRef.current.bEngine.stopRenderLoop();
        if (engineRef.current.hasTick) engineRef.current.tf.dispose();
        engineRef.current.vm.dispose();
        engineRef.current.bEngine.dispose();
        engineRef.current = null;
      }
    };
  }, [source, slug]);

  const togglePlay = () => {
    setPlaying(!playing);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">Loading simulation...</span>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <span className="text-lg">Simulation not found</span>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Back to Marketplace</Button>
      </div>
    );
  }

  const rating = sim.rating ? parseFloat(sim.rating) : null;
  const initials = sim.author_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-black/90 px-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{sim.name}</span>
          <Badge variant="secondary" className="text-[10px]">{sim.category}</Badge>
          <Badge variant="outline" className="text-[10px] text-white/50">v{sim.version}</Badge>
        </div>

        <div className="flex items-center gap-2 ml-3">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-white/20 text-white">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-white/50">{sim.author_name}</span>
        </div>

        {rating && (
          <span className="flex items-center gap-0.5 text-xs text-white/50 ml-2">
            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {rating.toFixed(1)}
          </span>
        )}
        <span className="flex items-center gap-0.5 text-xs text-white/50">
          <Users className="h-3 w-3" /> {sim.plays >= 1000 ? `${(sim.plays / 1000).toFixed(1)}K` : sim.plays}
        </span>

        <div className="flex-1" />

        {/* Playback controls */}
        <Button
          size="sm"
          className={playing ? 'bg-red-600 hover:bg-red-700 gap-1' : 'bg-green-600 hover:bg-green-700 gap-1'}
          onClick={togglePlay}
          disabled={!engineReady}
        >
          <Play className="h-4 w-4" /> {playing ? 'Stop' : 'Play'}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50" title="Fullscreen"
          onClick={() => canvasRef.current?.parentElement?.requestFullscreen()}>
          <Maximize className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50" title="Info">
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {/* Viewport */}
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="h-full w-full" />
        {!engineReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white mb-3" />
            <span className="text-sm text-white/50">Loading engine...</span>
          </div>
        )}
        {engineReady && !playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer" onClick={togglePlay}>
            <div className="rounded-full bg-white/20 p-6 backdrop-blur transition-transform hover:scale-110">
              <Play className="h-12 w-12 text-white" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="flex h-10 shrink-0 items-center gap-4 border-t border-white/10 bg-black/90 px-4">
        <span className="text-xs text-white/30">Sandbox: QuickJS WASM</span>
        <span className="text-xs text-white/30">Physics: Rapier 3D (host)</span>
        <span className="text-xs text-white/30">Renderer: Babylon.js</span>
        <div className="flex-1" />
        <span className="text-xs text-white/30">{sim.description}</span>
      </div>
    </div>
  );
}
