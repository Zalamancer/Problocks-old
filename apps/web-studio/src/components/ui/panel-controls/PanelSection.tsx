import { useState } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PanelSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  noBorder?: boolean;
  defaultOpen?: boolean;
  collapsible?: boolean;
  icon?: LucideIcon;
  badge?: string | number;
}

export function PanelSection({
  title,
  children,
  className,
  noBorder,
  defaultOpen = true,
  collapsible = false,
  icon: Icon,
  badge,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isCollapsible = collapsible && !!title;

  return (
    <div className={cn(!noBorder && 'border-b border-white/5 pb-4', className)}>
      {title &&
        (isCollapsible ? (
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center gap-1.5 mb-3 text-left group"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown size={13} className="shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors" />
            ) : (
              <ChevronRight size={13} className="shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors" />
            )}
            {Icon && <Icon size={14} className="shrink-0 text-gray-400" />}
            <span className="text-white text-sm font-semibold">{title}</span>
            {badge != null && <span className="ml-auto text-[10px] text-gray-500">{badge}</span>}
          </button>
        ) : (
          <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5">
            {Icon && <Icon size={14} className="shrink-0 text-gray-400" />}
            {title}
            {badge != null && <span className="ml-auto text-[10px] text-gray-500">{badge}</span>}
          </h2>
        ))}
      {(!isCollapsible || open) && children}
    </div>
  );
}
