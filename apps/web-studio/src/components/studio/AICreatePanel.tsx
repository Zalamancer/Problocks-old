import { useState } from 'react';
import { useStudio } from '@/store/studio-store';
import { cn } from '@/lib/utils';

// ── Tool card data ────────────────────────────────────────────────────

type Badge = 'PRO' | 'NEW' | 'EXP' | 'API';

interface ToolCard {
  id: string;
  name: string;
  desc: string;
  badge?: Badge;
}

type SubTab = 'create' | 'tilesets' | 'animate' | 'transform' | 'utility';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'create',    label: 'Create'    },
  { id: 'tilesets',  label: 'Tilesets'  },
  { id: 'animate',   label: 'Animate'   },
  { id: 'transform', label: 'Transform' },
  { id: 'utility',   label: 'Utility'   },
];

const TOOLS: Record<SubTab, { section: string; cards: ToolCard[] }[]> = {
  create: [
    {
      section: 'Characters',
      cards: [
        { id: 'create-character',   name: 'Create Character',    desc: '8-directional sprite with all views', badge: 'API' },
        { id: 'create-8dir-sprite', name: 'Create 8-Dir Sprite', desc: 'Generate 8 directional views',        badge: 'PRO' },
      ],
    },
    {
      section: 'Objects',
      cards: [
        { id: 'create-map-object', name: 'Create Map Object', desc: 'Trees, rocks, buildings, props', badge: 'API' },
      ],
    },
    {
      section: 'Images',
      cards: [
        { id: 'create-sm-image',      name: 'Create S-M Image',        desc: 'Best for 16-64px' },
        { id: 'create-mxl-image',     name: 'Create M-XL Image',       desc: 'Best for 64px and larger' },
        { id: 'create-image-pro',     name: 'Create Image',            desc: 'High quality generation', badge: 'PRO' },
        { id: 'image-to-pixel-art',   name: 'Image to Pixel Art',      desc: 'Convert any image to pixel art' },
        { id: 'create-from-style',    name: 'Create from Style Ref',   desc: 'Match your art style', badge: 'PRO' },
      ],
    },
    {
      section: 'UI',
      cards: [
        { id: 'create-ui-elements',     name: 'Create UI Elements', desc: 'Game UI components',      badge: 'PRO' },
        { id: 'create-ui-experimental', name: 'Create UI Elements', desc: 'Tier 2 subscription',    badge: 'EXP' },
      ],
    },
  ],
  tilesets: [
    {
      section: 'Game Tilesets',
      cards: [
        { id: 'create-topdown-tileset',    name: 'Top-Down Tileset',    desc: 'Wang tileset for seamless terrain transitions', badge: 'API' },
        { id: 'create-sidescroller-tileset', name: 'Sidescroller Tileset', desc: 'Platformer-style tilesets', badge: 'API' },
        { id: 'create-isometric-tile',     name: 'Isometric Tile',      desc: 'Isometric perspective tiles', badge: 'API' },
        { id: 'create-tiles-pro',          name: 'Create Tiles',        desc: 'Generate tile variations for games', badge: 'PRO' },
      ],
    },
  ],
  animate: [
    {
      section: 'Character Animation',
      cards: [
        { id: 'animate-character', name: 'Animate Character', desc: 'Walk, run, idle animations for characters', badge: 'API' },
      ],
    },
    {
      section: 'General Animation',
      cards: [
        { id: 'animate-with-text',      name: 'Animate with Text',          desc: 'Generate animation from text',       badge: 'NEW' },
        { id: 'interpolate',            name: 'Interpolate',                desc: 'Animate between two frames',         badge: 'NEW' },
        { id: 'create-animated-object', name: 'Animated Object/Character',  desc: 'Generate animation from text',       badge: 'PRO' },
        { id: 'animate-with-text-pro',  name: 'Animate with Text',          desc: 'Add animation to existing image',    badge: 'PRO' },
        { id: 'edit-animation',         name: 'Edit Animation',             desc: 'Modify frames of an animation',      badge: 'PRO' },
        { id: 'transfer-outfit',        name: 'Transfer Outfit to Anim',    desc: 'Apply outfit to another animation',  badge: 'PRO' },
        { id: 'interpolate-pro',        name: 'Interpolate',                desc: 'Smooth transitions between frames',  badge: 'PRO' },
      ],
    },
  ],
  transform: [
    {
      section: 'Image Transformation',
      cards: [
        { id: 'image-to-image',  name: 'Image to Image', desc: 'Transform using depth guidance' },
        { id: 'edit-image',      name: 'Edit Image',     desc: 'Edit parts of an existing image' },
        { id: 'edit-image-pro',  name: 'Edit Image',     desc: 'Advanced AI image editing', badge: 'PRO' },
      ],
    },
  ],
  utility: [
    {
      section: 'Cleanup Tools',
      cards: [
        { id: 'unzoom',               name: 'Unzoom',               desc: 'Detect pixel scale and downscale', badge: 'NEW' },
        { id: 'remove-background',    name: 'Remove Background',    desc: 'Remove background from image',    badge: 'NEW' },
        { id: 'pixel-art-correction', name: 'Pixel Art Correction', desc: 'Clean up and refine pixel art',   badge: 'NEW' },
      ],
    },
  ],
};

const BADGE_STYLES: Record<Badge, string> = {
  PRO: 'bg-purple-500/20 text-purple-300',
  NEW: 'bg-emerald-500/20 text-emerald-300',
  EXP: 'bg-amber-500/15 text-amber-300',
  API: 'bg-sky-500/20 text-sky-300',
};

// ── Component ─────────────────────────────────────────────────────────

export function AICreatePanel() {
  const { selectedAITool, setSelectedAITool } = useStudio();
  const [activeTab, setActiveTab] = useState<SubTab>('create');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sub-tab bar */}
      <div className="shrink-0 flex gap-px px-2 pt-1 pb-0 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === t.id
                ? 'text-emerald-400 border-emerald-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tool cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
        {TOOLS[activeTab].map((group) => (
          <div key={group.section}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 px-1 pb-1.5 pt-1">
              {group.section}
            </div>
            <div className="space-y-1">
              {group.cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedAITool(selectedAITool === card.id ? null : card.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                    selectedAITool === card.id
                      ? 'border-emerald-500/50 bg-emerald-500/8 text-zinc-100'
                      : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 text-zinc-200',
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[13px] font-semibold">{card.name}</span>
                    {card.badge && (
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', BADGE_STYLES[card.badge])}>
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 leading-snug">{card.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
