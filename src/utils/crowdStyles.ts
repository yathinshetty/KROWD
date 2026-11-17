import type {
  CrowdLevel,
  DataSourceLabel,
  PlaceCategory,
  TrafficLevel,
} from '../types/krowd';

export const CROWD_COLORS: Record<
  CrowdLevel,
  {
    hex: string;
    softBg: string;
    textHex: string;
    label: string;
  }
> = {
  Low: {
    hex: '#4ADE80',
    softBg: '#E6F9ED',
    textHex: '#15803D',
    label: 'Low',
  },
  Moderate: {
    hex: '#FACC15',
    softBg: '#FEF9C3',
    textHex: '#92600A',
    label: 'Moderate',
  },
  High: {
    hex: '#F87171',
    softBg: '#FEE2E2',
    textHex: '#B91C1C',
    label: 'High',
  },
  'Very High': {
    hex: '#EF4444',
    softBg: '#FEE2E2',
    textHex: '#991B1B',
    label: 'Very High',
  },
};

export const TRAFFIC_COLORS: Record<
  TrafficLevel,
  {
    hex: string;
    softBg: string;
    textHex: string;
  }
> = {
  Smooth: {
    hex: '#4ADE80',
    softBg: '#E6F9ED',
    textHex: '#15803D',
  },
  Moderate: {
    hex: '#FACC15',
    softBg: '#FEF9C3',
    textHex: '#92600A',
  },
  Heavy: {
    hex: '#F87171',
    softBg: '#FEE2E2',
    textHex: '#B91C1C',
  },
  Severe: {
    hex: '#EF4444',
    softBg: '#FEE2E2',
    textHex: '#991B1B',
  },
};

export const ALL_CATEGORIES: Array<'All' | PlaceCategory> = [
  'All',
  'Temples',
  'Malls',
  'Parks',
  'Tourist Places',
  'Restaurants',
  'Transport',
  'Markets',
  'Events',
];

export function formatRelativeTime(isoString: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDistance(distanceKm?: number): string | null {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

export function buildGoogleMapsDirectionsUrl(params: {
  destLat: number;
  destLon: number;
  destName: string;
  originLat?: number | null;
  originLon?: number | null;
}): string {
  const hasCoords =
    typeof params.destLat === 'number' &&
    typeof params.destLon === 'number' &&
    Number.isFinite(params.destLat) &&
    Number.isFinite(params.destLon);

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set(
    'destination',
    hasCoords ? `${params.destLat},${params.destLon}` : params.destName
  );
  url.searchParams.set('travelmode', 'driving');
  url.searchParams.set('dir_action', 'navigate');
  return url.toString();
}

export function formatTrafficStatusLabel(level: TrafficLevel): string {
  switch (level) {
    case 'Smooth':
      return 'Low traffic';
    case 'Moderate':
      return 'Moderate traffic';
    case 'Heavy':
    case 'Severe':
      return 'Heavy congestion';
  }
}

export function formatSourceLabel(source: DataSourceLabel | string): string {
  if (source === 'Live traffic & weather signal') {
    return source;
  }
  const lower = source.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatSourceTag(source: DataSourceLabel, isDemoData?: boolean): string {
  const formatted = formatSourceLabel(source);
  if (isDemoData && source !== 'DEMO DATA') {
    return `${formatted} · Demo data`;
  }
  return formatted;
}

export function isTransportSearchQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return /\b(metro|bus|station|junction|stand|terminal|toll|airport|railway|ttmc|transit|ksrtc|nwkrtc|nwkrtec|bmtc|brts|chigari|cbt|transport|nelamangala|yeswanthpur|yesvantpur|jalahalli|majestic|mg road|silk board|kr puram|baiyappanahalli|hebbal|marathahalli|kengeri|shivajinagar|shantinagar|banashankari|whitefield|electronic city|peenya|hubballi|hubli|dharwad|belagavi|belgaum|mangaluru|mangalore|udupi|mysuru|mysore|tumakuru|hassan|mandya|shivamogga|davangere|hosapete|hospet|kalaburagi|gulbarga|vijayapura|bijapur|karwar|madikeri|chikkamagaluru|ixe|blr)\b/i.test(
    q
  );
}
