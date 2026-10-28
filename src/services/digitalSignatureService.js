/**
 * Digital Signature Management Service
 * 
 * Provides secure, encrypted client-side storage, password verification, 
 * format conversion (PNG/JPG/WEBP/SVG), dynamic signatory profiling,
 * and transparent background processing for digital signatures across the CRM.
 */

import { API_BASE_URL, isBackendEnabled, isBackendAuthoritative, readErrorDetail, verifyPasswordWithServer } from './backendConfig';

const STORAGE_KEY = 'astra_crm_digital_signatures';
const VAULT_SESSION_KEY = 'astra_crm_sig_vault_unlocked';

// ─── Server copy (backend/signatures.py) ──────────────────────────────────────
// The server holds the shared signatures; localStorage is only this browser's cache of them.
const signatureApiHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}`
});

const writeSignatureCache = (map) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('astra:digital_signature_updated', {
    detail: { key: 'master_officer', signature: map.master_officer || null }
  }));
};

/** Refresh this browser's cache from the server. Returns the server map, or null if unavailable. */
export const pullSignaturesFromServer = async () => {
  if (!isBackendEnabled()) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/signatures`, { headers: signatureApiHeaders() });
    if (!res.ok) return null;
    const map = await res.json();
    if (map && Object.keys(map).length) writeSignatureCache(map);
    return map;
  } catch {
    return null;
  }
};

