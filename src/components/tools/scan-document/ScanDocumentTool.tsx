'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ChevronLeft, ChevronRight, RefreshCw, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DownloadButton } from '../DownloadButton';
import {
  buildScanPdf,
  renderScan,
  type ScanFilter,
  type ScanPageSize,
  type ScanQuality,
  type ScanRotation,
} from './scan-utils';

interface ScanPage {
  id: string;
  blob: Blob;
  rotation: ScanRotation;
}

export interface ScanDocumentToolProps {
  /** Custom class name */
  className?: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function timestampName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `scan_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.pdf`;
}

/** Tombol pilihan (segmented) sederhana */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[hsl(var(--color-foreground))]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-sm transition-colors ${
              value === o.value
                ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-foreground))]'
                : 'border-[hsl(var(--color-border))] bg-[hsl(var(--color-background))] text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-muted))]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * ScanDocumentTool
 * Pindai dokumen: foto lewat kamera atau pilih foto/file gambar, rapikan dengan
 * filter ala scanner, lalu simpan sebagai PDF. Semua diproses di browser.
 */
export function ScanDocumentTool({ className = '' }: ScanDocumentToolProps) {
  const t = useTranslations('tools');

  const [pages, setPages] = useState<ScanPage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ScanFilter>('document');
  const [size, setSize] = useState<ScanPageSize>('a4');
  const [quality, setQuality] = useState<ScanQuality>('high');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('scan.pdf');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);
  const thumbCache = useRef(new Map<string, string>());

  // ---------- Kamera ----------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(t('scanDocument.cameraUnsupported'));
        setCameraOpen(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
        streamRef.current = stream;
        setFacing(mode);
        setCameraError(null);
        setCameraOpen(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError(t('scanDocument.cameraError'));
        setCameraOpen(false);
      }
    },
    [t]
  );

  // Matikan kamera saat komponen ditutup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // ---------- Tambah halaman ----------
  const addBlobs = useCallback(
    (blobs: Blob[]) => {
      if (blobs.length === 0) return;
      setError(null);
      setResult(null);
      setPages((prev) => [
        ...prev,
        ...blobs.map((blob) => ({ id: generateId(), blob, rotation: 0 as ScanRotation })),
      ]);
    },
    []
  );

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) addBlobs([blob]);
      },
      'image/jpeg',
      0.92
    );
  }, [addBlobs]);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
      if (images.length === 0 && list.length > 0) {
        setError(t('scanDocument.errorLoad'));
        return;
      }
      addBlobs(images);
    },
    [addBlobs, t]
  );

  // ---------- Thumbnail (dibuat ulang saat filter/rotasi berubah) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const page of pages) {
        const key = `${page.id}:${page.rotation}:${filter}`;
        let url = thumbCache.current.get(key);
        if (!url) {
          try {
            const canvas = await renderScan(page.blob, page.rotation, filter, 420);
            url = canvas.toDataURL('image/jpeg', 0.75);
            thumbCache.current.set(key, url);
          } catch {
            url = '';
          }
        }
        next[page.id] = url;
        if (cancelled) return;
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pages, filter]);

  // ---------- Aksi halaman ----------
  const rotatePage = (id: string) => {
    setResult(null);
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as ScanRotation) } : p))
    );
  };
  const removePage = (id: string) => {
    setResult(null);
    thumbCache.current.forEach((_, key) => {
      if (key.startsWith(`${id}:`)) thumbCache.current.delete(key);
    });
    setPages((prev) => prev.filter((p) => p.id !== id));
  };
  const movePage = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    setResult(null);
    setPages((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };
  const clearAll = () => {
    thumbCache.current.clear();
    setPages([]);
    setThumbs({});
    setResult(null);
    setError(null);
  };

  // ---------- Buat PDF ----------
  const createPdf = async () => {
    if (pages.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const blob = await buildScanPdf(
        pages.map((p) => ({ blob: p.blob, rotation: p.rotation })),
        { filter, size, quality },
        (done, total) => setProgress(Math.round((done / total) * 100))
      );
      setResult(blob);
      setResultName(timestampName());
    } catch {
      setError(t('scanDocument.errorCreate'));
    } finally {
      setBusy(false);
    }
  };

  const filterOptions: { value: ScanFilter; label: string }[] = [
    { value: 'document', label: t('scanDocument.filterDocument') },
    { value: 'color', label: t('scanDocument.filterColor') },
    { value: 'grayscale', label: t('scanDocument.filterGrayscale') },
    { value: 'original', label: t('scanDocument.filterOriginal') },
  ];
  const sizeOptions: { value: ScanPageSize; label: string }[] = [
    { value: 'a4', label: 'A4' },
    { value: 'letter', label: 'Letter' },
    { value: 'fit', label: t('scanDocument.sizeFit') },
  ];
  const qualityOptions: { value: ScanQuality; label: string }[] = [
    { value: 'high', label: t('scanDocument.qualityHigh') },
    { value: 'medium', label: t('scanDocument.qualityMedium') },
    { value: 'small', label: t('scanDocument.qualitySmall') },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sumber: kamera / galeri */}
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {!cameraOpen ? (
            <Button variant="primary" onClick={() => startCamera(facing)}>
              <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('scanDocument.openCamera')}
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={capture}>
                <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('scanDocument.takePhoto')}
              </Button>
              <Button variant="outline" onClick={() => startCamera(facing === 'environment' ? 'user' : 'environment')}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('scanDocument.switchCamera')}
              </Button>
              <Button variant="ghost" onClick={stopCamera}>
                <X className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('scanDocument.closeCamera')}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => nativeCameraRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('scanDocument.phoneCamera')}
          </Button>
          <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('scanDocument.uploadPhotos')}
          </Button>
        </div>

        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={nativeCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {cameraError && (
          <p role="alert" className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {cameraError}
          </p>
        )}

        <div className={cameraOpen ? 'space-y-2' : 'hidden'}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="mx-auto max-h-[60vh] w-full rounded-[var(--radius-lg)] bg-black object-contain"
          />
          <p className="text-center text-sm text-[hsl(var(--color-muted-foreground))]">{t('scanDocument.cameraHint')}</p>
        </div>
      </Card>

      {/* Daftar halaman */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[hsl(var(--color-foreground))]">
            {t('scanDocument.pagesTitle', { count: pages.length })}
          </h2>
          {pages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('scanDocument.clearAll')}
            </Button>
          )}
        </div>

        {pages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[hsl(var(--color-muted-foreground))]">
            {t('scanDocument.emptyPages')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pages.map((page, index) => (
              <li
                key={page.id}
                className="overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--color-border))] bg-[hsl(var(--color-muted))]"
              >
                <div className="flex aspect-[3/4] items-center justify-center bg-white">
                  {thumbs[page.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbs[page.id]}
                      alt={t('scanDocument.pageLabel', { number: index + 1 })}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">…</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <span className="text-xs font-medium text-[hsl(var(--color-muted-foreground))]">
                    {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => movePage(index, -1)}
                      disabled={index === 0}
                      aria-label={t('scanDocument.moveEarlier')}
                      className="rounded p-1.5 hover:bg-[hsl(var(--color-background))] disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(index, 1)}
                      disabled={index === pages.length - 1}
                      aria-label={t('scanDocument.moveLater')}
                      className="rounded p-1.5 hover:bg-[hsl(var(--color-background))] disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rotatePage(page.id)}
                      aria-label={t('scanDocument.rotate')}
                      className="rounded p-1.5 hover:bg-[hsl(var(--color-background))]"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePage(page.id)}
                      aria-label={t('scanDocument.delete')}
                      className="rounded p-1.5 text-red-600 hover:bg-[hsl(var(--color-background))]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Pengaturan */}
      {pages.length > 0 && (
        <Card className="space-y-5">
          <Segmented label={t('scanDocument.filterLabel')} value={filter} options={filterOptions} onChange={(v) => { setFilter(v); setResult(null); }} />
          <Segmented label={t('scanDocument.pageSize')} value={size} options={sizeOptions} onChange={(v) => { setSize(v); setResult(null); }} />
          <Segmented label={t('scanDocument.quality')} value={quality} options={qualityOptions} onChange={(v) => { setQuality(v); setResult(null); }} />
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Buat & unduh */}
      {pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={createPdf} loading={busy} disabled={busy}>
            {busy ? `${t('scanDocument.creating')} ${progress}%` : t('scanDocument.createPdf')}
          </Button>
          {result && (
            <DownloadButton file={result} filename={resultName} variant="secondary" size="lg" showFileSize />
          )}
        </div>
      )}

      {result && !busy && (
        <p role="status" className="rounded-[var(--radius-md)] border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
          {t('scanDocument.success')}
        </p>
      )}
    </div>
  );
}

export default ScanDocumentTool;
