import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * A camera that reads QR codes. Prefers the back camera, decodes a frame
 * every 150ms, and reports each code once until it has left the frame for
 * a couple of seconds. When there is no camera it says so and gets out of
 * the way — the keyboard scanner field still works.
 */
export const Scanner: React.FC<{ onCode: (text: string) => void; className?: string }> = ({ onCode, className = '' }) => {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const last = useRef({ code: '', at: 0 });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('This browser has no camera access. Use the scanner field instead.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch {
        setError('Camera not available — allow access, or use the scanner field.');
        return;
      }
      const v = video.current, c = canvas.current;
      if (!v || !c || stopped) { stream?.getTracks().forEach((t) => t.stop()); return; }
      v.srcObject = stream;
      try { await v.play(); } catch { /* autoplay policies */ }
      setReady(true);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (stopped) return;
        if (ctx && v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
          c.width = v.videoWidth; c.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (res?.data) {
            const now = Date.now();
            if (res.data !== last.current.code || now - last.current.at > 2500) {
              last.current = { code: res.data, at: now };
              onCode(res.data);
            }
          }
        }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    })();
    return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-ink-900 aspect-[4/3] ${className}`}>
      <video ref={video} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvas} className="hidden" />
      {ready && !error && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-[18%] rounded-2xl border-2 border-white/70" />
          <div className="absolute left-[18%] right-[18%] top-1/2 h-px bg-blue-200/80 breathe" />
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">{error}</div>}
      {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Starting the camera…</div>}
    </div>
  );
};
