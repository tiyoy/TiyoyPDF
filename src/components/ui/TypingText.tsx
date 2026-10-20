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

interface TypingLoopTextProps {
  /** Daftar kata yang diketik bergantian, lalu diulang terus */
  words: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  /** Lama kata dibiarkan terlihat sebelum dihapus (ms) */
  holdDelay?: number;
  /** Jeda setelah kata terhapus sebelum kata berikutnya diketik (ms) */
  nextDelay?: number;
  className?: string;
}

/**
 * Efek mengetik berulang: ketik kata -> tahan -> hapus -> kata berikutnya -> ... (loop).
 * Lebar kata terpanjang dipesan dulu supaya teks di sekitarnya tidak bergeser.
 */
export function TypingLoopText({
  words,
  typeSpeed = 90,
  deleteSpeed = 45,
  holdDelay = 1500,
  nextDelay = 350,
  className = '',
}: TypingLoopTextProps) {
  const [text, setText] = useState('');
  const [animate, setAnimate] = useState(true);
  const key = words.join('|');

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || words.length === 0) {
      setAnimate(false);
      setText(words[0] ?? '');
      return;
    }
    setAnimate(true);

    let wordIndex = 0;
    let chars = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = words[wordIndex];
      if (!deleting) {
        chars += 1;
        setText(word.slice(0, chars));
        if (chars >= word.length) {
          deleting = true;
          timer = setTimeout(tick, holdDelay);
          return;
        }
        timer = setTimeout(tick, typeSpeed);
      } else {
        chars -= 1;
        setText(word.slice(0, chars));
        if (chars <= 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          timer = setTimeout(tick, nextDelay);
          return;
        }
        timer = setTimeout(tick, deleteSpeed);
      }
    };

    setText('');
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, typeSpeed, deleteSpeed, holdDelay, nextDelay]);

  return (
    <span className="relative inline-block" aria-label={words.join(', ')}>
      {/* Semua kata ditumpuk (tak terlihat) agar lebar mengikuti kata terlebar, apa pun aksaranya */}
      <span className="inline-grid" aria-hidden="true">
        {words.map((w) => (
          <span key={w} className={`invisible whitespace-nowrap ${className}`} style={{ gridArea: '1 / 1' }}>
            {w}
          </span>
        ))}
      </span>
      <span
        className="absolute inset-0 whitespace-nowrap"
        style={{ textAlign: 'start' }}
        aria-hidden="true"
      >
        <span className={className}>{text}</span>
        {animate && <span className="typing-caret" />}
      </span>
    </span>
  );
}
