import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Compass, Loader2, Mic, MicOff, Network, Search, Volume2 } from 'lucide-react';
import { ArchivalImage } from '../components/ArchivalImage';
import { GoldHairlineDivider } from '../components/ArchivalOrnaments';
import type { PageRoute } from '../components/Header';
import { speakText, startVoiceCaptureSession, type VoiceCaptureHandle } from '../lib/scholarUtils';
import type { ArchiveEntry, Dynasty, LexiconTerm } from '../types';

interface HomePageProps {
  entries: ArchiveEntry[];
  dynasties: Dynasty[];
  eventsCount: number;
  lexicon: LexiconTerm[];
  onNavigate: (page: PageRoute) => void;
  onOpenEntry: (entryId: string) => void;
  onOpenDynasty: (dynastyId: string) => void;
  onOpenChatbot: () => void;
  onSearchArchive: (query: string) => void;
}

export function HomePage({
  entries,
  dynasties,
  eventsCount,
  lexicon,
  onNavigate,
  onOpenEntry,
  onOpenDynasty,
  onOpenChatbot,
  onSearchArchive,
}: HomePageProps) {
  const leadEntry = entries[0];
  const featuredEntries = entries.slice(1, 4);
  const [heroSearch, setHeroSearch] = useState('');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voiceCaptureRef = useRef<VoiceCaptureHandle | null>(null);

  useEffect(() => {
    return () => {
      voiceCaptureRef.current?.stop();
    };
  }, []);

  const toggleHeroVoiceSearch = () => {
    if (listening) {
      voiceCaptureRef.current?.stop();
      setListening(false);
      return;
    }
    setVoiceNote(null);
    voiceCaptureRef.current = startVoiceCaptureSession({
      languageCode: 'auto',
      onStart: () => {
        setListening(true);
        setTranscribing(false);
      },
      onTranscribing: () => {
        setListening(false);
        setTranscribing(true);
      },
      onTranscript: (transcript) => {
        setHeroSearch(transcript);
        onSearchArchive(transcript);
      },
      onError: (msg) => setVoiceNote(msg),
      onEnd: () => {
        setListening(false);
        setTranscribing(false);
      },
    });
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Exhibition Marquee Hero: Champagne, Ivory, French Blue, Gold & Navy */}
      <section
        style={{ background: 'var(--vh-hero-bg)' }}
        className="border-b border-[var(--vh-border-strong)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-12 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between py-2">
              <div className="space-y-5">
                <p className="text-xs font-mono tracking-widest uppercase text-[var(--vh-gold-ink)]">
                  Curatorial Archive · 322 BCE – 1857 CE
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[3.1rem] font-semibold leading-[1.15] text-[var(--vh-ink)] [text-wrap:balance]">
                  Primary Manuscripts, Stone Epigraphs &amp; Living Chronologies of South Asia
                </h1>
                <p className="text-base sm:text-lg text-[var(--vh-ink-muted)] leading-relaxed max-w-2xl">
                  Virasat Hub preserves palm-leaf treatises, copper-plate charters, monumental temple
                  architecture, and interactive spatial timelines across two millennia of South Asian
                  statecraft, astronomy, civic ethics, and multilingual literature.
                </p>
              </div>

              <div className="pt-8 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate('archive')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-sm font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] transition-colors cursor-pointer"
                  >
                    <span>Explore the Archive</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('timemap')}
                    className="inline-flex items-center gap-2 px-5 py-3 border border-[#7993AC] bg-[#7993AC] text-[#FAF6EE] text-sm font-medium rounded hover:bg-[#22324B] hover:border-[#B58A45] transition-colors cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-[#FAF6EE]" />
                    <span>Open Time Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenChatbot}
                    className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                  >
                    <span>Ask Research Assistant</span>
                  </button>
                </div>

                {/* Quick Multilingual Search & Voice Search Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (heroSearch.trim()) onSearchArchive(heroSearch.trim());
                  }}
                  className="max-w-xl space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[var(--vh-gold-ink)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={heroSearch}
                        onChange={(e) => setHeroSearch(e.target.value)}
                        placeholder={
                          transcribing
                            ? 'Transcribing voice search...'
                            : listening
                            ? 'Listening in any language — speak now...'
                            : 'Search manuscripts or speak in Tamil, Hindi, English...'
                        }
                        className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] rounded pl-9 pr-3 py-2 text-xs sm:text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/70 focus:outline-none focus:border-[#B58A45]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={toggleHeroVoiceSearch}
                      disabled={transcribing}
                      aria-label={listening ? 'Stop voice search' : 'Start voice search'}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                        listening
                          ? 'bg-[#B58A45] text-[#FAF6EE] border-[#B58A45] animate-pulse'
                          : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border-strong)] hover:border-[#B58A45]'
                      }`}
                    >
                      {transcribing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B58A45]" />
                      ) : listening ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-[#B58A45]" />
                      )}
                      <span>{transcribing ? 'Transcribing' : listening ? 'Stop' : 'Voice'}</span>
                    </button>
                  </div>
                  {voiceNote && <p className="text-[11px] text-[var(--vh-ink-muted)]">{voiceNote}</p>}
                </form>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-72 sm:h-96 lg:h-full min-h-[340px] overflow-hidden temple-arch-frame border-2 border-[#B58A45] ring-4 ring-[#7993AC]/35 bg-[#22324B] shadow-lg">
                <ArchivalImage
                  src="/src/assets/images/hero_temple_architecture_1795522708646.jpg"
                  alt="Golden hour sandstone temple mandapa colonnade"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 5-Column Full Palette Strip: Champagne, Ivory, French Blue, Gold & Navy */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border border-[#B58A45]/60 rounded overflow-hidden shadow-md">
            <div className="p-5 bg-[#DCC8AD] border-b lg:border-b-0 border-r border-[#B58A45]/35">
              <div className="font-mono text-2xl font-semibold text-[#22324B] tabular-nums">
                {entries.length}
              </div>
              <div className="text-xs text-[#534D41] font-medium mt-1">
                Cataloged Primary Monographs
              </div>
            </div>
            <div className="p-5 bg-[#F4EDE1] border-b lg:border-b-0 sm:border-r border-[#B58A45]/35">
              <div className="font-mono text-2xl font-semibold text-[#22324B] tabular-nums">
                {dynasties.length}
              </div>
              <div className="text-xs text-[#534D41] font-medium mt-1">
                Imperial &amp; Regional Dynasties
              </div>
            </div>
            <div className="p-5 bg-[#7993AC] border-b lg:border-b-0 border-r border-[#B58A45]/35">
              <div className="font-mono text-2xl font-semibold text-[#FAF6EE] tabular-nums">
                {eventsCount}
              </div>
              <div className="text-xs text-[#F4EDE1] font-medium mt-1">
                Geo-Referenced Timeline Events
              </div>
            </div>
            <div className="p-5 bg-[#B58A45] border-r border-[#22324B]/20">
              <div className="font-mono text-2xl font-semibold text-[#FAF6EE] tabular-nums">6</div>
              <div className="text-xs text-[#F4EDE1] font-medium mt-1">
                Indic Translation Languages
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-5 bg-[#22324B]">
              <div className="font-mono text-2xl font-semibold text-[#F4EDE1] tabular-nums">
                2,179
              </div>
              <div className="text-xs text-[#DCC8AD] font-medium mt-1">
                Years of Documented History
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <GoldHairlineDivider />
      </div>

      {/* Curatorial Scope & Historical Overview: All 5 Colors Represented */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start shadow-sm">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
              Historical Scope
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] leading-snug">
              From Ashokan Rock Edicts to Sahyadri Statecraft
            </h2>
            <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed">
              Every object in this archive is chosen because it illuminates how South Asian
              societies recorded law, astronomy, water engineering, and civic ethics across stone,
              copper, and palm leaf.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm leading-relaxed">
            <div className="p-4 rounded bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] space-y-1.5">
              <h3 className="font-display text-sm font-semibold text-[var(--vh-ink)]">
                Civic Constitutions &amp; Guilds
              </h3>
              <p className="text-xs text-[var(--vh-ink-muted)] leading-relaxed">
                Examine how 10th-century Chola villages codified electoral audits via Kudavolai
                palm-leaf ballots, and how Vidisha’s ivory-carvers’ guild funded Sanchi’s gateways.
              </p>
            </div>
            <div className="p-4 rounded bg-[#7993AC] border border-[#22324B]/20 border-t-2 border-t-[#FAF6EE] space-y-1.5">
              <h3 className="font-display text-sm font-semibold text-[#FAF6EE]">
                Material Science &amp; Acoustics
              </h3>
              <p className="text-xs text-[#F4EDE1] leading-relaxed">
                Explore high-phosphorus rust-resistant iron forging at Mehrauli, mortar-free
                granite vaulting at Thanjavur, and tuned musical colonnades at Hampi.
              </p>
            </div>
            <div className="p-4 rounded bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#7993AC] space-y-1.5">
              <h3 className="font-display text-sm font-semibold text-[var(--vh-ink)]">
                Pluralism &amp; Philology
              </h3>
              <p className="text-xs text-[var(--vh-ink-muted)] leading-relaxed">
                Trace parallels between Ashoka’s Samavaya speech-restraint edicts, Akbar’s
                Sulh-i-Kul philosophical dialogues, and Shivaji’s Sanskrit-Marathi lexicon.
              </p>
            </div>
            <div className="p-4 rounded bg-[#22324B] border border-[#B58A45]/65 space-y-1.5">
              <h3 className="font-display text-sm font-semibold text-[#F4EDE1]">
                Living Manuscript Lineages
              </h3>
              <p className="text-xs text-[#DCC8AD] leading-relaxed">
                Follow how fragile talapatra manuscripts like the Aryabhatiya survived monsoons
                through unbroken chains of scholarly copyists across Kerala and Tamil Nadu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Research Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
              Methodology
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] mt-1">
              Three Pillars of Historical Inquiry
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-[3px] border-t-[#B58A45] rounded p-6 flex flex-col justify-between shadow-xs">
            <div>
              <span className="font-mono text-xs text-[var(--vh-gold-ink)]">
                01. Epigraphy &amp; Manuscripts
              </span>
              <h3 className="font-display text-xl font-semibold text-[var(--vh-ink)] mt-2">
                Side-by-Side Monograph Reader
              </h3>
              <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed mt-3">
                Inspect high-resolution plates with zoom controls alongside Devanagari, Tamil,
                Prakrit, and Persian excerpts, IAST transliteration, and multilingual translations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
            >
              <span>Browse {entries.length} Primary Sources</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/55 border-t-[3px] border-t-[#7993AC] rounded p-6 flex flex-col justify-between shadow-xs">
            <div>
              <span className="font-mono text-xs text-[var(--vh-blue-ink)] font-semibold">
                02. Spatial Chronology
              </span>
              <h3 className="font-display text-xl font-semibold text-[var(--vh-ink)] mt-2">
                Interactive Time Map &amp; Polities
              </h3>
              <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed mt-3">
                Scrub across two millennia of South Asian territorial boundaries on an interactive
                Leaflet map linked to twenty documented archaeological and civic milestones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('timemap')}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vh-ink)] hover:text-[#B58A45] hover:underline cursor-pointer"
            >
              <span>Explore Spatial Timeline</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#7993AC]" />
            </button>
          </div>

          <div className="bg-[#22324B] border border-[#B58A45]/55 border-t-[3px] border-t-[#DCC8AD] rounded p-6 flex flex-col justify-between shadow-sm">
            <div>
              <span className="font-mono text-xs text-[#DCC8AD]">
                03. Relational Synthesis
              </span>
              <h3 className="font-display text-xl font-semibold text-[#F4EDE1] mt-2">
                Force-Directed Knowledge Graph
              </h3>
              <p className="text-sm text-[#DCC8AD] leading-relaxed mt-3">
                Trace how scripts, rulers, monuments, and ethical concepts like Dhamma and
                Sulh-i-Kul connect across eras through an interactive D3 network.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('graph')}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B58A45] hover:text-[#F4EDE1] hover:underline cursor-pointer"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Inspect Knowledge Graph</span>
            </button>
          </div>
        </div>
      </section>

      {/* Six Imperial & Regional Polities Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
              Dynastic Polities
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] mt-1">
              Six Foundational Eras of Statecraft
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('dynasties')}
            className="text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline whitespace-nowrap cursor-pointer"
          >
            Compare All Dynasties
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dynasties.map((d, idx) => {
            const topRule =
              idx % 3 === 0 ? '#B58A45' : idx % 3 === 1 ? '#7993AC' : '#22324B';
            const cardTone =
              idx % 3 === 0
                ? 'bg-[var(--vh-surface)]'
                : idx % 3 === 1
                ? 'bg-[var(--vh-french-blue-soft)]'
                : 'bg-[var(--vh-surface-alt)]';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpenDynasty(d.id)}
                style={{ borderTopColor: topRule }}
                className={`text-left ${cardTone} border border-[var(--vh-border)] border-t-[3px] rounded p-5 hover:border-[#B58A45] transition-colors flex flex-col justify-between cursor-pointer`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                    <span className="text-[var(--vh-gold-ink)] font-medium">{d.period}</span>
                    <span className="text-[var(--vh-blue-ink)] truncate">
                      {d.capital.split('(')[0].trim()}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-[var(--vh-ink)] mt-2">
                    {d.name}
                  </h3>
                  <p className="text-xs text-[var(--vh-ink-muted)] leading-relaxed mt-2 line-clamp-3">
                    {d.overview}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--vh-border)] text-xs font-semibold text-[var(--vh-ink)] inline-flex items-center gap-1">
                  <span>Explore Polity Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B58A45]" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Exhibition Entries */}
      {leadEntry && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
                Exhibition Catalogue
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] mt-1">
                Featured Archival Monographs
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline whitespace-nowrap cursor-pointer"
            >
              View Full Catalog
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded overflow-hidden mb-8 shadow-sm">
            <div className="lg:col-span-5 h-64 lg:h-auto min-h-[260px] bg-[var(--vh-surface-alt)]">
              <ArchivalImage
                src={leadEntry.imageUrl}
                alt={leadEntry.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
                  <span className="font-mono text-[var(--vh-gold-ink)] font-medium">
                    {leadEntry.accessionNo}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--vh-ink)] font-semibold">{leadEntry.dynastyName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{leadEntry.displayDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--vh-blue-ink)] font-medium">{leadEntry.category}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold text-[var(--vh-ink)] mt-3">
                  {leadEntry.title}
                </h3>
                <p className="text-sm text-[var(--vh-ink-muted)] mt-1">{leadEntry.subtitle}</p>
                <p className="text-sm text-[var(--vh-ink)]/90 leading-relaxed mt-4 max-w-2xl">
                  {leadEntry.summary}
                </p>
                <blockquote className="mt-5 pt-4 border-t border-[var(--vh-border)] text-sm italic text-[var(--vh-ink-muted)]">
                  “{leadEntry.englishTranslation}”
                </blockquote>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenEntry(leadEntry.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] transition-colors cursor-pointer"
                >
                  <span>Open Monograph</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDynasty(leadEntry.dynastyId)}
                  className="text-xs font-semibold text-[var(--vh-gold-ink)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                >
                  Explore {leadEntry.dynastyName}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredEntries.map((entry, idx) => {
              const topAccent = idx === 1 ? 'border-t-[#7993AC]' : 'border-t-[#B58A45]';
              return (
                <article
                  key={entry.id}
                  className={`bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 ${topAccent} rounded overflow-hidden flex flex-col justify-between hover:border-[#B58A45] transition-colors`}
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
                        <span>{entry.displayDate}</span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-[var(--vh-ink)] mt-2 leading-snug">
                        {entry.title}
                      </h3>
                      <p className="text-xs text-[var(--vh-ink-muted)] mt-2 line-clamp-3 leading-relaxed">
                        {entry.summary}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenEntry(entry.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vh-ink)] hover:text-[#B58A45] hover:underline cursor-pointer"
                    >
                      <span>Read Folio</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#B58A45]" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Lexicon & Pronunciation Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
                Philological Glossary
              </p>
              <h2 className="font-display text-2xl font-semibold text-[var(--vh-ink)] mt-1">
                Archival Key Terms &amp; Pronunciation
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lexicon')}
              className="text-xs font-semibold text-[var(--vh-ink)] hover:text-[#B58A45] hover:underline cursor-pointer"
            >
              Open Full Pronunciation Lab
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {lexicon.slice(0, 3).map((item, idx) => (
              <div
                key={item.id}
                className={`bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 ${
                  idx === 1 ? 'border-t-[#7993AC]' : 'border-t-[#B58A45]'
                } rounded p-5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
                      {item.term}
                    </h3>
                    <p className="text-sm text-[var(--vh-gold-ink)] mt-0.5">{item.scriptText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(item.term, 'en-IN', 0.8)}
                    className="w-9 h-9 inline-flex items-center justify-center rounded border border-[var(--vh-border-strong)] bg-[var(--vh-french-blue-soft)] text-[var(--vh-ink)] hover:bg-[#B58A45] hover:text-[#FAF6EE] cursor-pointer transition-colors"
                    aria-label={`Pronounce ${item.term}`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 font-mono text-xs text-[var(--vh-blue-ink)] tabular-nums">
                  {item.ipa} · {item.syllables.join(' · ')}
                </div>
                <p className="text-xs text-[var(--vh-ink-muted)] leading-relaxed mt-3">
                  {item.meaning}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
