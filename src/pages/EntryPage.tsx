import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Copy,
  Languages,
  Loader2,
  Maximize2,
  Minimize2,
  Quote,
  RotateCcw,
  Square,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ArchivalImage } from '../components/ArchivalImage';
import { SUPPORTED_LANGUAGES } from '../data/seedData';
import { synthesizeSpeech, translatePassage } from '../lib/api';
import {
  formatCitationAPA,
  formatCitationChicago,
  playBase64WavAudio,
  speakText,
  stopSpeaking,
} from '../lib/scholarUtils';
import type { ArchiveEntry, LexiconTerm, SupportedLanguage } from '../types';

interface EntryPageProps {
  entry: ArchiveEntry;
  lexicon: LexiconTerm[];
  onBack: () => void;
  onSaveToResearchSpace: (entryId: string) => void;
}

export function EntryPage({ entry, lexicon, onBack, onSaveToResearchSpace }: EntryPageProps) {
  const [zoom, setZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [targetLang, setTargetLang] = useState<SupportedLanguage>('en');
  const [translatedText, setTranslatedText] = useState<string>(entry.englishTranslation);
  const [culturalNote, setCulturalNote] = useState<string>('');
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [citationFormat, setCitationFormat] = useState<'apa' | 'chicago'>('apa');
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<LexiconTerm | null>(null);
  const [readingTranslation, setReadingTranslation] = useState(false);
  const [synthesizingAudio, setSynthesizingAudio] = useState(false);

  useEffect(() => {
    setTargetLang('en');
    setTranslatedText(entry.englishTranslation);
    setCulturalNote('');
    setTranslationError(null);
    setReadingTranslation(false);
    setSynthesizingAudio(false);
    stopSpeaking();
  }, [entry.id, entry.englishTranslation]);

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    setTargetLang(lang);
    setTranslationError(null);
    stopSpeaking();
    setReadingTranslation(false);
    const sourceText = entry.englishTranslation || entry.summary || entry.originalExcerpt;
    if (lang === 'en') {
      setTranslatedText(sourceText);
      setCulturalNote('');
      return;
    }

    setTranslating(true);
    try {
      const res = await translatePassage(entry.id, sourceText, lang);
      setTranslatedText(res.translatedText);
      setCulturalNote(res.culturalNote);
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : 'Unable to translate passage via Gemini API.'
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleReadTranslation = async () => {
    if (readingTranslation) {
      stopSpeaking();
      setReadingTranslation(false);
      return;
    }
    const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
    const locale = langMeta?.speechLocale || 'en-IN';
    const langName = langMeta?.label || 'English';
    setSynthesizingAudio(true);
    try {
      const tts = await synthesizeSpeech({
        text: translatedText,
        languageCode: locale,
        languageName: langName,
        voiceName: 'Kore',
      });
      setSynthesizingAudio(false);
      setReadingTranslation(true);
      const started = playBase64WavAudio(
        tts.audioBase64,
        { rate: 1.0, volume: 0.95 },
        () => setReadingTranslation(false),
        () => {
          setReadingTranslation(false);
          speakText(translatedText, locale, 0.95, () => setReadingTranslation(false));
        }
      );
      if (!started) setReadingTranslation(false);
    } catch {
      setSynthesizingAudio(false);
      setReadingTranslation(true);
      const started = speakText(translatedText, locale, 0.95, () => setReadingTranslation(false));
      if (!started) setReadingTranslation(false);
    }
  };

  const activeCitation =
    citationFormat === 'apa' ? formatCitationAPA(entry) : formatCitationChicago(entry);

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(activeCitation);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const matchedTerms = lexicon.filter((term) =>
    entry.keyTerms.some(
      (k) =>
        k.toLowerCase().includes(term.term.toLowerCase()) ||
        term.term.toLowerCase().includes(k.toLowerCase())
    )
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumb & Monograph Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--vh-border-strong)] pb-4">
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            onBack();
          }}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Archive</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFocusMode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--vh-border-strong)] bg-[var(--vh-surface)] text-[var(--vh-ink)] rounded hover:bg-[var(--vh-champagne-soft)] cursor-pointer"
          >
            {focusMode ? (
              <Minimize2 className="w-3.5 h-3.5 text-[#B58A45]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[#B58A45]" />
            )}
            <span>{focusMode ? 'Exit Focus Mode' : 'Focus Reading Mode'}</span>
          </button>
          <button
            type="button"
            onClick={() => onSaveToResearchSpace(entry.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save to Research Space</span>
          </button>
        </div>
      </div>

      {/* Monograph Title Block */}
      <header className="space-y-3 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
          <span className="font-mono text-[var(--vh-gold-ink)] font-medium">{entry.accessionNo}</span>
          <span aria-hidden="true">·</span>
          <span className="text-[var(--vh-blue-ink)] font-medium">{entry.dynastyName}</span>
          <span aria-hidden="true">·</span>
          <span>{entry.displayDate}</span>
          <span aria-hidden="true">·</span>
          <span>{entry.category}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)] leading-tight [text-wrap:balance]">
          {entry.title}
        </h1>
        <p className="text-base text-[var(--vh-ink-muted)]">{entry.subtitle}</p>
      </header>

      {/* Zoomable Manuscript Viewer + Accession Metadata Grid */}
      {!focusMode && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--vh-border)] flex items-center justify-between bg-[var(--vh-champagne-soft)]">
              <span className="text-xs font-mono text-[var(--vh-ink)] tabular-nums">
                Plate Inspection · {Math.round(zoom * 100)}%
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
                  aria-label="Zoom out manuscript"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
                  aria-label="Zoom in manuscript"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1.5 rounded bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              style={{ backgroundColor: 'var(--vh-plate-bg)' }}
              className="h-80 sm:h-[420px] overflow-auto flex items-center justify-center p-4"
            >
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-200 max-w-full max-h-full"
              >
                <ArchivalImage
                  src={entry.imageUrl}
                  alt={entry.title}
                  className="max-h-[380px] w-auto object-contain rounded shadow-md border border-[#B58A45]/45"
                />
              </div>
            </div>

            <p className="px-4 py-2.5 text-xs font-serif italic text-[var(--vh-ink-muted)] border-t border-[var(--vh-border)]">
              Fig. 1 — {entry.material}, {entry.provenance}.
            </p>
          </div>

          <aside className="lg:col-span-5 bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-[3px] border-t-[#7993AC] rounded p-6">
            <h2 className="font-display text-base font-semibold text-[var(--vh-ink)] pb-3 border-b border-[var(--vh-border)]">
              Accession Dossier
            </h2>
            <dl className="divide-y divide-[var(--vh-border)] text-sm">
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Accession No.</dt>
                <dd className="col-span-2 font-mono text-xs text-[var(--vh-gold-ink)] font-medium tabular-nums">
                  {entry.accessionNo}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Dynasty &amp; Era</dt>
                <dd className="col-span-2 text-xs text-[var(--vh-ink)]">
                  {entry.dynastyName} · {entry.displayDate}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Script / Language</dt>
                <dd className="col-span-2 text-xs text-[var(--vh-ink)]">
                  {entry.script} ({entry.language})
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Medium</dt>
                <dd className="col-span-2 text-xs text-[var(--vh-ink)]">{entry.material}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Dimensions</dt>
                <dd className="col-span-2 text-xs font-mono text-[var(--vh-ink)] tabular-nums">
                  {entry.dimensions}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Provenance</dt>
                <dd className="col-span-2 text-xs text-[var(--vh-ink)]">{entry.provenance}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-2">
                <dt className="text-xs text-[var(--vh-ink-muted)]">Repository</dt>
                <dd className="col-span-2 text-xs text-[var(--vh-ink)]">{entry.repository}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}

      {/* Side-by-Side Primary Text & Multilingual Translation */}
      <section className={focusMode ? 'max-w-3xl mx-auto space-y-6' : 'space-y-4'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--vh-border-strong)] pb-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--vh-ink)]">
              Side-by-Side Folio &amp; Translation
            </h2>
            <p className="text-xs text-[var(--vh-ink-muted)]">
              Original epigraphic excerpt, IAST transliteration, and multilingual rendering
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Languages className="w-4 h-4 text-[#B58A45]" />
            <div className="flex flex-wrap items-center gap-1 bg-[var(--vh-champagne-soft)] p-1 rounded border border-[var(--vh-border-strong)]">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    targetLang === lang.code
                      ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold'
                      : 'text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)]'
                  }`}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${focusMode ? '' : 'lg:grid-cols-2'} gap-6`}>
          <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--vh-gold-ink)]">
                Original Script · {entry.language}
              </span>
              <button
                type="button"
                onClick={() => speakText(entry.transliteration, 'en-IN', 0.85)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--vh-surface)] border border-[var(--vh-border-strong)] rounded text-[var(--vh-ink)] hover:bg-[#B58A45] hover:text-[#FAF6EE] cursor-pointer transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#B58A45]" />
                <span>Pronounce</span>
              </button>
            </div>
            <p className="text-lg sm:text-xl leading-relaxed text-[var(--vh-ink)] font-medium">
              {entry.originalExcerpt}
            </p>
            <div className="pt-3 border-t border-[var(--vh-border)]">
              <p className="text-[11px] font-mono uppercase text-[var(--vh-gold-ink)] mb-1">
                Scholarly Transliteration
              </p>
              <p className="text-sm italic text-[var(--vh-ink-muted)] leading-relaxed">
                {entry.transliteration}
              </p>
            </div>
          </div>

          <div className="bg-[var(--vh-surface)] border-2 border-[#7993AC] rounded p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--vh-border)]">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--vh-blue-ink)] font-semibold">
                Translation · {SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.label} (
                {SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.nativeName})
              </span>
              <button
                type="button"
                disabled={synthesizingAudio || translating}
                onClick={() => void handleReadTranslation()}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[#22324B] rounded text-[#F4EDE1] hover:bg-[#B58A45] hover:text-[#162235] cursor-pointer transition-colors disabled:opacity-60"
              >
                {synthesizingAudio ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing Voice...</span>
                  </>
                ) : readingTranslation ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Read Aloud</span>
                  </>
                )}
              </button>
            </div>

            {translating ? (
              <div className="flex items-center gap-2 py-8 text-xs text-[var(--vh-ink-muted)]">
                <Loader2 className="w-4 h-4 animate-spin text-[#B58A45]" />
                <span>Translating archival passage via philological engine...</span>
              </div>
            ) : translationError ? (
              <div className="p-3 bg-[var(--vh-champagne-soft)] border border-[#B58A45] rounded text-xs text-[var(--vh-ink)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{translationError}</p>
                  <button
                    type="button"
                    onClick={() => void handleLanguageChange(targetLang)}
                    className="px-2.5 py-1 rounded bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold cursor-pointer"
                  >
                    Retry Translation
                  </button>
                </div>
                <p className="text-[var(--vh-ink-muted)]">Showing English reference text below:</p>
                <p className="text-sm text-[var(--vh-ink)]">{entry.englishTranslation}</p>
              </div>
            ) : (
              <>
                <p className="text-base leading-relaxed text-[var(--vh-ink)] whitespace-pre-line">
                  {translatedText}
                </p>
                {culturalNote && (
                  <p className="pt-3 border-t border-[var(--vh-border)] text-xs text-[var(--vh-ink-muted)] leading-relaxed">
                    Philological Note: {culturalNote}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Scholarly Analysis, Historical Context & Epigraphic Notes */}
      <section className={`grid grid-cols-1 ${focusMode ? '' : 'lg:grid-cols-12'} gap-8`}>
        <div
          className={`${
            focusMode ? 'max-w-3xl mx-auto w-full' : 'lg:col-span-8'
          } bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded p-6 sm:p-8 space-y-6`}
        >
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-[var(--vh-ink)]">
              Curatorial &amp; Historical Commentary
            </h2>
            <p className="drop-cap text-base leading-relaxed text-[var(--vh-ink)]/95 max-w-prose">
              {entry.scholarlyAnalysis}
            </p>
          </div>

          {(entry.historicalContext || entry.epigraphicNotes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {entry.historicalContext && (
                <div className="bg-[var(--vh-surface-alt)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded p-5 space-y-2">
                  <h3 className="font-display text-sm font-semibold text-[var(--vh-ink)]">
                    Historical &amp; Archival Context
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--vh-ink-muted)]">
                    {entry.historicalContext}
                  </p>
                </div>
              )}
              {entry.epigraphicNotes && (
                <div className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/45 border-t-2 border-t-[#7993AC] rounded p-5 space-y-2">
                  <h3 className="font-display text-sm font-semibold text-[var(--vh-ink)]">
                    Epigraphic &amp; Paleographic Notes
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--vh-ink-muted)]">
                    {entry.epigraphicNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {matchedTerms.length > 0 && (
            <div className="pt-2 space-y-3">
              <p className="text-xs font-medium text-[var(--vh-gold-ink)]">
                Click a key philological term for IPA &amp; syllable pronunciation:
              </p>
              <div className="flex flex-wrap gap-2">
                {matchedTerms.map((term) => (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => {
                      setSelectedTerm(term);
                      speakText(term.term, 'en-IN', 0.8);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                      selectedTerm?.id === term.id
                        ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
                        : 'bg-[var(--vh-champagne-soft)] text-[var(--vh-ink)] border-[var(--vh-border-strong)] hover:opacity-90'
                    }`}
                  >
                    {term.term} · {term.scriptText}
                  </button>
                ))}
              </div>
              {selectedTerm && (
                <div className="p-4 bg-[var(--vh-surface-alt)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded text-xs space-y-1.5">
                  <div className="font-mono text-[var(--vh-gold-ink)]">
                    {selectedTerm.ipa} · Syllables: {selectedTerm.syllables.join(' - ')}
                  </div>
                  <p className="text-[var(--vh-ink)]">{selectedTerm.meaning}</p>
                  <p className="text-[var(--vh-ink-muted)] italic">{selectedTerm.etymology}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Citation Generator */}
        {!focusMode && (
          <aside className="lg:col-span-4 bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-6 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[var(--vh-ink)] flex items-center gap-2">
                <Quote className="w-4 h-4 text-[#B58A45]" />
                <span>Cite This Monograph</span>
              </h3>
              <div className="flex items-center gap-1 bg-[var(--vh-surface)] p-0.5 rounded border border-[var(--vh-border)]">
                <button
                  type="button"
                  onClick={() => setCitationFormat('apa')}
                  className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                    citationFormat === 'apa'
                      ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold'
                      : 'text-[var(--vh-ink-muted)]'
                  }`}
                >
                  APA
                </button>
                <button
                  type="button"
                  onClick={() => setCitationFormat('chicago')}
                  className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                    citationFormat === 'chicago'
                      ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold'
                      : 'text-[var(--vh-ink-muted)]'
                  }`}
                >
                  Chicago
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--vh-ink)] bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded p-3 leading-relaxed">
              {activeCitation}
            </p>
            <button
              type="button"
              onClick={handleCopyCitation}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
            >
              {copiedCitation ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCitation ? 'Copied Citation' : 'Copy Citation'}</span>
            </button>
          </aside>
        )}
      </section>
    </div>
  );
}
