import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, MessageSquareText, ShieldCheck, Volume2 } from 'lucide-react';
import { MandalaCrest } from './components/ArchivalOrnaments';
import { ChatbotDrawer } from './components/ChatbotDrawer';
import { Header, type ColorMode, type PageRoute } from './components/Header';
import { ScholarAuthModal } from './components/ScholarAuthModal';
import { fetchDataset, loadScholarSession, saveScholarSession } from './lib/api';
import { playSoftArchivalChime } from './lib/scholarUtils';
import { AdminPage } from './pages/AdminPage';
import { ArchivePage } from './pages/ArchivePage';
import { DynastiesPage } from './pages/DynastiesPage';
import { EntryPage } from './pages/EntryPage';
import { GraphPage } from './pages/GraphPage';
import { HomePage } from './pages/HomePage';
import { LexiconPage } from './pages/LexiconPage';
import { ResearchSpacePage } from './pages/ResearchSpacePage';
import { StoriesPage } from './pages/StoriesPage';
import { TimeMapPage } from './pages/TimeMapPage';
import type { ScholarUser, VirasatDataset } from './types';

function loadInitialColorMode(): ColorMode {
  try {
    const saved = window.localStorage.getItem('virasat_color_mode');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore storage access issues
  }
  return 'light';
}

