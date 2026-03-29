import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/store/studio-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Square,
  RotateCcw,
  Box,
  Circle,
  Cylinder,
  Save,
  Upload,
  Settings,
  ChevronDown,
  Undo,
  Redo,
  Move,
  RotateCw,
  Scaling,
  MousePointer,
  Store,
} from 'lucide-react';

export function Toolbar() {
  const { isPlaying, setPlaying, addEntity, marketplaceOpen, toggleMarketplace } = useStudio();

  let entityCounter = 10;
  const insertEntity = (shape: 'box' | 'sphere' | 'cylinder') => {
    const id = `${shape}_${Date.now()}`;
    entityCounter++;
    addEntity({
      id,
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${entityCounter}`,
      type: 'entity',
      shape,
      color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'][entityCounter % 5],
      position: { x: (Math.random() - 0.5) * 4, y: 5 + Math.random() * 3, z: (Math.random() - 0.5) * 4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { width: 1, height: 1, depth: 1 },
      physics: { mass: 1, friction: 0.5, restitution: 0.4, isStatic: false },
    });
  };

  return (
    <div className="flex h-12 items-center gap-1 border-b bg-card px-2">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2">
        <div className="h-6 w-6 rounded bg-primary" />
        <span className="font-bold text-sm">Problocks Studio</span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* File menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            File <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>New Simulation</DropdownMenuItem>
          <DropdownMenuItem>Open...</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Save className="mr-2 h-4 w-4" /> Save
          </DropdownMenuItem>
          <DropdownMenuItem>Save As...</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Upload className="mr-2 h-4 w-4" /> Publish to Marketplace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Insert <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => insertEntity('box')}><Box className="mr-2 h-4 w-4" /> Box</DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertEntity('sphere')}><Circle className="mr-2 h-4 w-4" /> Sphere</DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertEntity('cylinder')}><Cylinder className="mr-2 h-4 w-4" /> Cylinder</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Light</DropdownMenuItem>
          <DropdownMenuItem>Camera</DropdownMenuItem>
          <DropdownMenuItem>Script</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant={marketplaceOpen ? 'secondary' : 'ghost'}
        size="sm"
        className="gap-1.5"
        onClick={() => toggleMarketplace()}
      >
        <Store className="h-4 w-4" /> Marketplace
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Transform tools */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Select">
          <MousePointer className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Move">
          <Move className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Rotate">
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Scale">
          <Scaling className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Undo/Redo */}
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Undo">
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Redo">
        <Redo className="h-4 w-4" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className={`gap-1 ${isPlaying ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'}`}
          onClick={() => setPlaying(true)}
          disabled={isPlaying}
        >
          <Play className="h-4 w-4" /> Play
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setPlaying(false)}
          disabled={!isPlaying}
        >
          <Square className="h-4 w-4" /> Stop
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Badge variant="outline" className="text-xs">
        v0.0.1
      </Badge>

      <Button variant="ghost" size="icon" className="h-8 w-8">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
