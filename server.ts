import express from 'express';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {
  CityInsightsPayload,
  CrowdLevel,
  PlaceCategory,
  PlaceSummary,
} from './src/types/krowd.js';
import {BENGALURU_PLACES} from './server/data/bengaluruPlaces.js';
import {
  buildPlaceIntelligence,
  buildPlaceSummary,
  getBengaluruClock,
  scoreToCrowdLevel,
} from './server/services/crowdEngine.js';
import {submitAnonymousCrowdReport} from './server/services/reportStore.js';
import {trafficService} from './server/services/trafficService.js';
import {getLocationWeather} from './server/services/weatherService.js';
import {resolveNearestCity} from './src/utils/cityHubs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BENGALURU_CENTER = {lat: 12.9716, lon: 77.5946};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '32kb'}));

  app.get('/api/health', (_req, res) => {
    res.json({status: 'ok', service: 'krowd-api', city: 'Bengaluru'});
  });

  app.get('/api/weather', async (req, res) => {
    const lat = Number(req.query.lat) || BENGALURU_CENTER.lat;
    const lon = Number(req.query.lon) || BENGALURU_CENTER.lon;
    const weather = await getLocationWeather(lat, lon);
    res.json(weather);
  });

  app.get('/api/places', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : 'All';
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLon = req.query.lon ? Number(req.query.lon) : null;

    const clock = getBengaluruClock();
    const cityWeather = await getLocationWeather(BENGALURU_CENTER.lat, BENGALURU_CENTER.lon);

    const summaries: PlaceSummary[] = await Promise.all(
      BENGALURU_PLACES.filter((p) => {
        const catMatch = category === 'All' || p.category === category;
        const qMatch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.neighborhood.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q));
        return catMatch && qMatch;
      }).map(async (place) => {
        const traffic = await trafficService.getNearbyTraffic(
          place,
          clock.hour24,
          clock.isWeekend
        );
        const summary = buildPlaceSummary(place, cityWeather, traffic, clock);
        if (
          userLat !== null &&
          userLon !== null &&
          !Number.isNaN(userLat) &&
          !Number.isNaN(userLon)
        ) {
          summary.distanceKm = haversineKm(userLat, userLon, place.latitude, place.longitude);
        }
        return summary;
      })
    );

    res.json({
      city: 'Bengaluru',
      generatedAt: new Date().toISOString(),
      cityWeather: cityWeather.current,
      places: summaries,
    });
  });

  app.get('/api/places/:id', async (req, res) => {
    const place = BENGALURU_PLACES.find((p) => p.id === req.params.id);
    if (!place) {
      res.status(404).json({error: 'Location not found in Bengaluru directory.'});
      return;
    }

    const clock = getBengaluruClock();
    const [weather, traffic] = await Promise.all([
      getLocationWeather(place.latitude, place.longitude),
      trafficService.getNearbyTraffic(place, clock.hour24, clock.isWeekend),
    ]);

    const intelligence = buildPlaceIntelligence(place, weather, traffic, clock);
    res.json(intelligence);
  });

  app.get('/api/insights', async (req, res) => {
    const queryLat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const queryLon = req.query.lon !== undefined ? Number(req.query.lon) : null;
    const resolved = resolveNearestCity(queryLat, queryLon);

    const clock = getBengaluruClock();
    const cityWeather = await getLocationWeather(resolved.lat, resolved.lon);

    const allSummaries = await Promise.all(
      BENGALURU_PLACES.map(async (place) => {
        const traffic = await trafficService.getNearbyTraffic(
          place,
          clock.hour24,
          clock.isWeekend
        );
        const summary = buildPlaceSummary(place, cityWeather, traffic, clock);
        summary.distanceKm = haversineKm(
          resolved.lat,
          resolved.lon,
          place.latitude,
          place.longitude
        );
        return summary;
      })
    );

    const sortedByProximity = [...allSummaries].sort(
      (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)
    );

    const nearbyAll = sortedByProximity.filter((p) => (p.distanceKm ?? 9999) <= 80);
    const regionalSummaries =
      nearbyAll.length >= 6 ? nearbyAll : sortedByProximity.slice(0, 12);

    const nearbyVisits = sortedByProximity.filter(
      (p) => p.type === 'visit' && (p.distanceKm ?? 9999) <= 80
    );
    const regionalVisits =
      nearbyVisits.length >= 5
        ? nearbyVisits
        : sortedByProximity.filter((p) => p.type === 'visit').slice(0, 10);

    const busyLocations = [...regionalVisits]
      .sort((a, b) => b.crowd.densityPercent - a.crowd.densityPercent)
      .slice(0, 5);

    const quietLocations = [...regionalVisits]
      .sort((a, b) => a.crowd.densityPercent - b.crowd.densityPercent)
      .slice(0, 5);

    const popularLocations = [...regionalVisits]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 5);

    const categories: PlaceCategory[] = [
      'Temples',
      'Malls',
      'Parks',
      'Tourist Places',
      'Restaurants',
      'Transport',
      'Markets',
      'Events',
    ];

    const categoryBreakdown = categories.map((cat) => {
      const group = allSummaries.filter((p) => p.category === cat);
      const avg = group.length
        ? Math.round(group.reduce((s, p) => s + p.crowd.densityPercent, 0) / group.length)
        : 0;
      return {
        category: cat,
        averageIntensity: avg,
        placeCount: group.length,
        dominantLevel: scoreToCrowdLevel(avg),
      };
    });

    const regionalPlaceIds = new Set(regionalSummaries.map((p) => p.id));
    const regionalPlaceDefs = BENGALURU_PLACES.filter((p) => regionalPlaceIds.has(p.id));
    const rhythmPool = regionalPlaceDefs.length > 0 ? regionalPlaceDefs : BENGALURU_PLACES;

    const displayHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    const hourlyCityRhythm = displayHours.map((h) => {
      const avg = Math.round(
        rhythmPool.reduce((acc, p) => {
          const val = clock.isWeekend
            ? p.weekdayCurve[h] * p.weekendMultiplier
            : p.weekdayCurve[h];
          return acc + Math.min(95, val);
        }, 0) / rhythmPool.length
      );
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return {
        hourLabel: `${h12} ${suffix}`,
        intensity: avg,
        label: scoreToCrowdLevel(avg),
      };
    });

    const trafficPool = regionalSummaries.length > 0 ? regionalSummaries : allSummaries;
    const avgTrafficIntensity = Math.round(
      trafficPool.reduce((acc, p) => {
        const w =
          p.trafficLevel === 'Severe'
            ? 85
            : p.trafficLevel === 'Heavy'
            ? 68
            : p.trafficLevel === 'Moderate'
            ? 45
            : 20;
        return acc + w;
      }, 0) / trafficPool.length
    );

    const overallTrafficLevel =
      avgTrafficIntensity >= 75
        ? 'Severe'
        : avgTrafficIntensity >= 55
        ? 'Heavy'
        : avgTrafficIntensity >= 35
        ? 'Moderate'
        : 'Smooth';

    const unusualActivity = regionalSummaries
      .filter((p) => p.crowd.recentReportCount > 0 || p.crowd.densityPercent >= 74)
      .slice(0, 4)
      .map((p) => ({
        placeId: p.id,
        placeName: p.name,
        category: p.category,
        reason:
          p.crowd.recentReportCount > 0
            ? `Updated by ${p.crowd.recentReportCount} visitor ${
                p.crowd.recentReportCount === 1 ? 'report' : 'reports'
              } in the last 90 minutes`
            : p.crowd.comparisonToTypical,
        crowdLevel: p.crowd.crowdLevel,
        source: p.crowd.source,
      }));

    const payload: CityInsightsPayload = {
      cityName: resolved.cityName,
      generatedAt: new Date().toISOString(),
      weather: cityWeather.current,
      overallTraffic: {
        level: overallTrafficLevel,
        summary:
          overallTrafficLevel === 'Heavy' || overallTrafficLevel === 'Severe'
            ? `Peak arterial corridor pressure across ${resolved.cityName} junctions.`
            : overallTrafficLevel === 'Moderate'
            ? `Manageable flow across primary ${resolved.cityName} corridors with localized junction queues.`
            : `Smooth traffic movement across major ${resolved.cityName} avenues.`,
        source: process.env.TRAFFIC_API_KEY ? 'LIVE DATA' : 'DEMO DATA',
        isDemoData: !process.env.TRAFFIC_API_KEY,
      },
      busyLocations,
      quietLocations,
      popularLocations,
      categoryBreakdown,
      hourlyCityRhythm,
      unusualActivity,
      transparencyNote:
        `Weather readings are fetched live from Open-Meteo for ${resolved.cityName}. Crowd levels combine anonymous visitor reports with historical regional baseline patterns (labeled DEMO DATA / HISTORICAL BASELINE where live sensors are absent).`,
    };

    res.json(payload);
  });

  app.post('/api/reports', (req, res) => {
    const {placeId, crowdLevel, waitMinutes, note, clientToken} = req.body ?? {};
    const validLevels: CrowdLevel[] = ['Low', 'Moderate', 'High', 'Very High'];

    if (typeof placeId !== 'string' || !BENGALURU_PLACES.some((p) => p.id === placeId)) {
      res.status(400).json({error: 'Invalid placeId.'});
      return;
    }
    if (!validLevels.includes(crowdLevel)) {
      res.status(400).json({error: 'Invalid crowdLevel.'});
      return;
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const clientKey = typeof clientToken === 'string' && clientToken.length > 4 ? clientToken : ip;

    const result = submitAnonymousCrowdReport({
      placeId,
      crowdLevel,
      waitMinutes: typeof waitMinutes === 'number' ? waitMinutes : undefined,
      note: typeof note === 'string' ? note : undefined,
      clientKey,
    });

    if (!result.ok) {
      res.status(429).json({
        error: result.reason,
        retryAfterSec: result.retryAfterSec,
      });
      return;
    }

    res.status(201).json({report: result.report});
  });

  const httpServer = http.createServer(app);

  // Mount Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {server: httpServer},
        hmr: process.env.DISABLE_HMR === 'true' ? false : {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`KROWD server running on http://0.0.0.0:${port}`);
  });
}

startServer();
