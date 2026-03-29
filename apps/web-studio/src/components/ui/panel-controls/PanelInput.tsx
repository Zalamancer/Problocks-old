import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface PanelInputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  icon?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: string;
}

export function PanelInput({
  label,
  value,
  onChange,
  placeholder,
  className,
  icon: Icon,
  fullWidth,
  disabled,
  type = 'text',
}: PanelInputProps) {
  const input = (
    <div className={cn('relative', fullWidth ? 'w-full' : 'flex-1')}>
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full bg-[#2a2a2a] text-white text-sm py-2 rounded-lg',
          'focus:outline-none focus:ring-1 focus:ring-green-500',
          'placeholder:text-gray-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          Icon ? 'pl-9 pr-3' : 'px-3',
          className,
        )}
      />
    </div>
  );

  if (!label) return <div className="mb-3">{input}</div>;

  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-gray-400 text-sm w-20 shrink-0">{label}</span>
      {input}
    </div>
  );
}
