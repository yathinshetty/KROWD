import React from 'react';
import {ArrowDownRight, ArrowRight, ArrowUpRight} from 'lucide-react';
import type {CrowdLevel, CrowdObservation} from '../../types/krowd';
import {CROWD_COLORS} from '../../utils/crowdStyles';

export const CrowdStatusText: React.FC<{
  level: CrowdLevel;
  trend?: CrowdObservation['trend'];
  compact?: boolean;
}> = ({level, trend, compact = false}) => {
  const style = CROWD_COLORS[level];

  const renderTrendIcon = () => {
    if (!trend) return null;
    if (trend.startsWith('Increasing')) {
      return <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    }
    if (trend.startsWith('Decreasing')) {
      return <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    }
    return <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
        compact ? 'text-xs' : 'text-sm'
      }`}
      style={{color: style.textHex}}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{backgroundColor: style.hex}}
        aria-hidden="true"
      />
      <span>{level} crowd</span>
      {trend && !compact && (
        <span className="inline-flex items-center gap-0.5 text-[#627065] font-normal">
          <span aria-hidden="true">·</span>
          {renderTrendIcon()}
          <span>{trend}</span>
        </span>
      )}
    </span>
  );
};

export const CrowdDensityBar: React.FC<{
  level: CrowdLevel;
  percent: number;
  darkSurface?: boolean;
}> = ({level, percent, darkSurface = false}) => {
  const style = CROWD_COLORS[level];
  return (
    <div className="w-full">
      <div
        className={`h-2.5 w-full rounded-full overflow-hidden ${
          darkSurface ? 'bg-white/15' : 'bg-[#E6F4D7]'
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(6, Math.min(100, percent))}%`,
            backgroundColor: style.hex,
          }}
        />
      </div>
    </div>
  );
};
