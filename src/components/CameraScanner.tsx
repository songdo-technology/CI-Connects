import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  /** Called once per distinct code. Repeats of the same code are suppressed. */
  onScan: (raw: string) => void;
  /** Pauses decoding while a result is being shown, without dropping the stream. */
  paused?: boolean;
}

/**
 * Camera QR reader, for scanning badges on a phone.
 *
 * Deliberately decodes in JavaScript rather than using the browser's
 * BarcodeDetector: that API does not exist in Safari, and the people holding
 * the phones at a school door will mostly be holding iPhones. jsQR runs
 * everywhere getUserMedia does, which is the whole point — no dedicated
 * scanning hardware, just a phone someone already has.
 *
 * The camera stream needs a secure context. On localhost that is granted; in
 * production the site is served over HTTPS, so it holds there too. Over plain
 * HTTP on a LAN address it will not, and the error below says so rather than
 * failing silently.
 */
export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, paused = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Suppresses the same code firing on every frame while it stays in view. */
  const lastRef = useRef<{ value: string; at: number } | null>(null);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Frames examined since the camera started. Zero while running means the
   *  stream is not delivering pixels, which looks identical to "no code in
   *  view" unless it is reported. */
  const [framesSeen, setFramesSeen] = useState(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStatus('starting');
    setError(null);
    try {
      if (!window.isSecureContext) {
        throw new Error(
          'The camera needs a secure connection. Open this page over HTTPS, or on localhost.',
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        // The rear camera is the one pointed at a badge.
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      // iOS refuses to play an unmuted inline video without a gesture; this is
      // already inside a click, but the attributes matter regardless.
      video.setAttribute('playsinline', 'true');
      await video.play();
      setStatus('running');
    } catch (e) {
      const err = e as { name?: string; message?: string };
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was declined. Allow camera access for this site, then try again.'
          : err.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : err.message ?? 'The camera could not be started.',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  // Decode loop. Runs off requestAnimationFrame so it pauses automatically
  // when the tab is backgrounded, rather than burning battery at a door.
  useEffect(() => {
    if (status !== 'running') return;

    let frames = 0;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (pausedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      // HAVE_CURRENT_DATA (2) is enough to read a frame. The earlier check
      // demanded HAVE_ENOUGH_DATA (4), which a live camera stream often never
      // reports — so every frame was skipped and nothing ever decoded.
      if (!video || !canvas || video.readyState < 2) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      // Decode at a reduced resolution: a QR only needs enough pixels to
      // resolve its modules, and full-resolution frames make this loop drop
      // frames on older phones.
      const targetW = Math.min(640, w);
      const targetH = Math.round((targetW / w) * h);
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, targetW, targetH);

      frames += 1;
      if (frames % 30 === 0) setFramesSeen(frames);

      const image = ctx.getImageData(0, 0, targetW, targetH);
      // attemptBoth costs a second pass but reads codes that arrive inverted
      // or low-contrast — a phone screen photographed under hall lighting is
      // exactly that case, and it is the common one at a door.
      const found = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (!found?.data) return;

      const now = Date.now();
      // Same badge held in front of the lens keeps decoding; only act once
      // every few seconds so a queue does not produce twenty scans per person.
      if (lastRef.current?.value === found.data && now - lastRef.current.at < 3000) return;
      lastRef.current = { value: found.data, at: now };

      if (navigator.vibrate) navigator.vibrate(40);
      onScanRef.current(found.data);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [status]);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900">
      <div className="relative aspect-[4/3] bg-slate-900">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover ${status === 'running' ? '' : 'opacity-0'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {status === 'running' && (
          // Aiming frame. Purely visual, but a target makes people hold the
          // badge still, which is most of what makes a scan succeed.
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-48 h-48 rounded-2xl border-4 transition-colors ${
              paused ? 'border-emerald-400' : 'border-white/70'
            }`} />
          </div>
        )}

        {status !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {status === 'starting' ? (
              <>
                <Loader2 className="w-7 h-7 text-blue-300 animate-spin" />
                <p className="text-sm text-slate-300">Starting the camera…</p>
              </>
            ) : status === 'error' ? (
              <>
                <CameraOff className="w-7 h-7 text-amber-400" />
                <p className="text-sm text-amber-200 max-w-xs leading-relaxed">{error}</p>
                <button
                  onClick={start}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold hover:bg-white/20 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try again
                </button>
              </>
            ) : (
              <>
                <Camera className="w-7 h-7 text-blue-300" />
                <p className="text-sm text-slate-300 max-w-xs leading-relaxed">
                  Use the camera on this phone or laptop to scan badges. No separate
                  scanner needed.
                </p>
                <button
                  onClick={start}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start camera
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {status === 'running' && (
        <div className="px-4 py-2.5 bg-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">
            {paused
              ? 'Showing result…'
              : framesSeen > 0
                ? 'Scanning — point at a QR code'
                : 'Waiting for the camera…'}
          </span>
          <button
            onClick={() => { stop(); setStatus('idle'); }}
            className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            Stop camera
          </button>
        </div>
      )}
    </div>
  );
};
