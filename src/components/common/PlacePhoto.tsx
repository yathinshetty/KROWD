import React, {useEffect, useState} from 'react';
import {getPlaceImageSrc} from '../../data/placeImages';
import type {PlaceCategory} from '../../types/krowd';
import {CategoryIcon} from './CategoryIcon';

export const PlacePhoto: React.FC<{
  imageKey: string;
  imageUrl?: string;
  name: string;
  category: PlaceCategory;
  className?: string;
}> = React.memo(({imageKey, imageUrl, name, category, className = 'w-full h-full object-cover'}) => {
  const [fallbackLevel, setFallbackLevel] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    setFallbackLevel(0);
  }, [imageKey, imageUrl]);

  const src =
    fallbackLevel === 0
      ? getPlaceImageSrc(imageKey, imageUrl)
      : getPlaceImageSrc(imageKey);

  if (fallbackLevel === 2) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#E6F4D7] to-[#F2FAE8] text-[#1A211C] p-4 text-center ${className}`}
      >
        <CategoryIcon category={category} className="w-6 h-6 text-[#84CC16] mb-1.5" />
        <span className="text-xs font-medium text-[#627065] line-clamp-2">{name}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFallbackLevel((prev) => (prev === 0 && imageUrl ? 1 : 2))}
      className={className}
    />
  );
});
