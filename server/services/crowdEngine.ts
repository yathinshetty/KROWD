import type {
  BestTimeRecommendation,
  CrowdLevel,
  CrowdObservation,
  CrowdZoneActivity,
  DailyCrowdForecast,
  HourlyCrowdPrediction,
  PlaceIntelligence,
  PlaceSummary,
  TomorrowForecast,
  TrafficCondition,
  UserCrowdReport,
  WeatherPayload,
} from '../../src/types/krowd.js';
import type {PlaceSeed} from '../data/bengaluruPlaces.js';
import {getRecentReportsForPlace} from './reportStore.js';

export function getBengaluruClock(date = new Date()): {
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

function formatHour12(hour24: number): string {
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h} ${suffix}`;
}

function computeHourlyScore(
  place: PlaceSeed,
  hour24: number,
  isWeekend: boolean,
  rainProbabilityPercent: number | null
): number {
  const base = place.weekdayCurve[hour24] ?? 30;
  let adjusted = isWeekend ? base * place.weekendMultiplier : base;

  // Rain shifts outdoor venues down slightly and indoor malls up slightly
  if (rainProbabilityPercent !== null && rainProbabilityPercent >= 55) {
    if (place.isOutdoor) {
      adjusted *= 0.82;
    } else if (place.category === 'Malls') {
      adjusted *= 1.1;
    }
  }

  return Math.max(4, Math.min(96, Math.round(adjusted)));
}

function buildWaitTimeRange(
  place: PlaceSeed,
  level: CrowdLevel,
  recentReports: UserCrowdReport[]
): string | null {
  if (!place.supportsWaitTime) return null;
  const reportedWait = recentReports.find((r) => typeof r.waitMinutes === 'number')?.waitMinutes;
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

export function buildCrowdObservation(
  place: PlaceSeed,
  weather: WeatherPayload,
  clock = getBengaluruClock()
): {observation: CrowdObservation; recentReports: UserCrowdReport[]} {
  const recentReports = getRecentReportsForPlace(place.id, 90);
  const rainProb = weather.current.available ? weather.current.rainProbabilityPercent : null;

  const baselineScore = computeHourlyScore(place, clock.hour24, clock.isWeekend, rainProb);
  const nextHourScore = computeHourlyScore(
    place,
    (clock.hour24 + 1) % 24,
    clock.isWeekend,
    rainProb
  );

  let finalScore = baselineScore;
  let source: CrowdObservation['source'] = 'HISTORICAL BASELINE';
  let isDemoData = true;
  let confidence: CrowdObservation['confidence'] = 'Medium';
  let sourceNote =
    'Historical Bengaluru hourly pattern (no live sensor feed connected; labeled baseline estimate)';

  if (recentReports.length > 0) {
    const avgReportScore =
      recentReports.reduce((acc, r) => acc + crowdLevelToScore(r.crowdLevel), 0) /
      recentReports.length;
    finalScore = Math.round(avgReportScore * 0.7 + baselineScore * 0.3);
    source = 'USER REPORTED';
    isDemoData = false;
    confidence = recentReports.length >= 2 ? 'High' : 'Medium';
    sourceNote = `Informed by ${recentReports.length} recent visitor ${
      recentReports.length === 1 ? 'report' : 'reports'
    } blended with historical pattern`;
  }

  const crowdLevel = scoreToCrowdLevel(finalScore);
  const delta = nextHourScore - baselineScore;

  let trend: CrowdObservation['trend'] = 'Steady';
  if (delta >= 14) trend = 'Increasing';
  else if (delta >= 5) trend = 'Increasing gradually';
  else if (delta <= -14) trend = 'Decreasing';
  else if (delta <= -5) trend = 'Decreasing gradually';

  const densityLabelMap: Record<CrowdLevel, string> = {
    Low: 'Light visitor presence with open space',
    Moderate: 'Moderate visitor activity',
    High: 'Busy conditions across primary areas',
    'Very High': 'Peak capacity crowding',
  };

  const weekdayBaseline = place.weekdayCurve[clock.hour24] ?? 30;
  const diffFromWeekday = finalScore - weekdayBaseline;
  let comparisonToTypical = 'In line with a typical weekday at this hour.';
  if (diffFromWeekday >= 15) {
    comparisonToTypical = clock.isWeekend
      ? 'Noticeably busier than a typical weekday due to weekend turnout.'
      : 'Busier than usual for this hour.';
  } else if (diffFromWeekday >= 6) {
    comparisonToTypical = 'Slightly busier than a typical weekday at this time.';
  } else if (diffFromWeekday <= -10) {
    comparisonToTypical = 'Quieter than typical conditions for this time of day.';
  }

  let statusHeadline = 'Conditions are calm and easy to navigate right now.';
  if (crowdLevel === 'Moderate') {
    statusHeadline =
      trend.startsWith('Increasing')
        ? 'Conditions are currently manageable, though visitor activity is rising.'
        : 'Steady, manageable activity with comfortable movement.';
  } else if (crowdLevel === 'High') {
    statusHeadline =
      trend.startsWith('Decreasing')
        ? 'Currently busy, though activity is expected to ease over the next hour.'
        : 'Busy period underway; arriving slightly later or earlier can reduce wait times.';
  } else if (crowdLevel === 'Very High') {
    statusHeadline = 'Peak crowd period; expect dense queues and congested approach roads.';
  }

  return {
    observation: {
      crowdLevel,
      densityPercent: finalScore,
      densityLabel: densityLabelMap[crowdLevel],
      trend,
      trendDelta: delta,
      waitTimeRange: buildWaitTimeRange(place, crowdLevel, recentReports),
      comparisonToTypical,
      statusHeadline,
      source,
      sourceNote,
      isDemoData,
      confidence,
      observedAt: recentReports[0]?.createdAt ?? new Date().toISOString(),
      recentReportCount: recentReports.length,
    },
    recentReports,
  };
}

function buildZones(place: PlaceSeed, baseScore: number): CrowdZoneActivity[] | null {
  if (!place.zoneTemplates || place.zoneTemplates.length === 0) {
    return null;
  }
  return place.zoneTemplates.map((tpl) => {
    const zoneScore = Math.max(5, Math.min(95, baseScore + tpl.offset));
    const level = scoreToCrowdLevel(zoneScore);
    const activitySummary =
      level === 'Low' ? tpl.lowDesc : level === 'Moderate' ? tpl.modDesc : tpl.highDesc;
    return {
      zoneName: tpl.zoneName,
      crowdLevel: level,
      activitySummary,
    };
  });
}

function buildSituationSummary(
  crowd: CrowdObservation,
  traffic: TrafficCondition,
  weather: WeatherPayload
): string {
  const crowdSentence = `Visitor activity is currently ${crowd.crowdLevel.toLowerCase()} (${crowd.trend.toLowerCase()}).`;
  const trafficSentence = `Surrounding roads along ${traffic.corridorName} show ${traffic.congestionLevel.toLowerCase()} traffic conditions.`;

  let weatherSentence = 'Live weather readings are currently unavailable for this coordinate.';
  if (weather.current.available) {
    const rainText =
      (weather.current.rainProbabilityPercent ?? 0) >= 50
        ? `a high ${weather.current.rainProbabilityPercent}% chance of rain`
        : `a relatively low ${weather.current.rainProbabilityPercent ?? 10}% chance of rain`;
    weatherSentence = `${weather.current.condition} (${weather.current.temperatureC}°C) is observed with ${rainText}.`;
  }

  return `${crowdSentence} ${trafficSentence} ${weatherSentence}`;
}

export function buildPlaceSummary(
  place: PlaceSeed,
  weather: WeatherPayload,
  traffic: TrafficCondition,
  clock = getBengaluruClock()
): PlaceSummary {
  const {observation} = buildCrowdObservation(place, weather, clock);
  return {
    id: place.id,
    name: place.name,
    type: place.type,
    category: place.category,
    neighborhood: place.neighborhood,
    description: place.description,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    imageKey: place.imageKey,
    imageUrl: place.imageUrl,
    openingHours: place.openingHours,
    isVerified: place.isVerified,
    popularityScore: place.popularityScore,
    isOutdoor: place.isOutdoor,
    supportsWaitTime: place.supportsWaitTime,
    tags: place.tags,
    crowd: observation,
    weatherSummary: {
      available: weather.current.available,
      temperatureC: weather.current.temperatureC,
      condition: weather.current.condition,
      rainProbabilityPercent: weather.current.rainProbabilityPercent,
      source: weather.current.source,
    },
    trafficLevel: traffic.congestionLevel,
  };
}

export function buildPlaceIntelligence(
  place: PlaceSeed,
  weather: WeatherPayload,
  traffic: TrafficCondition,
  clock = getBengaluruClock()
): PlaceIntelligence {
  const {observation, recentReports} = buildCrowdObservation(place, weather, clock);
  const zones = buildZones(place, observation.densityPercent);

  // Hourly prediction bar chart (from 6 AM to 10 PM or full 16-hour active window centered around day)
  const displayHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const hourlyPredictions: HourlyCrowdPrediction[] = displayHours.map((h) => {
    const matchedWeather = weather.hourly.find((hw) => Number(hw.timeIso.slice(11, 13)) === h);
    const rainProb = matchedWeather?.rainProbabilityPercent ?? weather.current.rainProbabilityPercent;
    const score = computeHourlyScore(place, h, clock.isWeekend, rainProb);
    const level = scoreToCrowdLevel(score);
    return {
      hour24: h,
      hourLabel: formatHour12(h),
      crowdLevel: level,
      intensityScore: score,
      weatherTempC: matchedWeather?.temperatureC ?? weather.current.temperatureC,
      rainProbabilityPercent: rainProb,
      summary: `${level} activity expected around ${formatHour12(h)} (${score}% typical load).`,
      isCurrentHour: h === clock.hour24,
    };
  });

  // Tomorrow forecast
  const tomorrowIsWeekend = (clock.dayOfWeek + 1) % 7 === 0 || (clock.dayOfWeek + 1) % 7 === 6;
  const tomorrowWeather = weather.daily[1];
  const tomorrowRain = tomorrowWeather?.rainProbabilityPercent ?? null;

  const tomorrowHours = displayHours.map((h) => ({
    hour24: h,
    score: computeHourlyScore(place, h, tomorrowIsWeekend, tomorrowRain),
  }));
  const peakTomorrow = [...tomorrowHours].sort((a, b) => b.score - a.score);
  const quietTomorrow = [...tomorrowHours]
    .filter((x) => x.hour24 >= 7 && x.hour24 <= 20)
    .sort((a, b) => a.score - b.score);

  const bestHour = quietTomorrow[0]?.hour24 ?? 8;
  const bestEndHour = Math.min(21, bestHour + 2);
  const peakHour = peakTomorrow[0]?.hour24 ?? 18;
  const peakEndHour = Math.min(22, peakHour + 2);
  const avgTomorrowScore = Math.round(
    tomorrowHours.reduce((s, x) => s + x.score, 0) / tomorrowHours.length
  );

  const tomorrowForecast: TomorrowForecast = {
    dateIso: tomorrowWeather?.dateIso ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    expectedCrowd: scoreToCrowdLevel(avgTomorrowScore),
    busyHours: `${formatHour12(peakHour)} – ${formatHour12(peakEndHour)}`,
    quietHours: `${formatHour12(bestHour)} – ${formatHour12(bestEndHour)}`,
    recommendedWindow: `Tomorrow, ${formatHour12(bestHour)} – ${formatHour12(bestEndHour)}`,
    weatherSummary: tomorrowWeather
      ? `${tomorrowWeather.condition} · ${tomorrowWeather.tempMinC}°–${tomorrowWeather.tempMaxC}°C · ${tomorrowWeather.rainProbabilityPercent}% rain`
      : 'Forecast data unavailable',
    confidence: tomorrowWeather ? 'Medium' : 'Limited',
  };

  // Seven-day forecast
  const sevenDayForecast: DailyCrowdForecast[] = Array.from({length: 7}, (_, idx) => {
    const dayWeather = weather.daily[idx];
    const targetDay = (clock.dayOfWeek + idx) % 7;
    const isWknd = targetDay === 0 || targetDay === 6;
    const rainP = dayWeather?.rainProbabilityPercent ?? null;
    const dayScores = displayHours.map((h) => ({
      h,
      score: computeHourlyScore(place, h, isWknd, rainP),
    }));
    const peak = [...dayScores].sort((a, b) => b.score - a.score)[0];
    const quiet = [...dayScores]
      .filter((x) => x.h >= 7 && x.h <= 20)
      .sort((a, b) => a.score - b.score)[0];

    const dateObj = new Date(Date.now() + idx * 86400000);
    const dayLabel =
      idx === 0
        ? 'Today'
        : idx === 1
        ? 'Tomorrow'
        : new Intl.DateTimeFormat('en-IN', {
            weekday: 'long',
            timeZone: 'Asia/Kolkata',
          }).format(dateObj);
    const shortDay =
      dayWeather?.dayName ??
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(dateObj);

    return {
      dateIso: dayWeather?.dateIso ?? dateObj.toISOString().slice(0, 10),
      dayLabel,
      shortDay,
      expectedCrowd: scoreToCrowdLevel(peak?.score ?? 50),
      peakIntensity: peak?.score ?? 50,
      busyPeriods: `${formatHour12(peak?.h ?? 18)} – ${formatHour12(Math.min(22, (peak?.h ?? 18) + 2))}`,
      recommendedHours: `${formatHour12(quiet?.h ?? 8)} – ${formatHour12(Math.min(20, (quiet?.h ?? 8) + 2))}`,
      weatherCondition: dayWeather?.condition ?? 'Forecast unavailable',
      tempMaxC: dayWeather?.tempMaxC ?? null,
      tempMinC: dayWeather?.tempMinC ?? null,
      rainProbabilityPercent: dayWeather?.rainProbabilityPercent ?? null,
    };
  });

  const bestTimeToVisit: BestTimeRecommendation = {
    windowLabel: tomorrowForecast.recommendedWindow,
    expectedCrowd: `${scoreToCrowdLevel(quietTomorrow[0]?.score ?? 25)} to Moderate`,
    reason:
      'Historical visitor patterns and day-of-week baselines indicate significantly lower footfall during these hours.',
    confidence: tomorrowWeather ? 'Medium' : 'Limited',
    modelLabel: 'PREDICTED',
  };

  return {
    place: {
      id: place.id,
      name: place.name,
      type: place.type,
      category: place.category,
      neighborhood: place.neighborhood,
      description: place.description,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      imageKey: place.imageKey,
      imageUrl: place.imageUrl,
      openingHours: place.openingHours,
      isVerified: place.isVerified,
      popularityScore: place.popularityScore,
      isOutdoor: place.isOutdoor,
      supportsWaitTime: place.supportsWaitTime,
      tags: place.tags,
    },
    crowd: observation,
    zones,
    weather,
    traffic,
    situationSummary: buildSituationSummary(observation, traffic, weather),
    hourlyPredictions,
    tomorrowForecast,
    sevenDayForecast,
    bestTimeToVisit,
    predictionMeta: {
      source: 'PREDICTED',
      modelVersion: 'Baseline-Temporal-v1 (Modular ML Slot)',
      confidence: weather.current.available ? 'Medium' : 'Limited',
      note: 'Combines day-of-week curves with live Open-Meteo weather forecasts; ready for historical sensor ML weights.',
    },
    recentUserReports: recentReports.slice(0, 6),
  };
}
