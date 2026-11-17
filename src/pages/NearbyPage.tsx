import React, {useMemo, useState} from 'react';
import {ArrowUpDown, LocateFixed, MapPin} from 'lucide-react';
import type {PlaceCategory, PlaceSummary} from '../types/krowd';
import type {GeolocationStatus, UserCoordinates} from '../hooks/useGeolocation';
import {ALL_CATEGORIES} from '../utils/crowdStyles';
import {PlaceCard} from '../components/discover/PlaceCard';
import {
  SortDropdown,
  type SortDropdownOption,
} from '../components/common/SortDropdown';

type SortOption =
  | 'nearest'
  | 'nearbyLeastCrowded'
  | 'leastCrowded'
  | 'mostPopular'
  | 'bestWeather';

const SORT_OPTIONS: readonly SortDropdownOption<SortOption>[] = [
  {value: 'nearest', label: 'Nearest'},
  {value: 'nearbyLeastCrowded', label: 'Nearby & less crowded'},
  {value: 'leastCrowded', label: 'Least crowded'},
  {value: 'mostPopular', label: 'Most popular'},
  {value: 'bestWeather', label: 'Best weather conditions'},
];

const BENGALURU_CENTER_LAT = 12.9716;
const BENGALURU_CENTER_LON = 77.5946;

