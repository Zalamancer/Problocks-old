import { useStudio } from '@/store/studio-store';
import { PanelSection, PanelSlider, PanelInput, PanelToggle, PanelColorSwatches } from '@/components/ui/panel-controls';

export function PropertiesPanel() {
  const { entities, selectedEntityId, updateEntity } = useStudio();
  const entity = entities.find((e) => e.id === selectedEntityId);

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

            {/* Transform — PartTransformControls layout: label w-16 + inline pills in a row */}
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

            {/* Terrain */}
            {entity.terrain && (
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
          </div>
        )}
      </div>
    </aside>
  );
}
