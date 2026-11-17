import React, {useState} from 'react';
import {motion} from 'motion/react';
import {CheckCircle2, Send, X} from 'lucide-react';
import type {CrowdLevel} from '../../types/krowd';
import {submitCrowdReport} from '../../services/api';
import {saveLocalCrowdReport} from '../../services/liveIntelligence';
import {CROWD_COLORS} from '../../utils/crowdStyles';

interface ReportCrowdModalProps {
  placeId: string;
  placeName: string;
  supportsWaitTime: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const LEVELS: CrowdLevel[] = ['Low', 'Moderate', 'High', 'Very High'];

export const ReportCrowdModal: React.FC<ReportCrowdModalProps> = ({
  placeId,
  placeName,
  supportsWaitTime,
  onClose,
  onSubmitted,
}) => {
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>('Moderate');
  const [waitMinutes, setWaitMinutes] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const parsedWait = waitMinutes.trim() ? Number(waitMinutes) : undefined;
    const validWait =
      parsedWait !== undefined && !Number.isNaN(parsedWait) ? parsedWait : undefined;
    const cleanNote = note.trim() || undefined;

    try {
      let savedFromServer: {id: string; createdAt: string} | null = null;
      try {
        const res = await submitCrowdReport({
          placeId,
          crowdLevel,
          waitMinutes: validWait,
          note: cleanNote,
        });
        savedFromServer = res.report;
      } catch {
        // Still persist locally for 90 minutes if server rate-limits or is offline
      }

      saveLocalCrowdReport({
        id: savedFromServer?.id,
        placeId,
        crowdLevel,
        waitMinutes: validWait,
        note: cleanNote,
        createdAt: savedFromServer?.createdAt,
      });

      setSuccess(true);
      onSubmitted();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{opacity: 0, scale: 0.98, y: -4}}
      animate={{opacity: 1, scale: 1, y: 0}}
      exit={{opacity: 0, scale: 0.98, y: -4}}
      transition={{type: 'spring', stiffness: 380, damping: 30}}
      className="rounded-[18px] bg-[#E6F4D7]/70 border border-[#D1E7BD] p-4 space-y-3 will-change-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[#1A211C]">Share current crowd level</h4>
          <p className="text-xs text-[#627065]">Anonymous update for {placeName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close crowd report form"
          className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#627065] hover:text-[#1A211C]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {success ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#E6F9ED] p-3 text-sm font-medium text-[#15803D]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Thanks! Your anonymous report is now reflected.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LEVELS.map((lvl) => {
              const active = crowdLevel === lvl;
              const style = CROWD_COLORS[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCrowdLevel(lvl)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
                    active
                      ? 'bg-[#121814] text-white shadow-sm'
                      : 'bg-white text-[#1A211C] hover:bg-[#F2FAE8]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{backgroundColor: style.hex}}
                    aria-hidden="true"
                  />
                  <span>{lvl}</span>
                </button>
              );
            })}
          </div>

          {supportsWaitTime && (
            <div>
              <label className="block text-xs font-medium text-[#627065] mb-1">
                Estimated wait time in minutes (optional)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(e.target.value)}
                placeholder="e.g. 15"
                className="w-full rounded-xl bg-white border border-[#D1E7BD] px-3 py-2 text-sm text-[#1A211C] focus:outline-none focus:ring-2 focus:ring-[#84CC16]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#627065] mb-1">
              Quick observation (optional)
            </label>
            <input
              type="text"
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Main gate moving smoothly, parking full"
              className="w-full rounded-xl bg-white border border-[#D1E7BD] px-3 py-2 text-sm text-[#1A211C] focus:outline-none focus:ring-2 focus:ring-[#84CC16]"
            />
          </div>

          {error && <p className="text-xs font-medium text-[#B91C1C]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#84CC16] text-[#121814] text-sm font-semibold hover:bg-[#A3E635] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{submitting ? 'Submitting...' : 'Submit Anonymous Report'}</span>
          </button>
        </form>
      )}
    </motion.div>
  );
};
