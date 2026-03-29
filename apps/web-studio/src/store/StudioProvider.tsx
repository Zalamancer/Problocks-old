import { useState, useCallback, useRef, type ReactNode } from 'react';
import { StudioContext, DEFAULT_ENTITIES, type EntityData } from './studio-store';
import type { SimulationLoop } from '@problocks/engine/core/simulation-loop';
import type { QuickJSRuntime } from '@problocks/engine/scripting/quickjs-runtime';

export function StudioProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<EntityData[]>(DEFAULT_ENTITIES);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('ball');
  const [isPlaying, setIsPlaying] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const simRef = useRef<SimulationLoop | null>(null);
  const sandboxRef = useRef<QuickJSRuntime | null>(null);

  const selectEntity = useCallback((id: string | null) => {
    setSelectedEntityId(id);
  }, []);

  const updateEntity = useCallback((id: string, partial: Partial<EntityData>) => {
    setEntities(prev => prev.map(e => (e.id === id ? { ...e, ...partial } : e)));
  }, []);

  const addEntity = useCallback((entity: EntityData) => {
    setEntities(prev => [...prev, entity]);
    if (simRef.current && entity.shape) {
      simRef.current.createEntity(entity.id, entity.shape, {
        width: entity.dimensions?.width,
        height: entity.dimensions?.height,
        depth: entity.dimensions?.depth,
        radius: entity.shape === 'sphere' ? (entity.dimensions?.width ?? 1) / 2 : undefined,
        color: entity.color,
        position: entity.position,
        mass: entity.physics?.mass ?? 1,
        isStatic: entity.physics?.isStatic ?? false,
        friction: entity.physics?.friction ?? 0.5,
        restitution: entity.physics?.restitution ?? 0.3,
      });
    }
  }, []);

  const removeEntity = useCallback((id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    if (simRef.current) simRef.current.removeEntity(id);
  }, []);

  const toggleMarketplace = useCallback(() => {
    setMarketplaceOpen(prev => !prev);
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (simRef.current) {
      if (playing) simRef.current.start();
      else simRef.current.stop();
    }
  }, []);

  const addLog = useCallback((msg: string) => {
    setConsoleLogs(prev => [...prev.slice(-99), msg]);
  }, []);

  const clearLogs = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const runScript = useCallback(async (code: string) => {
    // Get sim from viewport (registered on window)
    const sim = (window as any).__problocks_sim;
    if (!sim) {
      addLog('[error] Engine not ready — wait for viewport to load');
      return;
    }
    simRef.current = sim;

    // Intercept console.log from sandbox
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (msg.startsWith('[sandbox]')) {
        addLog(msg.replace('[sandbox] ', ''));
      }
      origLog(...args);
    };

    try {
      addLog('--- Script started ---');
      setScriptRunning(true);

      // Create new sandbox if needed
      if (sandboxRef.current) {
        sandboxRef.current.dispose();
      }

      const { QuickJSRuntime } = await import('@problocks/engine/scripting/quickjs-runtime');
      const sandbox = new QuickJSRuntime();
      await sandbox.init({ maxFrameMs: 100, maxMemoryBytes: 10 * 1024 * 1024, maxApiCallsPerSec: 60 });
      sandbox.bindSimulation(simRef.current);
      sandboxRef.current = sandbox;

      // Load and execute the student code
      await sandbox.loadSimulation(code);

      // Wire tick
      simRef.current.onFrame((dt) => {
        if (sandboxRef.current) sandboxRef.current.callTick(dt);
      });

      // Auto-start physics
      simRef.current.start();
      setIsPlaying(true);

      addLog('--- Script running (physics started) ---');
    } catch (err: any) {
      addLog(`[error] ${err.message}`);
      setScriptRunning(false);
    } finally {
      console.log = origLog;
    }
  }, [addLog]);

  const stopScript = useCallback(() => {
    if (sandboxRef.current) {
      sandboxRef.current.dispose();
      sandboxRef.current = null;
    }
    if (simRef.current) {
      simRef.current.stop();
      simRef.current.onFrame(() => {}); // clear tick callback
    }
    setScriptRunning(false);
    setIsPlaying(false);
    addLog('--- Script stopped ---');
  }, [addLog]);

  const value = {
    entities,
    selectedEntityId,
    isPlaying,
    consoleLogs,
    scriptRunning,
    marketplaceOpen,
    selectEntity,
    updateEntity,
    addEntity,
    removeEntity,
    setPlaying,
    toggleMarketplace,
    runScript,
    stopScript,
    addLog,
    clearLogs,
    _simRef: simRef,
  };

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}
