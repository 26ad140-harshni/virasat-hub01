import { useState } from 'react';
import { ArrowRight, Volume2 } from 'lucide-react';
import { speakText } from '../lib/scholarUtils';
import type { LexiconTerm } from '../types';

interface LexiconPageProps {
  lexicon: LexiconTerm[];
  onOpenEntry: (entryId: string) => void;
}

const CARD_SWATCHES = [
  'bg-[var(--vh-surface)] border-t-[#B58A45]',
  'bg-[var(--vh-french-blue-soft)] border-t-[#7993AC]',
  'bg-[var(--vh-surface-alt)] border-t-[#22324B]',
  'bg-[var(--vh-surface)] border-t-[#B58A45]',
];

export function LexiconPage({ lexicon, onOpenEntry }: LexiconPageProps) {
  const [customPhrase, setCustomPhrase] = useState('Vasudhaiva Kutumbakam');
  const [speechRate, setSpeechRate] = useState(0.85);
  const [activeSyllableIdx, setActiveSyllableIdx] = useState<number | null>(null);

  const customSyllables = customPhrase
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const playWordByWord = (parts: string[]) => {
    if (parts.length === 0) return;
    let idx = 0;
    const step = () => {
      if (idx >= parts.length) {
        setActiveSyllableIdx(null);
        return;
      }
      setActiveSyllableIdx(idx);
      const current = parts[idx];
      idx += 1;
      const started = speakText(current, 'en-IN', speechRate, () => {
        setTimeout(step, 180);
      });
      if (!started) {
        setActiveSyllableIdx(null);
      }
    };
    step();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="border-b border-[var(--vh-border-strong)] pb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Philology &amp; Phonetics
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)] mt-1">
          Pronunciation Lexicon &amp; IPA Guide
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-2 max-w-2xl">
          Inspect International Phonetic Alphabet transcriptions, syllable segmentation, and
          etymologies for core Sanskrit, Prakrit, Tamil, Persian, and Marathi archival terms.
        </p>
      </div>

      {/* Interactive Word-by-Word Pronunciation Tester */}
      <section className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
              Word-by-Word Pronunciation Studio
            </h2>
            <p className="text-xs text-[var(--vh-ink-muted)]">
              Enter any transliterated phrase to hear step-by-step SpeechSynthesis playback
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--vh-ink-muted)]">
            <span>Cadence:</span>
            <input
              type="range"
              min="0.6"
              max="1.2"
              step="0.05"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="accent-[#B58A45]"
            />
            <span className="font-mono tabular-nums text-[var(--vh-gold-ink)] font-semibold">
              {speechRate.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={customPhrase}
            onChange={(e) => setCustomPhrase(e.target.value)}
            className="flex-1 bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] rounded px-3.5 py-2.5 text-sm text-[var(--vh-ink)] focus:outline-none focus:border-[#B58A45]"
          />
          <button
            type="button"
            onClick={() => playWordByWord(customSyllables)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Play Word-by-Word</span>
          </button>
        </div>

        {customSyllables.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {customSyllables.map((word, idx) => (
              <button
                key={`${word}-${idx}`}
                type="button"
                onClick={() => speakText(word, 'en-IN', speechRate)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors cursor-pointer ${
                  activeSyllableIdx === idx
                    ? 'bg-[#B58A45] text-[#FAF6EE] border-[#B58A45] font-semibold'
                    : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:border-[#7993AC]'
                }`}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lexicon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lexicon.map((term, idx) => {
          const cardBg = CARD_SWATCHES[idx % CARD_SWATCHES.length];
          return (
            <article
              key={term.id}
              className={`${cardBg} border border-[var(--vh-border)] border-t-[3px] rounded p-6 flex flex-col justify-between space-y-4 shadow-sm`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs text-[var(--vh-blue-ink)] font-medium">
                      {term.language}
                    </span>
                    <h3 className="font-display text-2xl font-semibold text-[var(--vh-ink)] mt-0.5">
                      {term.term}
                    </h3>
                    <p className="text-base text-[var(--vh-gold-ink)] mt-0.5">{term.scriptText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(term.term, 'en-IN', speechRate)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#B58A45] bg-[#B58A45] rounded text-[#FAF6EE] hover:bg-[#7993AC] hover:border-[#7993AC] cursor-pointer transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--vh-ink-muted)] bg-[var(--vh-champagne-soft)] border border-[var(--vh-border)] rounded px-3 py-2">
                  <span>IPA: {term.ipa}</span>
                  <span aria-hidden="true">·</span>
                  <span>Syllables: {term.syllables.join(' · ')}</span>
                </div>

                <p className="text-sm text-[var(--vh-ink)] leading-relaxed">{term.meaning}</p>
                <p className="text-xs text-[var(--vh-ink-muted)] italic">{term.etymology}</p>
              </div>

              <div className="pt-3 border-t border-[var(--vh-border)]">
                <button
                  type="button"
                  onClick={() => onOpenEntry(term.exampleEntryId)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                >
                  <span>See Primary Source Context</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
