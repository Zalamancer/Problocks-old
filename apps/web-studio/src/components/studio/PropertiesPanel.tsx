import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useStudio } from '@/store/studio-store';

export function PropertiesPanel() {
  const { entities, selectedEntityId, updateEntity } = useStudio();
  const entity = entities.find(e => e.id === selectedEntityId);

  if (!entity) {
    return (
      <div className="flex h-full flex-col border-l bg-card">
        <div className="flex items-center border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Properties
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <span className="text-sm text-muted-foreground">Select an entity</span>
        </div>
      </div>
    );
  }

  const updatePos = (axis: 'x' | 'y' | 'z', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    updateEntity(entity.id, { position: { ...entity.position, [axis]: num } });
  };

  const updateRot = (axis: 'x' | 'y' | 'z', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    updateEntity(entity.id, { rotation: { ...entity.rotation, [axis]: num } });
  };

  const updateScale = (axis: 'x' | 'y' | 'z', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    updateEntity(entity.id, { scale: { ...entity.scale, [axis]: num } });
  };

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Properties
        </span>
        <Badge variant="outline" className="text-[10px]">
          {entity.name}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-3">
        {/* Name */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Name
          </label>
          <Input
            value={entity.name}
            onChange={e => updateEntity(entity.id, { name: e.target.value })}
            className="h-7 text-sm"
          />
        </div>

        <Separator className="my-3" />

        {/* Transform — Position */}
        <div className="mb-3">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Transform</h4>
          <label className="mb-1 block text-[10px] text-muted-foreground">Position</label>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="mb-0.5 block text-[10px] text-red-400">X</label>
              <Input
                value={entity.position.x.toFixed(2)}
                onChange={e => updatePos('x', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-green-400">Y</label>
              <Input
                value={entity.position.y.toFixed(2)}
                onChange={e => updatePos('y', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-blue-400">Z</label>
              <Input
                value={entity.position.z.toFixed(2)}
                onChange={e => updatePos('z', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>

          <label className="mb-1 mt-2 block text-[10px] text-muted-foreground">Rotation</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['x', 'y', 'z'] as const).map(axis => (
              <Input
                key={axis}
                value={entity.rotation[axis].toFixed(2)}
                onChange={e => updateRot(axis, e.target.value)}
                className="h-7 text-xs"
              />
            ))}
          </div>

          <label className="mb-1 mt-2 block text-[10px] text-muted-foreground">Scale</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['x', 'y', 'z'] as const).map(axis => (
              <Input
                key={axis}
                value={entity.scale[axis].toFixed(2)}
                onChange={e => updateScale(axis, e.target.value)}
                className="h-7 text-xs"
              />
            ))}
          </div>
        </div>

        {entity.shape && (
          <>
            <Separator className="my-3" />
            <div className="mb-3">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Mesh</h4>
              <div className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted-foreground">Shape</label>
                  <Input value={entity.shape} className="h-7 text-xs" disabled />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted-foreground">Color</label>
                  <div className="flex gap-1.5">
                    <div
                      className="h-7 w-7 rounded border"
                      style={{ backgroundColor: entity.color ?? '#fff' }}
                    />
                    <Input
                      value={entity.color ?? '#ffffff'}
                      onChange={e => updateEntity(entity.id, { color: e.target.value })}
                      className="h-7 flex-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {entity.physics && (
          <>
            <Separator className="my-3" />
            <div className="mb-3">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">RigidBody</h4>
              <div className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted-foreground">Mass</label>
                  <Input
                    value={entity.physics.mass.toFixed(2)}
                    onChange={e => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num)) {
                        updateEntity(entity.id, { physics: { ...entity.physics!, mass: num } });
                      }
                    }}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">Friction</label>
                    <Input
                      value={entity.physics.friction.toFixed(2)}
                      onChange={e => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) {
                          updateEntity(entity.id, { physics: { ...entity.physics!, friction: num } });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">Restitution</label>
                    <Input
                      value={entity.physics.restitution.toFixed(2)}
                      onChange={e => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) {
                          updateEntity(entity.id, { physics: { ...entity.physics!, restitution: num } });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="static"
                    checked={entity.physics.isStatic}
                    onChange={e => {
                      updateEntity(entity.id, { physics: { ...entity.physics!, isStatic: e.target.checked } });
                    }}
                    className="rounded"
                  />
                  <label htmlFor="static" className="text-xs text-muted-foreground">Static</label>
                </div>
              </div>
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