export default function App() {
  const [dataset, setDataset] = useState<VirasatDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<PageRoute>('home');
  const [colorMode, setColorMode] = useState<ColorMode>(loadInitialColorMode);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('ent-01');
  const [selectedDynastyId, setSelectedDynastyId] = useState<string>('maurya');
  const [pendingSaveEntryId, setPendingSaveEntryId] = useState<string | null>(null);
  const [scholar, setScholar] = useState<ScholarUser | null>(() => loadScholarSession());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState<string>('');
  const [archiveVoiceTrigger, setArchiveVoiceTrigger] = useState<number>(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
    try {
      window.localStorage.setItem('virasat_color_mode', colorMode);
    } catch {
      // ignore storage access issues
    }
  }, [colorMode]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const loadAllData = useCallback(async () => {
    const data = await fetchDataset();
    setDataset(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const navigateTo = (page: PageRoute) => {
    setRoute(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
    navigateTo('entry');
  };

  const openDynasty = (dynastyId: string) => {
    setSelectedDynastyId(dynastyId);
    navigateTo('dynasties');
  };

  const handleSaveToResearchSpace = (entryId: string) => {
    setPendingSaveEntryId(entryId);
    if (!scholar) {
      setAuthModalOpen(true);
      showToast('Sign in to save monographs to your Research Space.');
    } else {
      navigateTo('research');
      showToast('Select a folder to store this monograph.');
    }
  };

  const handleSignIn = (user: ScholarUser) => {
    setScholar(user);
    saveScholarSession(user);
    playSoftArchivalChime();
    showToast(`Welcome, ${user.name}.`);
  };

  const handleSignOut = () => {
    setScholar(null);
    saveScholarSession(null);
    showToast('Signed out of Scholar Workspace.');
  };

  const activeEntry =
    dataset?.entries.find((e) => e.id === selectedEntryId) || dataset?.entries[0];

  return (
    <div
      className={`min-h-screen flex flex-col archival-paper royal-page-${route} text-[var(--vh-ink)] transition-colors duration-200`}
    >
      <div className="royal-spectrum-bar" />
      <Header
        currentPage={route}
        colorMode={colorMode}
        onToggleColorMode={setColorMode}
        onNavigate={navigateTo}
        onStartVoiceSearch={() => {
          navigateTo('archive');
          setArchiveVoiceTrigger((n) => n + 1);
        }}
      />

      {/* Operational Utility Ribbon */}
      <div
        style={{ background: 'var(--vh-ribbon-bg)' }}
        className="border-b border-[var(--vh-border)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--vh-ink-muted)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--vh-ink)]">
              Curated South Asian Heritage Archive
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-[var(--vh-gold-ink)] font-medium">
              {dataset ? `${dataset.entries.length} Primary Sources` : 'Loading catalog'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--vh-blue-ink)] font-medium">
              Open Curatorial Reading Room
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('lexicon')}
              className="inline-flex items-center gap-1 text-[var(--vh-ink)] hover:text-[#B58A45] font-medium cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#B58A45]" />
              <span>Pronunciation Lexicon</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="inline-flex items-center gap-1 text-[var(--vh-ink)] hover:text-[#B58A45] font-medium cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#7993AC]" />
              <span>Admin CMS</span>
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-[var(--vh-ink)] hover:text-[#B58A45] hover:underline cursor-pointer whitespace-nowrap"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-[#B58A45]" />
              <span>Research Assistant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {loading || !dataset ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3 text-sm text-[var(--vh-ink-muted)]">
            <Loader2 className="w-6 h-6 animate-spin text-[#B58A45]" />
            <span>Opening archival vault...</span>
          </div>
        ) : (
          <>
            {route === 'home' && (
              <HomePage
                entries={dataset.entries}
                dynasties={dataset.dynasties}
                eventsCount={dataset.events.length}
                lexicon={dataset.lexicon}
                onNavigate={navigateTo}
                onOpenEntry={openEntry}
                onOpenDynasty={openDynasty}
                onOpenChatbot={() => setChatOpen(true)}
                onSearchArchive={(q) => {
                  setArchiveSearchQuery(q);
                  navigateTo('archive');
                }}
              />
            )}
            {route === 'archive' && (
              <ArchivePage
                entries={dataset.entries}
                dynasties={dataset.dynasties}
                initialQuery={archiveSearchQuery}
                autoVoiceTrigger={archiveVoiceTrigger}
                onConsumeVoiceTrigger={() => setArchiveVoiceTrigger(0)}
                onOpenEntry={openEntry}
              />
            )}
            {route === 'entry' && activeEntry && (
              <EntryPage
                entry={activeEntry}
                lexicon={dataset.lexicon}
                onBack={() => navigateTo('archive')}
                onSaveToResearchSpace={handleSaveToResearchSpace}
              />
            )}
            {route === 'dynasties' && (
              <DynastiesPage
                dynasties={dataset.dynasties}
                entries={dataset.entries}
                initialDynastyId={selectedDynastyId}
                onOpenEntry={openEntry}
              />
            )}
            {route === 'timemap' && (
              <TimeMapPage
                dynasties={dataset.dynasties}
                events={dataset.events}
                colorMode={colorMode}
                onOpenEntry={openEntry}
                onOpenDynasty={openDynasty}
              />
            )}
            {route === 'stories' && (
              <StoriesPage stories={dataset.stories} onOpenEntry={openEntry} />
            )}
            {route === 'graph' && (
              <GraphPage
                nodes={dataset.graphNodes}
                edges={dataset.graphEdges}
                colorMode={colorMode}
                onOpenEntry={openEntry}
                onOpenDynasty={openDynasty}
              />
            )}
            {route === 'lexicon' && (
              <LexiconPage lexicon={dataset.lexicon} onOpenEntry={openEntry} />
            )}
            {route === 'research' && (
              <ResearchSpacePage
                scholar={scholar}
                entries={dataset.entries}
                colorMode={colorMode}
                onOpenAuth={() => setAuthModalOpen(true)}
                onSignOut={handleSignOut}
                onOpenEntry={openEntry}
                pendingEntryId={pendingSaveEntryId}
                onClearPendingEntry={() => setPendingSaveEntryId(null)}
              />
            )}
            {route === 'admin' && (
              <AdminPage
                entries={dataset.entries}
                dynasties={dataset.dynasties}
                graphNodes={dataset.graphNodes}
                graphEdges={dataset.graphEdges}
                onRefreshData={loadAllData}
              />
            )}
          </>
        )}
      </main>

      {/* Navy Anchor Footer */}
      <footer
        style={{ backgroundColor: 'var(--vh-footer-bg)' }}
        className="border-t-2 border-[#B58A45] text-[#F4EDE1] mt-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MandalaCrest className="w-8 h-8" />
            <div>
              <div className="font-display text-base font-semibold text-[#F4EDE1]">
                Virasat Hub
              </div>
              <p className="text-xs text-[#DCC8AD]">
                Digital South Asian Epigraphy, Manuscripts &amp; Spatial History Archive
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-[#DCC8AD]">
            <button type="button" onClick={() => navigateTo('archive')} className="hover:text-[#F4EDE1] cursor-pointer">
              Archive
            </button>
            <button type="button" onClick={() => navigateTo('dynasties')} className="hover:text-[#F4EDE1] cursor-pointer">
              Dynasties
            </button>
            <button type="button" onClick={() => navigateTo('timemap')} className="hover:text-[#F4EDE1] cursor-pointer">
              Time Map
            </button>
            <button type="button" onClick={() => navigateTo('stories')} className="hover:text-[#F4EDE1] cursor-pointer">
              Stories
            </button>
            <button type="button" onClick={() => navigateTo('graph')} className="hover:text-[#F4EDE1] cursor-pointer">
              Knowledge Graph
            </button>
            <button type="button" onClick={() => navigateTo('research')} className="hover:text-[#F4EDE1] cursor-pointer">
              Research Space
            </button>
            <button type="button" onClick={() => navigateTo('admin')} className="hover:text-[#F4EDE1] cursor-pointer">
              Admin CMS
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Research Assistant Trigger on Desktop */}
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-2.5 bg-[#22324B] text-[#F4EDE1] text-xs font-medium rounded shadow-lg border border-[#B58A45] hover:bg-[#B58A45] hover:text-[#162235] transition-colors cursor-pointer"
          aria-label="Open Archival Research Assistant"
        >
          <BookOpen className="w-4 h-4 text-current" />
          <span>Research Assistant</span>
        </button>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 bg-[#22324B] text-[#F4EDE1] text-xs px-4 py-2.5 rounded shadow-lg border border-[#B58A45]"
        >
          {toast}
        </div>
      )}

      <ChatbotDrawer
        open={chatOpen}
        colorMode={colorMode}
        onClose={() => setChatOpen(false)}
        onOpenEntry={openEntry}
      />

      <ScholarAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={handleSignIn}
      />
    </div>
  );
}
