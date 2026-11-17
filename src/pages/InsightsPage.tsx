import React, {useEffect, useState} from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Car,
  Info,
  TrendingDown,
  TrendingUp,
  Umbrella,
} from 'lucide-react';
import type {CityInsightsPayload} from '../types/krowd';
import type {UserCoordinates} from '../hooks/useGeolocation';
import {fetchCityInsights} from '../services/api';
import {
  applyCachedSignalsToPlaceSummary,
  fetchLiveTrafficFlow,
  fetchLiveWeather,
} from '../services/liveIntelligence';
import {CROWD_COLORS, TRAFFIC_COLORS, formatSourceLabel} from '../utils/crowdStyles';
import {resolveNearestCity} from '../utils/cityHubs';
import {WeatherIcon} from '../components/common/CategoryIcon';
import {PlacePhoto} from '../components/common/PlacePhoto';

interface InsightsPageProps {
  userCoords?: UserCoordinates | null;
  onSelectPlace: (placeId: string) => void;
}

export const InsightsPage: React.FC<InsightsPageProps> = React.memo(({userCoords, onSelectPlace}) => {
  const [data, setData] = useState<CityInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userLat = userCoords?.latitude ?? null;
  const userLon = userCoords?.longitude ?? null;
  const resolvedCity = resolveNearestCity(userLat, userLon);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, liveWeather] = await Promise.all([
        fetchCityInsights({lat: userLat, lon: userLon}),
        fetchLiveWeather(resolvedCity.lat, resolvedCity.lon),
      ]);

      const anchorPlace = res.busyLocations[0] ?? res.popularLocations[0] ?? null;
      const liveTraffic = anchorPlace
        ? await fetchLiveTrafficFlow({
            placeId: `insights_${resolvedCity.cityName.toLowerCase()}`,
            latitude: resolvedCity.lat,
            longitude: resolvedCity.lon,
            category: anchorPlace.category,
          }).catch(() => null)
        : null;

      const weatherCurrent = liveWeather?.payload.current ?? res.weather;
      const busyLocations = res.busyLocations.map((p) =>
        applyCachedSignalsToPlaceSummary(p, weatherCurrent)
      );
      const quietLocations = res.quietLocations.map((p) =>
        applyCachedSignalsToPlaceSummary(p, weatherCurrent)
      );
      const popularLocations = res.popularLocations.map((p) =>
        applyCachedSignalsToPlaceSummary(p, weatherCurrent)
      );

      setData({
        ...res,
        cityName: res.cityName || resolvedCity.cityName,
        weather: weatherCurrent,
        overallTraffic: liveTraffic?.isLive
          ? {
              ...res.overallTraffic,
              level: liveTraffic.congestionLevel,
              source: 'LIVE DATA',
              isDemoData: false,
            }
          : res.overallTraffic,
        busyLocations,
        quietLocations,
        popularLocations,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load city insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLat, userLon]);

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-5 pb-24">
        <div className="h-10 w-64 rounded-xl bg-white animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 rounded-[18px] bg-white animate-pulse" />
          <div className="h-36 rounded-[18px] bg-white animate-pulse" />
          <div className="h-36 rounded-[18px] bg-white animate-pulse" />
        </div>
        <div className="h-64 rounded-[24px] bg-white animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-sm font-medium text-[#1A211C]">{error ?? 'Insights unavailable'}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-xl bg-[#121814] text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const cityName = data.cityName || resolvedCity.cityName;
  const trafficStyle = TRAFFIC_COLORS[data.overallTraffic.level];
  const totalPlaces = data.categoryBreakdown.reduce((sum, item) => sum + item.placeCount, 0);

  return (
    <div className="min-h-full bg-[#E6F4D7] pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="font-display font-bold text-[24px] leading-[1.2] tracking-[-0.02em] text-[#1A211C] text-balance">
              {cityName} City Insights
            </h1>
            <span className="font-sans font-normal text-[12px] leading-[1.3] tabular-nums text-[#627065]">
              Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
            </span>
          </div>
          <div className="flex items-center shrink-0">
            <span className="inline-flex items-center bg-[#FFFFFF] border border-[#D1E7BD] rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#1A211C] shadow-xs tabular-nums whitespace-nowrap">
              {totalPlaces} places
            </span>
          </div>
        </div>

        {/* City Overview Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weather Card */}
          <div className="rounded-[20px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div className="flex items-center justify-between text-xs text-[#627065]">
              <span>{cityName} Weather</span>
              <span className="font-sans font-medium text-[11px] leading-[1.3] text-[#627065] tabular-nums">
                {formatSourceLabel(data.weather.source)} · {data.weather.provider}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4D7] flex items-center justify-center text-[#1A211C]">
                <WeatherIcon code={data.weather.weatherCode} className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-2xl font-bold tabular-nums text-[#1A211C]">
                  {data.weather.available && data.weather.temperatureC !== null
                    ? `${data.weather.temperatureC}°C`
                    : 'N/A'}
                </div>
                <div className="font-sans text-xs text-[#627065]">{data.weather.condition}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 font-sans text-xs text-[#627065] pt-1 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Umbrella className="w-3.5 h-3.5" aria-hidden="true" />
                Rain {data.weather.rainProbabilityPercent ?? 0}%
              </span>
              <span>Humidity {data.weather.humidityPercent ?? 0}%</span>
            </div>
          </div>

          {/* Traffic Card */}
          <div className="rounded-[20px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div className="flex items-center justify-between text-xs text-[#627065]">
              <span>City Traffic Conditions</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{backgroundColor: trafficStyle.softBg, color: trafficStyle.textHex}}
              >
                <Car className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xl font-bold" style={{color: trafficStyle.textHex}}>
                  {data.overallTraffic.level}
                </div>
                <div className="text-xs text-[#627065]">Major arterial corridors</div>
              </div>
            </div>
          </div>

          {/* Unusual / Highlighted Activity (Obsidian Dark Contrast Card) */}
          <div className="rounded-[20px] bg-[#121814] text-white p-5 shadow-[0_10px_30px_rgba(40,60,30,0.12)] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-white/75">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Activity className="w-3.5 h-3.5 text-[#A3E635]" aria-hidden="true" />
                <span>Notable Activity</span>
              </span>
              <span className="text-[#A3E635]">City pulse</span>
            </div>
            {data.unusualActivity.length > 0 ? (
              <div className="space-y-2">
                {data.unusualActivity.slice(0, 2).map((item) => (
                  <button
                    key={item.placeId}
                    type="button"
                    onClick={() => onSelectPlace(item.placeId)}
                    className="w-full text-left rounded-xl bg-white/8 border border-white/10 hover:bg-white/14 active:scale-[0.98] p-2.5 transition-[transform,background-color] duration-150 ease-out will-change-transform"
                  >
                    <div className="text-xs font-bold text-white truncate">
                      {item.placeName} · {item.crowdLevel}
                    </div>
                    <div className="text-[11px] text-white/70 truncate">{item.reason}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/75 leading-relaxed pt-1">
                No unusual spikes reported across tracked {cityName} destinations right now.
              </p>
            )}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hourly City Rhythm */}
          <div className="rounded-[24px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#1A211C]">{cityName} Daily Crowd Rhythm</h2>
                <p className="font-sans text-xs text-[#627065]">
                  Typical citywide visitor curve · Historical baseline
                </p>
              </div>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.hourlyCityRhythm} margin={{top: 10, right: 8, left: -24, bottom: 0}}>
                  <defs>
                    <linearGradient id="krowdArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#A3E635" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="hourLabel"
                    tick={{fontSize: 11, fill: '#627065'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{fontSize: 11, fill: '#627065'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({active, payload}) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as {
                        hourLabel: string;
                        intensity: number;
                        label: string;
                      };
                      return (
                        <div className="rounded-xl bg-[#121814] px-3 py-2 text-xs text-white shadow-lg">
                          <div className="font-semibold">
                            {pt.hourLabel} · {pt.label}
                          </div>
                          <div className="text-[#A3E635] font-sans tabular-nums">
                            City index: {pt.intensity}%
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="intensity"
                    stroke="#84CC16"
                    strokeWidth={2.5}
                    fill="url(#krowdArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="rounded-[24px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#1A211C]">Crowd Intensity by Category</h2>
              <p className="font-sans text-xs text-[#627065]">
                Current average load across tracked {cityName} categories
              </p>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.categoryBreakdown}
                  margin={{top: 10, right: 8, left: -24, bottom: 0}}
                >
                  <XAxis
                    dataKey="category"
                    tick={{fontSize: 10, fill: '#627065'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{fontSize: 11, fill: '#627065'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({active, payload}) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as {
                        category: string;
                        averageIntensity: number;
                        dominantLevel: string;
                      };
                      return (
                        <div className="rounded-xl bg-[#121814] px-3 py-2 text-xs text-white shadow-lg">
                          <div className="font-semibold">{item.category}</div>
                          <div className="text-[#A3E635] font-sans tabular-nums">
                            Avg {item.averageIntensity}% ({item.dominantLevel})
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="averageIntensity" radius={[8, 8, 2, 2]}>
                    {data.categoryBreakdown.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={CROWD_COLORS[entry.dominantLevel].hex}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Busy vs Less Crowded Destinations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-[24px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#B91C1C]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#1A211C]">Currently Busy Locations</h2>
            </div>
            <div className="divide-y divide-[#D1E7BD]/60">
              {data.busyLocations.map((place) => {
                const c = CROWD_COLORS[place.crowd.crowdLevel];
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => onSelectPlace(place.id)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#E6F4D7]/50 active:scale-[0.98] rounded-xl px-2 transition-[transform,background-color] duration-150 ease-out will-change-transform"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#E6F4D7]">
                        <PlacePhoto
                          imageKey={place.imageKey}
                          imageUrl={place.imageUrl}
                          name={place.name}
                          category={place.category}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1A211C] truncate">
                          {place.name}
                        </div>
                        <div className="text-xs text-[#627065] truncate">
                          {place.category} · {place.neighborhood}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-sans font-semibold text-[12px] leading-[1.3] tracking-[0em]" style={{color: c.textHex}}>
                        {place.crowd.crowdLevel}
                      </div>
                      <div className="font-sans text-[11px] tabular-nums text-[#627065]">
                        {place.crowd.densityPercent}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] bg-white border border-[#D1E7BD] p-5 shadow-[0_10px_30px_rgba(40,60,30,0.08)] space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#1A211C]">Less Crowded Destinations</h2>
            </div>
            <div className="divide-y divide-[#D1E7BD]/60">
              {data.quietLocations.map((place) => {
                const c = CROWD_COLORS[place.crowd.crowdLevel];
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => onSelectPlace(place.id)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#E6F4D7]/50 active:scale-[0.98] rounded-xl px-2 transition-[transform,background-color] duration-150 ease-out will-change-transform"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#E6F4D7]">
                        <PlacePhoto
                          imageKey={place.imageKey}
                          imageUrl={place.imageUrl}
                          name={place.name}
                          category={place.category}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1A211C] truncate">
                          {place.name}
                        </div>
                        <div className="text-xs text-[#627065] truncate">
                          {place.category} · {place.neighborhood}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-sans font-semibold text-[12px] leading-[1.3] tracking-[0em]" style={{color: c.textHex}}>
                        {place.crowd.crowdLevel}
                      </div>
                      <div className="font-sans text-[11px] tabular-nums text-[#627065]">
                        {place.crowd.densityPercent}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Transparency Notice */}
        <div className="rounded-[18px] bg-white border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] p-4 flex items-start gap-2.5 text-xs text-[#627065]">
          <Info className="w-4 h-4 text-[#1A211C] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">{data.transparencyNote}</p>
        </div>
      </div>
    </div>
  );
});