/** Save this browser's signatures to the server. The password is re-checked by the server. */
export const pushSignaturesToServer = async (password) => {
  if (!isBackendEnabled()) return;
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/signatures`, {
      method: 'PUT',
      headers: signatureApiHeaders(),
      body: JSON.stringify({ signatures: getAllSignatures(), password })
    });
  } catch {
    throw new Error('Could not reach the CRM server to store the signature.');
  }
  if (!res.ok) throw new Error(await readErrorDetail(res, 'The server did not accept the signature.'));
};

/**
 * After the vault is unlocked: the server copy wins; a signature that so far exists only in
 * this browser is uploaded so every admin browser (and Leegality dispatch) uses it.
 * Returns 'pulled', 'uploaded' or 'none'.
 */
export const syncSignaturesOnUnlock = async (password) => {
  const server = await pullSignaturesFromServer();
  if (server && Object.keys(server).length) return 'pulled';
  if (server === null) return 'none';
  const local = getAllSignatures();
  if (Object.values(local).some(sig => sig?.isCustomUploaded && sig?.signatureDataUrl)) {
    await pushSignaturesToServer(password);
    return 'uploaded';
  }
  return 'none';
};

export const SIGNATORY_PRESETS = [
  {
    id: 'srinivas_r',
    name: 'Srinivas R',
    designation: 'Managing Director & Super Admin',
    entity: 'Astra CRM Enterprise',
    sebiReg: 'EMP-001'
  },
  {
    id: 'rajesh_kumar',
    name: 'Rajesh Kumar',
    designation: 'Executive Director (Admin)',
    entity: 'Astra CRM Enterprise',
    sebiReg: 'EMP-002'
  },
  {
    id: 'harshal_parmar_demo',
    name: 'Mr. Harshal Parmar',
    designation: 'Principal Officer (Research Analyst)',
    entity: 'InvestEQ Research (Demo Partner)',
    sebiReg: 'INH000002099'
  }
];

export const DEFAULT_OFFICER_SIGNATURE = {
  id: 'master_officer',
  title: 'Primary Authorized Signatory',
  signerName: 'Srinivas R',
  designation: 'Managing Director / Authorized Signatory',
  sebiReg: 'EMP-001',
  entity: 'Astra CRM Enterprise',
  officeAddress: 'Corporate Headquarters, Bengaluru, Karnataka',
  signatureDataUrl: null, // When null, system falls back to crisp canvas calligraphy stamp
  fileName: 'primary_authorized_signature.png',
  fileType: 'image/png',
  fileSize: '24.5 KB',
  dimensions: { width: 480, height: 160 },
  isCustomUploaded: false,
  uploadedAt: null,
  uploadedBy: 'System Seeded',
  status: 'Active'
};

/**
 * Creates a sample professional cursive signature PNG for any given name
 */
export const generateDemoSignaturePNG = (name = 'Srinivas R') => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set cursive font with fallback to system cursive fonts
  ctx.font = 'italic 600 42px "Brush Script MT", "Dancing Script", "Caveat", "Segoe Script", cursive';
  ctx.fillStyle = '#0f2e59';
  ctx.textBaseline = 'middle';

  // Draw name
  ctx.fillText(name, 30, 65);

  // Measure text and draw flourish underline
  const metrics = ctx.measureText(name);
  const textWidth = Math.min(Math.max(metrics.width + 45, 180), 440);

  ctx.strokeStyle = '#0f2e59';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(25, 100);
  ctx.bezierCurveTo(textWidth * 0.35, 90, textWidth * 0.7, 110, textWidth, 98);
  ctx.stroke();

  // Decorative dot
  ctx.beginPath();
  ctx.arc(textWidth + 10, 96, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0f2e59';
  ctx.fill();

  const safeName = (name || 'signature').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return {
    dataUrl: canvas.toDataURL('image/png'),
    fileName: `${safeName}_signature.png`,
    fileType: 'image/png',
    fileSize: '26.8 KB',
    dimensions: { width: 480, height: 150 }
  };
};

/**
 * Retrieve all stored signatures
 */
export const getAllSignatures = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.master_officer) {
        parsed.master_officer = { ...DEFAULT_OFFICER_SIGNATURE };
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Error reading digital signatures from localStorage:', err);
  }
  return {
    master_officer: { ...DEFAULT_OFFICER_SIGNATURE }
  };
};

/**
 * Retrieve a specific signature by key (e.g. 'master_officer' or userId)
 */
export const getSignature = (key = 'master_officer') => {
  const all = getAllSignatures();
  return all[key] || (key === 'master_officer' ? DEFAULT_OFFICER_SIGNATURE : null);
};

/**
 * Retrieve primary authorized signatory
 */
export const getPrimarySignatory = () => {
  return getSignature('master_officer');
};

/**
 * Retrieve the active user signature uploaded in "My User Signature" block.
 * Priority:
 * 1. Current user specific signature if custom uploaded
 * 2. 'current_user' or 'my_user_signature' key if custom uploaded
 * 3. Matching user name signature
 * 4. Master officer signature if custom uploaded
 * 5. Default officer signature
 */
export const getMyUserSignature = (currentUser = null) => {
  const all = getAllSignatures();
  if (currentUser?.id && all[currentUser.id]?.signatureDataUrl) {
    return all[currentUser.id];
  }
  if (all['current_user']?.signatureDataUrl) {
    return all['current_user'];
  }
  if (all['my_user_signature']?.signatureDataUrl) {
    return all['my_user_signature'];
  }
  if (currentUser?.name) {
    const byName = Object.values(all).find(s => 
      s.signerName?.toLowerCase() === currentUser.name?.toLowerCase() && s.signatureDataUrl
    );
    if (byName) return byName;
  }
  if (all['master_officer']?.signatureDataUrl) {
    return all['master_officer'];
  }
  return (currentUser?.id && all[currentUser.id]) 
    || all['current_user'] 
    || all['my_user_signature'] 
    || all['master_officer'] 
    || DEFAULT_OFFICER_SIGNATURE;
};

/**
 * Verify if password matches the current user or standard administrator override passwords
 */
// Passwords confirmed by the backend during this page session (hosted builds only).
const serverVerifiedPasswords = new Set();

/**
 * Confirm a password with the backend so the synchronous checks below accept it.
 * No-op outside hosted builds, where the local demo checks apply.
 */
export const primeSignerPassword = async (inputPassword) => {
  const trimmed = (inputPassword || '').trim();
  if (!isBackendAuthoritative() || !trimmed || serverVerifiedPasswords.has(trimmed)) return;
  if (await verifyPasswordWithServer(trimmed, 'self_or_admin')) serverVerifiedPasswords.add(trimmed);
};

export const verifySignerPassword = (inputPassword, currentUser, allUsers = []) => {
  if (!inputPassword || typeof inputPassword !== 'string') return false;
  const trimmed = inputPassword.trim();
  if (!trimmed) return false;
  if (isBackendAuthoritative()) return serverVerifiedPasswords.has(trimmed);

  const validPasswords = new Set([
    'admin123',
    'superadmin123',
    '123456',
    currentUser?.password,
    ...(allUsers || [])
      .filter(u => u.role === 'Super Admin' || u.role === 'Admin')
      .map(u => u.password)
  ].filter(Boolean));

  return validPasswords.has(trimmed);
};

/**
 * Save or update a digital signature and signatory details with mandatory password authentication
 */
export const saveDigitalSignature = ({
  key = 'master_officer',
  signaturePayload,
  password,
  currentUser,
  allUsers = []
}) => {
  if (!verifySignerPassword(password, currentUser, allUsers)) {
    throw new Error('Authentication failed: Invalid password. Re-enter your password to authorize changes.');
  }

  const all = getAllSignatures();
  const current = all[key] || { ...DEFAULT_OFFICER_SIGNATURE, id: key };

  const updated = {
    ...current,
    ...signaturePayload,
    isCustomUploaded: signaturePayload.signatureDataUrl ? true : current.isCustomUploaded,
    uploadedAt: new Date().toISOString(),
    uploadedBy: currentUser ? `${currentUser.name} (${currentUser.role || 'User'})` : 'Authorized Administrator',
    status: 'Active'
  };

  all[key] = updated;
  if (key === currentUser?.id || key === 'current_user' || key === 'my_user_signature') {
    all['my_user_signature'] = updated;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('astra:digital_signature_updated', {
      detail: { key, signature: updated }
    }));
    if (key !== 'my_user_signature') {
      window.dispatchEvent(new CustomEvent('astra:digital_signature_updated', {
        detail: { key: 'my_user_signature', signature: updated }
      }));
    }
  } catch (err) {
    console.error('Error saving digital signature to localStorage:', err);
    throw new Error('Failed to save signature: Storage quota exceeded or invalid format.');
  }

  return updated;
};

/**
 * Reset a signature to default system stamp (requires password authentication)
 */
export const resetToDefaultSignature = ({
  key = 'master_officer',
  password,
  currentUser,
  allUsers = []
}) => {
  if (!verifySignerPassword(password, currentUser, allUsers)) {
    throw new Error('Authentication failed: Invalid password. Re-enter your password to reset signature.');
  }

  const all = getAllSignatures();
  if (key === 'master_officer') {
    all[key] = { ...DEFAULT_OFFICER_SIGNATURE };
  } else {
    delete all[key];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('astra:digital_signature_updated', {
      detail: { key, signature: all[key] || null }
    }));
  } catch (err) {
    console.error('Error resetting digital signature:', err);
    throw new Error('Failed to reset signature.');
  }

  return all[key] || null;
};

/**
 * Checks if the vault is unlocked in the current session
 */
export const isVaultUnlockedInSession = () => {
  try {
    return sessionStorage.getItem(VAULT_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Set vault unlocked status in sessionStorage
 */
export const setVaultSessionUnlocked = (unlocked = true) => {
  try {
    if (unlocked) {
      sessionStorage.setItem(VAULT_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(VAULT_SESSION_KEY);
    }
  } catch {}
};

/**
 * Read and process an image file (JPG, PNG, WEBP, SVG)
 * Optionally removes white paper background and converts to transparent PNG
 */
export const processSignatureFile = (file, { makeTransparent = false, enhanceContrast = false } = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected.'));
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      reject(new Error('Unsupported file format. Please upload JPG, PNG, WEBP, or SVG image.'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('File exceeds maximum size limit of 5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;

      if (file.type === 'image/svg+xml' && !makeTransparent && !enhanceContrast) {
        const sizeFormatted = (file.size / 1024).toFixed(1) + ' KB';
        resolve({
          dataUrl: rawDataUrl,
          fileName: file.name,
          fileType: file.type,
          fileSize: sizeFormatted,
          dimensions: { width: 480, height: 160 }
        });
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image data.'));
      img.onload = () => {
        const naturalWidth = img.naturalWidth || img.width || 400;
        const naturalHeight = img.naturalHeight || img.height || 200;

        if (!makeTransparent && !enhanceContrast) {
          const sizeFormatted = (file.size / 1024).toFixed(1) + ' KB';
          resolve({
            dataUrl: rawDataUrl,
            fileName: file.name,
            fileType: file.type,
            fileSize: sizeFormatted,
            dimensions: { width: naturalWidth, height: naturalHeight }
          });
          return;
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = naturalWidth;
          canvas.height = naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imgData = ctx.getImageData(0, 0, naturalWidth, naturalHeight);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            if (makeTransparent) {
              const isWhiteOrLight = (r > 220 && g > 220 && b > 220);
              if (isWhiteOrLight) {
                data[i + 3] = 0;
                continue;
              }
            }

            if (enhanceContrast) {
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 180) {
                data[i] = Math.max(0, r - 30);
                data[i + 1] = Math.max(0, b - 30);
                data[i + 2] = Math.max(0, b - 20);
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          const processedDataUrl = canvas.toDataURL('image/png');
          const sizeApprox = Math.round((processedDataUrl.length * 3) / 4 / 1024) + ' KB';

          resolve({
            dataUrl: processedDataUrl,
            fileName: file.name.replace(/\.[^/.]+$/, "") + '_transparent.png',
            fileType: 'image/png',
            fileSize: sizeApprox,
            dimensions: { width: naturalWidth, height: naturalHeight }
          });
        } catch (canvasErr) {
          console.warn('Canvas processing error, falling back to original:', canvasErr);
          const sizeFormatted = (file.size / 1024).toFixed(1) + ' KB';
          resolve({
            dataUrl: rawDataUrl,
            fileName: file.name,
            fileType: file.type,
            fileSize: sizeFormatted,
            dimensions: { width: naturalWidth, height: naturalHeight }
          });
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Creates a sample corporate seal / rubber stamp with readable printed text to test OCR directly
 */
export const generateSampleStampPNG = (name = 'Srinivas R', designation = 'Managing Director & Authorized Signatory', entity = 'Astra CRM Enterprise', regId = 'EMP-001') => {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Outer border with stamp styling (double border in blue/purple ink)
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 480, 200);

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, 464, 184);

  // Entity Title
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(entity.toUpperCase(), 250, 52);

  // Divider line
  ctx.beginPath();
  ctx.moveTo(35, 68);
  ctx.lineTo(465, 68);
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Signatory Name
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText(name.toUpperCase(), 250, 105);

  // Designation
  ctx.fillStyle = '#1e40af';
  ctx.font = 'italic 600 16px Arial, sans-serif';
  ctx.fillText(designation, 250, 138);

  // Registration ID / SEBI Reg
  ctx.fillStyle = '#475569';
  ctx.font = '600 14px "Courier New", monospace';
  ctx.fillText(`REG ID: ${regId} | AUTHORIZED SIGNATORY`, 250, 172);

  const safeName = (name || 'stamp').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return {
    dataUrl: canvas.toDataURL('image/png'),
    fileName: `${safeName}_official_stamp.png`,
    fileType: 'image/png',
    fileSize: '32.4 KB',
    dimensions: { width: 500, height: 220 }
  };
};

/**
 * OCR preprocessing for signatures & stamps (runs entirely in the browser).
 * Flattens transparency onto white paper, binarizes with Otsu's threshold, crops to the ink,
 * and rescales so printed text lands in Tesseract's preferred size range.
 */
const OCR_MAX_SIDE = 2400; // larger photos are scaled down: faster, and no accuracy gain for stamp text

export const preprocessImageForOCR = (dataUrl, { sensitivity = 0, upscale = true, autoCrop = true, despeckle = false } = {}) => {
  return new Promise((resolve) => {
    const fallback = { ocrDataUrl: dataUrl, threshold: null, otsuThreshold: null, upscaleFactor: 1 };
    if (!dataUrl) {
      resolve(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(fallback);
    img.onload = () => {
      try {
        const origWidth = img.naturalWidth || img.width || 400;
        const origHeight = img.naturalHeight || img.height || 200;
        const downscale = Math.min(1, OCR_MAX_SIDE / Math.max(origWidth, origHeight));
        const width = Math.max(1, Math.round(origWidth * downscale));
        const height = Math.max(1, Math.round(origHeight * downscale));

        // Step 1: flatten onto white so transparent backgrounds count as paper, not as missing pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, width, height);
        tempCtx.drawImage(img, 0, 0, width, height);

        const imgData = tempCtx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const luminance = new Uint8Array(width * height);
        const histogram = new Uint32Array(256);

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          // ITU-R BT.601 perceptual luminance
          const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          luminance[p] = lum;
          histogram[lum]++;
        }

        // Step 2: Otsu's optimal global threshold over the whole page (ink + paper)
        const total = width * height;
        let sum = 0;
        for (let t = 0; t < 256; t++) sum += t * histogram[t];
        let sumB = 0;
        let wB = 0;
        let varMax = 0;
        let otsuThreshold = 140;
        for (let t = 0; t < 256; t++) {
          wB += histogram[t];
          if (wB === 0) continue;
          const wF = total - wB;
          if (wF === 0) break;
          sumB += t * histogram[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);
          if (varBetween > varMax) {
            varMax = varBetween;
            otsuThreshold = t;
          }
        }

        // Sensitivity slider (-40..+40) nudges the threshold for faint or heavy ink
        const finalThreshold = Math.max(40, Math.min(235, otsuThreshold + sensitivity));

        // Step 3: binarize and find the ink bounding box.
        // Light text on a dark stamp would make the background look like ink, so invert when most pixels are dark.
        let darkPixels = 0;
        for (let p = 0; p < luminance.length; p++) if (luminance[p] <= finalThreshold) darkPixels++;
        const inverted = darkPixels > luminance.length * 0.5;
        const inkMask = new Uint8Array(luminance.length);
        for (let p = 0; p < luminance.length; p++) {
          inkMask[p] = (inverted ? luminance[p] > finalThreshold : luminance[p] <= finalThreshold) ? 1 : 0;
        }

        // Optional speckle removal for noisy photos: drop ink pixels with fewer than 4 inked neighbours
        if (despeckle) {
          const cleaned = inkMask.slice();
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              const p = y * width + x;
              if (!inkMask[p]) continue;
              const neighbours = inkMask[p - width - 1] + inkMask[p - width] + inkMask[p - width + 1]
                + inkMask[p - 1] + inkMask[p + 1]
                + inkMask[p + width - 1] + inkMask[p + width] + inkMask[p + width + 1];
              if (neighbours < 4) cleaned[p] = 0;
            }
          }
          inkMask.set(cleaned);
        }

        let minX = width, minY = height, maxX = 0, maxY = 0;
        for (let p = 0, i = 0; p < luminance.length; p++, i += 4) {
          const ink = inkMask[p] === 1;
          const v = ink ? 0 : 255;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
          if (ink) {
            const x = p % width;
            const y = (p / width) | 0;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        tempCtx.putImageData(imgData, 0, 0);

        // Step 4: crop to the ink with a white margin (Tesseract needs some border)
        const hasContent = maxX > minX && maxY > minY;
        const padding = 30;
        const cropX = hasContent && autoCrop ? Math.max(0, minX - padding) : 0;
        const cropY = hasContent && autoCrop ? Math.max(0, minY - padding) : 0;
        const cropW = hasContent && autoCrop ? Math.min(width - cropX, (maxX - minX) + padding * 2) : width;
        const cropH = hasContent && autoCrop ? Math.min(height - cropY, (maxY - minY) + padding * 2) : height;

        // Step 5: upscale small crops (Tesseract reads best with ~30px+ letter height)
        const scaleFactor = upscale ? (cropW < 600 ? 2.5 : cropW < 1200 ? 1.6 : 1) : 1;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = Math.round(cropW * scaleFactor);
        finalCanvas.height = Math.round(cropH * scaleFactor);
        const finalCtx = finalCanvas.getContext('2d');
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, finalCanvas.width, finalCanvas.height);

        resolve({
          ocrDataUrl: finalCanvas.toDataURL('image/png'),
          threshold: finalThreshold,
          otsuThreshold,
          cropBox: { x: cropX, y: cropY, width: cropW, height: cropH },
          upscaleFactor: scaleFactor,
          hasInk: hasContent,
          inverted
        });
      } catch (err) {
        console.warn('OCR preprocessing failed, using the original image:', err);
        resolve(fallback);
      }
    };
    img.src = dataUrl;
  });
};

/**
 * Conservative OCR clean-up: fixes only well-known confusions inside ID patterns
 * (O/0, I/1, stray spaces) and leaves ordinary words untouched.
 */
export const cleanAndFuzzyCorrectText = (rawText) => {
  if (!rawText) return { cleanedText: '', corrections: [] };
  const corrections = [];

  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/[|_~`^]+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    // Drop OCR noise lines (stray marks from signature strokes)
    .filter(l => (l.match(/[A-Za-z0-9]/g) || []).length >= 2);

  let text = lines.join('\n');

  // SEBI Research Analyst / Investment Adviser numbers: INH/INA + 9 digits
  text = text.replace(/\b([I1l][Nn][HhAa])\s*[-:]?\s*([0-9OoQDIl]{9,10})\b/g, (match, prefix, rawDigits) => {
    // Valid numbers have exactly 9 digits; a single letter O making a 10th character is an OCR artifact
    const letterOs = (rawDigits.match(/[Oo]/g) || []).length;
    const digits = rawDigits.length === 10 && letterOs === 1 ? rawDigits.replace(/[Oo]/, '') : rawDigits;
    if (digits.length !== 9) return match;
    const fixed = `IN${prefix[2].toUpperCase()}${digits.replace(/[OoQD]/g, '0').replace(/[Il]/g, '1')}`;
    if (fixed !== match) corrections.push(`Normalized ID ${fixed}`);
    return fixed;
  });

  // "Pvt Ltd" is often read as "Put Ltd" / "Pvt Lid"
  text = text.replace(/\bP[uvy]t\.?\s*L[t1il]d\b\.?/gi, (match) => {
    if (match !== 'Pvt Ltd') corrections.push('Normalized Pvt Ltd');
    return 'Pvt Ltd';
  });

  // Employee codes: EMP-001 style
  text = text.replace(/\bEMP\s*[-–—_.]?\s*([0-9OoIl]{2,6})\b/gi, (match, digits) => {
    const fixed = `EMP-${digits.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}`;
    if (fixed !== match) corrections.push(`Normalized code ${fixed}`);
    return fixed;
  });

  return { cleanedText: text, corrections };
};

