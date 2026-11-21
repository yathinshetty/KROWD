import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, LayoutGroup, motion} from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  LocateFixed,
  Navigation2,
  TrendingUp,
} from 'lucide-react';
import {Analytics} from '@vercel/analytics/react';
import type {
  PlaceCategory,
  PlaceIntelligence,
  PlaceSummary,
  WeatherCurrent,
} from './types/krowd';
import {fetchPlaceIntelligence, fetchPlaces} from './services/api';
import {
  applyCachedSignalsToPlaceSummary,
  buildSummaryPatchFromIntelligence,
  enrichPlaceIntelligence,
  enrichPlacesWithLiveSignals,
  refreshViewportTraffic,
  type ViewportBounds,
} from './services/liveIntelligence';
import {useGeolocation} from './hooks/useGeolocation';
import {useRecentSearches} from './hooks/useRecentSearches';
import {
  ALL_CATEGORIES,
  CROWD_COLORS,
  formatDistance,
  isTransportSearchQuery,
} from './utils/crowdStyles';
import {BengaluruMap} from './components/map/BengaluruMap';
import {SearchBar} from './components/search/SearchBar';
import {DiscoverDrawer} from './components/discover/DiscoverDrawer';
import {LocationDetailsContent} from './components/place/LocationDetailsContent';
import {MobileBottomSheet, type SheetState} from './components/place/MobileBottomSheet';
import {OfflineBanner, PWAInstallButton} from './components/common/PWAInstallButton';
import {CategoryIcon, WeatherIcon} from './components/common/CategoryIcon';
import {LogoMark} from './components/common/Logo';
import {NearbyPage} from './pages/NearbyPage';
import {InsightsPage} from './pages/InsightsPage';

