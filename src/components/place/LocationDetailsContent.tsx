import React, {useState} from 'react';
import {AnimatePresence} from 'motion/react';
import {
  Car,
  Clock,
  Droplets,
  Eye,
  MapPin,
  MessageSquarePlus,
  Navigation,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
  X,
} from 'lucide-react';
import type {PlaceIntelligence} from '../../types/krowd';
import type {UserCoordinates} from '../../hooks/useGeolocation';
import {
  CROWD_COLORS,
  TRAFFIC_COLORS,
  buildGoogleMapsDirectionsUrl,
  formatDistance,
  formatRelativeTime,
  formatSourceLabel,
  formatSourceTag,
  formatTrafficStatusLabel,
} from '../../utils/crowdStyles';
import {WeatherIcon} from '../common/CategoryIcon';
import {CrowdDensityBar, CrowdStatusText} from '../common/CrowdIndicator';
import {PlacePhoto} from '../common/PlacePhoto';
import {CrowdPredictionSection} from './CrowdPredictionSection';
import {ReportCrowdModal} from './ReportCrowdModal';

interface LocationDetailsContentProps {
  intelligence: PlaceIntelligence | null;
  loading: boolean;
  error: string | null;
  distanceKm?: number;
  userCoords: UserCoordinates | null;
  onClose?: () => void;
  onRefresh: () => void;
}

