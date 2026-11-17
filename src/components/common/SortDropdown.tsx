import React, {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';

export interface SortDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface SortDropdownProps<T extends string> {
  id?: string;
  labelledBy?: string;
  value: T;
  options: readonly SortDropdownOption<T>[];
  onChange: (value: T) => void;
  rangeKm?: number | null;
  onRangeKmChange?: (km: number | null) => void;
}

const SLIDER_MIN_KM = 2;
const SLIDER_MAX_LIMIT_KM = 100;
const SLIDER_MAX_ANY = 105;

export function SortDropdown<T extends string>({
  id,
  labelledBy,
  value,
  options,
  onChange,
  rangeKm,
  onRangeKmChange,
}: SortDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: Event) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, {passive: true});
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const sliderVal =
    typeof rangeKm === 'number'
      ? Math.min(SLIDER_MAX_LIMIT_KM, Math.max(SLIDER_MIN_KM, rangeKm))
      : SLIDER_MAX_ANY;
  const progressPct =
    ((sliderVal - SLIDER_MIN_KM) / (SLIDER_MAX_ANY - SLIDER_MIN_KM)) * 100;

  return (
    <div ref={containerRef} className="lg:relative inline-block">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} ${id ?? ''}`.trim() : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2 bg-[#FFFFFF] rounded-full px-4 py-2 text-[13px] font-medium text-[#1A211C] border active:scale-[0.97] transition-[transform,background-color,border-color] duration-150 ease-out min-h-[40px] whitespace-nowrap cursor-pointer ${
          open
            ? 'border-[#84CC16] ring-2 ring-[#A3E635]/40'
            : 'border-[#D1E7BD] hover:bg-[#F2FAE8]'
        }`}
      >
        <span>
          {selectedOption?.label}
          {typeof rangeKm === 'number' ? ` · ≤ ${rangeKm} km` : ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#627065] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{opacity: 0, y: -4, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -4, scale: 0.96}}
            transition={{duration: 0.16, ease: [0.22, 1, 0.36, 1]}}
            className="absolute left-0 top-full lg:left-auto lg:right-0 mt-2 w-[272px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#FFFFFF] border border-[#D1E7BD] shadow-[0_12px_32px_rgba(26,33,28,0.12)] p-2 z-50 origin-top-left lg:origin-top-right will-change-[transform,opacity]"
          >
            <div role="listbox" aria-labelledby={labelledBy} className="space-y-0.5">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-sans text-[13px] leading-[1.2] active:scale-[0.98] transition-[transform,background-color,color] duration-150 ease-out cursor-pointer ${
                      isSelected
                        ? 'bg-[#121814] text-white font-semibold'
                        : 'text-[#1A211C] font-medium hover:bg-[#F2FAE8] hover:text-[#1A211C]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#A3E635] shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {onRangeKmChange && (
              <>
                <div className="border-t border-[#E6F4D7] my-2" />
                <div className="px-3 pt-1 pb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#627065]">
                    Distance range
                  </span>
                  <span className="text-[12px] font-semibold text-[#121814] tabular-nums">
                    {typeof rangeKm === 'number' ? `≤ ${rangeKm} km` : 'Any'}
                  </span>
                </div>
                <div className="px-3 pb-2">
                  <input
                    type="range"
                    min={SLIDER_MIN_KM}
                    max={SLIDER_MAX_ANY}
                    step={1}
                    value={sliderVal}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      onRangeKmChange(next > SLIDER_MAX_LIMIT_KM ? null : next);
                    }}
                    aria-label="Distance range in kilometers"
                    className="w-full krowd-range-slider touch-pan-x cursor-pointer block"
                    style={{'--range-progress': `${progressPct}%`} as React.CSSProperties}
                  />
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#627065]">
                    <span>2 km</span>
                    <span>Any</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