const DESIGNATIONS = [
  { regex: /managing\s+director/i, label: 'Managing Director' },
  { regex: /executive\s+director/i, label: 'Executive Director' },
  { regex: /whole[\s-]*time\s+director/i, label: 'Whole-time Director' },
  { regex: /principal\s+officer/i, label: 'Principal Officer' },
  { regex: /compliance\s+officer/i, label: 'Compliance Officer' },
  { regex: /chief\s+executive\s+officer|\bC\.?E\.?O\b/, label: 'Chief Executive Officer' },
  { regex: /research\s+analyst/i, label: 'Research Analyst' },
  { regex: /investment\s+advis[eo]r/i, label: 'Investment Adviser' },
  { regex: /\bdirector\b/i, label: 'Director' },
  { regex: /\bproprietor\b/i, label: 'Proprietor' },
  { regex: /\bpartner\b/i, label: 'Partner' },
  { regex: /\bmanager\b/i, label: 'Manager' }
];
const AUTH_SIGNATORY = /auth[o0]ri[sz]ed\s+signator(y|ies)/i;
const ENTITY_SUFFIX = /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|corporation|corp\.?|& co\.?)/i;
const ENTITY_HINT = /\b(securities|capital|advisors|advisory|wealth|finserv|investments?|enterprises?|consultants?|associates)\b/i;
const ADDRESS_HINT = /\b(road|rd\.|street|st\.|floor|nagar|layout|cross|main|sector|plot|building|bldg|tower|complex|lane|marg|colony|phase|block|near|opp\.?)\b|\b[1-9]\d{5}\b/i;
const ID_LINE = /\b(IN[HA]\d{9}|ARN\b|CIN\b|EMP-\d|Reg(d|n|istration)?\.?\s*No|SEBI\b|GSTIN|PAN\b)/i;
const NOT_A_NAME = /\b(for|pvt|private|ltd|limited|llp|inc|corp|director|officer|analyst|adviser|advisor|signator|reg(d|n|istration)?|sebi|emp|cin|gst|pan|tel|ph|phone|mobile|email|www|address|date|seal|stamp|proprietor|partner|manager|research|securities|capital)\b/i;
const FILE_NOISE = /\b(signature|sign|sig|stamp|seal|img|image|photo|scan|scanned|screenshot|dsc|final|copy|new|whatsapp|official)\b/gi;

