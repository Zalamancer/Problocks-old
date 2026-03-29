import { useRef, useCallback, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCode, X, Play, Square, Terminal, Trash2 } from 'lucide-react';
import { useStudio } from '@/store/studio-store';

const DEFAULT_CODE = `// Physics Simulation — main.ts
// Runs inside QuickJS WASM sandbox
// Available: pb.createEntity, pb.applyForce, pb.getPosition, pb.log, parseVec3

var time = 0;

function onStart() {
  pb.log("=== Physics Simulation Started ===");

  pb.createEntity("ball", "sphere", JSON.stringify({
    radius: 0.5,
    position: { x: 0, y: 5, z: 0 },
    mass: 1.0,
    color: "#ff4444",
    restitution: 0.6,
  }));

  pb.createEntity("ramp", "box", JSON.stringify({
    width: 4, height: 0.2, depth: 2,
    position: { x: -2, y: 2, z: 0 },
    isStatic: true,
    color: "#4488ff",
  }));
}

function onTick(dt) {
  time += dt;
  var pos = parseVec3(pb.getPosition("ball"));

  if (pos.y < -10) {
    pb.removeEntity("ball");
    pb.createEntity("ball", "sphere", JSON.stringify({
      radius: 0.5,
      position: { x: 0, y: 8, z: 0 },
      mass: 1.0,
      color: "#ff4444",
      restitution: 0.6,
    }));
    pb.log("Ball reset!");
  }
}
`;

/** Type definitions for the Problocks sandbox API — gives IntelliSense */
const PB_TYPE_DEFS = `
declare namespace pb {
  /** Log a message to the console */
  function log(...args: any[]): void;

  /**
   * Create a 3D entity in the scene.
   * @param id - Unique identifier for the entity
   * @param shape - "box" | "sphere" | "cylinder"
   * @param optsJSON - JSON string with entity options
   * @example
   * pb.createEntity("ball", "sphere", JSON.stringify({
   *   radius: 0.5,
   *   position: { x: 0, y: 5, z: 0 },
   *   mass: 1.0,
   *   color: "#ff4444",
   *   restitution: 0.6,
   * }));
   */
  function createEntity(id: string, shape: string, optsJSON: string): void;

  /** Remove an entity from the scene */
  function removeEntity(id: string): void;

  /**
   * Apply a force to an entity.
   * @param id - Entity ID
   * @param fx - Force X component
   * @param fy - Force Y component
   * @param fz - Force Z component
   */
  function applyForce(id: string, fx: number, fy: number, fz: number): void;

  /**
   * Apply an impulse to an entity (instant velocity change).
   */
  function applyImpulse(id: string, ix: number, iy: number, iz: number): void;

  /**
   * Get entity position as "x,y,z" string. Use parseVec3() to convert.
   * @returns Position string like "1.5,3.2,0.0"
   */
  function getPosition(id: string): string;

  /**
   * Get entity velocity as "vx,vy,vz" string. Use parseVec3() to convert.
   */
  function getVelocity(id: string): string;
}

/**
 * Parse a "x,y,z" string into a vector object.
 * @example
 * var pos = parseVec3(pb.getPosition("ball"));
 * // pos.x, pos.y, pos.z
 */
declare function parseVec3(s: string): { x: number; y: number; z: number };

/**
 * Called once when the simulation starts.
 * Create your initial entities here.
 */
declare function onStart(): void;

/**
 * Called every frame with the time delta.
 * Put your game logic here.
 * @param dt - Time since last frame in seconds (~0.016 at 60fps)
 */
declare function onTick(dt: number): void;
`;

export function ScriptEditor() {
  const { isPlaying, scriptRunning, consoleLogs, runScript, stopScript, clearLogs } = useStudio();
  const editorRef = useRef<any>(null);
  const [showConsole, setShowConsole] = useState(true);

  const handleRun = useCallback(() => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();
    runScript(code);
  }, [runScript]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register Problocks SDK type definitions for IntelliSense
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: true,
    });

    // Add the Problocks API type definitions
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      PB_TYPE_DEFS,
      'problocks-sandbox.d.ts',
    );

    // Focus editor
    editor.focus();
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex h-9 items-center border-b bg-[#1e1e1e] px-1">
        <Tabs defaultValue="main" className="h-full">
          <TabsList className="h-full bg-transparent gap-0 p-0">
            <TabsTrigger
              value="main"
              className="h-full gap-1.5 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-blue-500 data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-white text-gray-500"
            >
              <FileCode className="h-3 w-3 text-green-400" />
              main.ts
              <X className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:text-white" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="mr-1 h-6 gap-1 text-[10px] text-white/70 hover:text-white"
          onClick={() => setShowConsole(!showConsole)}
        >
          <Terminal className="h-3 w-3" /> Console
          {consoleLogs.length > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 px-1.5 text-[9px]">{consoleLogs.length}</span>
          )}
        </Button>

        {scriptRunning ? (
          <Button
            size="sm"
            className="mr-1 h-6 gap-1 bg-red-600 hover:bg-red-700 text-[10px]"
            onClick={stopScript}
          >
            <Square className="h-3 w-3" /> Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="mr-1 h-6 gap-1 bg-green-600 hover:bg-green-700 text-[10px]"
            onClick={handleRun}
          >
            <Play className="h-3 w-3" /> Run
          </Button>
        )}

        <Badge className="mr-1 border-green-800 bg-green-950 text-[10px] text-green-400">
          QuickJS
        </Badge>
      </div>

      {/* Monaco Editor + Console */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className={`overflow-hidden ${showConsole ? 'flex-[2]' : 'flex-1'}`}>
          <Editor
            defaultLanguage="javascript"
            defaultValue={DEFAULT_CODE}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              fontSize: 13,
              fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Menlo, monospace",
              fontLigatures: true,
              minimap: { enabled: true, scale: 2 },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              tabSize: 2,
              automaticLayout: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              padding: { top: 8 },
              renderLineHighlight: 'gutter',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
            }}
          />
        </div>

        {/* Console output */}
        {showConsole && (
          <div className="flex flex-1 flex-col border-l border-[#333]">
            <div className="flex h-7 items-center justify-between border-b border-[#333] bg-[#1e1e1e] px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Console</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-gray-500 hover:text-white"
                onClick={clearLogs}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-[#1a1a1a] p-2 font-mono text-xs">
              {consoleLogs.length === 0 ? (
                <span className="text-gray-600">Click "Run" to execute your script...</span>
              ) : (
                consoleLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      log.startsWith('[error]')
                        ? 'text-red-400'
                        : log.startsWith('---')
                          ? 'text-blue-400'
                          : 'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
