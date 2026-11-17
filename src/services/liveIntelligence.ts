import type {
  CrowdLevel,
  CrowdObservation,
  HourlyCrowdPrediction,
  HourlyWeatherPoint,
  DailyWeatherPoint,
  PlaceCategory,
  PlaceIntelligence,
  PlaceSummary,
  TrafficCondition,
  TrafficLevel,
  UserCrowdReport,
  WeatherCurrent,
  WeatherPayload,
} from '../types/krowd';
import {formatTrafficStatusLabel} from '../utils/crowdStyles';

const TOMTOM_API_KEY =
  import.meta.env.VITE_TOMTOM_API_KEY || 'xvXofCgdCNDJiaEHSXQdGT3NY7lbh6Kv';

const TRAFFIC_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REPORT_TTL_MS = 90 * 60 * 1000; // 90 minutes

const TRAFFIC_CACHE_PREFIX = 'krowd_live_traffic_v1_';
const WEATHER_CACHE_PREFIX = 'krowd_live_weather_v1_';
const LOCAL_REPORTS_KEY = 'krowd_crowd_reports_v1';

const BENGALURU_CENTER = {lat: 12.9716, lon: 77.5946};

const CATEGORY_WEEKDAY_CURVES: Record<PlaceCategory, number[]> = {
  Temples: [5, 5, 5, 6, 12, 24, 42, 60, 68, 62, 54, 48, 35, 22, 20, 28, 44, 64, 74, 68, 42, 18, 8, 5],
  Parks: [4, 4, 4, 5, 14, 48, 66, 62, 46, 36, 30, 28, 25, 24, 28, 38, 58, 68, 52, 28, 12, 6, 4, 4],
  Malls: [4, 4, 4, 4, 4, 4, 5, 8, 12, 20, 34, 48, 58, 62, 60, 62, 68, 76, 84, 86, 78, 54, 22, 8],
  'Tourist Places': [
    4, 4, 4, 4, 5, 8, 14, 24, 38, 54, 68, 74, 70, 62, 64, 66, 58, 42, 24, 14, 8, 5, 4, 4,
  ],
  Transport: [
    24, 18, 14, 16, 26, 42, 58, 76, 88, 86, 74, 64, 60, 62, 64, 70, 80, 90, 92, 84, 68, 52, 38, 28,
  ],
  Markets: [
    12, 14, 18, 28, 48, 68, 80, 82, 76, 72, 68, 64, 58, 56, 60, 68, 76, 80, 74, 58, 38, 22, 14, 12,
  ],
  Restaurants: [
    10, 6, 4, 4, 4, 5, 10, 28, 46, 42, 32, 44, 68, 74, 54, 36, 38, 54, 72, 86, 88, 76, 52, 24,
  ],
  Events: [4, 4, 4, 4, 4, 5, 8, 16, 28, 46, 62, 70, 68, 62, 64, 68, 72, 74, 68, 52, 32, 16, 8, 5],
};

const CATEGORY_WEEKEND_MULTIPLIER: Record<PlaceCategory, number> = {
  Temples: 1.2,
  Parks: 1.24,
  Malls: 1.28,
  'Tourist Places': 1.26,
  Transport: 0.86,
  Markets: 1.15,
  Restaurants: 1.24,
  Events: 1.3,
};

interface CachedEntry<T> {
  expiresAt: number;
  cachedAt: number;
  value: T;
}

export interface LiveTrafficResult {
  congestionLevel: TrafficLevel;
  trafficLabel: string;
  intensityPercent: number;
  estimatedDelayMinutes: number;
  roadCondition: string;
  trend: TrafficCondition['trend'];
  isLive: boolean;
  currentSpeedKmh: number | null;
  freeFlowSpeedKmh: number | null;
  ratio: number | null;
  observedAt: string;
}

export interface LiveWeatherResult {
  payload: WeatherPayload;
  isLive: boolean;
}

const memoryTrafficCache = new Map<string, CachedEntry<LiveTrafficResult>>();
const memoryWeatherCache = new Map<string, CachedEntry<LiveWeatherResult>>();
const inFlightTraffic = new Map<string, Promise<LiveTrafficResult>>();
const inFlightWeather = new Map<string, Promise<LiveWeatherResult>>();

function readSessionCache<T>(key: string, memoryMap: Map<string, CachedEntry<T>>): T | null {
  const now = Date.now();
  const mem = memoryMap.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.value;
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (parsed && parsed.expiresAt > now && parsed.value !== undefined) {
      memoryMap.set(key, parsed);
      return parsed.value;
    }
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors in restricted environments
  }
  return null;
}

function writeSessionCache<T>(
  key: string,
  value: T,
  ttlMs: number,
  memoryMap: Map<string, CachedEntry<T>>
): void {
  const entry: CachedEntry<T> = {
    value,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  memoryMap.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors
  }
}

export function getIstClock(date = new Date()): {
  hour24: number;
  minute: number;
  dayOfWeek: number;
  isWeekend: boolean;
  dateIso: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const rawHour = Number(map.get('hour') ?? '12');
  const hour24 = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.get('minute') ?? '0');
  const weekdayStr = map.get('weekday') ?? 'Mon';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[weekdayStr] ?? 1;
  const dateIso = `${map.get('year')}-${map.get('month')}-${map.get('day')}`;

  return {
    hour24,
    minute,
    dayOfWeek,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    dateIso,
  };
}

