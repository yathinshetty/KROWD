import React, {useState} from 'react';
import {Download, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#121814] text-white text-xs font-medium hover:bg-[#1A211C] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-3.5 h-3.5 text-[#A3E635]" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#84CC16] text-[#121814] text-xs font-medium hover:bg-[#A3E635] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121814]/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white border border-[#D1E7BD] p-6 shadow-[0_10px_30px_rgba(40,60,30,0.14)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A211C]">Install KROWD on iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[#627065] hover:bg-[#E6F4D7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-[#627065] list-decimal list-inside">
                <li>Tap the Share button in the Safari toolbar.</li>
                <li>Scroll down and choose Add to Home Screen.</li>
                <li>Tap Add to launch KROWD full-screen anytime.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-[#121814] text-white text-sm font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#121814] px-3.5 py-2 text-xs font-medium text-white shadow-[0_10px_30px_rgba(40,60,30,0.18)]"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#FACC15]" aria-hidden="true" />
      <span>Offline — Live crowd & weather updates paused until reconnected.</span>
    </div>
  );
};
