import { useStudio, type GameMode } from '@/store/studio-store';

interface ModeOption {
  id: GameMode;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

const MODES: ModeOption[] = [
  {
    id: '2d',
    label: '2D Game',
    description: 'Side-scrollers, platformers, top-down 2D physics games',
    icon: '🎮',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/20',
  },
  {
    id: '3d',
    label: '3D Game',
    description: 'Full 3D worlds with terrain, physics, lighting and sculpting',
    icon: '🌍',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/20 hover:border-green-500/50 hover:bg-green-500/20',
  },
  {
    id: 'hex',
    label: 'Hex Map',
    description: 'Hexagonal tile-based maps for strategy and board games',
    icon: '⬡',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/20',
  },
  {
    id: 'isometric',
    label: 'Isometric',
    description: 'Isometric tile worlds — city builders, RPGs, tactics',
    icon: '◇',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/20',
  },
  {
    id: 'cubes',
    label: 'Voxel / Cubes',
    description: 'Minecraft-style voxel worlds with sculpting tools',
    icon: '🧊',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/20',
  },
];

export function ModeSelector() {
  const { setGameMode } = useStudio();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-green-500" />
          <h1 className="text-3xl font-bold tracking-tight">Problocks Studio</h1>
        </div>
        <p className="text-zinc-500 text-sm max-w-md">
          Choose your game type to get started. Each mode has its own tools and workspace tailored for that style of game.
        </p>
        <p className="text-zinc-600 text-xs mt-2">
          This cannot be changed after creation.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setGameMode(mode.id)}
            className={`group flex flex-col items-start p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${mode.bgColor}`}
          >
            <span className="text-3xl mb-3">{mode.icon}</span>
            <h2 className={`text-lg font-semibold ${mode.color}`}>{mode.label}</h2>
            <p className="text-sm text-zinc-400 mt-1 text-left leading-relaxed">
              {mode.description}
            </p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <p className="text-zinc-700 text-xs mt-10">v0.0.1</p>
    </div>
  );
}
