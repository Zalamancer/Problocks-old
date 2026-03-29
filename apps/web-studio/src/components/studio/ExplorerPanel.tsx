import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useStudio, type EntityData } from '@/store/studio-store';
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Box,
  Circle,
  Cylinder,
  Lightbulb,
  Camera,
  FileCode,
  Folder,
  Square,
  Mountain,
} from 'lucide-react';
import { useState } from 'react';

function getEntityIcon(entity: EntityData) {
  if (entity.type === 'terrain') return <Mountain className="h-4 w-4 text-emerald-400" />;
  if (entity.type === 'light') return <Lightbulb className="h-4 w-4 text-yellow-300" />;
  if (entity.type === 'camera') return <Camera className="h-4 w-4 text-purple-400" />;
  if (entity.type === 'script') return <FileCode className="h-4 w-4 text-green-400" />;
  switch (entity.shape) {
    case 'sphere': return <Circle className="h-4 w-4" style={{ color: entity.color }} />;
    case 'cylinder': return <Cylinder className="h-4 w-4" style={{ color: entity.color }} />;
    case 'plane': return <Square className="h-4 w-4 text-gray-500" />;
    default: return <Box className="h-4 w-4" style={{ color: entity.color }} />;
  }
}

function EntityItem({ entity }: { entity: EntityData }) {
  const { selectedEntityId, selectEntity } = useStudio();
  const isSelected = selectedEntityId === entity.id;

  return (
    <div
      className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm ${
        isSelected ? 'bg-green-500/15 text-green-400' : 'text-zinc-300 hover:bg-white/[0.06]'
      }`}
      style={{ paddingLeft: '32px' }}
      onClick={() => selectEntity(entity.id)}
    >
      {getEntityIcon(entity)}
      <span className="truncate">{entity.name}</span>
    </div>
  );
}

function FolderItem({ label, icon, children, defaultOpen = true }: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-sm text-zinc-300 hover:bg-white/[0.06]"
        style={{ paddingLeft: '16px' }}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
        )}
        {icon}
        <span>{label}</span>
      </div>
      {open && children}
    </div>
  );
}

export function ExplorerPanel() {
  const { entities } = useStudio();
  const terrainEntity = entities.find(e => e.type === 'terrain');
  const sceneEntities = entities.filter(e => e.type === 'entity');

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-1">
        {/* World root */}
        <div className="flex items-center gap-1 rounded-sm px-1 py-1 text-sm">
          <ChevronDown className="h-3 w-3 text-zinc-500" />
          <Globe className="h-4 w-4 text-blue-400" />
          <span className="font-medium">World</span>
        </div>

        {/* Terrain */}
        {terrainEntity && <EntityItem entity={terrainEntity} />}

        <FolderItem
          label="Scene"
          icon={<Folder className="h-4 w-4 text-yellow-400" />}
        >
          {sceneEntities.map(e => (
            <EntityItem key={e.id} entity={e} />
          ))}
        </FolderItem>

        <FolderItem
          label="Lighting"
          icon={<Folder className="h-4 w-4 text-yellow-400" />}
        >
          <div className="flex items-center gap-1.5 px-2 py-1 text-sm" style={{ paddingLeft: '32px' }}>
            <Lightbulb className="h-4 w-4 text-yellow-300" />
            <span className="text-zinc-500">Hemisphere Light</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-sm" style={{ paddingLeft: '32px' }}>
            <Lightbulb className="h-4 w-4 text-orange-300" />
            <span className="text-zinc-500">Directional Light</span>
          </div>
        </FolderItem>

        <div className="flex items-center gap-1.5 px-2 py-1 text-sm" style={{ paddingLeft: '16px' }}>
          <Camera className="h-4 w-4 text-purple-400" />
          <span className="text-zinc-500">Camera</span>
        </div>

        <FolderItem
          label="Scripts"
          icon={<Folder className="h-4 w-4 text-yellow-400" />}
        >
          <div className="flex items-center gap-1.5 px-2 py-1 text-sm" style={{ paddingLeft: '32px' }}>
            <FileCode className="h-4 w-4 text-green-400" />
            <span className="text-zinc-500">main.ts</span>
          </div>
        </FolderItem>
      </ScrollArea>
    </div>
  );
}