function getEffectiveDistanceKm(place: PlaceSummary): number {
  if (typeof place.distanceKm === 'number' && !Number.isNaN(place.distanceKm)) {
    return place.distanceKm;
  }
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(place.latitude - BENGALURU_CENTER_LAT);
  const dLon = toRad(place.longitude - BENGALURU_CENTER_LON);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(BENGALURU_CENTER_LAT)) *
      Math.cos(toRad(place.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreNearbyAndLessCrowded(place: PlaceSummary): number {
  const distKm = getEffectiveDistanceKm(place);
  const distancePenalty = distKm <= 10 ? distKm * 2.2 : 22 + (distKm - 10) * 3.5;
  const crowdTierPenalty =
    place.crowd.crowdLevel === 'Low'
      ? 0
      : place.crowd.crowdLevel === 'Moderate'
      ? 14
      : place.crowd.crowdLevel === 'High'
      ? 42
      : 70;
  return crowdTierPenalty + place.crowd.densityPercent * 0.55 + distancePenalty;
}

interface NearbyPageProps {
  places: PlaceSummary[];
  loading: boolean;
  userCoords: UserCoordinates | null;
  geoStatus: GeolocationStatus;
  onRetryLocation: () => void;
  onSelectPlace: (placeId: string) => void;
}

export const NearbyPage: React.FC<NearbyPageProps> = React.memo(({
  places,
  loading,
  userCoords,
  geoStatus,
  onRetryLocation,
  onSelectPlace,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | PlaceCategory>('All');
  const [sortBy, setSortBy] = useState<SortOption>('nearest');
  const [rangeKm, setRangeKm] = useState<number | null>(null);

  const sortedPlaces = useMemo(() => {
    const categoryFiltered =
      selectedCategory === 'All'
        ? places.filter((p) => p.type === 'visit')
        : selectedCategory === 'Transport'
        ? places.filter((p) => p.type === 'transport')
        : places.filter((p) => p.type === 'visit' && p.category === selectedCategory);

    const filtered =
      rangeKm === null
        ? categoryFiltered
        : categoryFiltered.filter((p) => getEffectiveDistanceKm(p) <= rangeKm);

    return [...filtered].sort((a, b) => {
      if (sortBy === 'nearest') {
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      }
      if (sortBy === 'nearbyLeastCrowded') {
        return scoreNearbyAndLessCrowded(a) - scoreNearbyAndLessCrowded(b);
      }
      if (sortBy === 'leastCrowded') {
        return a.crowd.densityPercent - b.crowd.densityPercent;
      }
      if (sortBy === 'mostPopular') {
        return b.popularityScore - a.popularityScore;
      }
      // bestWeather: prefer lower rain probability and pleasant temp
      const aRain = a.weatherSummary.rainProbabilityPercent ?? 30;
      const bRain = b.weatherSummary.rainProbabilityPercent ?? 30;
      return aRain - bRain || a.crowd.densityPercent - b.crowd.densityPercent;
    });
  }, [places, selectedCategory, rangeKm, sortBy]);

  return (
    <div className="min-h-full bg-[#E6F4D7] pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Header & Location Action */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="font-display font-bold text-[24px] leading-[1.2] tracking-[-0.02em] text-[#1A211C] text-balance">
            Nearby
          </h1>

          <button
            type="button"
            onClick={onRetryLocation}
            aria-label={
              geoStatus === 'requesting'
                ? 'Detecting location'
                : userCoords
                ? 'Refresh my location'
                : 'Enable my location'
            }
            className="bg-[#FFFFFF] border border-[#D1E7BD] rounded-full px-3.5 py-2 text-[13px] font-medium text-[#1A211C] shadow-xs flex items-center gap-1.5 hover:bg-[#F2FAE8] active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out will-change-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LocateFixed
              className="w-4 h-4 text-[#84CC16] shrink-0"
              aria-hidden="true"
            />
            <span>
              {geoStatus === 'requesting'
                ? 'Detecting...'
                : userCoords
                ? 'Refresh'
                : 'Enable GPS'}
            </span>
          </button>
        </div>

        {geoStatus === 'denied' && (
          <div className="rounded-[18px] bg-white border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-[#1A211C]">
              <MapPin className="w-4 h-4 mt-0.5 text-[#627065] shrink-0" aria-hidden="true" />
              <span>
                Location access was declined, so distances are measured from Bengaluru city centre (MG Road).
              </span>
            </div>
            <button
              type="button"
              onClick={onRetryLocation}
              className="px-3.5 py-2 rounded-xl bg-[#121814] text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Retry detection
            </button>
          </div>
        )}

        {/* Controls: Category Filter & Sort */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-1 pl-4 pr-8 -ml-4 [mask-image:linear-gradient(to_right,transparent_0px,black_16px,black_calc(100%-32px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0px,black_16px,black_calc(100%-32px),transparent_100%)]">
            {ALL_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl font-sans font-semibold text-[13px] leading-[1.2] tracking-[-0.005em] whitespace-nowrap shrink-0 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] will-change-transform min-h-[40px] ${
                    active
                      ? 'bg-[#121814] text-white border border-[#121814]'
                      : 'bg-white border border-[#D1E7BD] text-[#627065] hover:bg-[#F2FAE8] hover:text-[#1A211C]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-[#627065]" aria-hidden="true" />
            <span
              id="nearby-sort-label"
              className="font-sans font-medium text-[13px] leading-[1.2] tracking-[0em] text-[#627065]"
            >
              Sort:
            </span>
            <SortDropdown
              id="nearby-sort"
              labelledBy="nearby-sort-label"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={setSortBy}
              rangeKm={rangeKm}
              onRangeKmChange={setRangeKm}
            />
          </div>
        </div>

        {/* Grid */}
        {loading && places.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({length: 6}).map((_, i) => (
              <div key={i} className="h-56 rounded-[18px] bg-white animate-pulse" />
            ))}
          </div>
        ) : sortedPlaces.length === 0 ? (
          <div className="rounded-[20px] bg-white border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] p-8 text-center space-y-3">
            <p className="font-sans text-sm font-medium text-[#1A211C]">
              {rangeKm !== null
                ? `No places found within ${rangeKm} km`
                : 'No places found for this filter'}
            </p>
            {rangeKm !== null && (
              <button
                type="button"
                onClick={() => setRangeKm(null)}
                className="inline-flex items-center justify-center rounded-full bg-[#121814] text-white px-4 py-2 font-sans text-xs font-semibold hover:bg-[#1A211C] active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out cursor-pointer"
              >
                Reset range
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onSelect={onSelectPlace}
                layout="grid"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