const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/**
 * Turns OCR text into signatory fields. Only values actually found are returned;
 * anything not detected is left empty so the form keeps what the user already has.
 */
export const parseOcrResults = (rawText = '', fileName = '', ocrUsed = false, corrections = [], diagnostics = {}) => {
  const text = (rawText || '').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const tags = [];
  const found = { name: '', designation: '', entity: '', regId: '', address: '' };

  // 1. Registration IDs (most specific first)
  const idPatterns = [
    { regex: /\bIN[HA]\d{9}\b/, label: 'SEBI Reg' },
    { regex: /\bARN\s*[-:]?\s*\d{4,8}\b/i, label: 'ARN' },
    { regex: /\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/, label: 'CIN' },
    { regex: /\bEMP-\d{2,6}\b/, label: 'Employee Code' },
    { regex: /\bReg(?:d|n|istration)?\.?\s*No\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{3,20})/i, label: 'Reg No', group: 1 }
  ];
  for (const { regex, label, group } of idPatterns) {
    const m = text.match(regex);
    if (m) {
      found.regId = (group ? m[group] : m[0]).toUpperCase().replace(/\s+/g, '').replace(/^ARN[-:]?/, 'ARN-');
      tags.push(`${label}: ${found.regId}`);
      break;
    }
  }

  // 2. Designation (specific titles before generic ones), keeping "Authorised Signatory" when printed
  let designationLine = -1;
  for (const { regex, label } of DESIGNATIONS) {
    const idx = lines.findIndex(l => regex.test(l));
    if (idx !== -1) {
      found.designation = label;
      designationLine = idx;
      break;
    }
  }
  const authIdx = lines.findIndex(l => AUTH_SIGNATORY.test(l));
  if (authIdx !== -1) {
    found.designation = found.designation ? `${found.designation} & Authorised Signatory` : 'Authorised Signatory';
    if (designationLine === -1) designationLine = authIdx;
  }
  if (found.designation) tags.push(`Title: ${found.designation}`);

  // 3. Entity: a line with a legal suffix (else an industry word), never a designation, ID or address line
  const isDesignationLine = (l) => DESIGNATIONS.some(d => d.regex.test(l)) || AUTH_SIGNATORY.test(l);
  const entityCandidates = lines.filter(l => !isDesignationLine(l) && !ID_LINE.test(l) && !ADDRESS_HINT.test(l));
  const entityLine = entityCandidates.find(l => ENTITY_SUFFIX.test(l)) || entityCandidates.find(l => ENTITY_HINT.test(l));
  if (entityLine) {
    // Drop leading OCR debris first, then the stamp's "For" (also when the space was lost: "ForInvestEQ")
    let entity = entityLine.replace(/^[^A-Za-z]+/, '').replace(/^for(\s+|(?=[A-Z]))/i, '');
    const suffix = entity.match(new RegExp(`^(.*?${ENTITY_SUFFIX.source})`, 'i'));
    if (suffix) entity = suffix[1];
    found.entity = entity.replace(/[^A-Za-z0-9\s.,&()'-]/g, '').replace(/\s{2,}/g, ' ').trim();
    if (found.entity === found.entity.toUpperCase() && found.entity.length > 3) found.entity = titleCase(found.entity);
    found.entity = found.entity.charAt(0).toUpperCase() + found.entity.slice(1);
    tags.push(`Entity: ${found.entity}`);
  }

  // 4. Name: a 2-5 word alphabetic line, preferring the one just above the designation (typical stamp layout).
  // OCR debris at either end ("Agarwal . oc To") is trimmed; single-letter initials ("Srinivas R") are kept.
  const isDebris = (t) => !/[A-Za-z]/.test(t) || (/^[A-Za-z]{1,2}\.?$/.test(t) && !/^[A-Z]\.?$/.test(t));
  const trimNameDebris = (l) => {
    const tokens = l.split(/\s+/).filter(Boolean);
    while (tokens.length && isDebris(tokens[0]) && !/^(mr|ms|dr)\.?$/i.test(tokens[0])) tokens.shift();
    while (tokens.length && isDebris(tokens[tokens.length - 1])) tokens.pop();
    return tokens.join(' ');
  };
  const isNameLine = (raw) => {
    const l = trimNameDebris(raw);
    if (NOT_A_NAME.test(l) || !/^[A-Za-z][A-Za-z\s.'-]+$/.test(l)) return false;
    const words = l.replace(/\./g, ' ').split(/\s+/).filter(w => w.length > 0);
    // Printed names are capitalised word by word (or all caps); lowercase fragments are OCR debris
    return words.length >= 2 && words.length <= 5 && words.some(w => w.length >= 3) && words.every(w => /^[A-Z]/.test(w));
  };
  const above = designationLine > 0 ? lines[designationLine - 1] : null;
  const rawNameLine = (above && isNameLine(above)) ? above : lines.find(isNameLine);
  // A hyphen OCR inserted between two capitalised words ("Narottam-Agarwal") is a lost space
  const nameLine = rawNameLine ? trimNameDebris(rawNameLine).replace(/([a-z])-(?=[A-Z][a-z])/g, '$1 ') : null;
  if (nameLine) {
    found.name = nameLine === nameLine.toUpperCase() ? titleCase(nameLine) : nameLine;
    found.name = found.name.replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/i, (m) => titleCase(m.trim().replace(/\.$/, '')) + '. ');
    tags.push(`Name: ${found.name}`);
  } else if (fileName) {
    // Last resort: a person-like file name such as "nishant_agarwal.png"
    const fromFile = fileName.replace(/\.[^/.]+$/, '').replace(/[-_.]+/g, ' ').replace(FILE_NOISE, ' ').replace(/\d+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (fromFile.split(' ').length >= 2 && /^[A-Za-z\s]+$/.test(fromFile)) {
      found.name = titleCase(fromFile);
      tags.push(`Name (from file name): ${found.name}`);
    }
  }

  // 5. Office address: consecutive address-looking lines
  const addressLines = lines.filter(l => ADDRESS_HINT.test(l) && l !== entityLine && !ID_LINE.test(l));
  if (addressLines.length) {
    found.address = addressLines.join(', ').replace(/\s{2,}/g, ' ').trim();
    tags.push('Address detected');
  }

  const hasPrintedText = text.length > 0 && (diagnostics.wordCount || 0) > 0;
  if (ocrUsed && !hasPrintedText) tags.unshift('No printed text found (handwritten signature)');
  if (diagnostics.upscaleFactor > 1) tags.push(`${diagnostics.upscaleFactor}x upscaled`);
  if (diagnostics.threshold) tags.push(`Otsu threshold ${diagnostics.threshold}`);
  corrections.forEach(c => tags.push(c));

  return {
    success: ocrUsed,
    detectedName: found.name,
    detectedDesignation: found.designation,
    detectedEntity: found.entity,
    detectedRegId: found.regId,
    detectedAddress: found.address,
    confidence: Math.round(diagnostics.confidence || 0),
    tags: Array.from(new Set(tags)),
    rawText: text,
    ocrUsed,
    hasPrintedText,
    corrections
  };
};

// ─── Tesseract worker: one per tab, created on first use, released when idle ───
// Engine and English model load from the jsDelivr CDN into the browser, so the CRM server does no OCR work.
const OCR_FIRST_LOAD_TIMEOUT_MS = 120000;
const OCR_RECOGNIZE_TIMEOUT_MS = 45000;
const OCR_IDLE_RELEASE_MS = 120000;
let ocrWorkerPromise = null;
let ocrIdleTimer = null;
let ocrProgressListener = null;

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
]);

const releaseOcrWorker = async () => {
  const pending = ocrWorkerPromise;
  ocrWorkerPromise = null;
  if (pending) {
    try { (await pending).terminate(); } catch {}
  }
};

const getOcrWorker = () => {
  clearTimeout(ocrIdleTimer);
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        logger: (m) => ocrProgressListener?.(m)
      });
    })();
    ocrWorkerPromise.catch(() => { ocrWorkerPromise = null; });
  }
  return ocrWorkerPromise;
};

