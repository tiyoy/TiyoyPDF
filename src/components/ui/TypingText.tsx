'use client';

import { useEffect, useState } from 'react';

interface TypingTextProps {
  /** Teks lengkap yang akan diketik */
  text: string;
  /** Kecepatan mengetik per huruf (ms) */
  speed?: number;
  /** Jeda sebelum mulai mengetik (ms) */
  startDelay?: number;
  className?: string;
}

/**
 * Teks dengan efek mengetik + kursor berkedip.
 * - Ruang teks penuh sudah dipesan (invisible) supaya layout tidak bergeser.
 * - Pengguna yang memilih "reduce motion" langsung melihat teks penuh.
 * - Pembaca layar membaca teks penuh lewat aria-label.
 */
export function TypingText({ text, speed = 85, startDelay = 400, className = '' }: TypingTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setCount(text.length);
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length && interval) clearInterval(interval);
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span className="relative inline-block" aria-label={text}>
      {/* Memesan ruang agar tinggi/lebar tidak berubah saat mengetik */}
      <span className={`invisible ${className}`} aria-hidden="true">
        {text}
      </span>
      <span className="absolute inset-0 text-left" aria-hidden="true">
        <span className={className}>{text.slice(0, count)}</span>
        <span className="typing-caret" />
      </span>
    </span>
  );
}

export default TypingText;