export const LocationDetailsContent: React.FC<LocationDetailsContentProps> = React.memo(({
  intelligence,
  loading,
  error,
  distanceKm,
  userCoords,
  onClose,
  onRefresh,
}) => {
  const [showReportForm, setShowReportForm] = useState(false);

  if (loading && !intelligence) {
    return (
      <div className="p-5 space-y-4 animate-pulse">
        <div className="h-44 rounded-[18px] bg-[#E6F4D7]" />
        <div className="h-6 w-2/3 rounded-lg bg-[#E6F4D7]" />
        <div className="h-4 w-1/2 rounded-lg bg-[#E6F4D7]" />
        <div className="h-32 rounded-[18px] bg-[#E6F4D7]" />
        <div className="h-40 rounded-[18px] bg-[#E6F4D7]" />
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm font-medium text-[#1A211C]">
          {error ?? 'Select a location to view live crowd and weather intelligence.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-[#121814] text-white text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    place,
    crowd,
    zones,
    weather,
    traffic,
    situationSummary,
    hourlyPredictions,
    tomorrowForecast,
    sevenDayForecast,
    bestTimeToVisit,
    predictionMeta,
    recentUserReports,
  } = intelligence;

  const crowdStyle = CROWD_COLORS[crowd.crowdLevel];
  const trafficStyle = TRAFFIC_COLORS[traffic.congestionLevel];
  const distLabel = formatDistance(distanceKm);

  const directionsUrl = buildGoogleMapsDirectionsUrl({
    destLat: place.latitude,
    destLon: place.longitude,
    destName: place.name,
    originLat: userCoords?.latitude,
    originLon: userCoords?.longitude,
  });

  return (
    <div className="space-y-5 pb-8">
      {/* A. Location Header */}
      <div className="relative">
        <div className="relative h-48 w-full overflow-hidden rounded-[18px] bg-[#E6F4D7]">
          <PlacePhoto
            imageKey={place.imageKey}
            imageUrl={place.imageUrl}
            name={place.name}
            category={place.category}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121814]/85 via-[#121814]/20 to-transparent" />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close location details"
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center text-[#1A211C] hover:bg-white shadow-[0_6px_16px_rgba(40,60,30,0.16)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="font-sans font-medium text-[12px] leading-[1.3] tracking-[0em] tabular-nums text-[#A3E635]">
              {place.category} · {place.neighborhood}
              {distLabel ? ` · ${distLabel}` : ''}
            </div>
            <h2 className="font-display font-bold text-[20px] leading-[1.25] tracking-[-0.015em] text-balance">
              {place.name}
            </h2>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 px-1">
          <div className="flex items-start gap-2 font-sans font-normal text-[12px] leading-[1.4] tracking-[0em] text-[#627065]">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1A211C]" aria-hidden="true" />
            <span>{place.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans font-normal text-[12px] leading-[1.4] tracking-[0em] text-[#627065] tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1A211C]" aria-hidden="true" />
              <span>{place.openingHours}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Updated {formatRelativeTime(crowd.observedAt) === 'Just now' ? 'just now' : formatRelativeTime(crowd.observedAt)}
            </span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-4 flex items-center gap-2.5">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#84CC16] text-[#121814] px-4 py-3 font-sans font-semibold text-[14px] leading-[1.2] tracking-[-0.005em] hover:bg-[#A3E635] active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out min-h-[44px]"
          >
            <Navigation className="w-4 h-4 text-[#121814]" aria-hidden="true" />
            <span>Get Directions</span>
          </a>
          <button
            type="button"
            onClick={() => setShowReportForm((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#121814] text-white px-4 py-3 font-sans font-semibold text-[14px] leading-[1.2] tracking-[-0.005em] hover:bg-[#1A211C] transition-colors min-h-[44px] whitespace-nowrap"
          >
            <MessageSquarePlus className="w-4 h-4 text-[#A3E635]" aria-hidden="true" />
            <span>Report Crowd</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showReportForm && (
          <ReportCrowdModal
            placeId={place.id}
            placeName={place.name}
            supportsWaitTime={place.supportsWaitTime}
            onClose={() => setShowReportForm(false)}
            onSubmitted={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* B. Prominent Current Situation Report (Obsidian High-Contrast Card) */}
      <section
        aria-labelledby="current-situation-heading"
        className="rounded-[20px] bg-[#121814] text-white p-4 space-y-3.5 shadow-[0_10px_30px_rgba(40,60,30,0.12)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-white/65">Current situation</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="font-display font-bold text-[18px] leading-[1.2] tracking-[-0.015em]"
                style={{color: crowdStyle.hex}}
              >
                {crowd.crowdLevel} Crowd
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-sans font-medium text-[11px] leading-[1.3] tracking-[0em] text-[#A3E635]">
              {formatSourceTag(crowd.source, crowd.isDemoData)}
            </div>
            <div className="font-sans font-normal text-[11px] leading-[1.3] tracking-[0em] text-white/65">
              {crowd.confidence} confidence
            </div>
          </div>
        </div>

        <CrowdDensityBar level={crowd.crowdLevel} percent={crowd.densityPercent} darkSurface />

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white/8 border border-white/10 p-3">
            <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-white/65">Estimated density</div>
            <div className="font-sans font-semibold text-[13px] leading-[1.35] tracking-[-0.005em] text-white mt-0.5 tabular-nums">
              {crowd.densityLabel}
            </div>
          </div>
          <div className="rounded-xl bg-white/8 border border-white/10 p-3">
            <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-white/65">Crowd trend</div>
            <div className="font-sans font-semibold text-[13px] leading-[1.35] tracking-[-0.005em] text-white mt-0.5 tabular-nums">
              {crowd.trend}
            </div>
          </div>
          {crowd.waitTimeRange && (
            <div className="rounded-xl bg-white/8 border border-white/10 p-3">
              <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-white/65">Estimated wait</div>
              <div className="font-sans font-semibold text-[13px] leading-[1.35] tracking-[-0.005em] text-[#A3E635] mt-0.5 tabular-nums">
                {crowd.waitTimeRange}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-white/8 border border-white/10 p-3">
            <div className="font-sans font-normal text-[12px] leading-[1.3] tracking-[0em] text-white/65">Nearby traffic</div>
            <div
              className="font-sans font-semibold text-[13px] leading-[1.35] tracking-[-0.005em] mt-0.5 tabular-nums"
              style={{color: trafficStyle.hex}}
            >
              {formatTrafficStatusLabel(traffic.congestionLevel)}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white/8 border border-white/10 p-3 font-sans font-normal text-[13px] leading-[1.45] tracking-[0em] space-y-1">
          <div>
            <span className="font-semibold text-white">Typical comparison: </span>
            <span className="text-white/75">{crowd.comparisonToTypical}</span>
          </div>
          <div>
            <span className="font-semibold text-white">Status: </span>
            <span className="text-white/90">{crowd.statusHeadline}</span>
          </div>
          <div className="text-[11px] text-white/60 pt-0.5">{crowd.sourceNote}</div>
        </div>
      </section>

      {/* E. Natural-Language Current Situation Summary */}
      <section aria-labelledby="summary-heading" className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4">
        <h3 id="summary-heading" className="font-display text-sm font-bold text-[#1A211C]">
          Situation Summary
        </h3>
        <p className="mt-1.5 font-sans font-normal text-[13px] leading-[1.45] tracking-[0em] text-[#1A211C]/85">
          {situationSummary}
        </p>
      </section>

      {/* C. Crowd Distribution (Only when verified sub-zone data exists) */}
      {zones && zones.length > 0 && (
        <section aria-labelledby="zones-heading" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 id="zones-heading" className="font-display text-base font-bold text-[#1A211C]">
              Area Crowd Distribution
            </h3>
            <span className="font-sans font-medium text-[11px] leading-[1.3] text-[#627065]">Estimated zones</span>
          </div>
          <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] divide-y divide-[#D1E7BD]/70">
            {zones.map((z) => (
              <div key={z.zoneName} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-sans text-sm font-semibold text-[#1A211C]">{z.zoneName}</div>
                  <div className="font-sans text-xs text-[#627065] mt-0.5">{z.activitySummary}</div>
                </div>
                <div className="shrink-0">
                  <CrowdStatusText level={z.crowdLevel} compact />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* D. Environmental & Traffic Conditions */}
      <section aria-labelledby="environment-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="environment-heading" className="font-display text-base font-bold text-[#1A211C]">
            Weather &amp; Environment
          </h3>
          <span className="font-sans font-medium text-[11px] leading-[1.3] text-[#627065] tabular-nums">
            {formatSourceLabel(weather.current.source)} · {weather.current.provider}
          </span>
        </div>

        {weather.current.available ? (
          <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white border border-[#D1E7BD] flex items-center justify-center text-[#1A211C] shadow-sm">
                  <WeatherIcon code={weather.current.weatherCode} className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display text-2xl font-bold tabular-nums text-[#1A211C]">
                    {weather.current.temperatureC}°C
                  </div>
                  <div className="font-sans text-xs text-[#627065]">
                    {weather.current.condition} · Feels like {weather.current.feelsLikeC}°C
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-sans text-xs font-semibold text-[#1A211C]">
                  {weather.current.outdoorComfort}
                </div>
                <div className="font-sans text-[11px] text-[#627065]">Outdoor comfort</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5">
                <div className="flex items-center gap-1 text-[#627065]">
                  <Umbrella className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Rain</span>
                </div>
                <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                  {weather.current.rainProbabilityPercent ?? 0}%
                </div>
              </div>
              <div className="rounded-xl bg-white p-2.5">
                <div className="flex items-center gap-1 text-[#627065]">
                  <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Humidity</span>
                </div>
                <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                  {weather.current.humidityPercent ?? 0}%
                </div>
              </div>
              <div className="rounded-xl bg-white p-2.5">
                <div className="flex items-center gap-1 text-[#627065]">
                  <Wind className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Wind</span>
                </div>
                <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                  {weather.current.windSpeedKmh ?? 0} km/h
                </div>
              </div>
              {weather.current.visibilityKm !== null && (
                <div className="rounded-xl bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[#627065]">
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Visibility</span>
                  </div>
                  <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                    {weather.current.visibilityKm} km
                  </div>
                </div>
              )}
              {weather.current.uvIndex !== null && (
                <div className="rounded-xl bg-white p-2.5">
                  <div className="flex items-center gap-1 text-[#627065]">
                    <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>UV Index</span>
                  </div>
                  <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                    {weather.current.uvIndex}
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-white p-2.5">
                <div className="flex items-center gap-1 text-[#627065]">
                  <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Feels like</span>
                </div>
                <div className="font-sans font-semibold text-[13px] tabular-nums text-[#1A211C] mt-1">
                  {weather.current.feelsLikeC}°C
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4 font-sans text-xs text-[#627065]">
            Live weather data for these coordinates is temporarily unavailable.
          </div>
        )}

        {/* Surrounding Traffic Card */}
        <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-[#1A211C]" aria-hidden="true" />
              <span className="font-sans text-sm font-semibold text-[#1A211C]">
                Surrounding Traffic · {traffic.corridorName}
              </span>
            </div>
            <span
              className="font-sans text-xs font-semibold"
              style={{color: trafficStyle.textHex}}
            >
              {formatTrafficStatusLabel(traffic.congestionLevel)}
            </span>
          </div>
          <p className="font-sans font-normal text-[13px] leading-[1.45] text-[#627065]">{traffic.roadCondition}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] text-[#627065] tabular-nums">
            <span>Trend: {traffic.trend}</span>
            {traffic.estimatedDelayMinutes !== null && (
              <span>Delay: ~{traffic.estimatedDelayMinutes} mins</span>
            )}
            <span>{formatSourceTag(traffic.source, traffic.isDemoData)}</span>
          </div>
          <p className="font-sans text-[11px] text-[#627065]">{traffic.providerNote}</p>
        </div>
      </section>

      {/* F. Crowd Predictions & 7-Day Forecast */}
      <CrowdPredictionSection
        hourly={hourlyPredictions}
        tomorrow={tomorrowForecast}
        sevenDay={sevenDayForecast}
        bestTime={bestTimeToVisit}
        predictionMeta={predictionMeta}
      />

      {/* G. Recent Anonymous Visitor Reports */}
      {recentUserReports.length > 0 && (
        <section aria-labelledby="reports-heading" className="space-y-2">
          <h3 id="reports-heading" className="font-display text-sm font-bold text-[#1A211C]">
            Recent Visitor Reports · User reported
          </h3>
          <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] divide-y divide-[#D1E7BD]/70">
            {recentUserReports.map((rep) => (
              <div key={rep.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                <div>
                  <CrowdStatusText level={rep.crowdLevel} compact />
                  {rep.note && <p className="font-sans text-[#1A211C] mt-1">{rep.note}</p>}
                  {typeof rep.waitMinutes === 'number' && (
                    <p className="font-sans text-[#627065] mt-0.5 tabular-nums">
                      Reported wait: ~{rep.waitMinutes} mins
                    </p>
                  )}
                </div>
                <span className="font-sans text-[#627065] tabular-nums shrink-0">
                  {formatRelativeTime(rep.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
