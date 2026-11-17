import React from 'react';
import {motion} from 'motion/react';
import type {PlaceSummary} from '../../types/krowd';
import {CROWD_COLORS, formatDistance} from '../../utils/crowdStyles';
import {PlacePhoto} from '../common/PlacePhoto';

interface PlaceCardProps {
  place: PlaceSummary;
  isSelected?: boolean;
  onSelect: (placeId: string) => void;
  layout?: 'horizontal' | 'grid';
}

export const PlaceCard: React.FC<PlaceCardProps> = React.memo(({
  place,
  isSelected = false,
  onSelect,
  layout = 'horizontal',
}) => {
  const crowdStyle = CROWD_COLORS[place.crowd.crowdLevel];
  const dist = formatDistance(place.distanceKm);

  return (
    <motion.button
      type="button"
      whileHover={{y: -2}}
      whileTap={{scale: 0.97}}
      transition={{duration: 0.15, ease: [0.22, 1, 0.36, 1]}}
      onClick={() => onSelect(place.id)}
      className={`text-left rounded-[18px] bg-white overflow-hidden transition-shadow will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] ${
        layout === 'horizontal' ? 'w-[252px] sm:w-[272px] shrink-0' : 'w-full'
      } ${
        isSelected
          ? 'ring-2 ring-[#121814] shadow-[0_10px_30px_rgba(40,60,30,0.14)]'
          : 'shadow-[0_10px_30px_rgba(40,60,30,0.08)] hover:shadow-[0_12px_34px_rgba(40,60,30,0.12)]'
      }`}
    >
      <div className="relative h-32 w-full bg-[#E6F4D7] overflow-hidden">
        <PlacePhoto
          imageKey={place.imageKey}
          imageUrl={place.imageUrl}
          name={place.name}
          category={place.category}
        />
      </div>

      <div className="p-3.5 space-y-1.5">
        <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-[#627065] tabular-nums truncate">
          {place.category}
          {dist ? ` · ${dist}` : ` · ${place.neighborhood}`}
        </div>

        <h3 className="font-sans font-semibold text-[15px] leading-[1.3] tracking-[-0.01em] text-[#1A211C] truncate">
          {place.name}
        </h3>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className="inline-flex items-center gap-1.5 font-sans font-semibold text-[12px] leading-[1.3] tracking-[0em]"
            style={{color: crowdStyle.textHex}}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{backgroundColor: crowdStyle.hex}}
              aria-hidden="true"
            />
            <span>{place.crowd.crowdLevel}</span>
          </span>

          <span className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-[#627065] tabular-nums truncate">
            {place.weatherSummary.available && place.weatherSummary.temperatureC !== null
              ? `${place.weatherSummary.temperatureC}°C · ${place.weatherSummary.condition}`
              : place.weatherSummary.condition}
          </span>
        </div>
      </div>
    </motion.button>
  );
});
