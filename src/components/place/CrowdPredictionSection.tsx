import React, {useState} from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {Calendar, Clock} from 'lucide-react';
import type {
  BestTimeRecommendation,
  DailyCrowdForecast,
  HourlyCrowdPrediction,
  TomorrowForecast,
} from '../../types/krowd';
import {CROWD_COLORS, formatSourceLabel} from '../../utils/crowdStyles';

interface CrowdPredictionSectionProps {
  hourly: HourlyCrowdPrediction[];
  tomorrow: TomorrowForecast;
  sevenDay: DailyCrowdForecast[];
  bestTime: BestTimeRecommendation;
  predictionMeta: {
    source: string;
    modelVersion: string;
    confidence: string;
    note: string;
  };
}

export const CrowdPredictionSection: React.FC<CrowdPredictionSectionProps> = ({
  hourly,
  tomorrow,
  sevenDay,
  bestTime,
  predictionMeta,
}) => {
  const defaultSelectedIdx = Math.max(
    0,
    hourly.findIndex((h) => h.isCurrentHour)
  );
  const [selectedIdx, setSelectedIdx] = useState<number>(defaultSelectedIdx);
  const [tab, setTab] = useState<'hourly' | 'tomorrow' | '7day'>('hourly');

  const activeHour = hourly[selectedIdx] ?? hourly[0];

  return (
    <section aria-labelledby="predictions-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="predictions-heading" className="font-display text-base font-bold text-[#1A211C]">
            Crowd Forecast
          </h3>
          <p className="font-sans text-xs text-[#627065]">
            {formatSourceLabel(predictionMeta.source)} · {predictionMeta.confidence} confidence · {predictionMeta.modelVersion}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#E6F4D7] border border-[#D1E7BD]">
          <button
            type="button"
            onClick={() => setTab('hourly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'hourly'
                ? 'bg-[#121814] text-white shadow-sm'
                : 'text-[#627065] hover:text-[#1A211C]'
            }`}
          >
            Hourly
          </button>
          <button
            type="button"
            onClick={() => setTab('tomorrow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'tomorrow'
                ? 'bg-[#121814] text-white shadow-sm'
                : 'text-[#627065] hover:text-[#1A211C]'
            }`}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setTab('7day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === '7day'
                ? 'bg-[#121814] text-white shadow-sm'
                : 'text-[#627065] hover:text-[#1A211C]'
            }`}
          >
            7-Day
          </button>
        </div>
      </div>

      {/* Best Time To Visit Highlight (Obsidian Contrast Callout) */}
      <div className="rounded-[18px] bg-[#121814] text-white p-4 shadow-[0_10px_30px_rgba(40,60,30,0.1)]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-white/75">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#A3E635]" aria-hidden="true" />
            <span>Best time to visit</span>
          </span>
          <span className="text-[#A3E635]">
            {formatSourceLabel(bestTime.modelLabel)} · {bestTime.confidence} confidence
          </span>
        </div>
        <div className="mt-1.5 font-display text-base font-bold text-white">{bestTime.windowLabel}</div>
        <div className="mt-0.5 font-sans text-xs font-medium text-[#A3E635]">
          Expected crowd: {bestTime.expectedCrowd}
        </div>
        <p className="mt-1.5 font-sans font-normal text-[13px] leading-[1.45] text-white/75">{bestTime.reason}</p>
      </div>

      {tab === 'hourly' && (
        <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4 space-y-3">
          <div className="flex items-center justify-between font-sans text-xs text-[#627065]">
            <span>Tap any hour bar to inspect expected crowd</span>
            <span className="tabular-nums">6 AM – 10 PM</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourly}
                margin={{top: 8, right: 4, left: -24, bottom: 0}}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    setSelectedIdx(state.activeTooltipIndex);
                  }
                }}
              >
                <XAxis
                  dataKey="hourLabel"
                  tick={{fontSize: 10, fill: '#627065'}}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{fontSize: 10, fill: '#627065'}}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{fill: 'rgba(163, 230, 53, 0.22)'}}
                  content={({active, payload}) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as HourlyCrowdPrediction;
                    return (
                      <div className="rounded-xl bg-[#121814] px-3 py-2 text-xs text-white shadow-lg">
                        <div className="font-semibold">
                          {item.hourLabel} · {item.crowdLevel}
                        </div>
                        <div className="text-[#A3E635] font-sans tabular-nums">
                          Load index: {item.intensityScore}%
                          {item.weatherTempC !== null ? ` · ${item.weatherTempC}°C` : ''}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="intensityScore"
                  radius={[6, 6, 2, 2]}
                  className="cursor-pointer"
                  onClick={(_data, idx) => {
                    if (typeof idx === 'number') setSelectedIdx(idx);
                  }}
                >
                  {hourly.map((entry, idx) => {
                    const color = CROWD_COLORS[entry.crowdLevel].hex;
                    const isSelected = idx === selectedIdx;
                    return (
                      <Cell
                        key={entry.hour24}
                        fill={color}
                        fillOpacity={isSelected ? 1 : 0.78}
                        stroke={isSelected ? '#121814' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {activeHour && (
            <div className="rounded-xl bg-white border border-[#D1E7BD] p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[#627065]">
                  Selected window · {activeHour.hourLabel}
                  {activeHour.isCurrentHour ? ' (Current hour)' : ''}
                </div>
                <div className="text-sm font-semibold text-[#1A211C] mt-0.5">
                  {activeHour.crowdLevel} crowd expected
                </div>
                <div className="text-xs text-[#627065] mt-0.5">{activeHour.summary}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-lg font-bold tabular-nums text-[#1A211C]">
                  {activeHour.intensityScore}%
                </div>
                {activeHour.weatherTempC !== null && (
                  <div className="font-sans text-xs text-[#627065] tabular-nums">
                    {activeHour.weatherTempC}°C · {activeHour.rainProbabilityPercent ?? 0}% rain
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tomorrow' && (
        <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-semibold text-[#1A211C]">Tomorrow&apos;s Outlook</span>
            <span className="font-sans text-xs text-[#627065] tabular-nums">{tomorrow.dateIso}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3">
              <div className="font-sans font-normal text-[12px] leading-[1.3] text-[#627065]">Expected crowd</div>
              <div
                className="font-sans font-semibold text-[13px] leading-[1.35] mt-1"
                style={{color: CROWD_COLORS[tomorrow.expectedCrowd].textHex}}
              >
                {tomorrow.expectedCrowd}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3">
              <div className="font-sans font-normal text-[12px] leading-[1.3] text-[#627065]">Quiet hours</div>
              <div className="font-sans font-semibold text-[13px] leading-[1.35] text-[#1A211C] mt-1 tabular-nums">
                {tomorrow.quietHours}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3">
              <div className="font-sans font-normal text-[12px] leading-[1.3] text-[#627065]">Expected busy hours</div>
              <div className="font-sans font-semibold text-[13px] leading-[1.35] text-[#1A211C] mt-1 tabular-nums">
                {tomorrow.busyHours}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3">
              <div className="font-sans font-normal text-[12px] leading-[1.3] text-[#627065]">Recommended time</div>
              <div className="font-sans font-semibold text-[13px] leading-[1.35] text-[#15803D] mt-1 tabular-nums">
                {tomorrow.recommendedWindow}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 text-xs text-[#627065]">
            <span className="font-medium text-[#1A211C]">Weather forecast: </span>
            {tomorrow.weatherSummary}
          </div>
        </div>
      )}

      {tab === '7day' && (
        <div className="rounded-[18px] bg-[#E6F4D7]/55 border border-[#D1E7BD] p-3 divide-y divide-[#D1E7BD]/70">
          {sevenDay.map((day) => {
            const cStyle = CROWD_COLORS[day.expectedCrowd];
            return (
              <div key={day.dateIso} className="py-2.5 px-1 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#627065] shrink-0" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[#1A211C]">{day.dayLabel}</span>
                    <span className="font-sans text-xs text-[#627065] tabular-nums">
                      {day.tempMinC !== null && day.tempMaxC !== null
                        ? `${day.tempMinC}°–${day.tempMaxC}°C`
                        : ''}
                    </span>
                  </div>
                  <div className="text-xs text-[#627065] mt-0.5 pl-5 truncate">
                    Busy: {day.busyPeriods} · Best: {day.recommendedHours}
                  </div>
                  <div className="text-xs text-[#627065] pl-5 truncate">
                    {day.weatherCondition}
                    {day.rainProbabilityPercent !== null
                      ? ` · ${day.rainProbabilityPercent}% rain`
                      : ''}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    style={{color: cStyle.textHex}}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{backgroundColor: cStyle.hex}}
                      aria-hidden="true"
                    />
                    <span>{day.expectedCrowd}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-[#627065] leading-relaxed">
        {predictionMeta.note}
      </p>
    </section>
  );
};
