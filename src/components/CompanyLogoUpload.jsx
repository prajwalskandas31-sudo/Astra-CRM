import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

// Formats the server accepts (LOGO_TYPES in backend/sync.py)
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp,image/x-icon,image/vnd.microsoft.icon,image/avif,.png,.jpg,.jpeg,.jfif,.webp,.svg,.gif,.bmp,.ico,.avif';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;   // what can be picked; it is shrunk before saving
const MAX_SAVED_CHARS = 1_400_000;            // MAX_LOGO_CHARS in backend/sync.py
const MAX_SIDE = 512;                          // longest side of a saved raster logo, in pixels

const EXT_TYPE = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
  gif: 'image/gif', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif'
};

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Could not read the file.'));
  reader.readAsDataURL(blob);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('This image could not be opened. Try a JPG, PNG, WEBP or SVG file.'));
  img.src = src;
});

/** The picked file as a data URL small enough to share with every user. */
export const prepareLogo = async (file) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = (file.type || EXT_TYPE[ext] || '').toLowerCase();
  if (!type.startsWith('image/') || !Object.values(EXT_TYPE).concat('image/vnd.microsoft.icon', 'image/jpg').includes(type)) {
    throw new Error('Please choose an image: JPG, JPEG, PNG, WEBP, SVG, GIF, BMP, ICO or AVIF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('The image is larger than 10 MB.');

  // Keep the declared type so the data URL matches it (some systems give .svg files no type)
  const original = await readAsDataUrl(file.type ? file : new Blob([file], { type }));
  if (type === 'image/svg+xml' || type === 'image/gif' || type.includes('icon')) {
    // Vector, animated and icon files are kept as they are
    if (original.length > MAX_SAVED_CHARS) throw new Error('This logo file is too large; please keep it under 1 MB.');
    await loadImage(original);
    return original;
  }
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  if (scale === 1 && original.length <= 300_000) return original;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  // JPEG stays JPEG; everything else becomes PNG so transparent backgrounds survive
  const shrunk = type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
  const best = shrunk.length < original.length || original.length > MAX_SAVED_CHARS ? shrunk : original;
  if (best.length > MAX_SAVED_CHARS) throw new Error('This logo is still too large after resizing; please use a smaller image.');
  return best;
};

/** Company Logo picker with a preview; saves as soon as a file is chosen. */
export const CompanyLogoUpload = ({ logo, canEdit, onChange, onError }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await prepareLogo(file));
    } catch (err) {
      onError(err.message || 'Could not use this image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
      <label htmlFor="company-logo-file">Company Logo</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{
          width: '120px', height: '72px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg-input)'
        }}>
          {logo
            ? <img src={logo} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>No logo</span>}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input id="company-logo-file" ref={input} type="file" accept={LOGO_ACCEPT} onChange={pick} style={{ display: 'none' }} />
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ImagePlus size={14} /> {busy ? 'Processing...' : logo ? 'Replace Logo' : 'Upload Logo'}
              </button>
              {logo && (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => onChange('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              JPG, JPEG, PNG, WEBP, SVG, GIF, BMP, ICO or AVIF. Saved and shared with every user straight away.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
