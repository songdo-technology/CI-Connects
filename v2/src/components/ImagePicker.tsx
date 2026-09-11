import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2 } from 'lucide-react';
import { uploadImage, describeUpload } from '../lib/upload';
import { Button, Input } from './ui';

/**
 * A picture you change by clicking on it.
 *
 * Click or drop a file and it is resized, uploaded to the site's storage
 * and shown at once — the way people expect a photo field to behave. A
 * link still works for those who have one (Unsplash, a school photo
 * already online), behind a small "Use a link instead".
 */
export const ImagePicker: React.FC<{
  value?: string;
  onChange: (url: string | undefined) => void;
  /** Where the file goes in storage, e.g. `v2/covers/<eventId>`. */
  folder: string;
  shape?: 'wide' | 'logo';
  /** Whether the picture may be taken away (a logo can; a cover cannot). */
  removable?: boolean;
}> = ({ value, onChange, folder, shape = 'wide', removable = false }) => {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [over, setOver] = useState(false);
  const noun = shape === 'logo' ? 'logo' : 'photo';

  const pick = async (file: File | undefined) => {
    if (!file || progress !== null) return;
    setError(null);
    if (!file.type.startsWith('image/')) { setError('That is not an image — use a JPG, PNG or SVG.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('That file is over 25 MB. Export a smaller copy first.'); return; }
    setProgress(0);
    try { onChange(await uploadImage(folder, file, shape === 'logo' ? 'logo' : 'photo', setProgress)); }
    catch (e) { setError(describeUpload(e)); }
    finally { setProgress(null); }
  };
  const useLink = (e: React.FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\//.test(url)) { setError('A link starts with https://'); return; }
    setError(null); onChange(url); setLink(''); setLinking(false);
  };

  return (
    <div>
      <div role="button" tabIndex={0} data-image-picker aria-label={value ? `Change ${noun}` : `Choose a ${noun}`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files[0]); }}
        className={`group relative overflow-hidden rounded-xl border-2 border-dashed cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          over ? 'border-blue-400 bg-blue-50' : value ? 'border-transparent bg-sand-200' : 'border-sand-200 bg-sand-50 hover:border-blue-300'} ${shape === 'wide' ? 'aspect-[21/9]' : 'h-28'}`}>
        {value
          ? <img src={value} alt="" className={`absolute inset-0 w-full h-full ${shape === 'wide' ? 'object-cover' : 'object-contain p-4'}`} />
          : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-500 px-4 text-center"><ImagePlus className="w-6 h-6" /><span className="text-sm">Drop a {noun} here, or click to choose one</span></div>}
        {value && progress === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/30 sm:bg-ink-900/0 sm:group-hover:bg-ink-900/45 transition-colors">
            <span className="btn btn-sm bg-white text-ink-900 shadow-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><ImagePlus className="w-4 h-4" />Change {noun}</span>
          </div>
        )}
        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/65 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Uploading… {Math.round(progress)}%</span>
            <div className="w-40 h-1 bg-white/25 rounded-full overflow-hidden"><div className="h-full bg-white transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
        <span>JPG, PNG or SVG{shape === 'wide' ? ' — a wide photograph works best' : ' — on a light background'}. Big photos are made smaller before upload.</span>
        <button type="button" onClick={() => { setLinking((v) => !v); setError(null); }} className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:text-blue-700"><Link2 className="w-3 h-3" />Use a link instead</button>
        {removable && value && <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:text-rose-700"><Trash2 className="w-3 h-3" />Remove</button>}
      </div>
      {linking && (
        <form onSubmit={useLink} noValidate className="flex gap-2 mt-2">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" autoFocus />
          <Button type="submit" size="sm" variant="secondary">Use</Button>
        </form>
      )}
      {error && <p className="text-xs text-rose-700 mt-2">{error}</p>}
    </div>
  );
};
