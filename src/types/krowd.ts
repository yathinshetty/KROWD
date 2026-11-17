export type PlaceCategory =
  | 'Temples'
  | 'Malls'
  | 'Parks'
  | 'Tourist Places'
  | 'Restaurants'
  | 'Transport'
  | 'Markets'
  | 'Events';

export type CrowdLevel = 'Low' | 'Moderate' | 'High' | 'Very High';

export type DataSourceLabel =
  | 'LIVE DATA'
  | 'USER REPORTED'
  | 'ESTIMATED'
  | 'HISTORICAL BASELINE'
  | 'PREDICTED'
  | 'DEMO DATA'
  | 'Live traffic & weather signal';

export type TrafficLevel = 'Smooth' | 'Moderate' | 'Heavy' | 'Severe';

export type ConfidenceLevel = 'High' | 'Medium' | 'Limited';

export type PlaceType = 'visit' | 'transport';

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  category: PlaceCategory;
  neighborhood: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  imageKey: string;
  imageUrl: string;
  openingHours: string;
  isVerified: boolean;
  popularityScore: number;
  isOutdoor: boolean;
  supportsWaitTime: boolean;
  tags: string[];
}

export interface CrowdObservation {
  crowdLevel: CrowdLevel;
  densityPercent: number;
  densityLabel: string;
  trend: 'Increasing' | 'Increasing gradually' | 'Steady' | 'Decreasing gradually' | 'Decreasing';
  trendDelta: number;
  waitTimeRange: string | null;
  comparisonToTypical: string;
  statusHeadline: string;
  source: DataSourceLabel;
  sourceNote: string;
  isDemoData: boolean;
  confidence: ConfidenceLevel;
  observedAt: string;
  recentReportCount: number;
}

export interface CrowdZoneActivity {
  zoneName: string;
  crowdLevel: CrowdLevel;
  activitySummary: string;
}

export interface WeatherCurrent {
  available: boolean;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  rainProbabilityPercent: number | null;
  windSpeedKmh: number | null;
  visibilityKm: number | null;
  uvIndex: number | null;
  condition: string;
  weatherCode: number | null;
  isDay: boolean;
  outdoorComfort: 'Comfortable' | 'Warm' | 'Humid' | 'Rainy' | 'Unavailable';
  source: DataSourceLabel;
  provider: string;
  observedAt: string;
}

export interface HourlyWeatherPoint {
  timeIso: string;
  hourLabel: string;
  temperatureC: number;
  rainProbabilityPercent: number;
  condition: string;
  weatherCode: number;
}

export interface DailyWeatherPoint {
  dateIso: string;
  dayName: string;
  tempMaxC: number;
  tempMinC: number;
  rainProbabilityPercent: number;
  condition: string;
  weatherCode: number;
}

export interface WeatherPayload {
  current: WeatherCurrent;
  hourly: HourlyWeatherPoint[];
  daily: DailyWeatherPoint[];
}

export interface TrafficCondition {
  congestionLevel: TrafficLevel;
  intensityPercent: number;
  estimatedDelayMinutes: number | null;
  roadCondition: string;
  trend: 'Building' | 'Steady' | 'Easing';
  corridorName: string;
  source: DataSourceLabel;
  isDemoData: boolean;
  providerNote: string;
  observedAt: string;
}

export interface HourlyCrowdPrediction {
  hour24: number;
  hourLabel: string;
  crowdLevel: CrowdLevel;
  intensityScore: number;
  weatherTempC: number | null;
  rainProbabilityPercent: number | null;
  summary: string;
  isCurrentHour: boolean;
}

export interface TomorrowForecast {
  dateIso: string;
  expectedCrowd: CrowdLevel;
  busyHours: string;
  quietHours: string;
  recommendedWindow: string;
  weatherSummary: string;
  confidence: ConfidenceLevel;
}

export interface DailyCrowdForecast {
  dateIso: string;
  dayLabel: string;
  shortDay: string;
  expectedCrowd: CrowdLevel;
  peakIntensity: number;
  busyPeriods: string;
  recommendedHours: string;
  weatherCondition: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  rainProbabilityPercent: number | null;
}

export interface BestTimeRecommendation {
  windowLabel: string;
  expectedCrowd: string;
  reason: string;
  confidence: ConfidenceLevel;
  modelLabel: DataSourceLabel;
}

export interface UserCrowdReport {
  id: string;
  placeId: string;
  crowdLevel: CrowdLevel;
  waitMinutes?: number;
  note?: string;
  createdAt: string;
  moderationStatus: 'approved' | 'pending';
}

export interface PlaceSummary extends Place {
  crowd: CrowdObservation;
  weatherSummary: {
    available: boolean;
    temperatureC: number | null;
    condition: string;
    rainProbabilityPercent: number | null;
    source: DataSourceLabel;
  };
  trafficLevel: TrafficLevel;
  distanceKm?: number;
}

export interface PlaceIntelligence {
  place: Place;
  crowd: CrowdObservation;
  zones: CrowdZoneActivity[] | null;
  weather: WeatherPayload;
  traffic: TrafficCondition;
  situationSummary: string;
  hourlyPredictions: HourlyCrowdPrediction[];
  tomorrowForecast: TomorrowForecast;
  sevenDayForecast: DailyCrowdForecast[];
  bestTimeToVisit: BestTimeRecommendation;
  predictionMeta: {
    source: DataSourceLabel;
    modelVersion: string;
    confidence: ConfidenceLevel;
    note: string;
  };
  recentUserReports: UserCrowdReport[];
}

export interface CityInsightsPayload {
  cityName: string;
  generatedAt: string;
  weather: WeatherCurrent;
  overallTraffic: {
    level: TrafficLevel;
    summary: string;
    source: DataSourceLabel;
    isDemoData: boolean;
  };
  busyLocations: PlaceSummary[];
  quietLocations: PlaceSummary[];
  popularLocations: PlaceSummary[];
  categoryBreakdown: Array<{
    category: PlaceCategory;
    averageIntensity: number;
    placeCount: number;
    dominantLevel: CrowdLevel;
  }>;
  hourlyCityRhythm: Array<{
    hourLabel: string;
    intensity: number;
    label: CrowdLevel;
  }>;
  unusualActivity: Array<{
    placeId: string;
    placeName: string;
    category: PlaceCategory;
    reason: string;
    crowdLevel: CrowdLevel;
    source: DataSourceLabel;
  }>;
  transparencyNote: string;
}
