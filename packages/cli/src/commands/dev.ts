import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';

export async function devCommand(options: { port: string }) {
  const port = parseInt(options.port, 10);
  const cwd = process.cwd();

  const manifestPath = path.join(cwd, 'manifest.json');
  if (!(await fs.pathExists(manifestPath))) {
    console.error(chalk.red('Error: No manifest.json found. Run this from a Problocks simulation directory.'));
    console.error(chalk.dim('  Use `problocks init <name>` to create a new simulation.'));
    process.exit(1);
  }

  const manifest = await fs.readJSON(manifestPath);
  const entryPath = path.join(cwd, manifest.entry ?? 'src/index.ts');

  if (!(await fs.pathExists(entryPath))) {
    console.error(chalk.red(`Error: Entry file "${manifest.entry}" not found.`));
    process.exit(1);
  }

  // Watch for file changes
  let currentCode = await fs.readFile(entryPath, 'utf-8');
  let version = 0;

  fs.watch(entryPath, async () => {
    try {
      currentCode = await fs.readFile(entryPath, 'utf-8');
      version++;
      console.log(chalk.dim(`  [${new Date().toLocaleTimeString()}] File changed — reload browser to see updates`));
    } catch { /* ignore */ }
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // SSE endpoint for live reload
    if (req.url === '/__problocks_version') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ version }));
      return;
    }

    // Source code endpoint (for live reload without full page refresh)
    if (req.url === '/__problocks_source') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ source: currentCode, version }));
      return;
    }

    // Main page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateDevHtml(manifest.name, currentCode, port));
  });

  server.listen(port, () => {
    console.log();
    console.log(chalk.green('  ▶ Problocks Dev Server'));
    console.log();
    console.log(`  Simulation: ${chalk.cyan(manifest.name)}`);
    console.log(`  Category:   ${chalk.dim(manifest.category ?? 'general')}`);
    console.log(`  Local:      ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log();
    console.log(chalk.dim('  Engine: Babylon.js + Rapier 3D'));
    console.log(chalk.dim('  Sandbox: QuickJS WASM'));
    console.log(chalk.dim('  Watching for file changes...'));
    console.log();
    console.log(chalk.dim('  Press Ctrl+C to stop.'));
    console.log();
  });
}

function generateDevHtml(name: string, studentCode: string, port: number): string {
  const escapedCode = studentCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  // We import the engine packages from the monorepo's node_modules via importmap
  // This is the key trick: we serve a self-contained HTML that loads everything via ESM
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Problocks Dev</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a0f; font-family: system-ui, -apple-system, sans-serif; color: #fff; }
    #canvas { width: 100vw; height: calc(100vh - 40px); display: block; margin-top: 40px; }
    #dev-bar {
      position: fixed; top: 0; left: 0; right: 0; height: 40px;
      background: #1a1a24; border-bottom: 1px solid #333;
      padding: 0 16px; font-size: 13px; z-index: 100;
      display: flex; align-items: center; gap: 12px;
    }
    #dev-bar .logo { background: #22c55e; color: #000; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    #dev-bar .name { font-weight: 600; }
    #dev-bar .sep { color: #444; }
    #dev-bar .badge { background: #22c55e22; color: #22c55e; padding: 2px 8px; border-radius: 4px; font-size: 11px; border: 1px solid #22c55e44; }
    #dev-bar .spacer { flex: 1; }
    #dev-bar .btn {
      background: #22c55e; color: #000; border: none; padding: 5px 14px;
      border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    #dev-bar .btn:hover { background: #16a34a; }
    #dev-bar .btn.stop { background: #ef4444; color: #fff; }
    #dev-bar .btn.stop:hover { background: #dc2626; }
    #dev-bar .status { font-size: 11px; color: #888; }
    #overlay {
      position: fixed; top: 40px; left: 0; right: 0; bottom: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); z-index: 50; cursor: pointer;
    }
    #overlay .play-btn {
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(255,255,255,0.15); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #overlay:hover .play-btn { transform: scale(1.1); }
    #overlay svg { width: 36px; height: 36px; fill: white; margin-left: 4px; }
    #console-bar {
      position: fixed; bottom: 0; left: 0; right: 0; height: 28px;
      background: #1a1a24; border-top: 1px solid #333;
      padding: 0 16px; font-size: 11px; color: #888;
      display: flex; align-items: center; gap: 16px; z-index: 100;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div id="dev-bar">
    <span class="logo">PB</span>
    <span class="name">${name}</span>
    <span class="sep">|</span>
    <span class="badge">DEV</span>
    <span class="spacer"></span>
    <span class="status" id="status">Ready</span>
    <button class="btn" id="btn-play" onclick="startSim()">▶ Play</button>
    <button class="btn stop hidden" id="btn-stop" onclick="stopSim()">■ Stop</button>
  </div>

  <canvas id="canvas"></canvas>

  <div id="overlay" onclick="startSim()">
    <div class="play-btn">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </div>
  </div>

  <div id="console-bar">
    <span>Sandbox: QuickJS WASM</span>
    <span>Physics: Rapier 3D (host)</span>
    <span>Renderer: Babylon.js</span>
    <span class="spacer" style="flex:1"></span>
    <span id="fps-counter">FPS: --</span>
  </div>

  <script type="module">
    // ---- Engine imports (from node_modules via Vite-like resolution) ----
    // Since we're running a plain HTTP server (not Vite), we inline the engine logic.
    // The engine modules are loaded dynamically from the monorepo.

    const STUDENT_CODE = \`${escapedCode}\`;

    let engine = null;
    let running = false;

    window.startSim = async function() {
      if (running) return;

      const status = document.getElementById('status');
      const btnPlay = document.getElementById('btn-play');
      const btnStop = document.getElementById('btn-stop');
      const overlay = document.getElementById('overlay');

      status.textContent = 'Loading engine...';

      try {
        // Dynamic import of Babylon.js
        const BABYLON = await import('https://esm.sh/@babylonjs/core@9');

        const canvas = document.getElementById('canvas');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 68; // minus bars

        // Create Babylon engine
        const bEngine = new BABYLON.Engine(canvas, true);
        const scene = new BABYLON.Scene(bEngine);
        scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.12, 1);

        // Camera
        const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI/4, Math.PI/3, 15, new BABYLON.Vector3(0,2,0), scene);
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 100;

        // Lights
        const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0,1,0), scene);
        hemi.intensity = 0.9;
        const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1,-2,-1), scene);
        dir.intensity = 0.7;

        // Ground
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {width:30, height:30}, scene);
        const gmat = new BABYLON.StandardMaterial('gmat', scene);
        gmat.diffuseColor = new BABYLON.Color3(0.18,0.18,0.22);
        gmat.specularColor = new BABYLON.Color3(0.05,0.05,0.05);
        ground.material = gmat;

        // Dynamic import of Rapier
        const RAPIER = await import('https://esm.sh/@dimforge/rapier3d-compat@0.14');
        await RAPIER.init();
        const world = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));

        // Physics ground so objects don't fall through
        const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        world.createCollider(RAPIER.ColliderDesc.cuboid(15, 0.05, 15), groundBody);

        status.textContent = 'Loading sandbox...';

        // Dynamic import of QuickJS
        const { getQuickJS } = await import('https://esm.sh/quickjs-emscripten@0.31');
        const QuickJS = await getQuickJS();
        const vm = QuickJS.newContext();

        // Track entities: id -> { mesh, body }
        const entities = {};

        // Host function: pb.createEntity(id, shape, optsJSON)
        function hostCreateEntity(id, shape, optsJSON) {
          const opts = JSON.parse(optsJSON);
          let mesh;
          const pos = opts.position || {x:0,y:0,z:0};
          switch(shape) {
            case 'sphere':
              mesh = BABYLON.MeshBuilder.CreateSphere(id, {diameter:(opts.radius||0.5)*2, segments:32}, scene);
              break;
            case 'cylinder':
              mesh = BABYLON.MeshBuilder.CreateCylinder(id, {diameter:(opts.radius||0.5)*2, height:opts.height||1}, scene);
              break;
            case 'box':
            default:
              mesh = BABYLON.MeshBuilder.CreateBox(id, {width:opts.width||1, height:opts.height||1, depth:opts.depth||1}, scene);
          }
          const mat = new BABYLON.StandardMaterial(id+'_mat', scene);
          if(opts.color) mat.diffuseColor = BABYLON.Color3.FromHexString(opts.color);
          mesh.material = mat;
          mesh.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

          // Physics body
          const bodyDesc = opts.isStatic ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
          bodyDesc.setTranslation(pos.x, pos.y, pos.z);
          const body = world.createRigidBody(bodyDesc);
          let cDesc;
          switch(shape) {
            case 'sphere': cDesc = RAPIER.ColliderDesc.ball(opts.radius||0.5); break;
            case 'cylinder': cDesc = RAPIER.ColliderDesc.cylinder((opts.height||1)/2, (opts.radius||0.5)); break;
            default: cDesc = RAPIER.ColliderDesc.cuboid((opts.width||1)/2,(opts.height||1)/2,(opts.depth||1)/2);
          }
          if(opts.friction !== undefined) cDesc.setFriction(opts.friction);
          if(opts.restitution !== undefined) cDesc.setRestitution(opts.restitution);
          if(!opts.isStatic && opts.mass) cDesc.setMass(opts.mass);
          world.createCollider(cDesc, body);

          entities[id] = { mesh, body };
        }

        // Register pb namespace in QuickJS
        const pbObj = vm.newObject();
        const logFn = vm.newFunction('log', (...args) => {
          console.log('[sandbox]', ...args.map(a => vm.dump(a)));
        });
        vm.setProp(pbObj, 'log', logFn); logFn.dispose();

        const createFn = vm.newFunction('createEntity', (...args) => {
          hostCreateEntity(vm.getString(args[0]), vm.getString(args[1]), vm.getString(args[2]));
          return vm.undefined;
        });
        vm.setProp(pbObj, 'createEntity', createFn); createFn.dispose();

        const removeFn = vm.newFunction('removeEntity', (...args) => {
          const id = vm.getString(args[0]);
          if(entities[id]) { entities[id].mesh.dispose(); world.removeRigidBody(entities[id].body); delete entities[id]; }
          return vm.undefined;
        });
        vm.setProp(pbObj, 'removeEntity', removeFn); removeFn.dispose();

        const forceFn = vm.newFunction('applyForce', (...args) => {
          const id = vm.getString(args[0]);
          if(entities[id]) entities[id].body.addForce(new RAPIER.Vector3(vm.getNumber(args[1]),vm.getNumber(args[2]),vm.getNumber(args[3])),true);
          return vm.undefined;
        });
        vm.setProp(pbObj, 'applyForce', forceFn); forceFn.dispose();

        const impulseFn = vm.newFunction('applyImpulse', (...args) => {
          const id = vm.getString(args[0]);
          if(entities[id]) entities[id].body.applyImpulse(new RAPIER.Vector3(vm.getNumber(args[1]),vm.getNumber(args[2]),vm.getNumber(args[3])),true);
          return vm.undefined;
        });
        vm.setProp(pbObj, 'applyImpulse', impulseFn); impulseFn.dispose();

        const posFn = vm.newFunction('getPosition', (...args) => {
          const id = vm.getString(args[0]);
          if(!entities[id]) return vm.newString('0,0,0');
          const p = entities[id].body.translation();
          return vm.newString(p.x+','+p.y+','+p.z);
        });
        vm.setProp(pbObj, 'getPosition', posFn); posFn.dispose();

        const velFn = vm.newFunction('getVelocity', (...args) => {
          const id = vm.getString(args[0]);
          if(!entities[id]) return vm.newString('0,0,0');
          const v = entities[id].body.linvel();
          return vm.newString(v.x+','+v.y+','+v.z);
        });
        vm.setProp(pbObj, 'getVelocity', velFn); velFn.dispose();

        vm.setProp(vm.global, 'pb', pbObj); pbObj.dispose();
        vm.evalCode('function parseVec3(s){var p=s.split(",").map(Number);return{x:p[0],y:p[1],z:p[2]};}');

        // Execute student code
        status.textContent = 'Running script...';
        const result = vm.evalCode(STUDENT_CODE);
        if(result.error) { console.error('Script error:', vm.dump(result.error)); result.error.dispose(); }
        else result.value.dispose();

        // Call onStart if defined
        const startFn = vm.getProp(vm.global, 'onStart');
        if(vm.typeof(startFn)==='function') {
          const r = vm.callFunction(startFn, vm.global);
          if(r.error) { console.error('onStart error:', vm.dump(r.error)); r.error.dispose(); } else r.value.dispose();
        }
        startFn.dispose();

        // Get onTick handle
        const tickFn = vm.getProp(vm.global, 'onTick');
        const hasTick = vm.typeof(tickFn)==='function';

        running = true;
        overlay.classList.add('hidden');
        btnPlay.classList.add('hidden');
        btnStop.classList.remove('hidden');
        status.textContent = '▶ Playing';

        // Render + physics loop
        let lastTime = performance.now();
        bEngine.runRenderLoop(() => {
          const now = performance.now();
          const dt = Math.min((now - lastTime) / 1000, 0.1);
          lastTime = now;

          // Sandbox tick
          if(hasTick) {
            const dtH = vm.newNumber(dt);
            const r = vm.callFunction(tickFn, vm.global, dtH);
            dtH.dispose();
            if(r.error) r.error.dispose(); else r.value.dispose();
          }

          // Physics step
          world.step();

          // Sync transforms
          for(const id in entities) {
            const e = entities[id];
            const p = e.body.translation();
            const r = e.body.rotation();
            e.mesh.position.set(p.x, p.y, p.z);
            e.mesh.rotationQuaternion = new BABYLON.Quaternion(r.x, r.y, r.z, r.w);
          }

          scene.render();
          document.getElementById('fps-counter').textContent = 'FPS: ' + Math.round(bEngine.getFps());
        });

        window.addEventListener('resize', () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight - 68;
          bEngine.resize();
        });

        engine = { bEngine, scene, world, vm, tickFn, hasTick };

      } catch(err) {
        status.textContent = 'Error: ' + err.message;
        console.error('[problocks dev]', err);
      }
    };

    window.stopSim = function() {
      if(!engine) return;
      engine.bEngine.stopRenderLoop();
      if(engine.hasTick) engine.tickFn.dispose();
      engine.vm.dispose();
      engine.bEngine.dispose();
      engine = null;
      running = false;

      document.getElementById('btn-play').classList.remove('hidden');
      document.getElementById('btn-stop').classList.add('hidden');
      document.getElementById('overlay').classList.remove('hidden');
      document.getElementById('status').textContent = 'Stopped';
      document.getElementById('fps-counter').textContent = 'FPS: --';
    };
  </script>
</body>
</html>`;
}
