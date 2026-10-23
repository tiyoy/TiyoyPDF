/**
 * Utilitas pemindai dokumen: memuat gambar, memutar, dan menerapkan filter
 * ala "scanner" (hapus bayangan, latar putih, teks tajam) memakai canvas.
 * Semua berjalan di browser, tidak ada file yang dikirim ke server.
 */

export type ScanFilter = 'original' | 'document' | 'grayscale' | 'color';
export type ScanRotation = 0 | 90 | 180 | 270;

/** Muat Blob gambar menjadi HTMLImageElement (EXIF orientasi diterapkan browser) */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membaca gambar'));
    };
    img.src = url;
  });
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Perkirakan kecerahan latar (kertas) per piksel dengan mengecilkan lalu
 * membesarkan kembali gambar (efek blur halus). Dipakai untuk menghapus bayangan.
 */
function estimateBackground(source: HTMLCanvasElement): Uint8ClampedArray {
  const { width, height } = source;
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.ceil(width / 24));
  small.height = Math.max(1, Math.ceil(height / 24));
  const sctx = small.getContext('2d');
  if (!sctx) throw new Error('Canvas tidak tersedia');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(source, 0, 0, small.width, small.height);

  const big = document.createElement('canvas');
  big.width = width;
  big.height = height;
  const bctx = big.getContext('2d');
  if (!bctx) throw new Error('Canvas tidak tersedia');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, width, height);
  return bctx.getImageData(0, 0, width, height).data;
}

/** Terapkan filter pada canvas (langsung mengubah isi canvas) */
export function applyScanFilter(canvas: HTMLCanvasElement, filter: ScanFilter): void {
  if (filter === 'original') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  if (filter === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(image, 0, 0);
    return;
  }

  const bg = estimateBackground(canvas);

  if (filter === 'document') {
    // Hitam-putih tajam: bagi dengan latar lalu regangkan kontras
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const bgLum = Math.max(24, 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]);
      const ratio = lum / bgLum;
      const v = clamp255(((ratio - 0.6) / (0.96 - 0.6)) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  } else {
    // Warna cerah: hapus bayangan, pertahankan warna, kertas jadi putih
    for (let i = 0; i < d.length; i += 4) {
      const bgLum = Math.max(24, 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]);
      const k = 255 / bgLum;
      for (let c = 0; c < 3; c++) {
        const x = d[i + c] * k * 0.97;
        d[i + c] = clamp255(((x - 20) / (255 - 20)) * 255);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Render satu halaman: skala (sisi terpanjang <= maxEdge), putar, lalu filter.
 */
export async function renderScan(
  blob: Blob,
  rotation: ScanRotation,
  filter: ScanFilter,
  maxEdge: number
): Promise<HTMLCanvasElement> {
  const img = await loadImage(blob);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const swap = rotation === 90 || rotation === 270;

  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  applyScanFilter(canvas, filter);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))),
      type,
      quality
    );
  });
}

export const QUALITY_PRESETS = {
  high: { maxEdge: 2480, jpeg: 0.9 },
  medium: { maxEdge: 1754, jpeg: 0.8 },
  small: { maxEdge: 1240, jpeg: 0.7 },
} as const;
export type ScanQuality = keyof typeof QUALITY_PRESETS;

export type ScanPageSize = 'a4' | 'letter' | 'fit';
const PAGE_POINTS = { a4: [595.28, 841.89], letter: [612, 792] } as const;

export interface ScanPageInput {
  blob: Blob;
  rotation: ScanRotation;
}

/** Susun semua halaman menjadi satu PDF */
export async function buildScanPdf(
  pages: ScanPageInput[],
  options: { filter: ScanFilter; size: ScanPageSize; quality: ScanQuality },
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const preset = QUALITY_PRESETS[options.quality];

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    const canvas = await renderScan(pages[i].blob, pages[i].rotation, options.filter, preset.maxEdge);
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', preset.jpeg);
    const embedded = await pdf.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));

    let pw: number;
    let ph: number;
    if (options.size === 'fit') {
      // anggap 150 dpi: 72 / 150 poin per piksel
      pw = embedded.width * 0.48;
      ph = embedded.height * 0.48;
    } else {
      const [a, b] = PAGE_POINTS[options.size];
      const landscape = embedded.width > embedded.height;
      pw = landscape ? b : a;
      ph = landscape ? a : b;
    }
    const page = pdf.addPage([pw, ph]);
    const s = Math.min(pw / embedded.width, ph / embedded.height);
    const dw = embedded.width * s;
    const dh = embedded.height * s;
    page.drawImage(embedded, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }
  onProgress?.(pages.length, pages.length);

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
