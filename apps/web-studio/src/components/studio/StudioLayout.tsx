import { TopMenuBar } from './TopMenuBar';
import { LeftPanel, LeftPanelToggle } from './LeftPanel';
import { Viewport } from './Viewport';
import { PropertiesPanel } from './PropertiesPanel';
import { ScriptEditor } from './ScriptEditor';
import { useStudio } from '@/store/studio-store';

/**
 * Main studio layout — AutoAnimation-style 3-panel glass design:
 * ┌─────────────────────────────────────────────────────┐
 * │                   TopMenuBar                        │
 * ├──────────┬────────────────────────────┬─────────────┤
 * │          │                            │             │
 * │  Left    │       3D Viewport          │  Properties │
 * │  Panel   │                            │   Panel     │
 * │          ├────────────────────────────┤             │
 * │          │     Script Editor          │             │
 * └──────────┴────────────────────────────┴─────────────┘
 *
 * - Outer: bg-zinc-950, p-1.5, gap-1.5
 * - All panels: glass-morphism (bg-zinc-900/80 backdrop-blur-xl rounded-xl)
 * - Left panel collapsible with toggle pill
 */
export function StudioLayout() {
  const { marketplaceOpen } = useStudio();

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 overflow-hidden text-zinc-100 font-sans p-1.5 gap-1.5">
      {/* Top menu bar */}
      <TopMenuBar />

      {/* Main content area */}
      <div className="flex-1 relative min-h-0">
        <div className="h-full flex overflow-hidden gap-1.5">
          {/* Left Panel */}
          <LeftPanel />

          {/* Center — Viewport + Script Editor stacked */}
          <div className="flex-1 flex flex-col overflow-hidden gap-1.5">
            {/* Viewport */}
            <div className="flex-1 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
              <Viewport />
            </div>
            {/* Script Editor */}
            <div className="h-[280px] shrink-0 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
              <ScriptEditor />
            </div>
          </div>

          {/* Right Panel — Properties */}
          <PropertiesPanel />
        </div>

        {/* Toggle pill — outside overflow-hidden, overlaps via absolute positioning */}
        <LeftPanelToggle />
      </div>
    </div>
  );
}
