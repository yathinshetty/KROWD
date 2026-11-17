import React, {useEffect, useState} from 'react';
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  type PanInfo,
} from 'motion/react';
import {ChevronDown, ChevronUp} from 'lucide-react';

export type SheetState = 'collapsed' | 'half' | 'expanded';

interface MobileBottomSheetProps {
  sheetState: SheetState;
  onChangeState: (next: SheetState) => void;
  collapsedHeader: React.ReactNode;
  children: React.ReactNode;
}

const BOTTOM_NAV_HEIGHT_PX = 64;
const SHEET_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.9,
};

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = React.memo(({
  sheetState,
  onChangeState,
  collapsedHeader,
  children,
}) => {
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize, {passive: true});
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const expandedHeight = Math.max(Math.round(viewportHeight * 0.92), viewportHeight - 56);
  const halfVisibleHeight = Math.round(viewportHeight * 0.5) + BOTTOM_NAV_HEIGHT_PX;
  const collapsedVisibleHeight = 112 + BOTTOM_NAV_HEIGHT_PX;

  const targetY =
    sheetState === 'expanded'
      ? 0
      : sheetState === 'half'
      ? Math.max(0, expandedHeight - halfVisibleHeight)
      : Math.max(0, expandedHeight - collapsedVisibleHeight);

  const y = useMotionValue(targetY);
  const dragControls = useDragControls();

  useEffect(() => {
    const controls = animate(y, targetY, SHEET_SPRING);
    return () => controls.stop();
  }, [y, targetY]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const dy = info.offset.y;
    const vy = info.velocity.y;
    if (dy < -45 || vy < -280) {
      const next = sheetState === 'collapsed' ? 'half' : 'expanded';
      if (next !== sheetState) {
        onChangeState(next);
        return;
      }
    } else if (dy > 45 || vy > 280) {
      const next = sheetState === 'expanded' ? 'half' : 'collapsed';
      if (next !== sheetState) {
        onChangeState(next);
        return;
      }
    }
    animate(y, targetY, SHEET_SPRING);
  };

  const toggleNext = () => {
    if (sheetState === 'collapsed') onChangeState('half');
    else if (sheetState === 'half') onChangeState('expanded');
    else onChangeState('collapsed');
  };

  return (
    <motion.div
      style={{height: expandedHeight, y}}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{top: 0, bottom: Math.max(0, expandedHeight - collapsedVisibleHeight)}}
      dragElastic={{top: 0.04, bottom: 0.1}}
      onDragEnd={handleDragEnd}
      className="md:hidden fixed left-0 right-0 bottom-0 z-40 pb-16 rounded-t-[26px] bg-white border-t border-[#D1E7BD] shadow-[0_-10px_30px_rgba(40,60,30,0.12)] flex flex-col overflow-hidden will-change-transform"
    >
      {/* Drag Handle & Summary Header */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        onClick={toggleNext}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggleNext();
        }}
        aria-label="Expand or collapse location panel"
        className="px-4 pt-2.5 pb-3 cursor-pointer shrink-0 select-none touch-none bg-white border-b border-[#D1E7BD]"
      >
        <div className="w-10 h-1.5 rounded-full bg-[#627065]/30 mx-auto mb-2.5" />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{collapsedHeader}</div>
          <span className="w-8 h-8 rounded-full bg-[#E6F4D7] flex items-center justify-center text-[#1A211C] shrink-0">
            {sheetState === 'expanded' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div
        style={{paddingBottom: Math.max(16, targetY + 16)}}
        className="flex-1 overflow-y-auto krowd-scroll-y overscroll-contain touch-pan-y px-4 pt-4"
      >
        {children}
      </div>
    </motion.div>
  );
});
