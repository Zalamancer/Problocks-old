import { getQuickJS, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten';
import { ScriptRuntime, type ScriptRuntimeConfig } from './script-runtime.js';
import type { SimulationLoop } from '../core/simulation-loop.js';
import { registerAPIExtensions, type APIExtensionDeps } from './api-extensions.js';

/**
 * QuickJS-in-WASM sandbox runtime.
 *
 * Student TypeScript (compiled to JS) runs here with zero ambient authority.
 * Only registered host functions are available — no DOM, no network, no filesystem.
 *
 * Host functions bridge the sandbox to the engine:
 *   - pb.createEntity(id, shape, opts) → creates entity in SimulationLoop
 *   - pb.applyForce(id, fx, fy, fz) → applies force via host physics
 *   - pb.getPosition(id) → reads position from host physics
 *   - pb.getVelocity(id) → reads velocity from host physics
 *   - pb.log(...) → console.log on host
 *   - pb.setGravity(x, y, z) → changes world gravity
 */
export class QuickJSRuntime extends ScriptRuntime {
  private vm: QuickJSContext | null = null;
  private config: ScriptRuntimeConfig = {
    maxFrameMs: 100,
    maxMemoryBytes: 10 * 1024 * 1024,
    maxApiCallsPerSec: 60,
  };
  private sim: SimulationLoop | null = null;
  private tickFnHandle: QuickJSHandle | null = null;

  /**
   * Bind to a SimulationLoop so host functions can create entities, apply forces, etc.
   */
  bindSimulation(sim: SimulationLoop): void {
    this.sim = sim;
  }

  /**
   * Register all engine system API extensions (tilemap, camera, audio, etc.)
   * onto the `pb.*` namespace. Call after init() — the VM must be running.
   */
  bindExtensions(deps: APIExtensionDeps): void {
    registerAPIExtensions(this, deps);
  }

  async init(config: ScriptRuntimeConfig): Promise<void> {
    this.config = config;
    const QuickJS = await getQuickJS();
    this.vm = QuickJS.newContext();
    this.registerBuiltins();
  }

  /**
   * Register the `pb` namespace with all host functions available to student code.
   */
  private registerBuiltins(): void {
    if (!this.vm) return;

    // Create the `pb` global namespace
    const pbObj = this.vm.newObject();

    // pb.log(...args)
    const logFn = this.vm.newFunction('log', (...args) => {
      const values = args.map(a => this.vm!.dump(a));
      console.log('[sandbox]', ...values);
    });
    this.vm.setProp(pbObj, 'log', logFn);
    logFn.dispose();

    // pb.createEntity(id, shape, optsJson)
    const createEntityFn = this.vm.newFunction('createEntity', (...args) => {
      if (!this.sim || args.length < 3) return this.vm!.undefined;
      const id = this.vm!.getString(args[0]);
      const shape = this.vm!.getString(args[1]) as 'box' | 'sphere' | 'cylinder';
      const opts = JSON.parse(this.vm!.getString(args[2]));
      this.sim.createEntity(id, shape, opts);
      return this.vm!.undefined;
    });
    this.vm.setProp(pbObj, 'createEntity', createEntityFn);
    createEntityFn.dispose();

    // pb.removeEntity(id)
    const removeEntityFn = this.vm.newFunction('removeEntity', (...args) => {
      if (!this.sim || args.length < 1) return this.vm!.undefined;
      const id = this.vm!.getString(args[0]);
      this.sim.removeEntity(id);
      return this.vm!.undefined;
    });
    this.vm.setProp(pbObj, 'removeEntity', removeEntityFn);
    removeEntityFn.dispose();

    // pb.applyForce(id, fx, fy, fz)
    const applyForceFn = this.vm.newFunction('applyForce', (...args) => {
      if (!this.sim || args.length < 4) return this.vm!.undefined;
      const id = this.vm!.getString(args[0]);
      const fx = this.vm!.getNumber(args[1]);
      const fy = this.vm!.getNumber(args[2]);
      const fz = this.vm!.getNumber(args[3]);
      this.sim.applyForce(id, { x: fx, y: fy, z: fz });
      return this.vm!.undefined;
    });
    this.vm.setProp(pbObj, 'applyForce', applyForceFn);
    applyForceFn.dispose();

    // pb.applyImpulse(id, ix, iy, iz)
    const applyImpulseFn = this.vm.newFunction('applyImpulse', (...args) => {
      if (!this.sim || args.length < 4) return this.vm!.undefined;
      const id = this.vm!.getString(args[0]);
      const ix = this.vm!.getNumber(args[1]);
      const iy = this.vm!.getNumber(args[2]);
      const iz = this.vm!.getNumber(args[3]);
      this.sim.applyImpulse(id, { x: ix, y: iy, z: iz });
      return this.vm!.undefined;
    });
    this.vm.setProp(pbObj, 'applyImpulse', applyImpulseFn);
    applyImpulseFn.dispose();

    // pb.getPosition(id) → "x,y,z" string (avoiding complex object passing)
    const getPositionFn = this.vm.newFunction('getPosition', (...args) => {
      if (!this.sim || args.length < 1) return this.vm!.newString('0,0,0');
      const id = this.vm!.getString(args[0]);
      const pos = this.sim.getPosition(id);
      return this.vm!.newString(`${pos.x},${pos.y},${pos.z}`);
    });
    this.vm.setProp(pbObj, 'getPosition', getPositionFn);
    getPositionFn.dispose();

    // pb.getVelocity(id) → "vx,vy,vz" string
    const getVelocityFn = this.vm.newFunction('getVelocity', (...args) => {
      if (!this.sim || args.length < 1) return this.vm!.newString('0,0,0');
      const id = this.vm!.getString(args[0]);
      const vel = this.sim.getVelocity(id);
      return this.vm!.newString(`${vel.x},${vel.y},${vel.z}`);
    });
    this.vm.setProp(pbObj, 'getVelocity', getVelocityFn);
    getVelocityFn.dispose();

    // Set pb as global
    this.vm.setProp(this.vm.global, 'pb', pbObj);
    pbObj.dispose();

    // Add helper: parseVec3(str) → {x, y, z}
    this.vm.evalCode(`
      function parseVec3(s) {
        const [x, y, z] = s.split(',').map(Number);
        return { x, y, z };
      }
    `);
  }

  async execute(code: string): Promise<void> {
    if (!this.vm) throw new Error('Runtime not initialized');

    const result = this.vm.evalCode(code);
    if (result.error) {
      const err = this.vm.dump(result.error);
      result.error.dispose();
      throw new Error(`Sandbox error: ${JSON.stringify(err)}`);
    }
    result.value.dispose();
  }

  /**
   * Load student code that defines an onTick(dt) function.
   * The simulation loop calls callTick() each frame.
   */
  async loadSimulation(code: string): Promise<void> {
    if (!this.vm) throw new Error('Runtime not initialized');

    // Execute the student's code (which should define onTick, onStart, etc.)
    await this.execute(code);

    // Try to get the onTick function handle
    const tickFn = this.vm.getProp(this.vm.global, 'onTick');
    if (this.vm.typeof(tickFn) === 'function') {
      this.tickFnHandle = tickFn;
    } else {
      tickFn.dispose();
    }

    // Call onStart if defined
    const startFn = this.vm.getProp(this.vm.global, 'onStart');
    if (this.vm.typeof(startFn) === 'function') {
      const result = this.vm.callFunction(startFn, this.vm.global);
      if (result.error) {
        const err = this.vm.dump(result.error);
        result.error.dispose();
        console.error('[sandbox] onStart error:', err);
      } else {
        result.value.dispose();
      }
    }
    startFn.dispose();
  }

  /**
   * Call the student's onTick(dt) function. Called by SimulationLoop each frame.
   */
  callTick(deltaTime: number): void {
    if (!this.vm || !this.tickFnHandle) return;

    const dtHandle = this.vm.newNumber(deltaTime);
    const result = this.vm.callFunction(this.tickFnHandle, this.vm.global, dtHandle);
    dtHandle.dispose();

    if (result.error) {
      const err = this.vm.dump(result.error);
      result.error.dispose();
      console.error('[sandbox] onTick error:', err);
    } else {
      result.value.dispose();
    }
  }

  async call(functionName: string, ...args: unknown[]): Promise<unknown> {
    if (!this.vm) throw new Error('Runtime not initialized');

    const fn = this.vm.getProp(this.vm.global, functionName);
    if (this.vm.typeof(fn) !== 'function') {
      fn.dispose();
      return undefined;
    }

    const handles = args.map(a => {
      if (typeof a === 'number') return this.vm!.newNumber(a);
      if (typeof a === 'string') return this.vm!.newString(a);
      return this.vm!.undefined;
    });

    const result = this.vm.callFunction(fn, this.vm.global, ...handles);
    handles.forEach(h => h.dispose());
    fn.dispose();

    if (result.error) {
      const err = this.vm.dump(result.error);
      result.error.dispose();
      throw new Error(`Sandbox call error: ${JSON.stringify(err)}`);
    }

    const value = this.vm.dump(result.value);
    result.value.dispose();
    return value;
  }

  registerHostFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    if (!this.vm) return;
    const pb = this.vm.getProp(this.vm.global, 'pb');

    const hostFn = this.vm.newFunction(name, (...args) => {
      const jsArgs = args.map(a => this.vm!.dump(a));
      const result = fn(...jsArgs);
      if (typeof result === 'number') return this.vm!.newNumber(result);
      if (typeof result === 'string') return this.vm!.newString(result);
      return this.vm!.undefined;
    });

    // Support dotted names: "tilemap.setTile" → pb.tilemap.setTile
    const parts = name.split('.');
    if (parts.length === 1) {
      // Flat property on pb
      this.vm.setProp(pb, name, hostFn);
    } else {
      // Walk/create intermediate namespace objects.
      // Track all intermediate handles so we can dispose them after setting
      // the final property. We must NOT dispose a handle while it's still
      // being used as `parent`.
      let parent = pb;
      const intermediates: QuickJSHandle[] = [];

      for (let i = 0; i < parts.length - 1; i++) {
        const existing = this.vm.getProp(parent, parts[i]);
        if (this.vm.typeof(existing) === 'object') {
          // Namespace already exists — advance into it
          parent = existing;
          intermediates.push(existing);
        } else {
          // Create new namespace object
          existing.dispose();
          const ns = this.vm.newObject();
          this.vm.setProp(parent, parts[i], ns);
          parent = ns;
          intermediates.push(ns);
        }
      }

      this.vm.setProp(parent, parts[parts.length - 1], hostFn);

      // Dispose intermediate handles (they're refs to objects that live in
      // the VM, so disposing the handle is safe — the object persists).
      for (const h of intermediates) {
        h.dispose();
      }
    }

    hostFn.dispose();
    pb.dispose();
  }

  dispose(): void {
    if (this.tickFnHandle) {
      this.tickFnHandle.dispose();
      this.tickFnHandle = null;
    }
    if (this.vm) {
      this.vm.dispose();
      this.vm = null;
    }
  }
}
