import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, LayoutGrid, List, Loader2, Mic, MicOff, Search, X } from 'lucide-react';
import { ArchivalImage } from '../components/ArchivalImage';
import { SUPPORTED_LANGUAGES } from '../data/seedData';
import { testSemanticEmbeddings } from '../lib/api';
import { startVoiceCaptureSession, type VoiceCaptureHandle } from '../lib/scholarUtils';
import type { ArchiveEntry, Dynasty, EntryCategory } from '../types';

interface ArchivePageProps {
  entries: ArchiveEntry[];
  dynasties: Dynasty[];
  initialQuery?: string;
  autoVoiceTrigger?: number;
  onConsumeVoiceTrigger?: () => void;
  onOpenEntry: (entryId: string) => void;
}

const CATEGORIES: Array<'All' | EntryCategory> = [
  'All',
  'Manuscript',
  'Inscription',
  'Monument',
  'Treatise',
];

const CATEGORY_ACCENTS: Record<EntryCategory, string> = {
  Manuscript: '#7993AC',
  Inscription: '#B58A45',
  Monument: '#22324B',
  Treatise: '#8F6B2F',
};

export function ArchivePage({
  entries,
  dynasties,
  initialQuery,
  autoVoiceTrigger = 0,
  onConsumeVoiceTrigger,
  onOpenEntry,
}: ArchivePageProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [category, setCategory] = useState<'All' | EntryCategory>('All');
  const [dynastyFilter, setDynastyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'year' | 'title' | 'accession'>('year');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [voiceLang, setVoiceLang] = useState<string>('auto');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [semanticMatchIds, setSemanticMatchIds] = useState<string[] | null>(null);
  const [semanticSearching, setSemanticSearching] = useState(false);
  const voiceCaptureRef = useRef<VoiceCaptureHandle | null>(null);
  const lastVoiceTriggerRef = useRef<number>(0);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    return () => {
      voiceCaptureRef.current?.stop();
    };
  }, []);

  const lexicalFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (category !== 'All' && entry.category !== category) return false;
        if (dynastyFilter !== 'all' && entry.dynastyId !== dynastyFilter) return false;
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.subtitle.toLowerCase().includes(q) ||
          entry.accessionNo.toLowerCase().includes(q) ||
          entry.dynastyName.toLowerCase().includes(q) ||
          entry.script.toLowerCase().includes(q) ||
          entry.language.toLowerCase().includes(q) ||
          entry.originalExcerpt.toLowerCase().includes(q) ||
          entry.transliteration.toLowerCase().includes(q) ||
          entry.summary.toLowerCase().includes(q) ||
          entry.keyTerms.some((k) => k.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'year') return a.year - b.year;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return a.accessionNo.localeCompare(b.accessionNo);
      });
  }, [entries, query, category, dynastyFilter, sortBy]);

  // Enable cross-lingual / conceptual voice search (e.g., Tamil/Hindi queries matching English monographs)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || lexicalFiltered.length > 0) {
      setSemanticMatchIds(null);
      setSemanticSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSemanticSearching(true);
      try {
        const res = await testSemanticEmbeddings(trimmed);
        if (!cancelled) {
          setSemanticMatchIds(
            res.matches.filter((m) => m.score >= 0.28).map((m) => m.entryId)
          );
        }
      } catch {
        if (!cancelled) setSemanticMatchIds(null);
      } finally {
        if (!cancelled) setSemanticSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, lexicalFiltered.length]);

  const filtered = useMemo(() => {
    if (lexicalFiltered.length > 0 || !semanticMatchIds || semanticMatchIds.length === 0) {
      return lexicalFiltered;
    }
    const order = new Map(semanticMatchIds.map((id, idx) => [id, idx]));
    return entries
      .filter((entry) => {
        if (!order.has(entry.id)) return false;
        if (category !== 'All' && entry.category !== category) return false;
        if (dynastyFilter !== 'all' && entry.dynastyId !== dynastyFilter) return false;
        return true;
      })
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }, [entries, lexicalFiltered, semanticMatchIds, category, dynastyFilter]);

  const startVoiceSearch = () => {
    if (listening) {
      voiceCaptureRef.current?.stop();
      setListening(false);
      return;
    }

    const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.speechLocale === voiceLang);
    setVoiceStatus(null);

    voiceCaptureRef.current = startVoiceCaptureSession({
      languageCode: voiceLang,
      languageName: selectedLang?.label,
      onStart: () => {
        setListening(true);
        setTranscribing(false);
        setVoiceStatus(
          selectedLang
            ? `Listening in ${selectedLang.label} (${selectedLang.speechLocale}) — speak your search query...`
            : 'Listening in any language — speak your search query...'
        );
      },
      onTranscribing: () => {
        setListening(false);
        setTranscribing(true);
        setVoiceStatus('Transcribing voice search...');
      },
      onTranscript: (transcript) => {
        setQuery(transcript);
        setVoiceStatus(`Voice search: "${transcript}"`);
      },
      onError: (msg) => {
        setVoiceStatus(msg);
      },
      onEnd: () => {
        setListening(false);
        setTranscribing(false);
      },
    });
  };

  useEffect(() => {
    if (autoVoiceTrigger > 0 && autoVoiceTrigger !== lastVoiceTriggerRef.current) {
      lastVoiceTriggerRef.current = autoVoiceTrigger;
      onConsumeVoiceTrigger?.();
      startVoiceSearch();
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-[var(--vh-border-strong)] pb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Archival Repository
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)] mt-1">
          Heritage Archive Catalogue
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-2 max-w-2xl">
          Filter primary manuscripts, stone inscriptions, monuments, and statecraft treatises across
          six South Asian dynasties by keyword or multilingual voice search.
        </p>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--vh-gold-ink)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or speak in English, Tamil, Hindi (e.g., Kudavolai, குடவோலை, Brahmi)..."
              className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded pl-10 pr-9 py-2.5 text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setVoiceStatus(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              aria-label="Voice search language"
              className="bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2.5 text-xs text-[var(--vh-ink)] focus:outline-none focus:border-[#B58A45] cursor-pointer"
            >
              <option value="auto">Voice: Auto Language</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.speechLocale}>
                  Voice: {lang.label} ({lang.nativeName})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={startVoiceSearch}
              disabled={transcribing}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                listening
                  ? 'bg-[#B58A45] text-[#FAF6EE] border-[#B58A45] font-semibold animate-pulse'
                  : 'bg-[var(--vh-input-bg)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:bg-[var(--vh-french-blue-soft)]'
              }`}
            >
              {transcribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B58A45]" />
              ) : listening ? (
                <MicOff className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-[#B58A45]" />
              )}
              <span>
                {transcribing ? 'Transcribing...' : listening ? 'Stop Listening' : 'Voice Search'}
              </span>
            </button>
          </div>
        </div>

        {(voiceStatus || semanticSearching || (semanticMatchIds && semanticMatchIds.length > 0 && lexicalFiltered.length === 0)) && (
          <p className="text-xs text-[var(--vh-ink-muted)] flex items-center gap-2">
            {semanticSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B58A45]" />}
            <span>
              {semanticSearching
                ? 'Finding multilingual semantic archive matches...'
                : voiceStatus ||
                  (semanticMatchIds && semanticMatchIds.length > 0 && lexicalFiltered.length === 0
                    ? `Showing ${filtered.length} semantic matches for "${query}"`
                    : '')}
            </span>
          </p>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-[var(--vh-border)]">
          {/* Category Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category filter">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === cat
                    ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold'
                    : 'bg-[var(--vh-input-bg)] text-[var(--vh-ink-muted)] border border-[var(--vh-border)] hover:text-[var(--vh-ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={dynastyFilter}
              onChange={(e) => setDynastyFilter(e.target.value)}
              aria-label="Filter by dynasty"
              className="bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-1.5 text-xs text-[var(--vh-ink)]"
            >
              <option value="all">All Dynasties</option>
              {dynasties.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'year' | 'title' | 'accession')}
              aria-label="Sort entries"
              className="bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-1.5 text-xs text-[var(--vh-ink)]"
            >
              <option value="year">Chronological</option>
              <option value="title">Title A–Z</option>
              <option value="accession">Accession No.</option>
            </select>

            <div className="flex items-center border border-[var(--vh-border)] rounded bg-[var(--vh-input-bg)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)]'
                    : 'text-[var(--vh-ink-muted)]'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)]'
                    : 'text-[var(--vh-ink-muted)]'
                }`}
                aria-label="Ledger table view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-[var(--vh-ink-muted)] tabular-nums">
        Showing {filtered.length} of {entries.length} archival monographs
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded p-12 text-center space-y-3">
          <p className="font-display text-lg text-[var(--vh-ink)]">No matching archival entries</p>
          <p className="text-xs text-[var(--vh-ink-muted)]">
            Adjust your dynasty filter or search terms to view all monographs.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('All');
              setDynastyFilter('all');
            }}
            className="px-4 py-2 text-xs font-semibold bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] rounded cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((entry) => {
            const topColor = CATEGORY_ACCENTS[entry.category] || '#B58A45';
            return (
              <article
                key={entry.id}
                style={{ borderTopColor: topColor }}
                className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-[3px] rounded overflow-hidden flex flex-col justify-between hover:border-[#B58A45] transition-colors"
              >
                <div>
                  <div className="h-48 bg-[var(--vh-surface-alt)]">
                    <ArchivalImage
                      src={entry.imageUrl}
                      alt={entry.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--vh-ink-muted)]">
                      <span className="font-mono text-[var(--vh-gold-ink)]">{entry.accessionNo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[var(--vh-ink)]">{entry.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.displayDate}</span>
                    </div>
                    <h2 className="font-display text-lg font-semibold text-[var(--vh-ink)] mt-2 leading-snug">
                      {entry.title}
                    </h2>
                    <p className="text-xs text-[var(--vh-blue-ink)] mt-1 font-medium">
                      {entry.dynastyName}
                    </p>
                    <p className="text-xs text-[var(--vh-ink-muted)] mt-3 line-clamp-3 leading-relaxed">
                      {entry.summary}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-[var(--vh-border)]">
                  <span className="text-[11px] font-mono text-[var(--vh-ink-muted)] truncate max-w-[160px]">
                    {entry.script}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEntry(entry.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#B58A45]/45 bg-[#22324B] text-xs font-medium text-[#F4EDE1]">
                <th className="py-3 px-4">Accession</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Dynasty</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Script</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vh-border)] text-sm">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-[var(--vh-row-hover)]">
                  <td className="py-3.5 px-4 font-mono text-xs text-[var(--vh-gold-ink)] tabular-nums whitespace-nowrap">
                    {entry.accessionNo}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[var(--vh-ink)] max-w-xs">
                    {entry.title}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--vh-blue-ink)] whitespace-nowrap">
                    {entry.dynastyName}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-[var(--vh-ink-muted)] tabular-nums whitespace-nowrap">
                    {entry.displayDate}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--vh-ink-muted)]">{entry.category}</td>
                  <td className="py-3.5 px-4 text-xs text-[var(--vh-ink-muted)]">{entry.script}</td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenEntry(entry.id)}
                      className="text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                    >
                      Open Monograph
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
