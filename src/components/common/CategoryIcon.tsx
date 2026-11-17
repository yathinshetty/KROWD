import React from 'react';
import {
  Building2,
  CalendarDays,
  Camera,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  ShoppingBag,
  Store,
  Sun,
  TrainFront,
  Trees,
  Utensils,
} from 'lucide-react';
import type {PlaceCategory} from '../../types/krowd';

export const CategoryIcon: React.FC<{
  category: PlaceCategory;
  className?: string;
}> = ({category, className = 'w-4 h-4'}) => {
  switch (category) {
    case 'Temples':
      return <Building2 className={className} aria-hidden="true" />;
    case 'Malls':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'Parks':
      return <Trees className={className} aria-hidden="true" />;
    case 'Tourist Places':
      return <Camera className={className} aria-hidden="true" />;
    case 'Restaurants':
      return <Utensils className={className} aria-hidden="true" />;
    case 'Transport':
      return <TrainFront className={className} aria-hidden="true" />;
    case 'Markets':
      return <Store className={className} aria-hidden="true" />;
    case 'Events':
      return <CalendarDays className={className} aria-hidden="true" />;
  }
};

export const WeatherIcon: React.FC<{
  code: number | null;
  className?: string;
}> = ({code, className = 'w-4 h-4'}) => {
  if (code === null) return <Cloud className={className} aria-hidden="true" />;
  if (code === 0 || code === 1) return <Sun className={className} aria-hidden="true" />;
  if (code === 2) return <CloudSun className={className} aria-hidden="true" />;
  if (code === 45 || code === 48) return <CloudFog className={className} aria-hidden="true" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain className={className} aria-hidden="true" />;
  }
  if (code >= 95) return <CloudLightning className={className} aria-hidden="true" />;
  return <Cloud className={className} aria-hidden="true" />;
};