export function scoreToCrowdLevel(score: number): CrowdLevel {
  if (score < 32) return 'Low';
  if (score < 58) return 'Moderate';
  if (score < 78) return 'High';
  return 'Very High';
}

function crowdLevelToScore(level: CrowdLevel): number {
  switch (level) {
    case 'Low':
      return 22;
    case 'Moderate':
      return 48;
    case 'High':
      return 70;
    case 'Very High':
      return 88;
  }
}

export function decodeWeatherCode(code: number | null): string {
  if (code === null || Number.isNaN(code)) return 'Partly Cloudy';
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3 || code === 45 || code === 48) return 'Overcast';
  if (code === 51 || code === 53 || code === 55 || code === 61 || code === 80) {
    return 'Light Rain';
  }
  if (code === 63 || code === 65 || code === 81 || code === 82) {
    return 'Rain';
  }
  if (code === 95 || code === 96 || code === 99) {
    return 'Thunderstorm';
  }
  return 'Partly Cloudy';
}

function isRainyWeather(weatherCode: number | null, rainProbabilityPercent: number | null): boolean {
  if ((rainProbabilityPercent ?? 0) >= 55) return true;
  if (weatherCode !== null && weatherCode >= 51) return true;
  return false;
}

function deriveOutdoorComfort(
  tempC: number | null,
  humidity: number | null,
  rainProb: number | null,
  weatherCode: number | null
): WeatherCurrent['outdoorComfort'] {
  if (tempC === null) return 'Unavailable';
  if (isRainyWeather(weatherCode, rainProb)) return 'Rainy';
  if (tempC >= 31) return 'Warm';
  if ((humidity ?? 0) >= 78 && tempC >= 25) return 'Humid';
  return 'Comfortable';
}

