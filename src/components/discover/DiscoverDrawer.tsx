import React, {useMemo, useState} from 'react';
import {Car, TrendingDown, TrendingUp} from 'lucide-react';
import type {PlaceSummary, WeatherCurrent} from '../../types/krowd';
import {formatSourceLabel, formatTrafficStatusLabel} from '../../utils/crowdStyles';
import {WeatherIcon} from '../common/CategoryIcon';
import {PlaceCard} from './PlaceCard';

type DiscoverTab = 'recommended' | 'lessCrowded' | 'nearby' | 'popular' | 'today';

interface DiscoverDrawerProps {
  places: PlaceSummary[];
  cityWeather: WeatherCurrent | null;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  hasUserCoords: boolean;
}

export const DiscoverDrawer: React.FC<DiscoverDrawerProps> = React.memo(({
  places,
  cityWeather,
  selectedPlaceId,
  onSelectPlace,
  hasUserCoords,
}) => {
  const [activeTab, setActiveTab] = useState<DiscoverTab>('recommended');

  const pool = useMemo(() => {
    if (places.length > 0 && places.every((p) => p.type === 'transport')) {
      return places;
    }
    return places.filter((p) => p.type === 'visit');
  }, [places]);

  const curated = useMemo(() => {
    const lessCrowded = [...pool].sort(
      (a, b) => a.crowd.densityPercent - b.crowd.densityPercent
    );
    const popular = [...pool].sort((a, b) => b.popularityScore - a.popularityScore);
    const nearby = hasUserCoords
      ? [...pool].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      : pool;
    const todayWorth = [...pool].sort(
      (a, b) =>
        b.popularityScore - b.crowd.densityPercent * 0.5 - (a.popularityScore - a.crowd.densityPercent * 0.5)
    );
    const recommended = [...pool].sort(
      (a, b) =>
        a.crowd.densityPercent * 0.65 - a.popularityScore * 0.35 -
        (b.crowd.densityPercent * 0.65 - b.popularityScore * 0.35)
    );

    return {
      recommended,
      lessCrowded,
      nearby,
      popular,
      today: todayWorth,
    };
  }, [pool, hasUserCoords]);

  const busiestSpot = useMemo(
    () => [...pool].sort((a, b) => b.crowd.densityPercent - a.crowd.densityPercent)[0],
    [pool]
  );
  const quietestSpot = useMemo(
    () => [...pool].sort((a, b) => a.crowd.densityPercent - b.crowd.densityPercent)[0],
    [pool]
  );

  const visiblePlaces = curated[activeTab].slice(0, 10);

  const tabs: Array<{id: DiscoverTab; label: string}> = [
    {id: 'recommended', label: 'Recommended'},
    {id: 'lessCrowded', label: 'Less crowded'},
    {id: 'nearby', label: 'Nearby'},
    {id: 'popular', label: 'Popular in Bengaluru'},
    {id: 'today', label: 'Worth visiting today'},
  ];

  return (
    <div className="space-y-3.5">
      {/* Compact City Conditions Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-[#E6F4D7]/65 border border-[#D1E7BD] p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#1A211C] shrink-0">
            <WeatherIcon code={cityWeather?.weatherCode ?? null} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-sans font-normal text-[11px] leading-[1.3] text-[#627065]">
              Bengaluru weather · {formatSourceLabel(cityWeather?.source ?? 'LIVE DATA')}
            </div>
            <div className="font-sans text-xs font-semibold text-[#1A211C] truncate tabular-nums">
              {cityWeather?.available && cityWeather.temperatureC !== null
                ? `${cityWeather.temperatureC}°C · ${cityWeather.condition}`
                : 'Weather unavailable'}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#E6F4D7]/65 border border-[#D1E7BD] p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#1A211C] shrink-0">
            <Car className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-sans font-normal text-[11px] leading-[1.3] text-[#627065]">
              Traffic summary · {places.some((p) => !p.crowd.isDemoData) ? 'Live signal' : 'Estimated'}
            </div>
            <div className="font-sans text-xs font-semibold text-[#1A211C] truncate">
              {places[0]?.trafficLevel
                ? `${formatTrafficStatusLabel(places[0].trafficLevel)} on corridors`
                : 'Moderate traffic on corridors'}
            </div>
          </div>
        </div>

        {busiestSpot && (
          <button
            type="button"
            onClick={() => onSelectPlace(busiestSpot.id)}
            className="rounded-2xl bg-[#FEE2E2]/80 hover:bg-[#FEE2E2] p-3 flex items-center gap-2.5 text-left active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out will-change-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#B91C1C] shrink-0">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#B91C1C]">Busy now</div>
              <div className="text-xs font-bold text-[#1A211C] truncate">{busiestSpot.name}</div>
            </div>
          </button>
        )}

        {quietestSpot && (
          <button
            type="button"
            onClick={() => onSelectPlace(quietestSpot.id)}
            className="rounded-2xl bg-[#E6F9ED]/85 hover:bg-[#E6F9ED] p-3 flex items-center gap-2.5 text-left active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out will-change-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#15803D] shrink-0">
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#15803D]">Calmest spot</div>
              <div className="text-xs font-bold text-[#1A211C] truncate">{quietestSpot.name}</div>
            </div>
          </button>
        )}
      </div>

      {/* Discovery Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-0.5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] will-change-transform min-h-[36px] ${
                active
                  ? 'bg-[#121814] text-white'
                  : 'bg-white border border-[#D1E7BD] text-[#627065] hover:bg-[#E6F4D7] hover:text-[#1A211C]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Horizontal Cards */}
      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain pb-1 will-change-transform">
        {visiblePlaces.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            isSelected={place.id === selectedPlaceId}
            onSelect={onSelectPlace}
            layout="horizontal"
          />
        ))}
      </div>
    </div>
  );
});
