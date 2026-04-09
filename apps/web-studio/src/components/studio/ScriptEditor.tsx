import { useRef, useCallback, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCode, X, Play, Square, Terminal, Trash2, Wand2 } from 'lucide-react';
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

const DUNGEON_DEMO_CODE = `// Dungeon Alchemist Demo — Problocks Engine
// Generates a procedural dungeon, auto-furnishes rooms,
// sets up lighting, and demos pathfinding.
//
// Switch to Tilemap viewport (Tile button), then hit Run!
// Try changing SEED or SPLIT_DEPTH for different layouts.

var DUNGEON_WIDTH  = 40;
var DUNGEON_HEIGHT = 30;
var SEED           = 42;
var MIN_ROOM_SIZE  = 5;
var MAX_ROOM_SIZE  = 12;
var SPLIT_DEPTH    = 5;
var CORRIDOR_WIDTH = 2;

// Furniture tile IDs (rendered as distinct colors)
var TILE_TABLE = 10, TILE_CHAIR = 11, TILE_CHEST = 12;
var TILE_BED = 13, TILE_BOOKCASE = 14, TILE_BARREL = 15;
var TILE_TORCH = 16, TILE_RUG = 17;

// Simple seeded RNG for furniture placement
var _rngState = SEED;
function seededRandom() {
  _rngState = (_rngState * 1664525 + 1013904223) & 0x7fffffff;
  return _rngState / 0x7fffffff;
}
function randomInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function canPlace(tileMap, x, y) {
  if (y < 0 || y >= tileMap.length) return false;
  if (x < 0 || x >= tileMap[0].length) return false;
  return tileMap[y][x] === 1;
}

function furnishRoom(room, tileMap) {
  var ix = room.x + 1, iy = room.y + 1;
  var iw = room.width - 2, ih = room.height - 2;
  if (iw < 2 || ih < 2) return;
  var area = iw * ih;

  // Torches in corners
  if (canPlace(tileMap, ix, iy))
    pb.tilemap.setTile(1, ix, iy, TILE_TORCH);
  if (canPlace(tileMap, ix + iw - 1, iy + ih - 1))
    pb.tilemap.setTile(1, ix + iw - 1, iy + ih - 1, TILE_TORCH);

  // Rug in center of larger rooms
  if (area >= 16) {
    var cx = ix + Math.floor(iw / 2);
    var cy = iy + Math.floor(ih / 2);
    for (var ry = cy - 1; ry <= cy + 1; ry++)
      for (var rx = cx - 1; rx <= cx + 1; rx++)
        if (canPlace(tileMap, rx, ry))
          pb.tilemap.setTile(1, rx, ry, TILE_RUG);
  }

  // Scatter furniture
  var types = [TILE_TABLE, TILE_CHAIR, TILE_CHEST, TILE_BED, TILE_BOOKCASE, TILE_BARREL];
  var count = Math.min(Math.floor(area / 6), 8);
  for (var i = 0; i < count; i++) {
    for (var a = 0; a < 5; a++) {
      var fx = ix + randomInt(0, iw - 1);
      var fy = iy + randomInt(0, ih - 1);
      if (canPlace(tileMap, fx, fy)) {
        pb.tilemap.setTile(1, fx, fy, types[randomInt(0, types.length - 1)]);
        break;
      }
    }
  }
}

function onStart() {
  pb.log("=== Dungeon Alchemist Demo ===");

  // 1. Generate dungeon
  var json = pb.procgen.generateDungeon(DUNGEON_WIDTH, DUNGEON_HEIGHT,
    JSON.stringify({ seed: SEED, minRoomSize: MIN_ROOM_SIZE,
      maxRoomSize: MAX_ROOM_SIZE, splitDepth: SPLIT_DEPTH,
      corridorWidth: CORRIDOR_WIDTH }));
  var data = JSON.parse(json);
  pb.log(data.rooms.length + " rooms, " + data.corridors.length + " corridors");

  // 2. Paint dungeon structure (layer 0)
  for (var y = 0; y < data.height; y++)
    for (var x = 0; x < data.width; x++)
      if (data.tileMap[y][x] > 0)
        pb.tilemap.setTile(0, x, y, data.tileMap[y][x]);

  // 3. Furnish rooms (layer 1)
  for (var i = 0; i < data.rooms.length; i++)
    furnishRoom(data.rooms[i], data.tileMap);

  // 4. Camera
  pb.camera.setPosition((data.width / 2) * 32, (data.height / 2) * 32);
  pb.camera.setZoom(1.5);

  // 5. Room lights
  for (var li = 0; li < data.rooms.length; li++) {
    var room = data.rooms[li];
    pb.light.add("room_" + li, JSON.stringify({
      type: "point", color: 0xffaa44, intensity: 0.8,
      radius: Math.max(room.width, room.height) * 32, falloff: 0.5
    }));
    pb.light.setPosition("room_" + li,
      (room.x + room.width / 2) * 32,
      (room.y + room.height / 2) * 32);
  }
  pb.light.setAmbient(0x111122, 0.2);

  // 6. Navigation + pathfinding demo
  for (var ny = 0; ny < data.height; ny++)
    for (var nx = 0; nx < data.width; nx++)
      if (data.tileMap[ny][nx] > 0)
        pb.nav.setWalkable(nx, ny, 1);

  if (data.rooms.length >= 2) {
    var s = data.rooms[0], e = data.rooms[data.rooms.length - 1];
    var path = JSON.parse(pb.nav.findPath(
      Math.floor(s.x + s.width / 2), Math.floor(s.y + s.height / 2),
      Math.floor(e.x + e.width / 2), Math.floor(e.y + e.height / 2)));
    if (path.length > 0) {
      pb.log("Path: " + path.length + " steps (room 0 -> room " + (data.rooms.length - 1) + ")");
      for (var pi = 0; pi < path.length; pi++)
        pb.tilemap.setTile(1, path[pi].x, path[pi].y, 20);
    }
  }

  pb.log("=== Done! Change SEED and re-run for a new dungeon ===");
}

function onTick(dt) {
  // Static demo — no per-frame updates needed
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
   */
  function createEntity(id: string, shape: string, optsJSON: string): void;
  function removeEntity(id: string): void;
  function applyForce(id: string, fx: number, fy: number, fz: number): void;
  function applyImpulse(id: string, ix: number, iy: number, iz: number): void;
  function getPosition(id: string): string;
  function getVelocity(id: string): string;

  namespace tilemap {
    /** Set a tile at (x,y) on the given layer. 0 = empty. */
    function setTile(layer: number, x: number, y: number, tileId: number): void;
    function getTile(layer: number, x: number, y: number): number;
    function getMapSize(): string;
    function getTileSize(): string;
    function setTileRegion(layer: number, x: number, y: number, w: number, h: number, tileId: number): void;
  }

  namespace camera {
    function setPosition(x: number, y: number): void;
    function getPosition(): string;
    function setZoom(zoom: number): void;
    function getZoom(): number;
    function shake(intensity: number, duration: number): void;
  }

  namespace light {
    /** Add a point/spot light. configJSON: { type, color, intensity, radius, falloff } */
    function add(id: string, configJSON: string): void;
    function remove(id: string): void;
    function setPosition(id: string, x: number, y: number): void;
    function setIntensity(id: string, intensity: number): void;
    function setColor(id: string, color: number): void;
    function setAmbient(color: number, intensity: number): void;
  }

  namespace nav {
    /** Find A* path, returns JSON array of {x,y} */
    function findPath(x1: number, y1: number, x2: number, y2: number): string;
    function hasLineOfSight(x1: number, y1: number, x2: number, y2: number): number;
    function isWalkable(x: number, y: number): number;
    function setWalkable(x: number, y: number, walkable: number): void;
  }

  namespace procgen {
    /** Generate a BSP dungeon. Returns JSON with rooms, corridors, tileMap. */
    function generateDungeon(width: number, height: number, optionsJSON?: string): string;
    function noise2D(x: number, y: number, seed?: number): number;
    function poissonDisk(width: number, height: number, minDist: number, seed?: number): string;
  }

  namespace input {
    function isKeyDown(key: string): number;
    function isKeyPressed(key: string): number;
    function getMousePosition(): string;
    function isMouseDown(button: number): number;
  }

  namespace ai {
    function addFSM(entityId: string, configJSON: string): void;
    function removeFSM(entityId: string): void;
    function getFSMState(entityId: string): string;
    function setBlackboard(entityId: string, key: string, valueJSON: string): void;
    function getBlackboard(entityId: string, key: string): string;
  }

  namespace audio {
    function playSound(url: string, optionsJSON?: string): string;
    function stopSound(id: string): void;
    function playMusic(url: string, optionsJSON?: string): void;
    function stopMusic(fadeOut?: number): void;
  }

  namespace prefab {
    function spawn(prefabId: string, x: number, y: number, z?: number, overridesJSON?: string): string;
    function destroy(instanceId: string): void;
    function list(): string;
  }
}

declare function parseVec3(s: string): { x: number; y: number; z: number };
declare function onStart(): void;
declare function onTick(dt: number): void;
`;

export function ScriptEditor() {
  const { isPlaying, scriptRunning, consoleLogs, runScript, stopScript, clearLogs, viewportMode, setViewportMode, setLeftPanelGroup } = useStudio();
  const editorRef = useRef<any>(null);
  const [showConsole, setShowConsole] = useState(true);

  const handleRun = useCallback(() => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();
    runScript(code);
  }, [runScript]);

  const handleLoadDemo = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.setValue(DUNGEON_DEMO_CODE);
    // Auto-switch to tilemap viewport
    setViewportMode('tilemap');
    setLeftPanelGroup('tilemap');
  }, [setViewportMode, setLeftPanelGroup]);

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
          className="mr-1 h-6 gap-1 text-[10px] text-purple-400 hover:text-purple-200"
          onClick={handleLoadDemo}
          title="Load the Dungeon Alchemist demo script"
        >
          <Wand2 className="h-3 w-3" /> Dungeon Demo
        </Button>

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
