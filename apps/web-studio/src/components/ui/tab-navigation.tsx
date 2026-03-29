import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Full-width animated style: icons span evenly, active shows label */
  animated?: boolean;
}

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  size = 'md',
  className,
  animated = false,
}: TabNavigationProps) {
  if (animated) {
    const iconSize = size === 'sm' ? 15 : 16;
    const h = size === 'sm' ? 'h-8' : 'h-9';
    return (
      <div className={cn('flex gap-1', className)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              style={{
                flex: isActive ? 2 : 1,
                transition:
                  'flex 300ms cubic-bezier(0.25, 1, 0.5, 1), background-color 200ms, color 200ms, padding 200ms',
              }}
              className={cn(
                'relative rounded-lg flex items-center justify-center gap-1.5 overflow-hidden',
                h,
                isActive
                  ? 'bg-white text-black px-2'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Icon size={iconSize} className="shrink-0" />
              <span
                style={{
                  transition: 'max-width 300ms cubic-bezier(0.25, 1, 0.5, 1) 50ms, opacity 200ms ease 60ms',
                }}
                className={cn(
                  'text-[11px] font-medium truncate',
                  isActive ? 'max-w-[80px] opacity-100' : 'max-w-0 opacity-0',
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const buttonSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 18 : 20;

  return (
    <div className={cn('flex gap-1 p-1', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={cn(
              'flex items-center justify-center rounded-lg transition-all duration-150',
              buttonSize,
              isActive
                ? 'bg-green-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300',
            )}
          >
            <Icon size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
