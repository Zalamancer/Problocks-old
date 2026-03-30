import { useState, useMemo } from 'react';
import { useStudio } from '@/store/studio-store';
import { PanelSection, PanelSlider, PanelInput, PanelToggle, PanelColorSwatches } from '@/components/ui/panel-controls';
import { getTerrainPresets, saveTerrainPreset, BUILT_IN_PRESETS } from '@/store/storage';
import { getBiomeIds } from '@problocks/engine';
import { cn } from '@/lib/utils';

const BIOME_COLORS: Record<string, string> = {
  arctic: '#C3C7DA', dunes: '#8F7E5F', canyons: '#895A47', lavascape: '#E89C4A',
  water: '#0C545C', mountains: '#666C6F', hills: '#6A7F3F', plains: '#6A7F3F', marsh: '#3A2E24',
};

function VoxelBiomeSection({ entity, updateEntity }: {
  entity: { id: string; terrain?: import('@/store/studio-store').TerrainConfig };
  updateEntity: (id: string, partial: Partial<import('@/store/studio-store').EntityData>) => void;
}) {
  const biomeIds = useMemo(() => getBiomeIds(), []);
  const selected = new Set(entity.terrain?.biomes ?? ['hills', 'plains']);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateEntity(entity.id, { terrain: { ...entity.terrain!, biomes: Array.from(next) } });
  };

  return (
    <PanelSection title="Biomes" collapsible>
      <div className="grid grid-cols-3 gap-1">
        {biomeIds.map((id) => {
          const checked = selected.has(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors text-[11px]',
                checked ? 'bg-green-500/10 text-green-400' : 'text-zinc-400 hover:bg-white/[0.06]',
              )}
            >
              <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: BIOME_COLORS[id] ?? '#888' }} />
              {id}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function PropertiesPanel() {
  const { entities, selectedEntityId, updateEntity } = useStudio();
  const entity = entities.find((e) => e.id === selectedEntityId);
  const [presets, setPresets] = useState(() => getTerrainPresets());
  const builtInNames = new Set(BUILT_IN_PRESETS.map(p => p.name));

  return (
    <aside className="w-[320px] flex-shrink-0 overflow-visible">
      <div className="h-full flex flex-col bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Panel header */}
        <div className="shrink-0 min-h-[49px] px-4 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-zinc-200">Properties</span>
          {entity && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
              {entity.name}
            </span>
          )}
        </div>

        {/* Panel body */}
        {!entity ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[13px] text-zinc-500">Select an entity</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* General */}
            <PanelSection title="General" collapsible>
              <PanelInput
                label="Name"
                value={entity.name}
                onChange={(v) => updateEntity(entity.id, { name: v })}
              />
            </PanelSection>

            {/* Transform */}
            <PanelSection title="Transform" collapsible>
              {/* Position: label + X Y Z inline pills */}
              <div className="flex items-center gap-3 mb-1">
                <span className="text-gray-400 text-sm shrink-0 w-16">Position</span>
                <div className="flex-1 flex gap-1.5">
                  <PanelSlider label="" value={entity.position.x} onChange={(v) => updateEntity(entity.id, { position: { ...entity.position, x: v } })} min={-50} max={50} step={0.1} precision={2} inline className="flex-1" />
                  <PanelSlider label="" value={entity.position.y} onChange={(v) => updateEntity(entity.id, { position: { ...entity.position, y: v } })} min={-50} max={50} step={0.1} precision={2} inline className="flex-1" />
                  <PanelSlider label="" value={entity.position.z} onChange={(v) => updateEntity(entity.id, { position: { ...entity.position, z: v } })} min={-50} max={50} step={0.1} precision={2} inline className="flex-1" />
                </div>
              </div>

              {/* Rotation: label + X Y Z inline pills */}
              <div className="flex items-center gap-3 mb-1">
                <span className="text-gray-400 text-sm shrink-0 w-16">Rotation</span>
                <div className="flex-1 flex gap-1.5">
                  <PanelSlider label="" value={entity.rotation.x} onChange={(v) => updateEntity(entity.id, { rotation: { ...entity.rotation, x: v } })} min={-180} max={180} step={1} precision={1} inline className="flex-1" />
                  <PanelSlider label="" value={entity.rotation.y} onChange={(v) => updateEntity(entity.id, { rotation: { ...entity.rotation, y: v } })} min={-180} max={180} step={1} precision={1} inline className="flex-1" />
                  <PanelSlider label="" value={entity.rotation.z} onChange={(v) => updateEntity(entity.id, { rotation: { ...entity.rotation, z: v } })} min={-180} max={180} step={1} precision={1} inline className="flex-1" />
                </div>
              </div>

              {/* Scale: label + X Y Z inline pills */}
              <div className="flex items-center gap-3 mb-1">
                <span className="text-gray-400 text-sm shrink-0 w-16">Scale</span>
                <div className="flex-1 flex gap-1.5">
                  <PanelSlider label="" value={entity.scale.x} onChange={(v) => updateEntity(entity.id, { scale: { ...entity.scale, x: v } })} min={0.1} max={10} step={0.1} precision={2} inline className="flex-1" />
                  <PanelSlider label="" value={entity.scale.y} onChange={(v) => updateEntity(entity.id, { scale: { ...entity.scale, y: v } })} min={0.1} max={10} step={0.1} precision={2} inline className="flex-1" />
                  <PanelSlider label="" value={entity.scale.z} onChange={(v) => updateEntity(entity.id, { scale: { ...entity.scale, z: v } })} min={0.1} max={10} step={0.1} precision={2} inline className="flex-1" />
                </div>
              </div>
            </PanelSection>

            {/* Mesh */}
            {entity.shape && (
              <PanelSection title="Mesh" collapsible>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-gray-400 text-sm w-20 shrink-0">Shape</span>
                  <div className="flex-1 bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg opacity-60">
                    {entity.shape}
                  </div>
                </div>
                <PanelColorSwatches
                  label="Color"
                  value={entity.color ?? '#ffffff'}
                  onChange={(v) => updateEntity(entity.id, { color: v })}
                />
              </PanelSection>
            )}

            {/* Physics / RigidBody */}
            {entity.physics && (
              <PanelSection title="RigidBody" collapsible>
                <PanelSlider
                  label="Mass"
                  value={entity.physics.mass}
                  onChange={(v) => updateEntity(entity.id, { physics: { ...entity.physics!, mass: v } })}
                  min={0}
                  max={100}
                  step={0.1}
                  precision={2}
                />
                <PanelSlider
                  label="Friction"
                  value={entity.physics.friction}
                  onChange={(v) => updateEntity(entity.id, { physics: { ...entity.physics!, friction: v } })}
                  min={0}
                  max={1}
                  step={0.01}
                  precision={2}
                />
                <PanelSlider
                  label="Bounce"
                  value={entity.physics.restitution}
                  onChange={(v) => updateEntity(entity.id, { physics: { ...entity.physics!, restitution: v } })}
                  min={0}
                  max={1}
                  step={0.01}
                  precision={2}
                />
                <PanelToggle
                  label="Static"
                  checked={entity.physics.isStatic}
                  onChange={(v) => updateEntity(entity.id, { physics: { ...entity.physics!, isStatic: v } })}
                  description="Fixed in place"
                />
              </PanelSection>
            )}

            {/* Terrain Presets */}
            {entity.terrain && (
              <PanelSection title="Presets" collapsible>
                <div className="space-y-2">
                  <select
                    className="w-full bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg border border-white/10"
                    value=""
                    onChange={(e) => {
                      const preset = presets.find(p => p.name === e.target.value);
                      if (preset) updateEntity(entity.id, { terrain: { ...preset.terrain } });
                    }}
                  >
                    <option value="" disabled>Load preset...</option>
                    <optgroup label="Built-in">
                      {presets.filter(p => builtInNames.has(p.name)).map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </optgroup>
                    {presets.some(p => !builtInNames.has(p.name)) && (
                      <optgroup label="My Presets">
                        {presets.filter(p => !builtInNames.has(p.name)).map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    onClick={() => {
                      const name = window.prompt('Preset name:');
                      if (name && entity.terrain) {
                        saveTerrainPreset({ name, terrain: { ...entity.terrain } });
                        setPresets(getTerrainPresets());
                      }
                    }}
                  >
                    Save As Preset
                  </button>
                </div>
              </PanelSection>
            )}

            {/* Terrain Mode Toggle */}
            {entity.terrain && (
              <PanelSection title="Terrain Mode" collapsible>
                <div className="flex items-center gap-1 bg-[#2a2a2a] rounded-lg p-0.5">
                  <button
                    onClick={() => updateEntity(entity.id, { terrain: { ...entity.terrain!, mode: 'heightmap' } })}
                    className={cn(
                      'flex-1 text-[12px] py-1.5 rounded-md transition-colors',
                      (entity.terrain.mode ?? 'heightmap') === 'heightmap'
                        ? 'bg-zinc-600 text-zinc-100 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    Heightmap
                  </button>
                  <button
                    onClick={() => updateEntity(entity.id, { terrain: { ...entity.terrain!, mode: 'voxel' } })}
                    className={cn(
                      'flex-1 text-[12px] py-1.5 rounded-md transition-colors',
                      entity.terrain.mode === 'voxel'
                        ? 'bg-green-600/80 text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    Voxel
                  </button>
                </div>
              </PanelSection>
            )}

            {/* Heightmap Terrain */}
            {entity.terrain && (entity.terrain.mode ?? 'heightmap') === 'heightmap' && (
              <>
                <PanelSection title="Terrain" collapsible>
                  <PanelSlider
                    label="Max Height"
                    value={entity.terrain.maxHeight}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, maxHeight: v } })}
                    min={1}
                    max={50}
                    step={0.5}
                    precision={1}
                  />
                  <PanelSlider
                    label="Noise Scale"
                    value={entity.terrain.noiseScale}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, noiseScale: v } })}
                    min={0.005}
                    max={0.15}
                    step={0.001}
                    precision={3}
                  />
                  <PanelSlider
                    label="Octaves"
                    value={entity.terrain.octaves}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, octaves: Math.round(v) } })}
                    min={1}
                    max={10}
                    step={1}
                    precision={0}
                  />
                  <PanelSlider
                    label="Width"
                    value={entity.terrain.width}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, width: v } })}
                    min={20}
                    max={500}
                    step={10}
                    precision={0}
                  />
                  <PanelSlider
                    label="Depth"
                    value={entity.terrain.depth}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, depth: v } })}
                    min={20}
                    max={500}
                    step={10}
                    precision={0}
                  />
                </PanelSection>

                <PanelSection title="Randomize" collapsible>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-16 shrink-0">Seed</span>
                    <div className="flex-1 bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg">
                      {entity.terrain.seed}
                    </div>
                  </div>
                  <button
                    className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                    onClick={() => updateEntity(entity.id, {
                      terrain: { ...entity.terrain!, seed: Math.floor(Math.random() * 100000) },
                    })}
                  >
                    Randomize Terrain
                  </button>
                </PanelSection>
              </>
            )}

            {/* Voxel Terrain */}
            {entity.terrain && entity.terrain.mode === 'voxel' && (
              <>
                <PanelSection title="Region" collapsible>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Min X</span>
                      <PanelSlider label="" value={entity.terrain.minX ?? -128} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, minX: v } })} min={-512} max={0} step={16} precision={0} inline className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Max X</span>
                      <PanelSlider label="" value={entity.terrain.maxX ?? 128} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, maxX: v } })} min={0} max={512} step={16} precision={0} inline className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Min Y</span>
                      <PanelSlider label="" value={entity.terrain.minY ?? -32} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, minY: v } })} min={-256} max={0} step={16} precision={0} inline className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Max Y</span>
                      <PanelSlider label="" value={entity.terrain.maxY ?? 64} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, maxY: v } })} min={0} max={512} step={16} precision={0} inline className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Min Z</span>
                      <PanelSlider label="" value={entity.terrain.minZ ?? -128} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, minZ: v } })} min={-512} max={0} step={16} precision={0} inline className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px] w-10 shrink-0">Max Z</span>
                      <PanelSlider label="" value={entity.terrain.maxZ ?? 128} onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, maxZ: v } })} min={0} max={512} step={16} precision={0} inline className="flex-1" />
                    </div>
                  </div>
                </PanelSection>

                <VoxelBiomeSection entity={entity} updateEntity={updateEntity} />

                <PanelSection title="Settings" collapsible>
                  <PanelSlider
                    label="Biome Size"
                    value={entity.terrain.biomeSize ?? 120}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, biomeSize: v } })}
                    min={50}
                    max={500}
                    step={10}
                    precision={0}
                  />
                  <PanelSlider
                    label="Blending"
                    value={entity.terrain.blending ?? 0.3}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, blending: v } })}
                    min={0}
                    max={1}
                    step={0.05}
                    precision={2}
                  />
                  <PanelToggle
                    label="Caves"
                    checked={entity.terrain.caves ?? true}
                    onChange={(v) => updateEntity(entity.id, { terrain: { ...entity.terrain!, caves: v } })}
                    description="Carve procedural caves"
                  />
                </PanelSection>

                <PanelSection title="Seed" collapsible>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-16 shrink-0">Seed</span>
                    <div className="flex-1 bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg">
                      {entity.terrain.seed}
                    </div>
                  </div>
                  <button
                    className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                    onClick={() => updateEntity(entity.id, {
                      terrain: { ...entity.terrain!, seed: Math.floor(Math.random() * 100000) },
                    })}
                  >
                    Randomize Seed
                  </button>
                </PanelSection>

                <button
                  className="w-full rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-500 transition-colors"
                  onClick={() => {
                    // Force terrain recreation by bumping seed then restoring
                    const t = entity.terrain!;
                    updateEntity(entity.id, { terrain: { ...t, seed: t.seed } });
                  }}
                >
                  Generate Voxel Terrain
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
