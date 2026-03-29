/**
 * Design tokens for the unified panel control system.
 * Copied from AutoAnimation's panel-controls design language.
 */
export const PANEL = {
  // Surface backgrounds
  surface: 'bg-[#2a2a2a]',
  surfaceHover: 'hover:bg-[#3a3a3a]',
  surfaceActive: 'bg-[#3a3a3a]',

  // Accent (active state)
  accent: 'bg-green-500',
  accentHover: 'hover:bg-green-600',
  accentText: 'text-green-500',
  accentBg: 'bg-green-500/10',
  accentBorder: 'border-green-500',
  accentBorderSubtle: 'border-green-500/30',

  // Text
  label: 'text-gray-400 text-sm',
  labelFixed: 'text-gray-400 text-sm w-20 shrink-0',
  sublabel: 'text-gray-500 text-xs',
  heading: 'text-white text-base font-semibold',
  headingSm: 'text-white text-sm font-semibold',
  value: 'text-white text-sm',

  // Borders
  border: 'border-white/5',
  borderSurface: 'border-[#3a3a3a]',

  // Focus
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',

  // Toggle
  toggleOn: 'bg-green-500',
  toggleOff: 'bg-[#3a3a3a]',

  // Common input
  input: 'bg-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500',

  // Button variants
  btnPrimary: 'bg-green-500 text-white hover:bg-green-600',
  btnSecondary: 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]',
  btnDestructive: 'bg-red-600/10 text-red-400 hover:bg-red-600/20',
  btnAccent: 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20',

  // Section
  section: 'border-b border-white/5',
} as const;
