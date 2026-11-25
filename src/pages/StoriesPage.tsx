import { useEffect, useState } from 'react';
import { ArrowRight, Play, Square, Volume2 } from 'lucide-react';
import { ArchivalImage } from '../components/ArchivalImage';
import { speakText, stopSpeaking } from '../lib/scholarUtils';
import type { HistoricalStory } from '../types';

interface StoriesPageProps {
  stories: HistoricalStory[];
  onOpenEntry: (entryId: string) => void;
}

export function StoriesPage({ stories, onOpenEntry }: StoriesPageProps) {
  const [activeStoryId, setActiveStoryId] = useState<string>(stories[0]?.id || '');
  const [isReading, setIsReading] = useState(false);
  const [activeParagraphIdx, setActiveParagraphIdx] = useState<number | null>(null);
  const [rate, setRate] = useState(0.95);

  const story = stories.find((s) => s.id === activeStoryId) || stories[0];

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  if (!story) return null;

  const stopNarration = () => {
    stopSpeaking();
    setIsReading(false);
    setActiveParagraphIdx(null);
  };

  const startNarration = () => {
    stopSpeaking();
    setIsReading(true);
    let idx = 0;

    const readNext = () => {
      if (idx >= story.paragraphs.length) {
        setIsReading(false);
        setActiveParagraphIdx(null);
        return;
      }
      setActiveParagraphIdx(idx);
      const paragraph = story.paragraphs[idx];
      idx += 1;
      const started = speakText(paragraph, 'en-IN', rate, () => {
        readNext();
      });
      if (!started) {
        setIsReading(false);
        setActiveParagraphIdx(null);
      }
    };

    readNext();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-[var(--vh-border-strong)] pb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Archival Narratives
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)] mt-1">
          Historical Stories &amp; Audio Chronicles
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-2 max-w-2xl">
          Long-form historical vignettes drawn directly from stone inscriptions, palm-leaf colophons,
          and courtly chronicles, with built-in Web Speech read-aloud narration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Story Selector Sidebar */}
        <aside className="lg:col-span-4 space-y-2.5">
          {stories.map((item, idx) => {
            const active = item.id === story.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  stopNarration();
                  setActiveStoryId(item.id);
                }}
                className={`w-full text-left p-4 rounded border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#22324B] border-[#B58A45] text-[#F4EDE1] shadow-sm'
                    : 'bg-[var(--vh-surface)] border-[var(--vh-border)] text-[var(--vh-ink)] hover:border-[#7993AC]'
                }`}
              >
                <div
                  className={`flex items-center justify-between text-[11px] font-mono tabular-nums ${
                    active ? 'text-[#DCC8AD] font-semibold' : 'text-[var(--vh-gold-ink)]'
                  }`}
                >
                  <span>0{idx + 1} · {item.era}</span>
                  <span className={active ? 'text-[#F4EDE1]/85' : 'text-[var(--vh-blue-ink)]'}>
                    {item.readingTime}
                  </span>
                </div>
                <h2
                  className={`font-display text-sm font-semibold mt-1 leading-snug ${
                    active ? 'text-[#FAF6EE]' : 'text-[var(--vh-ink)]'
                  }`}
                >
                  {item.title}
                </h2>
                <p
                  className={`text-xs mt-1 ${
                    active ? 'text-[#DCC8AD]' : 'text-[var(--vh-ink-muted)]'
                  }`}
                >
                  {item.dynastyName}
                </p>
              </button>
            );
          })}
        </aside>

        {/* Active Story Reader */}
        <article className="lg:col-span-8 bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded overflow-hidden shadow-md">
          <div className="h-60 sm:h-72 bg-[var(--vh-surface-alt)]">
            <ArchivalImage
              src={story.imageUrl}
              alt={story.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 sm:p-10 space-y-6">
            <div className="space-y-2 border-b border-[var(--vh-border)] pb-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-gold-ink)] font-medium">
                <span className="text-[var(--vh-blue-ink)]">{story.dynastyName}</span>
                <span aria-hidden="true">·</span>
                <span>{story.era}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--vh-ink-muted)]">{story.readingTime}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] leading-tight">
                {story.title}
              </h2>
              <p className="text-xs italic text-[var(--vh-ink-muted)]">{story.narratorNote}</p>
            </div>

            {/* Read-Aloud Controls */}
            <div className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/45 rounded p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {!isReading ? (
                  <button
                    type="button"
                    onClick={startNarration}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Read Story Aloud</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopNarration}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B58A45] border border-[#8F6B2F] text-[#FAF6EE] text-xs font-semibold rounded cursor-pointer hover:bg-[#22324B]"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Narration</span>
                  </button>
                )}
                <span className="text-xs text-[var(--vh-ink-muted)] flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-[#7993AC]" />
                  <span>{isReading ? 'Narrating paragraph...' : 'Web Speech narration'}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
                <span>Pace:</span>
                <select
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  aria-label="Narration speed"
                  className="bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] rounded px-2 py-1 text-xs text-[var(--vh-ink)]"
                >
                  <option value={0.8}>0.8x</option>
                  <option value={0.95}>0.95x</option>
                  <option value={1.15}>1.15x</option>
                  <option value={1.35}>1.35x</option>
                </select>
              </div>
            </div>

            {/* Story Body */}
            <div className="space-y-5 max-w-prose">
              {story.paragraphs.map((para, index) => (
                <p
                  key={index}
                  className={`text-base leading-relaxed transition-colors rounded px-3 py-1.5 -mx-3 ${
                    index === 0 ? 'drop-cap' : ''
                  } ${
                    activeParagraphIdx === index
                      ? 'bg-[var(--vh-champagne-soft)] text-[var(--vh-ink)] font-medium'
                      : 'text-[var(--vh-ink)]/95'
                  }`}
                >
                  {para}
                </p>
              ))}
            </div>

            {story.linkedEntryIds.length > 0 && (
              <div className="pt-6 border-t border-[var(--vh-border)] flex flex-wrap items-center gap-3">
                <span className="text-xs text-[var(--vh-ink-muted)]">Primary Evidence:</span>
                {story.linkedEntryIds.map((entryId) => (
                  <button
                    key={entryId}
                    type="button"
                    onClick={() => onOpenEntry(entryId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                  >
                    <span>Inspect Source Monograph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
