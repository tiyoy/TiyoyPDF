/**
 * Penerima file PDF yang dibuka dari luar aplikasi (klik kanan PDF -> "Buka dengan TiyoyPDF").
 *
 * Browser berbasis Chromium (Chrome, Edge) mengirim file lewat `window.launchQueue`
 * ketika TiyoyPDF terpasang sebagai aplikasi (PWA) dan terdaftar sebagai pembuka PDF
 * lewat `file_handlers` di manifest.
 */

interface LaunchedFileHandle {
  getFile(): Promise<File>;
}

interface LaunchParams {
  files?: LaunchedFileHandle[];
}

interface LaunchQueueLike {
  setConsumer(consumer: (params: LaunchParams) => void | Promise<void>): void;
}

let pendingPdf: File | null = null;

/** Simpan sementara file PDF supaya bisa diambil halaman PDF Reader setelah berpindah halaman */
export function setPendingPdf(file: File): void {
  pendingPdf = file;
}

/** Ambil (dan hapus) file PDF yang sedang menunggu */
export function takePendingPdf(): File | null {
  const file = pendingPdf;
  pendingPdf = null;
  return file;
}

function getLaunchQueue(): LaunchQueueLike | null {
  if (typeof window === 'undefined') return null;
  const queue = (window as unknown as { launchQueue?: LaunchQueueLike }).launchQueue;
  return queue && typeof queue.setConsumer === 'function' ? queue : null;
}

/** Apakah browser ini mendukung pembukaan file lewat launchQueue */
export function isLaunchQueueSupported(): boolean {
  return getLaunchQueue() !== null;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Dengarkan file PDF yang dikirim saat aplikasi dibuka dari luar.
 * Mengembalikan fungsi pembersih (callback berhenti dipanggil setelah dibersihkan).
 */
export function listenForLaunchedPdf(onPdf: (file: File) => void): () => void {
  const queue = getLaunchQueue();
  if (!queue) return () => undefined;

  let active = true;
  queue.setConsumer(async (params) => {
    if (!active || !params.files || params.files.length === 0) return;
    for (const handle of params.files) {
      try {
        const file = await handle.getFile();
        if (isPdf(file)) {
          onPdf(file);
          return; // PDF Reader membuka satu file sekaligus
        }
      } catch {
        // abaikan file yang tidak bisa dibaca, coba berikutnya
      }
    }
  });

  return () => {
    active = false;
  };
}