function formatHourLabel(isoTime: string): string {
  const hour = Number(isoTime.slice(11, 13));
  if (Number.isNaN(hour)) return isoTime;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

function formatHour12(hour24: number): string {
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h} ${suffix}`;
}

function buildFallbackTraffic(category: PlaceCategory): LiveTrafficResult {
  const clock = getIstClock();
  const baseCurve = CATEGORY_WEEKDAY_CURVES[category] ?? CATEGORY_WEEKDAY_CURVES['Tourist Places'];
  const curveVal = baseCurve[clock.hour24] ?? 40;
  const morningPeak = clock.hour24 >= 8 && clock.hour24 <= 11 ? 26 : 0;
  const eveningPeak = clock.hour24 >= 17 && clock.hour24 <= 21 ? 34 : 0;
  const middayFlow = clock.hour24 >= 12 && clock.hour24 <= 16 ? 16 : 0;
  const weekendLift =
    clock.isWeekend && (category === 'Malls' || category === 'Markets') && clock.hour24 >= 13
      ? 18
      : 0;

  const intensityPercent = Math.min(
    92,
    Math.max(14, Math.round(14 + curveVal * 0.42 + morningPeak + eveningPeak + middayFlow + weekendLift))
  );

  let congestionLevel: TrafficLevel = 'Smooth';
  let estimatedDelayMinutes = 1;
  let roadCondition = 'Steady IST corridor flow along surrounding approach roads';

  if (intensityPercent >= 62) {
    congestionLevel = 'Heavy';
    estimatedDelayMinutes = 14;
    roadCondition = 'Peak-hour congestion expected on primary access roads (IST corridor model)';
  } else if (intensityPercent >= 38) {
    congestionLevel = 'Moderate';
    estimatedDelayMinutes = 6;
    roadCondition = 'Moderate vehicle volume with routine junction waits (IST corridor model)';
  }

  const nextHour = (clock.hour24 + 1) % 24;
  const nextDelta = baseCurve[nextHour] - baseCurve[clock.hour24];
  const trend: TrafficCondition['trend'] =
    nextDelta > 6 ? 'Building' : nextDelta < -6 ? 'Easing' : 'Steady';

  return {
    congestionLevel,
    trafficLabel: formatTrafficStatusLabel(congestionLevel),
    intensityPercent,
    estimatedDelayMinutes,
    roadCondition,
    trend,
    isLive: false,
    currentSpeedKmh: null,
    freeFlowSpeedKmh: null,
    ratio: null,
    observedAt: new Date().toISOString(),
  };
}

export interface ViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom?: number;
}

const DEFAULT_KARNATAKA_BOUNDS: ViewportBounds = {
  south: 11.4,
  west: 73.8,
  north: 18.6,
  east: 78.7,
  zoom: 6.2,
};

export function filterPlacesInViewport(
  places: PlaceSummary[],
  bounds: ViewportBounds | null
): PlaceSummary[] {
  if (!bounds) return places;
  return places.filter(
    (p) =>
      p.latitude >= bounds.south &&
      p.latitude <= bounds.north &&
      p.longitude >= bounds.west &&
      p.longitude <= bounds.east
  );
}

export async function fetchLiveTrafficFlow(params: {
  placeId: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
}): Promise<LiveTrafficResult> {
  const cacheKey = `${TRAFFIC_CACHE_PREFIX}${params.placeId}`;
  const cached = readSessionCache<LiveTrafficResult>(cacheKey, memoryTrafficCache);
  if (cached) {
    return cached;
  }

  const gridCacheKey = `${TRAFFIC_CACHE_PREFIX}grid_${params.latitude.toFixed(2)}_${params.longitude.toFixed(2)}`;
  const cachedGrid = readSessionCache<LiveTrafficResult>(gridCacheKey, memoryTrafficCache);
  if (cachedGrid) {
    writeSessionCache(cacheKey, cachedGrid, TRAFFIC_CACHE_TTL_MS, memoryTrafficCache);
    return cachedGrid;
  }

  const pending = inFlightTraffic.get(params.placeId) ?? inFlightTraffic.get(gridCacheKey);
  if (pending) return pending;

  const promise = (async (): Promise<LiveTrafficResult> => {
    const url =
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
      `?point=${params.latitude.toFixed(5)},${params.longitude.toFixed(5)}&key=${encodeURIComponent(TOMTOM_API_KEY)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(url, {signal: controller.signal});
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`TomTom returned HTTP ${res.status}`);
      }

      const json = (await res.json()) as {
        flowSegmentData?: {
          currentSpeed?: number;
          freeFlowSpeed?: number;
          currentTravelTime?: number;
          freeFlowTravelTime?: number;
          roadClosure?: boolean;
          confidence?: number;
        };
      };

      const flow = json.flowSegmentData;
      if (!flow || typeof flow.currentSpeed !== 'number' || typeof flow.freeFlowSpeed !== 'number') {
        throw new Error('Incomplete TomTom flowSegmentData payload');
      }

      const currentSpeed = Math.max(0, flow.currentSpeed);
      const freeFlowSpeed = Math.max(1, flow.freeFlowSpeed);
      const ratio = currentSpeed / freeFlowSpeed;
      const roadClosure = Boolean(flow.roadClosure);

      let congestionLevel: TrafficLevel = 'Moderate';
      if (roadClosure || ratio < 0.45) {
        congestionLevel = 'Heavy';
      } else if (ratio >= 0.75) {
        congestionLevel = 'Smooth';
      }

      const currentTravelTime = flow.currentTravelTime ?? 0;
      const freeFlowTravelTime = flow.freeFlowTravelTime ?? 0;
      const estimatedDelayMinutes = Math.max(
        0,
        Math.round((currentTravelTime - freeFlowTravelTime) / 60)
      );

      const intensityPercent = Math.min(
        96,
        Math.max(12, Math.round((1 - Math.min(1, ratio)) * 115 + (roadClosure ? 35 : 14)))
      );

      const roundedCurrent = Math.round(currentSpeed);
      const roundedFree = Math.round(freeFlowSpeed);

      let roadCondition = `Live flow at ${roundedCurrent} km/h vs ${roundedFree} km/h free-flow speed`;
      if (roadClosure) {
        roadCondition = `Road closure or severe bottleneck reported nearby (${roundedCurrent} km/h avg)`;
      } else if (congestionLevel === 'Heavy') {
        roadCondition = `Slow-moving traffic at ${roundedCurrent} km/h (free-flow ${roundedFree} km/h)`;
      } else if (congestionLevel === 'Smooth') {
        roadCondition = `Smooth movement at ${roundedCurrent} km/h (free-flow ${roundedFree} km/h)`;
      }

      const clock = getIstClock();
      const curve = CATEGORY_WEEKDAY_CURVES[params.category] ?? CATEGORY_WEEKDAY_CURVES['Tourist Places'];
      const nextDelta = curve[(clock.hour24 + 1) % 24] - curve[clock.hour24];
      const trend: TrafficCondition['trend'] =
        nextDelta > 6 ? 'Building' : nextDelta < -6 ? 'Easing' : 'Steady';

      const result: LiveTrafficResult = {
        congestionLevel,
        trafficLabel: formatTrafficStatusLabel(congestionLevel),
        intensityPercent,
        estimatedDelayMinutes,
        roadCondition,
        trend,
        isLive: true,
        currentSpeedKmh: roundedCurrent,
        freeFlowSpeedKmh: roundedFree,
        ratio: Number(ratio.toFixed(2)),
        observedAt: new Date().toISOString(),
      };

      writeSessionCache(cacheKey, result, TRAFFIC_CACHE_TTL_MS, memoryTrafficCache);
      writeSessionCache(gridCacheKey, result, TRAFFIC_CACHE_TTL_MS, memoryTrafficCache);
      return result;
    } catch {
      return buildFallbackTraffic(params.category);
    } finally {
      inFlightTraffic.delete(params.placeId);
      inFlightTraffic.delete(gridCacheKey);
    }
  })();

  inFlightTraffic.set(params.placeId, promise);
  inFlightTraffic.set(gridCacheKey, promise);
  return promise;
}

