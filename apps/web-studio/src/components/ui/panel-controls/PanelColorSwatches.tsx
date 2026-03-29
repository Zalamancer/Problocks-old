/**
 * PanelColorSwatches — copied from AutoAnimation
 */
import { cn } from '@/lib/utils';
import { ColorPicker } from '@/components/ui/ColorPicker';

const DEFAULT_COLORS = [
  '#ffffff',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#000000',
  '#71717a',
];

interface PanelColorSwatchesProps {
  label?: string;
  colors?: string[];
  value: string;
  onChange: (color: string) => void;
  showCustom?: boolean;
  showPicker?: boolean;
  className?: string;
}

export function PanelColorSwatches({
  label,
  colors = DEFAULT_COLORS,
  value,
  onChange,
  showCustom = true,
  showPicker,
  className,
}: PanelColorSwatchesProps) {
  const showColorPicker = showPicker ?? showCustom;
  const swatches = (
    <div className="flex items-center gap-1.5 flex-wrap flex-1">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            'w-6 h-6 rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
            value === c ? 'border-green-500 scale-110' : 'border-transparent hover:border-white/30',
          )}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
      {showColorPicker && <ColorPicker color={value} onChange={onChange} />}
    </div>
  );

  if (!label) return <div className={cn('mb-3', className)}>{swatches}</div>;

  return (
    <div className={cn('flex items-center gap-3 mb-3', className)}>
      <span className="text-gray-400 text-sm w-20 shrink-0">{label}</span>
      {swatches}
    </div>
  );
}
