'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { locales, defaultLocale } from '@/lib/i18n/config';
import { isLaunchQueueSupported, listenForLaunchedPdf, setPendingPdf } from '@/lib/pending-file';

/**
 * Pintu masuk saat TiyoyPDF dipilih sebagai pembuka file PDF
 * (klik kanan PDF -> Buka dengan -> TiyoyPDF).
 * Menerima file, memilih bahasa sesuai browser, lalu membuka PDF Reader.
 */
function pickLocale(): string {
  try {
    const full = navigator.language;
    const list = locales as readonly string[];
    if (list.includes(full)) return full;
    const primary = full.split('-')[0];
    if (list.includes(primary)) return primary;
  } catch {
    // pakai bahasa bawaan
  }
  return defaultLocale;
}

export default function OpenPdfPage() {
  const router = useRouter();

  useEffect(() => {
    let redirected = false;
    const goToReader = () => {
      if (redirected) return;
      redirected = true;
      router.replace(`/${pickLocale()}/tools/pdf-reader/`);
    };

    const stop = listenForLaunchedPdf((file) => {
      setPendingPdf(file);
      goToReader();
    });

    // Dibuka tanpa file (atau browser tidak mendukung): langsung ke PDF Reader
    const timer = setTimeout(goToReader, isLaunchQueueSupported() ? 1500 : 0);

    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p>Membuka PDF… / Opening PDF…</p>
    </main>
  );
}