export async function fetchLiveWeather(
  latitude: number,
  longitude: number
): Promise<LiveWeatherResult | null> {
  const coordKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cacheKey = `${WEATHER_CACHE_PREFIX}${coordKey}`;
  const cached = readSessionCache<LiveWeatherResult>(cacheKey, memoryWeatherCache);
  if (cached) {
    return cached;
  }

  const pending = inFlightWeather.get(coordKey);
  if (pending) return pending;

  const promise = (async (): Promise<LiveWeatherResult> => {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,apparent_temperature,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,visibility,uv_index` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Asia%2FKolkata&forecast_days=7`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        precipitation_probability?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        apparent_temperature?: number;
        is_day?: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code?: number[];
        visibility?: number[];
        uv_index?: number[];
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };

    const clock = getIstClock();
    const currentPrefix = `${clock.dateIso}T${String(clock.hour24).padStart(2, '0')}`;
    const hourlyTimes = data.hourly?.time ?? [];
    const matchedIdx = Math.max(
      0,
      hourlyTimes.findIndex((t) => t.startsWith(currentPrefix))
    );

    const tempC =
      typeof data.current?.temperature_2m === 'number'
        ? Math.round(data.current.temperature_2m)
        : null;
    const humidity =
      typeof data.current?.relative_humidity_2m === 'number'
        ? Math.round(data.current.relative_humidity_2m)
        : null;
    const rainProbRaw =
      typeof data.current?.precipitation_probability === 'number'
        ? data.current.precipitation_probability
        : data.hourly?.precipitation_probability?.[matchedIdx] ?? null;
    const rainProb = rainProbRaw !== null ? Math.round(rainProbRaw) : null;
    const weatherCode =
      typeof data.current?.weather_code === 'number' ? data.current.weather_code : null;
    const windSpeedKmh =
      typeof data.current?.wind_speed_10m === 'number'
        ? Math.round(data.current.wind_speed_10m)
        : null;
    const feelsLikeC =
      typeof data.current?.apparent_temperature === 'number'
        ? Math.round(data.current.apparent_temperature)
        : tempC;
    const visibilityM = data.hourly?.visibility?.[matchedIdx] ?? null;
    const uvIndex = data.hourly?.uv_index?.[matchedIdx] ?? null;
    const nowIso = new Date().toISOString();

    const current: WeatherCurrent = {
      available: tempC !== null,
      temperatureC: tempC,
      feelsLikeC,
      humidityPercent: humidity,
      rainProbabilityPercent: rainProb,
      windSpeedKmh,
      visibilityKm: visibilityM !== null ? Number((visibilityM / 1000).toFixed(1)) : null,
      uvIndex: uvIndex !== null ? Number(uvIndex.toFixed(1)) : null,
      condition: decodeWeatherCode(weatherCode),
      weatherCode,
      isDay: (data.current?.is_day ?? 1) === 1,
      outdoorComfort: deriveOutdoorComfort(tempC, humidity, rainProb, weatherCode),
      source: 'LIVE DATA',
      provider: 'Open-Meteo',
      observedAt: nowIso,
    };

    const hourly: HourlyWeatherPoint[] = hourlyTimes
      .slice(matchedIdx, matchedIdx + 24)
      .map((timeIso, offset) => {
        const idx = matchedIdx + offset;
        const code = data.hourly?.weather_code?.[idx] ?? weatherCode ?? 2;
        return {
          timeIso,
          hourLabel: formatHourLabel(timeIso),
          temperatureC: Math.round(data.hourly?.temperature_2m?.[idx] ?? tempC ?? 24),
          rainProbabilityPercent: Math.round(
            data.hourly?.precipitation_probability?.[idx] ?? rainProb ?? 10
          ),
          condition: decodeWeatherCode(code),
          weatherCode: code,
        };
      });

    const daily: DailyWeatherPoint[] = (data.daily?.time ?? []).map((dateIso, idx) => {
      const code = data.daily?.weather_code?.[idx] ?? weatherCode ?? 2;
      const d = new Date(`${dateIso}T12:00:00+05:30`);
      const dayName = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(d);

      return {
        dateIso,
        dayName,
        tempMaxC: Math.round(data.daily?.temperature_2m_max?.[idx] ?? 29),
        tempMinC: Math.round(data.daily?.temperature_2m_min?.[idx] ?? 19),
        rainProbabilityPercent: Math.round(
          data.daily?.precipitation_probability_max?.[idx] ?? 15
        ),
        condition: decodeWeatherCode(code),
        weatherCode: code,
      };
    });

    const result: LiveWeatherResult = {
      payload: {current, hourly, daily},
      isLive: true,
    };

    writeSessionCache(cacheKey, result, WEATHER_CACHE_TTL_MS, memoryWeatherCache);
    return result;
  })();

  inFlightWeather.set(coordKey, promise);
  try {
    return await promise;
  } catch {
    return null;
  } finally {
    inFlightWeather.delete(coordKey);
  }
}

export function getCachedCityWeather(): WeatherCurrent | null {
  const key = `${WEATHER_CACHE_PREFIX}${BENGALURU_CENTER.lat.toFixed(2)},${BENGALURU_CENTER.lon.toFixed(2)}`;
  return readSessionCache<LiveWeatherResult>(key, memoryWeatherCache)?.payload.current ?? null;
}

export function getCachedTrafficForPlace(placeId: string): LiveTrafficResult | null {
  return readSessionCache<LiveTrafficResult>(`${TRAFFIC_CACHE_PREFIX}${placeId}`, memoryTrafficCache);
}

