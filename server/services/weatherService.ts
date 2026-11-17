import type {
  DailyWeatherPoint,
  HourlyWeatherPoint,
  WeatherCurrent,
  WeatherPayload,
} from '../../src/types/krowd.js';

interface CacheEntry {
  expiresAt: number;
  payload: WeatherPayload;
}

const WEATHER_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function decodeWmoCode(code: number | null): string {
  if (code === null || Number.isNaN(code)) return 'Partly Cloudy';
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3 || code === 45 || code === 48) return 'Overcast';
  if (code === 51 || code === 53 || code === 55 || code === 61 || code === 80) {
    return 'Light Rain';
  }
  if (code === 63 || code === 65 || code === 81 || code === 82) return 'Rain';
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
  return 'Partly Cloudy';
}

function deriveOutdoorComfort(
  tempC: number | null,
  humidity: number | null,
  rainProb: number | null
): WeatherCurrent['outdoorComfort'] {
  if (tempC === null) return 'Unavailable';
  if ((rainProb ?? 0) >= 60) return 'Rainy';
  if (tempC >= 31) return 'Warm';
  if ((humidity ?? 0) >= 78 && tempC >= 25) return 'Humid';
  return 'Comfortable';
}

function getBengaluruHourNow(): {dateStr: string; hour24: number} {
  const now = new Date();
  const istParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = new Map(istParts.map((p) => [p.type, p.value]));
  const dateStr = `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
  const rawHour = Number(map.get('hour') ?? '12');
  const hour24 = rawHour === 24 ? 0 : rawHour;
  return {dateStr, hour24};
}

function formatHourLabel(isoTime: string): string {
  const hour = Number(isoTime.slice(11, 13));
  if (Number.isNaN(hour)) return isoTime;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

export async function getLocationWeather(lat: number, lon: number): Promise<WeatherPayload> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,visibility,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FKolkata&forecast_days=7`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(url, {signal: controller.signal});
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const data = (await response.json()) as {
      current?: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        is_day: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code: number[];
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

    const {dateStr, hour24} = getBengaluruHourNow();
    const currentPrefix = `${dateStr}T${String(hour24).padStart(2, '0')}`;
    const hourlyTimes = data.hourly?.time ?? [];
    const matchedIdx = Math.max(
      0,
      hourlyTimes.findIndex((t) => t.startsWith(currentPrefix))
    );

    const rainProb = data.hourly?.precipitation_probability?.[matchedIdx] ?? null;
    const visibilityM = data.hourly?.visibility?.[matchedIdx] ?? null;
    const uvIndex = data.hourly?.uv_index?.[matchedIdx] ?? null;
    const tempC = data.current?.temperature_2m ?? null;
    const humidity = data.current?.relative_humidity_2m ?? null;
    const weatherCode = data.current?.weather_code ?? null;

    const current: WeatherCurrent = {
      available: true,
      temperatureC: tempC !== null ? Math.round(tempC) : null,
      feelsLikeC:
        data.current?.apparent_temperature !== undefined
          ? Math.round(data.current.apparent_temperature)
          : null,
      humidityPercent: humidity !== null ? Math.round(humidity) : null,
      rainProbabilityPercent: rainProb !== null ? Math.round(rainProb) : null,
      windSpeedKmh:
        data.current?.wind_speed_10m !== undefined
          ? Math.round(data.current.wind_speed_10m)
          : null,
      visibilityKm: visibilityM !== null ? Number((visibilityM / 1000).toFixed(1)) : null,
      uvIndex: uvIndex !== null ? Number(uvIndex.toFixed(1)) : null,
      condition: decodeWmoCode(weatherCode),
      weatherCode,
      isDay: (data.current?.is_day ?? 1) === 1,
      outdoorComfort: deriveOutdoorComfort(tempC, humidity, rainProb),
      source: 'LIVE DATA',
      provider: 'Open-Meteo',
      observedAt: new Date().toISOString(),
    };

    const hourly: HourlyWeatherPoint[] = hourlyTimes
      .slice(matchedIdx, matchedIdx + 24)
      .map((timeIso, offset) => {
        const idx = matchedIdx + offset;
        const code = data.hourly?.weather_code?.[idx] ?? 2;
        return {
          timeIso,
          hourLabel: formatHourLabel(timeIso),
          temperatureC: Math.round(data.hourly?.temperature_2m?.[idx] ?? 24),
          rainProbabilityPercent: Math.round(
            data.hourly?.precipitation_probability?.[idx] ?? 10
          ),
          condition: decodeWmoCode(code),
          weatherCode: code,
        };
      });

    const daily: DailyWeatherPoint[] = (data.daily?.time ?? []).map((dateIso, idx) => {
      const code = data.daily?.weather_code?.[idx] ?? 2;
      const d = new Date(`${dateIso}T12:00:00+05:30`);
      const dayName = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(d);

      return {
        dateIso,
        dayName,
        tempMaxC: Math.round(data.daily?.temperature_2m_max?.[idx] ?? 28),
        tempMinC: Math.round(data.daily?.temperature_2m_min?.[idx] ?? 19),
        rainProbabilityPercent: Math.round(
          data.daily?.precipitation_probability_max?.[idx] ?? 15
        ),
        condition: decodeWmoCode(code),
        weatherCode: code,
      };
    });

    const payload: WeatherPayload = {current, hourly, daily};
    WEATHER_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });
    return payload;
  } catch {
    if (cached) {
      return cached.payload;
    }
    return {
      current: {
        available: false,
        temperatureC: null,
        feelsLikeC: null,
        humidityPercent: null,
        rainProbabilityPercent: null,
        windSpeedKmh: null,
        visibilityKm: null,
        uvIndex: null,
        condition: 'Weather feed temporarily unavailable',
        weatherCode: null,
        isDay: true,
        outdoorComfort: 'Unavailable',
        source: 'ESTIMATED',
        provider: 'Open-Meteo (Unreachable)',
        observedAt: new Date().toISOString(),
      },
      hourly: [],
      daily: [],
    };
  }
}
