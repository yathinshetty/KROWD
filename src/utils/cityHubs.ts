export interface KarnatakaHub {
  name: string;
  lat: number;
  lon: number;
}

export const BENGALURU_DEFAULT_COORDS = {
  lat: 12.9716,
  lon: 77.5946,
} as const;

export const KARNATAKA_HUBS: KarnatakaHub[] = [
  {name: 'Bengaluru', lat: 12.9716, lon: 77.5946},
  {name: 'Mysuru', lat: 12.2958, lon: 76.6394},
  {name: 'Mangaluru', lat: 12.9141, lon: 74.856},
  {name: 'Udupi', lat: 13.3409, lon: 74.7421},
  {name: 'Coorg', lat: 12.4244, lon: 75.7382},
  {name: 'Chikkamagaluru', lat: 13.3161, lon: 75.772},
  {name: 'Hassan', lat: 13.0072, lon: 76.0962},
  {name: 'Mandya', lat: 12.5218, lon: 76.8951},
  {name: 'Tumakuru', lat: 13.3392, lon: 77.114},
  {name: 'Shivamogga', lat: 13.9299, lon: 75.5681},
  {name: 'Chitradurga', lat: 14.2251, lon: 76.398},
  {name: 'Davangere', lat: 14.4644, lon: 75.9218},
  {name: 'Hubballi', lat: 15.3647, lon: 75.124},
  {name: 'Dharwad', lat: 15.4589, lon: 75.0078},
  {name: 'Belagavi', lat: 15.8497, lon: 74.4977},
  {name: 'Hampi', lat: 15.335, lon: 76.46},
  {name: 'Karwar', lat: 14.8136, lon: 74.1297},
  {name: 'Gokarna', lat: 14.5479, lon: 74.3188},
  {name: 'Vijayapura', lat: 16.8302, lon: 75.71},
  {name: 'Kalaburagi', lat: 17.3297, lon: 76.8343},
  {name: 'Bidar', lat: 17.9104, lon: 77.5199},
];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ResolvedCityContext {
  cityName: string;
  lat: number;
  lon: number;
  isDetected: boolean;
}

export function resolveNearestCity(
  lat?: number | null,
  lon?: number | null
): ResolvedCityContext {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return {
      cityName: 'Bengaluru',
      lat: BENGALURU_DEFAULT_COORDS.lat,
      lon: BENGALURU_DEFAULT_COORDS.lon,
      isDetected: false,
    };
  }

  let nearest = KARNATAKA_HUBS[0];
  let bestDist = Infinity;

  for (const hub of KARNATAKA_HUBS) {
    const d = distanceKm(lat, lon, hub.lat, hub.lon);
    if (d < bestDist) {
      bestDist = d;
      nearest = hub;
    }
  }

  return {
    cityName: nearest.name,
    lat,
    lon,
    isDetected: true,
  };
}
