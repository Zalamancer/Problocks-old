import { Toolbar } from './Toolbar';
import { ExplorerPanel } from './ExplorerPanel';
import { Viewport } from './Viewport';
import { PropertiesPanel } from './PropertiesPanel';
import { ScriptEditor } from './ScriptEditor';
import { MarketplaceView } from './MarketplaceView';
import { useStudio } from '@/store/studio-store';

/**
 * Main studio layout — similar to Roblox Studio:
 * ┌─────────────────────────────────────────────┐
 * │                  Toolbar                     │
 * ├──────┬──────────────────────────┬────────────┤
 * │      │                          │            │
 * │ Expl │       3D Viewport        │ Properties │
 * │ orer │                          │   Panel    │
 * │      │                          │            │
 * │      ├──────────────────────────┤            │
 * │      │     Script Editor        │            │
 * └──────┴──────────────────────────┴────────────┘
 *
 * When marketplace is open, panels swap to:
 * ┌──────┬──────────────────────────┬────────────┐
 * │ Cate │    Simulation Grid       │  Details   │
 * │ gory │                          │   Panel    │
 * └──────┴──────────────────────────┴────────────┘
 */
export function StudioLayout() {
  const { marketplaceOpen } = useStudio();

  return (
    <div className="flex h-full flex-col bg-background">
      <Toolbar />
      {marketplaceOpen ? (
        <MarketplaceView />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Explorer — fixed width */}
          <div className="w-[220px] shrink-0 overflow-hidden">
            <ExplorerPanel />
          </div>

          {/* Center: Viewport + Script Editor */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Viewport — takes remaining space */}
            <div className="flex-1 overflow-hidden">
              <Viewport />
            </div>
            {/* Script Editor — fixed height */}
            <div className="h-[280px] shrink-0 overflow-hidden">
              <ScriptEditor />
            </div>
          </div>

          {/* Right: Properties — fixed width */}
          <div className="w-[280px] shrink-0 overflow-hidden">
            <PropertiesPanel />
          </div>
        </div>
      )}
    </div>
  );
}
