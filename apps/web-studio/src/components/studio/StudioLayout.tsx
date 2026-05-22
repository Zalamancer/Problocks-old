import { useState, useEffect } from 'react';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { TopMenuBar } from './TopMenuBar';
import { LeftPanel, LeftPanelToggle } from './LeftPanel';
import { ViewportThree } from './ViewportThree';
import { Viewport2D } from './Viewport2D';
import { TilemapViewport } from './TilemapViewport';
import { RPGViewport } from './RPGViewport';
import { PropertiesPanel } from './PropertiesPanel';
import { AIToolPanel } from './AIToolPanel';
import { ScriptEditor } from './ScriptEditor';
import { TerminalPanel } from './Terminal';
import { ModeSelector } from './ModeSelector';
import { useStudio } from '@/store/studio-store';

/**
 * Main studio layout:
 * ┌─────────────────────────────────────────────────────┐
 * │                   TopMenuBar                        │
 * ├──────────┬────────────────────────────┬─────────────┤
 * │          │       2D/3D Viewport       │             │
 * │  Left    │                            │  Properties │
 * │  Panel   ├────────────────────────────┤   Panel     │
 * │          │  [Script] [Terminal]        │             │
 * │          │   Tabbed bottom panel      │             │
 * └──────────┴────────────────────────────┴─────────────┘
 */
export function StudioLayout() {
  useThemeEffect();
  const { gameMode, marketplaceOpen, viewportMode, selectedAITool, leftPanelActiveGroup } = useStudio();

  // Show mode selector if no game mode is chosen yet
  if (!gameMode) return <ModeSelector />;
  const showAIPanel = leftPanelActiveGroup === 'create';
  const [bottomTab, setBottomTab] = useState<'playground' | 'script' | 'terminal'>('playground');
  const [terminalFullscreen, setTerminalFullscreen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't toggle if user is typing in an input/textarea or xterm
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Cmd+1 → Playground (collapse bottom panel)
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setBottomTab('playground');
        setTerminalFullscreen(false);
        return;
      }

      // Cmd+2 → Terminal tab
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setBottomTab('terminal');
        setTerminalFullscreen(false);
        return;
      }

      // Allow backtick toggle even inside terminal (xterm uses a div)
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setTerminalFullscreen((prev) => {
          if (!prev) setBottomTab('terminal'); // auto-switch to terminal when going fullscreen
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 overflow-hidden text-zinc-100 font-sans p-1.5 gap-1.5">
      {/* Top menu bar */}
      <TopMenuBar />

      {/* Main content area */}
      <div className="flex-1 relative min-h-0">
        <div className="h-full flex overflow-hidden gap-1.5">
          {/* Left Panel */}
          <LeftPanel />

          {/* Center — Viewport + Bottom Panel stacked */}
          <div className="flex-1 flex flex-col overflow-hidden gap-1.5">
            {/* Viewport — 2D or 3D (hidden when terminal is fullscreen) */}
            {!terminalFullscreen && (
              <div className="flex-1 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
                {viewportMode === '3d' ? <ViewportThree /> : viewportMode === 'tilemap' ? <TilemapViewport /> : viewportMode === 'rpg' ? <RPGViewport /> : <Viewport2D />}
              </div>
            )}

            {/* Bottom panel — Playground / Script Editor / Terminal */}
            <div className={`${terminalFullscreen ? 'flex-1' : bottomTab === 'playground' ? '' : 'h-[280px]'} shrink-0 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden flex flex-col`}>
              {/* Tabs */}
              <div className="flex items-center h-7 border-b border-white/[0.04] shrink-0 px-1">
                {!terminalFullscreen && (
                  <button
                    onClick={() => setBottomTab('playground')}
                    className={`px-3 h-full text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                      bottomTab === 'playground'
                        ? 'text-zinc-200 border-purple-500'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    Playground
                  </button>
                )}
                {!terminalFullscreen && (
                  <button
                    onClick={() => setBottomTab('script')}
                    className={`px-3 h-full text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                      bottomTab === 'script'
                        ? 'text-zinc-200 border-green-500'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    Script
                  </button>
                )}
                <button
                  onClick={() => {
                    setBottomTab('terminal');
                    if (terminalFullscreen) setTerminalFullscreen(false);
                  }}
                  className={`px-3 h-full text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                    bottomTab === 'terminal' || terminalFullscreen
                      ? 'text-zinc-200 border-blue-500'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  Terminal
                </button>
                {terminalFullscreen && (
                  <span className="ml-2 text-[9px] text-zinc-500 font-mono">press ` to exit fullscreen</span>
                )}
              </div>

              {/* Tab content — playground has no content, panel stays collapsed */}
              {bottomTab !== 'playground' && (
                <div className="flex-1 overflow-hidden">
                  {!terminalFullscreen && (
                    <div className={bottomTab === 'script' ? 'h-full' : 'hidden'}>
                      <ScriptEditor />
                    </div>
                  )}
                  <div className={bottomTab === 'terminal' || terminalFullscreen ? 'h-full' : 'hidden'}>
                    <TerminalPanel />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — AI Tool Settings or Properties */}
          {showAIPanel ? <AIToolPanel /> : <PropertiesPanel />}
        </div>

        {/* Toggle pill */}
        <LeftPanelToggle />
      </div>
    </div>
  );
}
