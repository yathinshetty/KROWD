import type {
  CityInsightsPayload,
  CrowdLevel,
  PlaceIntelligence,
  PlaceSummary,
  UserCrowdReport,
  WeatherCurrent,
} from '../types/krowd';

export interface PlacesListResponse {
  city: string;
  generatedAt: string;
  cityWeather: WeatherCurrent;
  places: PlaceSummary[];
}

const CLIENT_TOKEN_KEY = 'krowd_anon_token';

function getClientToken(): string {
  try {
    const existing = localStorage.getItem(CLIENT_TOKEN_KEY);
    if (existing) return existing;
    const created = `kw_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_TOKEN_KEY, created);
    return created;
  } catch {
    return 'kw_session';
  }
}

export async function fetchPlaces(params?: {
  lat?: number | null;
  lon?: number | null;
  category?: string;
  q?: string;
}): Promise<PlacesListResponse> {
  const sp = new URLSearchParams();
  if (typeof params?.lat === 'number' && typeof params?.lon === 'number') {
    sp.set('lat', String(params.lat));
    sp.set('lon', String(params.lon));
  }
  if (params?.category && params.category !== 'All') {
    sp.set('category', params.category);
  }
  if (params?.q) {
    sp.set('q', params.q);
  }

  const res = await fetch(`/api/places${sp.toString() ? `?${sp.toString()}` : ''}`);
  if (!res.ok) {
    throw new Error('Unable to load Bengaluru locations.');
  }
  return res.json();
}

export async function fetchPlaceIntelligence(placeId: string): Promise<PlaceIntelligence> {
  const res = await fetch(`/api/places/${encodeURIComponent(placeId)}`);
  if (!res.ok) {
    throw new Error('Unable to load detailed conditions for this place.');
  }
  return res.json();
}

export async function fetchCityInsights(params?: {
  lat?: number | null;
  lon?: number | null;
}): Promise<CityInsightsPayload> {
  const sp = new URLSearchParams();
  if (
    typeof params?.lat === 'number' &&
    typeof params?.lon === 'number' &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lon)
  ) {
    sp.set('lat', String(params.lat));
    sp.set('lon', String(params.lon));
  }
  const res = await fetch(`/api/insights${sp.toString() ? `?${sp.toString()}` : ''}`);
  if (!res.ok) {
    throw new Error('Unable to load city insights.');
  }
  return res.json();
}

export async function submitCrowdReport(params: {
  placeId: string;
  crowdLevel: CrowdLevel;
  waitMinutes?: number;
  note?: string;
}): Promise<{report: UserCrowdReport}> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      ...params,
      clientToken: getClientToken(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not submit report.');
  }
  return data;
}
