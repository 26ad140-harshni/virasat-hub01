import { useState } from 'react';
import { Menu, Mic, Moon, Sun, X } from 'lucide-react';

export type PageRoute =
  | 'home'
  | 'archive'
  | 'entry'
  | 'dynasties'
  | 'timemap'
  | 'stories'
  | 'graph'
  | 'research'
  | 'admin'
  | 'lexicon';

export type ColorMode = 'light' | 'dark';

interface HeaderProps {
  currentPage: PageRoute;
  colorMode: ColorMode;
  onToggleColorMode: (mode: ColorMode) => void;
  onNavigate: (page: PageRoute) => void;
  onStartVoiceSearch?: () => void;
}

const PRIMARY_NAV: Array<{ id: PageRoute; label: string }> = [
  { id: 'archive', label: 'Archive' },
  { id: 'dynasties', label: 'Dynasties' },
  { id: 'timemap', label: 'Time Map' },
  { id: 'stories', label: 'Stories' },
  { id: 'graph', label: 'Graph' },
];

export function Header({
  currentPage,
  colorMode,
  onToggleColorMode,
  onNavigate,
  onStartVoiceSearch,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageRoute) => {
    setMobileOpen(false);
    onNavigate(page);
  };

  return (
    <header
      style={{ background: 'var(--vh-header-bg)' }}
      className="sticky top-0 z-40 backdrop-blur-sm border-b border-[var(--vh-border-strong)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-display text-lg sm:text-xl font-semibold tracking-wider text-[var(--vh-ink)] hover:text-[#B58A45] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B58A45]"
        >
          Virasat Hub
        </button>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-7" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => {
            const active =
              currentPage === item.id || (item.id === 'archive' && currentPage === 'entry');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`text-sm font-medium tracking-wide transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B58A45] ${
                  active
                    ? 'border-[#B58A45] text-[var(--vh-ink)]'
                    : 'border-transparent text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)] hover:border-[#7993AC]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Light/Dark Switch + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Color theme mode"
            className="inline-flex items-center p-0.5 rounded border border-[var(--vh-border-strong)] bg-[var(--vh-surface)]"
          >
            <button
              type="button"
              onClick={() => onToggleColorMode('light')}
              aria-pressed={colorMode === 'light'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                colorMode === 'light'
                  ? 'bg-[#B58A45] text-[#FAF6EE]'
                  : 'text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)]'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span className="hidden sm:inline">Light</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleColorMode('dark')}
              aria-pressed={colorMode === 'dark'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                colorMode === 'dark'
                  ? 'bg-[#7993AC] text-[#FAF6EE]'
                  : 'text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)]'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span className="hidden sm:inline">Dark</span>
            </button>
          </div>

          {onStartVoiceSearch && (
            <button
              type="button"
              onClick={onStartVoiceSearch}
              title="Search archive with your voice"
              aria-label="Voice search archive"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded border border-[var(--vh-border-strong)] bg-[var(--vh-surface)] text-[var(--vh-ink)] hover:border-[#B58A45] hover:text-[#B58A45] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Mic className="w-3.5 h-3.5 text-[#B58A45]" />
              <span className="hidden lg:inline">Voice Search</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNav('research')}
            className={`hidden md:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B58A45] ${
              currentPage === 'research'
                ? 'bg-[#B58A45] text-[#162235]'
                : 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)]'
            }`}
          >
            Research Space
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded border border-[var(--vh-border-strong)] bg-[var(--vh-surface)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--vh-border)] bg-[var(--vh-canvas)] px-4 py-4 space-y-1">
          {PRIMARY_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full text-left px-3 py-3 text-sm font-medium rounded min-h-[44px] flex items-center cursor-pointer ${
                currentPage === item.id
                  ? 'bg-[#B58A45] text-[#FAF6EE] font-semibold'
                  : 'text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNav('lexicon')}
            className="w-full text-left px-3 py-3 text-sm font-medium rounded min-h-[44px] flex items-center text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
          >
            Pronunciation Lexicon
          </button>
          <button
            type="button"
            onClick={() => handleNav('research')}
            className="w-full text-left px-3 py-3 text-sm font-medium rounded min-h-[44px] flex items-center text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
          >
            Research Space
          </button>
          <button
            type="button"
            onClick={() => handleNav('admin')}
            className="w-full text-left px-3 py-3 text-sm font-medium rounded min-h-[44px] flex items-center text-[var(--vh-ink-muted)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
          >
            Admin CMS
          </button>
        </div>
      )}
    </header>
  );
}
