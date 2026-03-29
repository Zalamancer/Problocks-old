import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PanelSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  precision?: number;
  className?: string;
  compact?: boolean;
  inline?: boolean;
  suffix?: string;
  formatValue?: (v: number) => string;
}

export function PanelSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  precision = 0,
  className,
  compact,
  inline,
  suffix,
  formatValue,
}: PanelSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDidMove = useRef(false);
  const selectAllOnEdit = useRef(false);
  const lastClientX = useRef(0);
  const DRAG_THRESHOLD = 5;

  const clamp = useCallback((val: number) => Math.min(Math.max(val, min), max), [min, max]);

  const formatDisplay = (v: number) => {
    if (formatValue) return formatValue(v);
    return precision > 0 ? v.toFixed(precision) : String(Math.round(v));
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      lastClientX.current = e.clientX;
      dragDidMove.current = false;
      let currentValue = value;
      let locked = false;

      const onLockedMove = (ev: MouseEvent) => {
        const sens = ev.shiftKey ? 0.1 : 1;
        currentValue = clamp(Number((currentValue + ev.movementX * step * sens).toFixed(Math.max(precision, 2))));
        onChange(currentValue);
      };

      const cleanup = () => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {}
        if (locked) {
          document.removeEventListener('mousemove', onLockedMove);
          document.removeEventListener('mouseup', onLockedUp);
          if (document.pointerLockElement) document.exitPointerLock();
        }
        setIsDragging(false);
      };

      const onLockedUp = () => {
        cleanup();
      };

      const onMove = (ev: PointerEvent) => {
        if (locked) return;
        const dx = ev.clientX - startX;

        if (!dragDidMove.current) {
          if (Math.abs(dx) < DRAG_THRESHOLD) return;
          dragDidMove.current = true;
          setIsDragging(true);
          lastClientX.current = ev.clientX;

          target
            .requestPointerLock?.()
            ?.then?.(() => {
              locked = true;
              target.removeEventListener('pointermove', onMove);
              target.removeEventListener('pointerup', onUp);
              try {
                target.releasePointerCapture(e.pointerId);
              } catch {}
              document.addEventListener('mousemove', onLockedMove);
              document.addEventListener('mouseup', onLockedUp);
            })
            ?.catch?.(() => {
              document.body.style.cursor = 'none';
            });
          return;
        }

        const delta = ev.clientX - lastClientX.current;
        lastClientX.current = ev.clientX;
        const sens = ev.shiftKey ? 0.1 : 1;
        currentValue = clamp(Number((currentValue + delta * step * sens).toFixed(Math.max(precision, 2))));
        onChange(currentValue);
      };

      const onUp = () => {
        cleanup();
        document.body.style.cursor = '';

        if (!dragDidMove.current) {
          selectAllOnEdit.current = false;
          const raw = precision > 0 ? value.toFixed(precision) : String(Math.round(value));
          setEditValue(raw);
          setIsEditing(true);
        }
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    },
    [isEditing, value, step, precision, onChange, clamp],
  );

  const handleDoubleClick = () => {
    selectAllOnEdit.current = true;
    const raw = precision > 0 ? value.toFixed(precision) : String(Math.round(value));
    setEditValue(raw);
    setIsEditing(true);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleInputBlur();
    else if (e.key === 'Escape') setIsEditing(false);
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isEditing) return;
      const direction = e.deltaY > 0 ? -1 : 1;
      const sens = e.shiftKey ? 0.1 : 1;
      onChange(clamp(value + direction * step * sens));
    },
    [isEditing, value, step, onChange, clamp],
  );

  const handleSliderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) return;
      let newValue: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = clamp(value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = clamp(value - step);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        default:
          return;
      }
      e.preventDefault();
      onChange(newValue);
    },
    [isEditing, value, step, min, max, onChange, clamp],
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (selectAllOnEdit.current) {
        inputRef.current.select();
      } else {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  const pillContent = (
    <>
      {!isEditing && suffix && !formatValue && (
        <span className="text-xs text-gray-500 pr-2 select-none shrink-0">{suffix}</span>
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="w-full bg-transparent text-sm text-white outline-none"
        />
      ) : (
        <span className="text-sm text-white whitespace-nowrap flex-1">{formatDisplay(value)}</span>
      )}
    </>
  );

  const pillClass = cn(
    'flex items-center px-3 py-2 rounded-lg transition-all',
    'bg-[#2a2a2a]',
    isDragging ? 'ring-1 ring-green-500' : 'hover:bg-[#3a3a3a]',
    !isEditing && 'cursor-ew-resize select-none',
  );

  const pillHandlers = {
    onPointerDown: handlePointerDown,
    onDoubleClick: handleDoubleClick,
    onWheel: handleWheel,
    onKeyDown: handleSliderKeyDown,
  };

  const sliderAriaProps = {
    role: 'slider' as const,
    'aria-valuenow': value,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-label': label,
    tabIndex: isEditing ? undefined : 0,
  };

  if (inline) {
    return (
      <div className={cn(pillClass, className)} {...pillHandlers} {...sliderAriaProps}>
        {!isEditing && label && <span className="text-xs text-gray-500 pr-2 select-none shrink-0">{label}</span>}
        {pillContent}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 mb-3', className)}>
      <span className={cn('text-gray-400 text-sm shrink-0', compact ? 'w-auto' : 'w-20')}>{label}</span>
      <div className="flex-1">
        <div className={cn(pillClass)} {...pillHandlers} {...sliderAriaProps}>
          {pillContent}
        </div>
      </div>
    </div>
  );
}
