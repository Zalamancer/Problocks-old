/**
 * ColorPicker — copied from AutoAnimation/src/components/ui/ColorPicker.tsx
 * Custom HSV color picker with portal popover, eyedropper, and hex input.
 */
import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '@/utils/color';

function parseColor(hex: string): { h: number; s: number; v: number; a: number } {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, v] = rgbToHsv(r, g, b);
  const raw = hex.replace('#', '');
  const a = raw.length >= 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
  return { h, s, v, a };
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

// ═══════════════════════════════════════
// ColorPickerPanel
// ═══════════════════════════════════════

interface ColorPickerPanelProps {
  color: string;
  onChange: (hex: string) => void;
  showAlpha?: boolean;
}

export const ColorPickerPanel = memo(function ColorPickerPanel({
  color,
  onChange,
  showAlpha = false,
}: ColorPickerPanelProps) {
  const [hsv, setHsv] = useState(() => parseColor(color));
  const [hexInput, setHexInput] = useState(() => color.replace('#', '').slice(0, 6).toUpperCase());
  const draggingRef = useRef(false);
  const slRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(hsv);
  stateRef.current = hsv;

  useEffect(() => {
    if (!draggingRef.current) {
      const parsed = parseColor(color);
      setHsv(parsed);
      const [r, g, b] = hsvToRgb(parsed.h, parsed.s, parsed.v);
      setHexInput(rgbToHex(r, g, b).replace('#', '').toUpperCase());
    }
  }, [color]);

  const emit = useCallback(
    (h: number, s: number, v: number, a: number) => {
      const [r, g, b] = hsvToRgb(h, s, v);
      let hex = rgbToHex(r, g, b);
      if (showAlpha && a < 1) {
        hex += Math.round(a * 255)
          .toString(16)
          .padStart(2, '0');
      }
      setHexInput(hex.replace('#', '').slice(0, 6).toUpperCase());
      onChange(hex);
    },
    [onChange, showAlpha],
  );

  const setupDrag = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>, onUpdate: (cx: number, cy: number, rect: DOMRect) => void) =>
      (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;
        const el = ref.current!;
        onUpdate(e.clientX, e.clientY, el.getBoundingClientRect());

        const move = (ev: PointerEvent) => onUpdate(ev.clientX, ev.clientY, el.getBoundingClientRect());
        const up = () => {
          draggingRef.current = false;
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      },
    [],
  );

  const onSLDown = setupDrag(slRef, (cx, cy, rect) => {
    const s = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (cy - rect.top) / rect.height));
    const { h, a } = stateRef.current;
    stateRef.current = { h, s, v, a };
    setHsv({ h, s, v, a });
    emit(h, s, v, a);
  });

  const onHueDown = setupDrag(hueRef, (cx, _cy, rect) => {
    const h = Math.max(0, Math.min(0.9999, (cx - rect.left) / rect.width));
    const { s, v, a } = stateRef.current;
    stateRef.current = { h, s, v, a };
    setHsv({ h, s, v, a });
    emit(h, s, v, a);
  });

  const onAlphaDown = setupDrag(alphaRef, (cx, _cy, rect) => {
    const a = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    const { h, s, v } = stateRef.current;
    stateRef.current = { h, s, v, a };
    setHsv({ h, s, v, a });
    emit(h, s, v, a);
  });

  const onHexCommit = () => {
    const raw = hexInput.replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
      const hex = '#' + raw;
      const parsed = parseColor(hex);
      stateRef.current = parsed;
      setHsv(parsed);
      onChange(hex);
    } else {
      const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
      setHexInput(rgbToHex(r, g, b).replace('#', '').toUpperCase());
    }
  };

  const onEyedrop = async () => {
    if (!hasEyeDropper) return;
    try {
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      const hex = result.sRGBHex as string;
      const parsed = parseColor(hex);
      stateRef.current = parsed;
      setHsv(parsed);
      const [r, g, b] = hsvToRgb(parsed.h, parsed.s, parsed.v);
      setHexInput(rgbToHex(r, g, b).replace('#', '').toUpperCase());
      onChange(hex);
    } catch {
      /* cancelled */
    }
  };

  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hueColor = `hsl(${Math.round(hsv.h * 360)}, 100%, 50%)`;
  const currentRgb = `rgb(${r},${g},${b})`;
  const eyeH = showAlpha ? 52 : 24;

  return (
    <div
      style={{
        background: '#2a2a2a',
        width: 230,
        boxShadow: '0px 4px 24px 0px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05)',
        backdropFilter: 'blur(32px)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        fontSize: 11,
        color: 'rgba(255,255,255,0.95)',
        lineHeight: 1.15,
        letterSpacing: '0.3px',
      }}
    >
      {/* SL Picker */}
      <div
        ref={slRef}
        onPointerDown={onSLDown}
        style={{
          position: 'relative',
          width: 206,
          height: 206,
          borderRadius: 8,
          cursor: 'crosshair',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundColor: hueColor }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: 'linear-gradient(rgba(0,0,0,0), #000)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #fff',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 3px 1px rgba(0,0,0,0.2)',
            backgroundColor: currentRgb,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasEyeDropper && (
            <button
              type="button"
              onClick={onEyedrop}
              title="Pick color from screen"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: 'none',
                borderRadius: 8,
                width: eyeH,
                height: eyeH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.95)',
                flexShrink: 0,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget.style as any).background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget.style as any).background = 'rgba(255,255,255,0.03)';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" style={{ opacity: 0.6 }}>
                <path fill="currentColor" fillRule="evenodd" d="M7.854 5.146 8 5l2.379-2.379a2.121 2.121 0 0 1 3 3L11 8l-.146.146 1 1a.5.5 0 1 1-.707.708l-1-1-4.526 4.525a2.121 2.121 0 0 1-3-3l4.525-4.525-1-1a.5.5 0 0 1 .708-.708zm0 1.415-4.526 4.525a1.121 1.121 0 1 0 1.586 1.586L9.44 8.146z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 4 }}>
            <div
              ref={hueRef}
              onPointerDown={onHueDown}
              style={{
                position: 'relative',
                width: '100%',
                height: 24,
                borderRadius: 8,
                background: 'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                cursor: 'ew-resize',
                touchAction: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${hsv.h * 100}%`,
                  top: '50%',
                  width: 16,
                  height: 24,
                  borderRadius: 8,
                  background: hueColor,
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px #fff, 0 0 1px 2px rgba(0,0,0,0.15)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
            {showAlpha && (
              <div
                ref={alphaRef}
                onPointerDown={onAlphaDown}
                style={{ position: 'relative', width: '100%', height: 24, borderRadius: 8, cursor: 'ew-resize', touchAction: 'none', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 8px 8px' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))` }} />
                <div style={{ position: 'absolute', left: `${hsv.a * 100}%`, top: '50%', width: 16, height: 24, borderRadius: 8, background: 'transparent', border: '2px solid #fff', boxShadow: '0 0 0 1px #fff, 0 0 1px 2px rgba(0,0,0,0.15)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 3 }} />
              </div>
            )}
          </div>
        </div>

        {/* Hex input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 6px 6px' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundColor: currentRgb, opacity: hsv.a, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={onHexCommit}
              onKeyDown={(e) => { if (e.key === 'Enter') onHexCommit(); }}
              spellCheck={false}
              style={{
                appearance: 'none',
                background: 'rgba(255,255,255,0.03)',
                width: '100%',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'default',
                borderRadius: 8,
                border: 'none',
                outline: 'none',
                padding: '4px 8px',
                fontSize: 11,
                lineHeight: '1rem',
                letterSpacing: '0.3px',
                height: 24,
                fontFamily: 'inherit',
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 0 0 1px #22c55e'; e.currentTarget.style.cursor = 'text'; }}
              onBlurCapture={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════
// ColorPicker (trigger swatch + popover)
// ═══════════════════════════════════════

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  showAlpha?: boolean;
  className?: string;
}

export const ColorPicker = memo(function ColorPicker({
  color,
  onChange,
  showAlpha = false,
  className,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const PW = 230;
    const PH = showAlpha ? 340 : 310;
    const GAP = 8;

    let top = rect.bottom + GAP;
    if (top + PH > window.innerHeight) top = rect.top - GAP - PH;

    let left: number;
    if (rect.left > window.innerWidth / 2) {
      left = rect.right - PW;
    } else {
      left = rect.left;
    }
    if (left + PW > window.innerWidth - 8) left = window.innerWidth - PW - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [isOpen, showAlpha]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handle);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'relative w-7 h-7 rounded-lg border border-white/10 cursor-pointer overflow-hidden shrink-0',
          'hover:border-white/20 transition-colors',
          className,
        )}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 6px 6px' }}
        />
        <div className="absolute inset-0" style={{ backgroundColor: color }} />
      </button>
      {isOpen &&
        createPortal(
          <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}>
            <ColorPickerPanel color={color} onChange={onChange} showAlpha={showAlpha} />
          </div>,
          document.body,
        )}
    </>
  );
});