// ============================================================================
// 90-Minute Community Crowd Reports (localStorage)
// ============================================================================

function readAllLocalReports(): UserCrowdReport[] {
  const cutoff = Date.now() - REPORT_TTL_MS;
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserCrowdReport[];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (r) =>
        r &&
        typeof r.placeId === 'string' &&
        typeof r.createdAt === 'string' &&
        new Date(r.createdAt).getTime() >= cutoff
    );
    if (valid.length !== parsed.length) {
      localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function getLocalCrowdReportsForPlace(placeId: string): UserCrowdReport[] {
  return readAllLocalReports()
    .filter((r) => r.placeId === placeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveLocalCrowdReport(params: {
  id?: string;
  placeId: string;
  crowdLevel: CrowdLevel;
  waitMinutes?: number;
  note?: string;
  createdAt?: string;
}): UserCrowdReport {
  const nowIso = params.createdAt ?? new Date().toISOString();
  const report: UserCrowdReport = {
    id: params.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    placeId: params.placeId,
    crowdLevel: params.crowdLevel,
    waitMinutes: params.waitMinutes,
    note: params.note?.trim() || undefined,
    createdAt: nowIso,
    moderationStatus: 'approved',
  };

  try {
    const existing = readAllLocalReports().filter((r) => r.id !== report.id);
    existing.push(report);
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(existing.slice(-200)));
  } catch {
    // Ignore storage errors
  }

  return report;
}

function mergeReports(
  localReports: UserCrowdReport[],
  serverReports: UserCrowdReport[] = []
): UserCrowdReport[] {
  const cutoff = Date.now() - REPORT_TTL_MS;
  const combined: UserCrowdReport[] = [];
  const seenIds = new Set<string>();

  for (const rep of [...localReports, ...serverReports]) {
    if (!rep || seenIds.has(rep.id)) continue;
    if (new Date(rep.createdAt).getTime() < cutoff) continue;
    // Deduplicate if local optimistic save and server report came from the same submission
    const duplicateSameSubmit = combined.some(
      (existing) =>
        existing.placeId === rep.placeId &&
        existing.crowdLevel === rep.crowdLevel &&
        (existing.note ?? '') === (rep.note ?? '') &&
        Math.abs(new Date(existing.createdAt).getTime() - new Date(rep.createdAt).getTime()) < 5000
    );
    if (duplicateSameSubmit) continue;
    seenIds.add(rep.id);
    combined.push(rep);
  }

  return combined.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ============================================================================
// Dynamic IST Live Crowd Scoring
// ============================================================================

const DENSITY_LABELS: Record<CrowdLevel, string> = {
  Low: 'Light visitor presence with open space',
  Moderate: 'Moderate visitor activity',
  High: 'Busy conditions across primary areas',
  'Very High': 'Peak capacity crowding',
};

function computeWaitRange(
  supportsWaitTime: boolean,
  level: CrowdLevel,
  reports: UserCrowdReport[]
): string | null {
  if (!supportsWaitTime) return null;
  const reportedWait = reports.find((r) => typeof r.waitMinutes === 'number')?.waitMinutes;
  if (typeof reportedWait === 'number') {
    const lo = Math.max(0, reportedWait - 3);
    const hi = reportedWait + 4;
    return `${lo}–${hi} mins`;
  }
  switch (level) {
    case 'Low':
      return 'Under 5 mins';
    case 'Moderate':
      return '10–20 mins';
    case 'High':
      return '25–40 mins';
    case 'Very High':
      return '45+ mins';
  }
}

function computeAdjustedScore(params: {
  baseScore: number;
  category: PlaceCategory;
  isOutdoor: boolean;
  traffic: LiveTrafficResult | null;
  weather: WeatherCurrent | null;
  reports: UserCrowdReport[];
}): number {
  let score = params.baseScore;

  // Live TomTom road congestion boost
  if (params.traffic) {
    if (params.traffic.congestionLevel === 'Heavy' || params.traffic.congestionLevel === 'Severe') {
      score += params.category === 'Transport' || params.category === 'Markets' ? 14 : 10;
    } else if (params.traffic.congestionLevel === 'Moderate') {
      score += 5;
    } else if (params.traffic.isLive && params.traffic.congestionLevel === 'Smooth') {
      score -= 4;
    }
  }

  // Live Open-Meteo rain adjustment
  if (
    params.weather?.available &&
    isRainyWeather(params.weather.weatherCode, params.weather.rainProbabilityPercent)
  ) {
    if (params.isOutdoor || params.category === 'Parks') {
      score *= 0.8;
    } else if (params.category === 'Malls' || params.category === 'Restaurants') {
      score *= 1.12;
    }
  }

  const signalAdjusted = Math.max(4, Math.min(96, Math.round(score)));

  // Community crowd reports (90-minute active window)
  if (params.reports.length > 0) {
    const newest = params.reports[0];
    const newestScore = crowdLevelToScore(newest.crowdLevel);
    const avgScore =
      params.reports.reduce((acc, r) => acc + crowdLevelToScore(r.crowdLevel), 0) /
      params.reports.length;
    const reportComposite = newestScore * 0.65 + avgScore * 0.35;
    return Math.max(5, Math.min(96, Math.round(reportComposite * 0.8 + signalAdjusted * 0.2)));
  }

  return signalAdjusted;
}

function getCategoryBaselineScore(category: PlaceCategory, hour24: number, isWeekend: boolean): number {
  const curve = CATEGORY_WEEKDAY_CURVES[category] ?? CATEGORY_WEEKDAY_CURVES['Tourist Places'];
  const base = curve[hour24] ?? 35;
  const mult = isWeekend ? CATEGORY_WEEKEND_MULTIPLIER[category] ?? 1.15 : 1;
  return Math.max(4, Math.min(95, Math.round(base * mult)));
}

function buildCrowdCopy(params: {
  level: CrowdLevel;
  score: number;
  weekdayScore: number;
  trend: CrowdObservation['trend'];
  isWeekend: boolean;
  isLiveSignal: boolean;
  traffic: LiveTrafficResult | null;
  weather: WeatherCurrent | null;
  reports: UserCrowdReport[];
}): Pick<CrowdObservation, 'comparisonToTypical' | 'statusHeadline' | 'source' | 'sourceNote' | 'isDemoData' | 'confidence'> {
  const diffFromWeekday = params.score - params.weekdayScore;
  let comparisonToTypical = 'In line with a typical weekday at this hour.';
  if (diffFromWeekday >= 15) {
    comparisonToTypical = params.isWeekend
      ? 'Noticeably busier than a typical weekday due to weekend turnout.'
      : 'Busier than usual right now based on corridor and arrival activity.';
  } else if (diffFromWeekday >= 6) {
    comparisonToTypical = 'Slightly busier than a typical weekday at this time.';
  } else if (diffFromWeekday <= -10) {
    comparisonToTypical = 'Quieter than typical conditions for this time of day.';
  }

  let statusHeadline = 'Conditions are calm and easy to navigate right now.';
  if (params.level === 'Moderate') {
    statusHeadline = params.trend.startsWith('Increasing')
      ? 'Conditions are currently manageable, though visitor activity is rising.'
      : 'Steady, manageable activity with comfortable movement.';
  } else if (params.level === 'High') {
    statusHeadline = params.trend.startsWith('Decreasing')
      ? 'Currently busy, though activity is expected to ease over the next hour.'
      : 'Busy period underway; arriving slightly later or earlier can reduce wait times.';
  } else if (params.level === 'Very High') {
    statusHeadline = 'Peak crowd period; expect dense queues and congested approach roads.';
  }

  if (params.reports.length > 0) {
    const count = params.reports.length;
    const liveSuffix = params.isLiveSignal ? ' + live TomTom traffic & Open-Meteo weather' : '';
    return {
      comparisonToTypical,
      statusHeadline,
      source: 'USER REPORTED',
      isDemoData: false,
      confidence: count >= 2 || params.isLiveSignal ? 'High' : 'Medium',
      sourceNote: `Updated from ${count} recent visitor ${
        count === 1 ? 'report' : 'reports'
      }${liveSuffix}`,
    };
  }

  if (params.isLiveSignal) {
    const speedPart =
      params.traffic &&
      params.traffic.currentSpeedKmh !== null &&
      params.traffic.freeFlowSpeedKmh !== null
        ? `TomTom speed ${params.traffic.currentSpeedKmh}/${params.traffic.freeFlowSpeedKmh} km/h`
        : 'IST corridor rhythm';
    const weatherPart =
      params.weather?.available && params.weather.temperatureC !== null
        ? `Open-Meteo ${params.weather.temperatureC}°C (${params.weather.condition})`
        : 'Open-Meteo weather';
    return {
      comparisonToTypical,
      statusHeadline,
      source: 'Live traffic & weather signal',
      isDemoData: false,
      confidence: params.traffic?.isLive ? 'High' : 'Medium',
      sourceNote: `${speedPart} · ${weatherPart}`,
    };
  }

  return {
    comparisonToTypical,
    statusHeadline,
    source: 'HISTORICAL BASELINE',
    isDemoData: true,
    confidence: 'Medium',
    sourceNote: 'IST hourly pattern adjusted for day of week',
  };
}

// ============================================================================
// Public Orchestration API
// ============================================================================

export function applyCachedSignalsToPlaceSummary(
  place: PlaceSummary,
  cityWeatherOverride?: WeatherCurrent | null
): PlaceSummary {
  const clock = getIstClock();
  const cachedTraffic = getCachedTrafficForPlace(place.id);
  const localReports = getLocalCrowdReportsForPlace(place.id);
  const cachedWeather =
    cityWeatherOverride ??
    readSessionCache<LiveWeatherResult>(
      `${WEATHER_CACHE_PREFIX}${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`,
      memoryWeatherCache
    )?.payload.current ??
    getCachedCityWeather();

  const weatherCurrent = cachedWeather?.available ? cachedWeather : null;
  const hasLiveWeather = Boolean(weatherCurrent?.available);
  const hasLiveTraffic = Boolean(cachedTraffic?.isLive);

  if (!cachedTraffic && localReports.length === 0 && !weatherCurrent) {
    return place;
  }

  const weekdayScore = getCategoryBaselineScore(place.category, clock.hour24, false);
  const baseScore = place.crowd.densityPercent || getCategoryBaselineScore(place.category, clock.hour24, clock.isWeekend);
  const finalScore = computeAdjustedScore({
    baseScore,
    category: place.category,
    isOutdoor: place.isOutdoor,
    traffic: cachedTraffic,
    weather: weatherCurrent,
    reports: localReports,
  });

  const level = scoreToCrowdLevel(finalScore);
  const isLiveSignal = hasLiveTraffic || hasLiveWeather;
  const copy = buildCrowdCopy({
    level,
    score: finalScore,
    weekdayScore,
    trend: place.crowd.trend,
    isWeekend: clock.isWeekend,
    isLiveSignal,
    traffic: cachedTraffic,
    weather: weatherCurrent,
    reports: localReports,
  });

  const newestReportTime = localReports[0]?.createdAt;
  const observedAt =
    newestReportTime ??
    (cachedTraffic?.observedAt || weatherCurrent?.observedAt || place.crowd.observedAt);

  return {
    ...place,
    crowd: {
      ...place.crowd,
      crowdLevel: level,
      densityPercent: finalScore,
      densityLabel: DENSITY_LABELS[level],
      waitTimeRange: computeWaitRange(place.supportsWaitTime, level, localReports),
      ...copy,
      observedAt,
      recentReportCount: Math.max(place.crowd.recentReportCount, localReports.length),
    },
    weatherSummary: weatherCurrent
      ? {
          available: true,
          temperatureC: weatherCurrent.temperatureC,
          condition: weatherCurrent.condition,
          rainProbabilityPercent: weatherCurrent.rainProbabilityPercent,
          source: 'LIVE DATA',
        }
      : place.weatherSummary,
    trafficLevel: cachedTraffic ? cachedTraffic.congestionLevel : place.trafficLevel,
  };
}

export async function refreshViewportTraffic(
  places: PlaceSummary[],
  bounds: ViewportBounds
): Promise<PlaceSummary[] | null> {
  const inView = filterPlacesInViewport(places, bounds);
  if (inView.length === 0) return null;

  // Query up to 6 uncached top hubs inside the active viewport bounding box
  const candidates = [...inView]
    .filter((p) => !getCachedTrafficForPlace(p.id))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 6);

  if (candidates.length === 0) {
    return null;
  }

  await Promise.allSettled(
    candidates.map((p) =>
      fetchLiveTrafficFlow({
        placeId: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        category: p.category,
      })
    )
  );

  return places.map((p) => applyCachedSignalsToPlaceSummary(p));
}

export async function enrichPlacesWithLiveSignals(
  places: PlaceSummary[],
  viewportBounds: ViewportBounds | null = DEFAULT_KARNATAKA_BOUNDS
): Promise<{places: PlaceSummary[]; cityWeather: WeatherCurrent | null}> {
  const activeBounds = viewportBounds ?? DEFAULT_KARNATAKA_BOUNDS;
  const centerLat = (activeBounds.south + activeBounds.north) / 2;
  const centerLon = (activeBounds.west + activeBounds.east) / 2;

  const weatherRes = await fetchLiveWeather(
    Number.isFinite(centerLat) ? centerLat : BENGALURU_CENTER.lat,
    Number.isFinite(centerLon) ? centerLon : BENGALURU_CENTER.lon
  );
  const cityWeather = weatherRes?.payload.current ?? null;

  // Scope TomTom live traffic queries strictly to top hubs inside the active viewport bounding box
  const inView = filterPlacesInViewport(places, activeBounds);
  const priorityPlaces = [...inView]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 6);

  await Promise.allSettled(
    priorityPlaces.map((p) =>
      fetchLiveTrafficFlow({
        placeId: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        category: p.category,
      })
    )
  );

  const enriched = places.map((p) => applyCachedSignalsToPlaceSummary(p, cityWeather));
  return {places: enriched, cityWeather};
}

export async function enrichPlaceIntelligence(
  base: PlaceIntelligence
): Promise<PlaceIntelligence> {
  const clock = getIstClock();
  const [liveTraffic, liveWeatherRes] = await Promise.all([
    fetchLiveTrafficFlow({
      placeId: base.place.id,
      latitude: base.place.latitude,
      longitude: base.place.longitude,
      category: base.place.category,
    }),
    fetchLiveWeather(base.place.latitude, base.place.longitude),
  ]);

  const weather: WeatherPayload = liveWeatherRes?.payload ?? base.weather;
  const localReports = getLocalCrowdReportsForPlace(base.place.id);
  const mergedReports = mergeReports(localReports, base.recentUserReports);

  const currentHourPrediction = base.hourlyPredictions.find(
    (h) => h.hour24 === clock.hour24
  );
  const baseCurrentScore =
    currentHourPrediction?.intensityScore ??
    getCategoryBaselineScore(base.place.category, clock.hour24, clock.isWeekend);

  const finalScore = computeAdjustedScore({
    baseScore: baseCurrentScore,
    category: base.place.category,
    isOutdoor: base.place.isOutdoor,
    traffic: liveTraffic,
    weather: weather.current.available ? weather.current : null,
    reports: mergedReports,
  });

  const level = scoreToCrowdLevel(finalScore);
  const weekdayScore = getCategoryBaselineScore(base.place.category, clock.hour24, false);
  const isLiveSignal = liveTraffic.isLive || Boolean(liveWeatherRes?.isLive);

  const copy = buildCrowdCopy({
    level,
    score: finalScore,
    weekdayScore,
    trend: base.crowd.trend,
    isWeekend: clock.isWeekend,
    isLiveSignal,
    traffic: liveTraffic,
    weather: weather.current.available ? weather.current : null,
    reports: mergedReports,
  });

  const nowIso = new Date().toISOString();
  const observedAt = mergedReports[0]?.createdAt ?? nowIso;

  const updatedCrowd: CrowdObservation = {
    ...base.crowd,
    crowdLevel: level,
    densityPercent: finalScore,
    densityLabel: DENSITY_LABELS[level],
    waitTimeRange: computeWaitRange(base.place.supportsWaitTime, level, mergedReports),
    ...copy,
    observedAt,
    recentReportCount: mergedReports.length,
  };

  const updatedTraffic: TrafficCondition = {
    congestionLevel: liveTraffic.congestionLevel,
    intensityPercent: liveTraffic.intensityPercent,
    estimatedDelayMinutes: liveTraffic.estimatedDelayMinutes,
    roadCondition: liveTraffic.roadCondition,
    trend: liveTraffic.trend,
    corridorName: base.traffic.corridorName,
    source: liveTraffic.isLive ? 'LIVE DATA' : 'ESTIMATED',
    isDemoData: false,
    providerNote: liveTraffic.isLive
      ? 'TomTom Traffic Flow · Live road speed telemetry'
      : 'IST corridor traffic model (live sensor fallback active)',
    observedAt: liveTraffic.observedAt,
  };

  const updatedHourly: HourlyCrowdPrediction[] = base.hourlyPredictions.map((item) => {
    const matchedWeather = weather.hourly.find(
      (hw) => Number(hw.timeIso.slice(11, 13)) === item.hour24
    );
    const rainProb = matchedWeather?.rainProbabilityPercent ?? item.rainProbabilityPercent;
    const tempC = matchedWeather?.temperatureC ?? item.weatherTempC;
    const isCurrent = item.hour24 === clock.hour24;

    let adjustedHourScore = item.intensityScore;
    if (isCurrent) {
      adjustedHourScore = finalScore;
    } else if (
      rainProb !== null &&
      rainProb >= 55 &&
      (base.place.isOutdoor || base.place.category === 'Parks')
    ) {
      adjustedHourScore = Math.max(6, Math.round(item.intensityScore * 0.82));
    }

    const hourLevel = scoreToCrowdLevel(adjustedHourScore);
    return {
      ...item,
      crowdLevel: hourLevel,
      intensityScore: adjustedHourScore,
      weatherTempC: tempC,
      rainProbabilityPercent: rainProb,
      summary: isCurrent
        ? `${hourLevel} live activity right now (${adjustedHourScore}% load).`
        : `${hourLevel} activity expected around ${formatHour12(item.hour24)} (${adjustedHourScore}% load).`,
      isCurrentHour: isCurrent,
    };
  });

  const crowdSentence = `Visitor activity is currently ${updatedCrowd.crowdLevel.toLowerCase()} (${updatedCrowd.trend.toLowerCase()}).`;
  const trafficSentence = `Approach roads along ${updatedTraffic.corridorName} show ${liveTraffic.trafficLabel.toLowerCase()}${
    liveTraffic.estimatedDelayMinutes > 0
      ? ` (~${liveTraffic.estimatedDelayMinutes} min delay)`
      : ''
  }.`;
  const weatherSentence = weather.current.available
    ? `${weather.current.condition} (${weather.current.temperatureC}°C) with ${
        weather.current.rainProbabilityPercent ?? 0
      }% chance of rain.`
    : 'Live weather readings are currently unavailable for this coordinate.';

  return {
    ...base,
    crowd: updatedCrowd,
    weather,
    traffic: updatedTraffic,
    situationSummary: `${crowdSentence} ${trafficSentence} ${weatherSentence}`,
    hourlyPredictions: updatedHourly,
    recentUserReports: mergedReports.slice(0, 6),
    predictionMeta: {
      ...base.predictionMeta,
      source: isLiveSignal ? 'Live traffic & weather signal' : base.predictionMeta.source,
      confidence: isLiveSignal ? 'High' : base.predictionMeta.confidence,
      note: 'Combines real-time IST curves, TomTom Traffic Flow speeds, Open-Meteo weather, and local visitor reports.',
    },
  };
}

export function buildSummaryPatchFromIntelligence(
  intel: PlaceIntelligence
): Partial<PlaceSummary> {
  return {
    crowd: intel.crowd,
    trafficLevel: intel.traffic.congestionLevel,
    weatherSummary: {
      available: intel.weather.current.available,
      temperatureC: intel.weather.current.temperatureC,
      condition: intel.weather.current.condition,
      rainProbabilityPercent: intel.weather.current.rainProbabilityPercent,
      source: intel.weather.current.source,
    },
  };
}
