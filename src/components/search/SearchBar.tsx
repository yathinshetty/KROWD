import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Clock, Search, X} from 'lucide-react';
import type {PlaceCategory, PlaceSummary} from '../../types/krowd';
import {
  ALL_CATEGORIES,
  CROWD_COLORS,
  formatDistance,
  isTransportSearchQuery,
} from '../../utils/crowdStyles';
import {PlacePhoto} from '../common/PlacePhoto';

interface SearchBarProps {
  places: PlaceSummary[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectPlace: (place: PlaceSummary) => void;
  onSelectCategory: (cat: 'All' | PlaceCategory) => void;
  recentSearches: string[];
  onAddRecentSearch: (term: string) => void;
  onClearRecentSearches: () => void;
  compact?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = React.memo(({
  places,
  searchQuery,
  onSearchChange,
  onSelectPlace,
  onSelectCategory,
  recentSearches,
  onAddRecentSearch,
  onClearRecentSearches,
  compact = false,
}) => {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick, {passive: true});
    document.addEventListener('touchstart', onDocClick, {passive: true});
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const trimmed = searchQuery.trim().toLowerCase();
  const allowTransport = isTransportSearchQuery(trimmed);

  const matchingPlaces = useMemo(
    () =>
      trimmed
        ? places
            .filter(
              (p) =>
                (p.type === 'visit' || allowTransport) &&
                (p.name.toLowerCase().includes(trimmed) ||
                  p.neighborhood.toLowerCase().includes(trimmed) ||
                  p.category.toLowerCase().includes(trimmed) ||
                  p.address.toLowerCase().includes(trimmed) ||
                  p.tags.some((t) => t.toLowerCase().includes(trimmed)))
            )
            .slice(0, 6)
        : places.filter((p) => p.type === 'visit').slice(0, 4),
    [places, trimmed, allowTransport]
  );

  const matchingCategories = useMemo(
    () =>
      ALL_CATEGORIES.filter(
        (c) => c !== 'All' && (!trimmed || c.toLowerCase().includes(trimmed))
      ).slice(0, 4),
    [trimmed]
  );

  const handlePickPlace = (place: PlaceSummary) => {
    onAddRecentSearch(place.name);
    onSelectPlace(place);
    setFocused(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] transition-all ${
          compact ? 'px-3.5 py-2.5 rounded-2xl' : 'px-4 py-3 rounded-2xl'
        } ${focused ? 'ring-2 ring-[#84CC16]' : ''}`}
      >
        <Search className="w-4 h-4 text-[#627065] shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => setFocused(true)}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search places, temples, malls, stations..."
          aria-label="Search places in Bengaluru"
          className="w-full bg-transparent font-sans font-normal text-[14px] leading-[1.4] tracking-[0em] text-[#1A211C] placeholder:text-[#627065] focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#627065] hover:bg-[#E6F4D7] hover:text-[#1A211C]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {focused && (
          <motion.div
            initial={{opacity: 0, y: 6, scale: 0.98}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 4, scale: 0.98}}
            transition={{duration: 0.16, ease: [0.22, 1, 0.36, 1]}}
            className="absolute left-0 right-0 mt-2 z-50 rounded-[18px] bg-white border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.12)] overflow-hidden max-h-[65vh] overflow-y-auto krowd-scroll-y overscroll-contain touch-pan-y origin-top will-change-[transform,opacity]"
          >
            {recentSearches.length > 0 && !trimmed && (
              <div className="px-4 pt-3 pb-2 border-b border-[#D1E7BD]/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#627065]">Recent searches</span>
                  <button
                    type="button"
                    onClick={onClearRecentSearches}
                    className="text-xs text-[#627065] hover:text-[#1A211C]"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => onSearchChange(term)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E6F4D7] hover:bg-[#D1E7BD] text-xs font-medium text-[#1A211C] transition-colors"
                    >
                      <Clock className="w-3 h-3 text-[#627065]" aria-hidden="true" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchingCategories.length > 0 && (
              <div className="px-4 py-2.5 border-b border-[#D1E7BD]/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-xs text-[#627065] shrink-0 mr-1">Categories:</span>
                {matchingCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat);
                      setFocused(false);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#F2FAE8] hover:bg-[#A3E635]/40 active:scale-[0.97] text-xs font-medium text-[#1A211C] whitespace-nowrap shrink-0 transition-[transform,background-color] duration-150 ease-out"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="p-2">
              <div className="px-2 py-1 text-xs font-medium text-[#627065]">
                {trimmed ? 'Matching locations' : 'Suggested in Bengaluru'}
              </div>
              {matchingPlaces.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[#627065]">
                  No places found for &ldquo;{searchQuery}&rdquo;. Try a temple, park, mall, or metro station.
                </div>
              ) : (
                <ul className="divide-y divide-[#D1E7BD]/50">
                  {matchingPlaces.map((place) => {
                    const crowdColor = CROWD_COLORS[place.crowd.crowdLevel];
                    const dist = formatDistance(place.distanceKm);
                    return (
                      <li key={place.id}>
                        <button
                          type="button"
                          onClick={() => handlePickPlace(place)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#E6F4D7]/55 active:scale-[0.98] text-left transition-[transform,background-color] duration-150 ease-out"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#E6F4D7]">
                            <PlacePhoto
                              imageKey={place.imageKey}
                              imageUrl={place.imageUrl}
                              name={place.name}
                              category={place.category}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[#1A211C] truncate">
                              {place.name}
                            </div>
                            <div className="text-xs text-[#627065] truncate">
                              {place.category} · {place.neighborhood}
                              {dist ? ` · ${dist}` : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div
                              className="inline-flex items-center gap-1.5 text-xs font-semibold"
                              style={{color: crowdColor.textHex}}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{backgroundColor: crowdColor.hex}}
                                aria-hidden="true"
                              />
                              <span>{place.crowd.crowdLevel}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
