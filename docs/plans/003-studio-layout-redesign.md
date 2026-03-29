# Plan: Studio Layout Redesign — Copy AutoAnimation Patterns
**Date:** 2026-03-29 | **Status:** planned

## Goal
Redesign Problocks Studio to match AutoAnimation's polished 3-panel editor layout with chevron navigation, white-pill subtabs, and glass-morphism panels.

## Source Reference
`/Users/ihsanduru/autoStudio/AutoAnimation/src/components/layout/`

## Checklist

### Layout Structure
- [ ] Replace StudioLayout.tsx with flex-based 3-panel layout matching EditorLayout.tsx
  - `h-screen w-screen flex flex-col bg-zinc-950 overflow-hidden text-zinc-100 p-1.5 gap-1.5`
  - Left panel: `w-[300px]` collapsible with transition
  - Center: `flex-1 flex flex-col gap-1.5` (viewport + script editor)
  - Right panel: `w-[320px] overflow-y-auto`
- [ ] Header bar: dropdown menus for File/Insert/View matching TopMenuBar pattern
- [ ] LeftPanelToggle pill: `absolute w-6 h-12 bg-zinc-700 rounded-r-lg` with ChevronRight/Left

### Tab Group System (Left Panel)
- [ ] Tab groups: Scene, Scripts, Assets, Insert, Settings
- [ ] Card grid for groups with 3+ subtabs (icon box + label + description)
  - Icon box: `w-10 h-10 rounded-lg bg-white/[0.06]`
  - Card: `px-3.5 py-3 rounded-xl hover:bg-white/[0.06]`
- [ ] Drill-down header with ChevronLeft/ChevronRight + dropdown
- [ ] MainGroupHeader: `flex items-center gap-1 px-3 py-2 border-b border-white/5`

### White-Pill Subtabs
- [ ] Animated tab navigation from TabNavigation.tsx
  - Active: `bg-white text-black` with flex-grow animation
  - Inactive: `text-gray-400 hover:text-white hover:bg-panel-surface`
  - Transition: `flex 300ms cubic-bezier(0.25, 1, 0.5, 1)`
- [ ] Static pill tabs for properties sections
  - Active: `bg-green-500 text-white`
  - Inactive: `bg-zinc-800 text-zinc-400 hover:bg-zinc-700`

### Chevron Patterns
- [ ] Navigation: `ChevronLeft/Right size={16}` for prev/next
- [ ] Dropdown: `ChevronDown size={14}` with `transition-transform rotate-180`
- [ ] Collapse: `ChevronRight size={15}` for accordion sections
- [ ] Advanced toggle: `ChevronRight size={10}` with `rotate-90` animation

### Glass-Morphism Panels
- [ ] All panels: `bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-xl`
- [ ] Section dividers: `border-b border-white/5`
- [ ] Panel header: `min-h-[49px] px-3 py-2 border-b border-white/5`
- [ ] Panel body: `flex-1 min-h-0 overflow-y-auto p-4 space-y-4`

### Design Tokens
- [ ] Background: zinc-950 (#09090b)
- [ ] Panel bg: zinc-900/80 with backdrop-blur-xl
- [ ] Accent: green-500 (#22c55e)
- [ ] Borders: white/[0.06]
- [ ] Text: zinc-100 primary, zinc-400 secondary, zinc-600 muted
- [ ] Gap: 1.5 between all panels
- [ ] Padding: 1.5 around entire layout

### Properties Panel (Right)
- [ ] Section headers with ChevronDown toggle (collapsible sections)
- [ ] Transform inputs with colored X/Y/Z labels (red/green/blue)
- [ ] Slider controls for numeric values
- [ ] Color picker integration
- [ ] Status badges: `text-[9px] px-1 rounded`

### Key Files to Reference
```
AutoAnimation/src/components/layout/EditorLayout.tsx          — Main layout
AutoAnimation/src/components/layout/TopMenuBar.tsx             — Header
AutoAnimation/src/components/layout/LeftPanel/LeftPanel.tsx    — Left sidebar (37KB)
AutoAnimation/src/components/layout/RightPanel/RightPanel.tsx  — Right panel (26KB)
AutoAnimation/src/components/ui/TabNavigation.tsx              — Pill tabs
AutoAnimation/src/components/ui/PanelHeader.tsx                — Panel structure
AutoAnimation/src/constants/tabGroups.ts                       — Tab definitions
AutoAnimation/tailwind.config.js                               — Design tokens
```

## Implementation Order
1. Replace StudioLayout.tsx with new flex layout + gap-1.5
2. Add glass-morphism panel wrappers
3. Build tab group system for left panel
4. Add white-pill subtabs
5. Add chevron navigation
6. Add collapse/expand pill toggle
7. Polish properties panel with section toggles
