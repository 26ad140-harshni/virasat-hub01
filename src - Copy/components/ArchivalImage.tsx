import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface ArchivalImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ArchivalImage({ src, alt, className = '', fallbackLabel }: ArchivalImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--vh-surface-alt)] text-[var(--vh-ink-muted)] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <BookOpen className="w-8 h-8 text-[#B58A45] mb-2" strokeWidth={1.5} />
        <span className="font-display text-xs tracking-wider uppercase text-[var(--vh-ink)]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