type ActiveTab = 'explore' | 'nearby' | 'insights';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('explore');
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [cityWeather, setCityWeather] = useState<WeatherCurrent | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<PlaceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<PlaceIntelligence | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [desktopDiscoverOpen, setDesktopDiscoverOpen] = useState(true);
  const [mobileSheetState, setMobileSheetState] = useState<SheetState>('collapsed');
  const [flyToCoords, setFlyToCoords] = useState<{
    lat: number;
    lon: number;
    zoom?: number;
  } | null>(null);

  const {userCoords, status: geoStatus, requestLocation} = useGeolocation();
  const {recentSearches, addSearch, clearSearches} = useRecentSearches();
  const viewportBoundsRef = useRef<ViewportBounds | null>(null);
  const placesRef = useRef<PlaceSummary[]>([]);
  placesRef.current = places;
  const viewportTimerRef = useRef<number | null>(null);

  const loadPlaces = useCallback(async () => {
    try {
      const res = await fetchPlaces({
        lat: userCoords?.latitude,
        lon: userCoords?.longitude,
      });
      const initialPlaces = res.places.map((p) => applyCachedSignalsToPlaceSummary(p));
      setPlaces(initialPlaces);
      setCityWeather(res.cityWeather);
      setLoadingPlaces(false);

      // Enrich with live Open-Meteo weather + viewport-scoped TomTom Traffic Flow signals
      const live = await enrichPlacesWithLiveSignals(initialPlaces, viewportBoundsRef.current);
      setPlaces(live.places);
      if (live.cityWeather) {
        setCityWeather(live.cityWeather);
      }
    } catch {
      // keep existing places if network drops
    } finally {
      setLoadingPlaces(false);
    }
  }, [userCoords?.latitude, userCoords?.longitude]);

  useEffect(() => {
    loadPlaces();
    return () => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }
    };
  }, [loadPlaces]);

  const handleViewportChange = useCallback((bounds: ViewportBounds) => {
    viewportBoundsRef.current = bounds;
    if (viewportTimerRef.current !== null) {
      window.clearTimeout(viewportTimerRef.current);
    }
    viewportTimerRef.current = window.setTimeout(async () => {
      const current = placesRef.current;
      if (current.length === 0) return;
      const updated = await refreshViewportTraffic(current, bounds);
      if (updated) {
        setPlaces(updated);
      }
    }, 450);
  }, []);

  const loadPlaceDetails = useCallback(async (placeId: string) => {
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const data = await fetchPlaceIntelligence(placeId);
      const enriched = await enrichPlaceIntelligence(data);
      setIntelligence(enriched);
      const patch = buildSummaryPatchFromIntelligence(enriched);
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? {...p, ...patch} : p)));
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Unable to load location details.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const handleSelectPlace = useCallback(
    (placeId: string) => {
      if (placeId !== selectedPlaceId) {
        setIntelligence(null);
      }
      setSelectedPlaceId(placeId);
      setActiveTab('explore');
      setMobileSheetState('half');
      loadPlaceDetails(placeId);
    },
    [loadPlaceDetails, selectedPlaceId]
  );

  const handleClosePlace = useCallback(() => {
    setSelectedPlaceId(null);
    setIntelligence(null);
    setMobileSheetState('collapsed');
  }, []);

  const toggleCategory = useCallback((cat: 'All' | PlaceCategory) => {
    if (cat === 'All') {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const allowTransportFromSearch = isTransportSearchQuery(q);

    return places.filter((p) => {
      const qMatch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));

      if (!qMatch) return false;

      if (selectedCategories.length > 0) {
        return selectedCategories.includes(p.category);
      }

      if (p.type === 'transport') {
        return allowTransportFromSearch;
      }

      return true;
    });
  }, [places, selectedCategories, searchQuery]);

  const visitingFallbackPlaces = useMemo(
    () => places.filter((p) => p.type === 'visit'),
    [places]
  );

  const selectedSummary = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId]
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#E6F4D7] text-[#1A211C]">
      {/* Desktop Top Navigation */}
      <header className="hidden md:flex items-center justify-between gap-8 px-6 h-16 bg-white/95 backdrop-blur-md border-b border-[#D1E7BD] z-40 shrink-0">
        {/* Zone 1: Brand */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('explore');
              setFlyToCoords({lat: 13.02, lon: 77.55, zoom: 10.2});
            }}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogoMark size="md" />
            <span className="font-display font-extrabold text-[20px] leading-none tracking-[-0.03em] text-[#1A211C]">
              KROWD
            </span>
          </button>
        </div>

        {/* Zone 2: Primary Navigation Tabs */}
        <nav aria-label="Primary navigation" className="flex items-center gap-7">
          {(
            [
              {id: 'explore', label: 'Explore'},
              {id: 'nearby', label: 'Nearby'},
              {id: 'insights', label: 'Insights'},
            ] as const
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-1 font-sans font-semibold text-[14px] leading-[1.2] tracking-[-0.01em] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'text-[#1A211C]' : 'text-[#627065] hover:text-[#1A211C]'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="desktop-nav-underline"
                    transition={{type: 'spring', stiffness: 380, damping: 30}}
                    className="absolute left-0 right-0 -bottom-[19px] h-0.5 bg-[#121814] will-change-transform"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Weather + Location Action */}
        <div className="flex items-center gap-3 shrink-0">
          {cityWeather?.available && cityWeather.temperatureC !== null && (
            <div className="flex items-center gap-2 font-sans font-medium text-[13px] tabular-nums tracking-[0em] text-[#1A211C] whitespace-nowrap">
              <WeatherIcon code={cityWeather.weatherCode} className="w-4 h-4 text-[#627065]" />
              <span className="font-medium">{cityWeather.temperatureC}°C</span>
              <span className="text-[#627065] hidden lg:inline">· {cityWeather.condition}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              requestLocation();
              if (userCoords) {
                setActiveTab('explore');
                setFlyToCoords({
                  lat: userCoords.latitude,
                  lon: userCoords.longitude,
                  zoom: 13.4,
                });
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E6F4D7] border border-[#D1E7BD] hover:bg-[#D1E7BD]/60 font-sans font-medium text-[13px] tabular-nums tracking-[0em] text-[#1A211C] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <LocateFixed
              className={`w-3.5 h-3.5 ${userCoords ? 'text-[#84CC16]' : 'text-[#1A211C]'}`}
              aria-hidden="true"
            />
            <span>{userCoords ? 'Near Me' : 'Detect Location'}</span>
          </button>

          <PWAInstallButton />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 min-h-0 overflow-hidden">
        <div
          data-active={activeTab === 'explore'}
          aria-hidden={activeTab !== 'explore'}
          className="krowd-tab-panel"
        >
          <div
            className={`relative w-full h-full will-change-transform transition-transform duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              activeTab === 'explore' ? 'translate-y-0' : 'translate-y-1.5'
            }`}
          >
            {/* Full Interactive MapLibre Map */}
            <BengaluruMap
              places={filteredPlaces}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={handleSelectPlace}
              userCoords={userCoords}
              onRequestLocation={requestLocation}
              flyToCoords={flyToCoords}
              onViewportChange={handleViewportChange}
            />

            {/* Floating Top Search & Category Filter Overlay */}
            <div className="absolute top-3 left-0 right-0 md:top-4 md:left-4 md:right-auto md:w-[540px] lg:w-[600px] z-20 space-y-2.5 pointer-events-none">
              {/* Mobile Top Compact Brand + Search Row */}
              <div className="flex items-center gap-2 pointer-events-auto pl-4 pr-3 md:px-0">
                <div className="md:hidden px-3 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] flex items-center gap-2 shrink-0">
                  <LogoMark size="sm" />
                  <span className="font-display font-extrabold text-[16px] leading-none tracking-[-0.03em] text-[#1A211C]">
                    KROWD
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <SearchBar
                    places={places}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSelectPlace={(p) => {
                      handleSelectPlace(p.id);
                      setFlyToCoords({lat: p.latitude, lon: p.longitude, zoom: 14});
                    }}
                    onSelectCategory={(cat) => toggleCategory(cat)}
                    recentSearches={recentSearches}
                    onAddRecentSearch={addSearch}
                    onClearRecentSearches={clearSearches}
                    compact
                  />
                </div>
              </div>

              {/* Category Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pointer-events-auto pb-1 pl-4 pr-8 md:-ml-4 md:pl-4 [mask-image:linear-gradient(to_right,transparent_0px,black_16px,black_calc(100%-32px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0px,black_16px,black_calc(100%-32px),transparent_100%)]">
                {ALL_CATEGORIES.map((cat) => {
                  const isActive =
                    cat === 'All'
                      ? selectedCategories.length === 0
                      : selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-sans font-semibold text-[13px] leading-[1.2] tracking-[-0.005em] whitespace-nowrap shrink-0 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] will-change-transform shadow-[0_10px_30px_rgba(40,60,30,0.08)] min-h-[36px] ${
                        isActive
                          ? 'bg-[#121814] text-white border border-[#121814]'
                          : 'bg-white text-[#627065] border border-[#D1E7BD] hover:bg-[#E6F4D7] hover:text-[#1A211C]'
                      }`}
                    >
                      {cat !== 'All' && (
                        <CategoryIcon category={cat} className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Floating Bottom Discovery Rail */}
            {!selectedPlaceId && (
              <div className="hidden md:block absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                <div className="max-w-6xl mx-auto pointer-events-auto rounded-3xl bg-white/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between gap-4 border-b border-[#D1E7BD]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-[#1A211C]">
                        Discover Bengaluru
                      </span>
                      <span className="text-xs text-[#627065] truncate">
                        {filteredPlaces.length} verified places · Know the crowd. Plan better.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDesktopDiscoverOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6F4D7] hover:bg-[#D1E7BD] text-xs font-semibold text-[#1A211C] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{desktopDiscoverOpen ? 'Minimize' : 'Expand'}</span>
                      {desktopDiscoverOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {desktopDiscoverOpen && (
                    <div className="p-4">
                      <DiscoverDrawer
                        places={filteredPlaces.length > 0 ? filteredPlaces : visitingFallbackPlaces}
                        cityWeather={cityWeather}
                        selectedPlaceId={selectedPlaceId}
                        onSelectPlace={handleSelectPlace}
                        hasUserCoords={Boolean(userCoords)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Floating Right-Side Location Details Panel */}
            <AnimatePresence>
              {selectedPlaceId && (
                <motion.aside
                  initial={{opacity: 0, x: 24, scale: 0.98}}
                  animate={{opacity: 1, x: 0, scale: 1}}
                  exit={{opacity: 0, x: 24, scale: 0.98}}
                  transition={{type: 'spring', stiffness: 380, damping: 30}}
                  aria-label="Selected location intelligence"
                  className="hidden md:flex flex-col fixed top-20 right-4 bottom-4 w-[430px] lg:w-[460px] z-30 rounded-3xl bg-white border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.12)] overflow-hidden will-change-transform"
                >
                  <div className="flex-1 overflow-y-auto krowd-scroll-y touch-pan-y p-4">
                    <LocationDetailsContent
                      intelligence={intelligence}
                      loading={loadingDetails}
                      error={detailsError}
                      distanceKm={selectedSummary?.distanceKm}
                      userCoords={userCoords}
                      onClose={handleClosePlace}
                      onRefresh={() => {
                        if (selectedPlaceId) {
                          loadPlaceDetails(selectedPlaceId);
                          loadPlaces();
                        }
                      }}
                    />
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Mobile 3-State Expandable Bottom Sheet */}
            <MobileBottomSheet
              sheetState={mobileSheetState}
              onChangeState={setMobileSheetState}
              collapsedHeader={
                selectedSummary ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#1A211C] truncate">
                        {selectedSummary.name}
                      </div>
                      <div className="text-xs text-[#627065] truncate">
                        {selectedSummary.category}
                        {formatDistance(selectedSummary.distanceKm)
                          ? ` · ${formatDistance(selectedSummary.distanceKm)}`
                          : ` · ${selectedSummary.neighborhood}`}
                      </div>
                    </div>
                    <span
                      className="text-xs font-bold shrink-0"
                      style={{
                        color: CROWD_COLORS[selectedSummary.crowd.crowdLevel].textHex,
                      }}
                    >
                      {selectedSummary.crowd.crowdLevel}
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-[#1A211C]">
                      Explore Karnataka
                    </div>
                    <div className="text-xs text-[#627065] truncate">
                      {cityWeather?.available && cityWeather.temperatureC !== null
                        ? `${cityWeather.temperatureC}°C · ${cityWeather.condition} · `
                        : ''}
                      Swipe up for recommendations &amp; city conditions
                    </div>
                  </div>
                )
              }
            >
              {selectedPlaceId ? (
                <LocationDetailsContent
                  intelligence={intelligence}
                  loading={loadingDetails}
                  error={detailsError}
                  distanceKm={selectedSummary?.distanceKm}
                  userCoords={userCoords}
                  onClose={handleClosePlace}
                  onRefresh={() => {
                    if (selectedPlaceId) {
                      loadPlaceDetails(selectedPlaceId);
                      loadPlaces();
                    }
                  }}
                />
              ) : (
                <DiscoverDrawer
                  places={filteredPlaces.length > 0 ? filteredPlaces : visitingFallbackPlaces}
                  cityWeather={cityWeather}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={handleSelectPlace}
                  hasUserCoords={Boolean(userCoords)}
                />
              )}
            </MobileBottomSheet>
          </div>
        </div>

        <div
          data-active={activeTab === 'nearby'}
          aria-hidden={activeTab !== 'nearby'}
          className="krowd-tab-panel krowd-tab-panel-slide overflow-y-auto krowd-scroll-y touch-pan-y"
        >
          <NearbyPage
            places={places}
            loading={loadingPlaces}
            userCoords={userCoords}
            geoStatus={geoStatus}
            onRetryLocation={requestLocation}
            onSelectPlace={handleSelectPlace}
          />
        </div>

        <div
          data-active={activeTab === 'insights'}
          aria-hidden={activeTab !== 'insights'}
          className="krowd-tab-panel krowd-tab-panel-slide overflow-y-auto krowd-scroll-y touch-pan-y"
        >
          <InsightsPage userCoords={userCoords} onSelectPlace={handleSelectPlace} />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile primary navigation"
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-xl border border-[#D1E7BD]/60 shadow-[0_16px_40px_rgba(18,24,20,0.18)] rounded-full px-2 py-2 flex items-center gap-1 will-change-transform"
      >
        <LayoutGroup id="mobile-nav-pill">
          {(
            [
              {id: 'explore', label: 'Explore', icon: Compass},
              {id: 'nearby', label: 'Nearby', icon: Navigation2},
              {id: 'insights', label: 'Insights', icon: TrendingUp},
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onPointerDown={() => setActiveTab(tab.id)}
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-[transform,color] duration-150 ease-out active:scale-[0.97] whitespace-nowrap min-h-[40px] cursor-pointer ${
                  active ? 'text-white' : 'text-[#627065] hover:text-[#1A211C]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="navPillHighlight"
                    transition={{duration: 0.28, ease: [0.22, 1, 0.36, 1]}}
                    style={{willChange: 'transform'}}
                    className="absolute inset-0 rounded-full bg-[#1A211C]"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 shrink-0 ${
                    active ? 'stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                  aria-hidden="true"
                />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </LayoutGroup>
      </nav>

      <OfflineBanner />
      <Analytics />
    </div>
  );
}