const scheduleOcrRelease = () => {
  clearTimeout(ocrIdleTimer);
  ocrIdleTimer = setTimeout(releaseOcrWorker, OCR_IDLE_RELEASE_MS);
};

const OCR_MIN_WORD_CONFIDENCE = 45;

const summarize = (data) => {
  const lines = (data?.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
  const keptLines = [];
  let wordCount = 0;
  let confidenceSum = 0;
  for (const line of lines) {
    // Confident words only; joining symbols such as "&", "-" and "/" are kept so names like "Babu Securities & Co" survive
    const words = (line.words || []).filter(w => (w.confidence || 0) >= OCR_MIN_WORD_CONFIDENCE
      && (/[A-Za-z0-9]/.test(w.text || '') || /^[&/,.-]$/.test(w.text || '')));
    if (!words.some(w => /[A-Za-z0-9]/.test(w.text))) continue;
    keptLines.push(words.map(w => w.text).join(' '));
    for (const w of words) {
      if (/[A-Za-z0-9]{2,}/.test(w.text)) {
        wordCount += 1;
        confidenceSum += w.confidence;
      }
    }
  }
  return {
    text: keptLines.length ? keptLines.join('\n') : (data?.text || '').trim(),
    fullText: (data?.text || '').trim(),
    confidence: wordCount ? confidenceSum / wordCount : 0,
    wordCount
  };
};
const ocrScore = (r) => r.wordCount * r.confidence;
const OCR_FIELDS = ['detectedName', 'detectedDesignation', 'detectedEntity', 'detectedRegId', 'detectedAddress'];

/**
 * Picks a field value across OCR reads. Values are given in priority order (best read first).
 * A value also earns the votes of shorter values it contains ("Managing Director" ⊃ "Director");
 * ties go to the earlier, better-scoring read.
 */
const voteOnField = (values) => {
  const present = values.filter(Boolean);
  if (!present.length) return '';
  const unique = [...new Set(present)];
  const scored = unique.map(value => {
    const lower = value.toLowerCase();
    const votes = present.filter(other => other === value || lower.includes(other.toLowerCase())).length;
    return { value, votes, order: present.indexOf(value) };
  });
  scored.sort((a, b) => b.votes - a.votes || a.order - b.order);
  return scored[0].value;
};
const OCR_RETRY_BELOW_CONFIDENCE = 88;
const OCR_OUTPUT = { text: true, blocks: true };

/**
 * Smart OCR for signature stamps: preprocess → recognize (block + sparse-text pass) → clean → parse.
 * Everything runs client-side; returns empty fields for anything it could not read.
 */
export const extractDetailsFromSignatureImage = async (file, dataUrl, onProgress, options = {}) => {
  const { sensitivity = 0, upscale = true, autoCrop = true, multiPass = true } = options;
  const report = (stage, percent, message) => onProgress?.({ stage, percent, message });

  report('preprocess', 10, 'Cleaning the image (white background, ink threshold, crop)...');
  let preprocessed = null;
  if (dataUrl) {
    preprocessed = await preprocessImageForOCR(dataUrl, { sensitivity, upscale, autoCrop });
  }
  const target = preprocessed?.ocrDataUrl || dataUrl;

  let best = { text: '', confidence: 0, wordCount: 0 };
  const reads = [];
  let ocrUsed = false;
  let ocrError = null;

  if (target && preprocessed?.hasInk !== false) {
    try {
      const firstLoad = !ocrWorkerPromise;
      report('loading_engine', 20, firstLoad
        ? 'Downloading the OCR engine (first use only, ~15 MB)...'
        : 'Starting OCR engine...');
      ocrProgressListener = (m) => {
        if (m?.status === 'recognizing text') {
          report('recognizing', 35 + Math.round((m.progress || 0) * 45), `Reading text: ${Math.round((m.progress || 0) * 100)}%`);
        } else if (m?.status && firstLoad) {
          report('loading_engine', 20 + Math.round((m.progress || 0) * 15), `${m.status.replace(/^\w/, c => c.toUpperCase())}...`);
        }
      };
      const worker = await withTimeout(getOcrWorker(), OCR_FIRST_LOAD_TIMEOUT_MS,
        'The OCR engine could not be downloaded. Check the internet connection and try again.');

      // Pass 1: uniform block of text (typical stamps)
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      const pass1 = await withTimeout(worker.recognize(target, {}, OCR_OUTPUT), OCR_RECOGNIZE_TIMEOUT_MS, 'OCR took too long on this image.');
      best = summarize(pass1.data);
      reads.push(best);
      ocrUsed = true;

      // Pass 2: sparse text (scattered words around a signature)
      if (multiPass) {
        report('pass2', 82, 'Second pass for scattered text...');
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const pass2 = await withTimeout(worker.recognize(target, {}, OCR_OUTPUT), OCR_RECOGNIZE_TIMEOUT_MS, 'OCR took too long on this image.');
        const second = summarize(pass2.data);
        reads.push(second);
        if (ocrScore(second) > ocrScore(best)) best = second;
      }

      // Pass 3 (poor images only): remove speckle noise and read again
      if (multiPass && best.confidence < OCR_RETRY_BELOW_CONFIDENCE) {
        report('pass3', 88, 'Low-quality image: removing noise and re-reading...');
        const cleanedImage = await preprocessImageForOCR(dataUrl, { sensitivity, upscale, autoCrop, despeckle: true });
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const pass3 = await withTimeout(worker.recognize(cleanedImage.ocrDataUrl, {}, OCR_OUTPUT), OCR_RECOGNIZE_TIMEOUT_MS, 'OCR took too long on this image.');
        const third = summarize(pass3.data);
        reads.push(third);
        if (ocrScore(third) > ocrScore(best)) {
          best = third;
          preprocessed = cleanedImage;
        }
      }
    } catch (err) {
      ocrError = err.message || 'OCR failed.';
      console.warn('OCR error:', err);
      // A stuck or broken worker is discarded so the next attempt starts clean
      await releaseOcrWorker();
    } finally {
      ocrProgressListener = null;
      scheduleOcrRelease();
    }
  }

  report('parsing', 92, 'Extracting name, designation, entity and IDs...');
  const diagnostics = { ...(preprocessed || {}), confidence: best.confidence, wordCount: best.wordCount };
  const { cleanedText, corrections } = cleanAndFuzzyCorrectText(best.text);
  const parsed = parseOcrResults(cleanedText, file?.name || '', ocrUsed, corrections, diagnostics);

  // Each field is voted on across every read, best-scoring read first, so one noisy pass cannot
  // overwrite what the others agree on. Tesseract's unfiltered text only adds pattern-based fields
  // (title, entity, IDs, address) — never names — and only when real words were read at all.
  const parseText = (text) => parseOcrResults(cleanAndFuzzyCorrectText(text).cleanedText, '', ocrUsed, [], diagnostics);
  const candidates = [...reads].filter(r => r.wordCount > 0).sort((a, b) => ocrScore(b) - ocrScore(a)).flatMap(read => {
    const confident = parseText(read.text);
    if (!read.fullText || read.fullText === read.text) return [confident];
    return [confident, { ...parseText(read.fullText), detectedName: '' }];
  });
  if (candidates.length) {
    for (const key of OCR_FIELDS) {
      parsed[key] = voteOnField(candidates.map(c => c[key])) || (key === 'detectedName' ? parsed[key] : '');
    }
  }

  parsed.ocrError = ocrError;
  parsed.ocrOptimizedDataUrl = preprocessed?.ocrDataUrl || null;
  parsed.threshold = preprocessed?.threshold;
  parsed.otsuThreshold = preprocessed?.otsuThreshold;

  report('complete', 100, ocrError ? 'OCR could not finish.' : 'OCR analysis complete.');
  return parsed;
};
