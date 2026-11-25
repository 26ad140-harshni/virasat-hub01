import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FolderPlus,
  LogOut,
  Palette,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  createFolder,
  deleteFolder,
  fetchResearchSpace,
  removeSavedItem,
  saveItemToFolder,
  updateSavedItemNote,
} from '../lib/api';
import { formatCitationAPA, formatCitationChicago } from '../lib/scholarUtils';
import type {
  ArchiveEntry,
  ResearchFolder,
  SavedResearchItem,
  ScholarUser,
} from '../types';

interface ResearchSpacePageProps {
  scholar: ScholarUser | null;
  entries: ArchiveEntry[];
  colorMode?: 'light' | 'dark';
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenEntry: (entryId: string) => void;
  pendingEntryId?: string | null;
  onClearPendingEntry: () => void;
}

type RoyalTheme = 'oxblood' | 'peacock' | 'navy' | 'forest';

const ROYAL_THEME_CLASS: Record<RoyalTheme, string> = {
  oxblood: 'royal-theme-oxblood',
  peacock: 'royal-theme-peacock',
  navy: 'royal-theme-navy',
  forest: 'royal-theme-forest',
};

const ROYAL_THEMES: Array<{ id: RoyalTheme; label: string; swatch: string }> = [
  { id: 'oxblood', label: 'Ivory', swatch: '#F4EDE1' },
  { id: 'forest', label: 'Champagne', swatch: '#DCC8AD' },
  { id: 'peacock', label: 'French Blue', swatch: '#7993AC' },
  { id: 'navy', label: 'Navy', swatch: '#22324B' },
];

export function ResearchSpacePage({
  scholar,
  entries,
  colorMode = 'light',
  onOpenAuth,
  onSignOut,
  onOpenEntry,
  pendingEntryId,
  onClearPendingEntry,
}: ResearchSpacePageProps) {
  const [folders, setFolders] = useState<ResearchFolder[]>([]);
  const [items, setItems] = useState<SavedResearchItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [citationStyle, setCitationStyle] = useState<'apa' | 'chicago'>('apa');
  const [copiedAll, setCopiedAll] = useState(false);
  const [addEntryId, setAddEntryId] = useState(pendingEntryId || entries[0]?.id || '');
  const [royalTheme, setRoyalTheme] = useState<RoyalTheme>(colorMode === 'dark' ? 'navy' : 'oxblood');

  useEffect(() => {
    setRoyalTheme(colorMode === 'dark' ? 'navy' : 'oxblood');
  }, [colorMode]);

  useEffect(() => {
    if (!scholar) return;
    fetchResearchSpace(scholar)
      .then((space) => {
        setFolders(space.folders);
        setItems(space.items);
        if (space.folders.length > 0) {
          setActiveFolderId((prev) => prev || space.folders[0].id);
        }
      })
      .catch(console.error);
  }, [scholar]);

  useEffect(() => {
    if (pendingEntryId) {
      setAddEntryId(pendingEntryId);
    }
  }, [pendingEntryId]);

  if (!scholar) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-[var(--vh-surface)] border border-[var(--vh-border-strong)] border-t-[4px] border-t-[#B58A45] rounded p-8 sm:p-12 text-center space-y-6 shadow-md">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
            Scholar Authentication Required
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)]">
            My Research Space
          </h1>
          <p className="text-base text-[var(--vh-ink-muted)] leading-relaxed max-w-xl mx-auto">
            Sign in with your Scholar profile to organize archival monographs into topical folders,
            record field notes, and export bibliographies in APA or Chicago format.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] text-sm font-semibold rounded transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In to Research Space</span>
          </button>
        </div>
      </div>
    );
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId) || folders[0];
  const folderItems = items.filter((i) => i.folderId === activeFolder?.id);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const created = await createFolder(scholar, newFolderName.trim(), newFolderDesc.trim());
    setFolders((prev) => [...prev, created]);
    setActiveFolderId(created.id);
    setNewFolderName('');
    setNewFolderDesc('');
  };

  const handleDeleteFolder = async (folderId: string) => {
    await deleteFolder(scholar, folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setItems((prev) => prev.filter((i) => i.folderId !== folderId));
  };

  const handleAddEntryToFolder = async () => {
    if (!activeFolder || !addEntryId) return;
    const saved = await saveItemToFolder(scholar, activeFolder.id, addEntryId, '');
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev];
    });
    if (pendingEntryId) onClearPendingEntry();
  };

  const handleNoteChange = async (itemId: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, note } : i)));
    await updateSavedItemNote(scholar, itemId, note);
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeSavedItem(scholar, itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const formattedBibliography = folderItems
    .map((item) => {
      const entry = entries.find((e) => e.id === item.entryId);
      if (!entry) return '';
      return citationStyle === 'apa' ? formatCitationAPA(entry) : formatCitationChicago(entry);
    })
    .filter(Boolean)
    .join('\n\n');

  const copyBibliography = async () => {
    if (!formattedBibliography) return;
    await navigator.clipboard.writeText(formattedBibliography);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadBibliography = () => {
    if (!formattedBibliography || !activeFolder) return;
    const blob = new Blob(
      [`${activeFolder.name} — ${citationStyle.toUpperCase()} Citations\n\n${formattedBibliography}`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFolder.name.toLowerCase().replace(/\s+/g, '-')}-citations.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 ${ROYAL_THEME_CLASS[royalTheme]}`}>
      {/* Header Banner */}
      <div className="royal-workspace-header border border-[var(--royal-border)] rounded p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-md">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--royal-header-subtext)]">
            Scholar Workspace · {scholar.affiliation}
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--royal-header-text)] mt-1">
            {scholar.name}’s Research Space
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5 bg-black/20 p-1 rounded border border-[var(--royal-border)]"
            role="group"
            aria-label="Workspace Color Theme"
          >
            <Palette className="w-3.5 h-3.5 text-[var(--royal-header-subtext)] ml-1.5 mr-0.5" />
            {ROYAL_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRoyalTheme(t.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  royalTheme === t.id
                    ? 'bg-[#FAF6EE] text-[#22324B] font-semibold'
                    : 'text-[var(--royal-header-text)] hover:bg-white/15'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#B58A45]/70"
                  style={{ backgroundColor: t.swatch }}
                  aria-hidden="true"
                />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[var(--royal-border)] bg-black/20 text-[var(--royal-header-text)] rounded hover:bg-white/15 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Folders Column */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="royal-workspace-surface border rounded p-5 space-y-3 shadow-sm">
            <h2 className="font-display text-base font-semibold royal-text-primary">
              Research Folders ({folders.length})
            </h2>
            <div className="space-y-2">
              {folders.map((folder) => {
                const active = folder.id === activeFolder?.id;
                const count = items.filter((i) => i.folderId === folder.id).length;
                return (
                  <div
                    key={folder.id}
                    style={active ? { borderColor: 'var(--royal-primary)' } : undefined}
                    className={`flex items-center justify-between gap-2 p-3 rounded border transition-colors ${
                      active
                        ? 'royal-workspace-alt'
                        : 'bg-[var(--royal-canvas)] border-[var(--royal-border)] hover:opacity-90'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(folder.id)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <div className="text-sm font-medium text-[var(--royal-text)]">
                        {folder.name}
                      </div>
                      <div className="text-[11px] text-[var(--royal-text-muted)] tabular-nums">
                        {count} saved {count === 1 ? 'monograph' : 'monographs'}
                      </div>
                    </button>
                    {folders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1.5 text-[var(--royal-text-muted)] hover:text-[#B58A45] cursor-pointer"
                        aria-label={`Delete folder ${folder.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleCreateFolder}
            className="royal-workspace-alt border rounded p-5 space-y-3 shadow-sm"
          >
            <h3 className="text-xs font-medium royal-text-primary flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 royal-text-secondary" />
              <span>Create New Folder</span>
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder title (e.g., Maritime Trade)"
              className="w-full bg-[var(--royal-canvas)] border border-[var(--royal-border)] rounded px-3 py-2 text-xs text-[var(--royal-text)] placeholder:text-[var(--royal-text-muted)]/65 focus:outline-none focus:border-[var(--royal-primary)]"
            />
            <input
              type="text"
              value={newFolderDesc}
              onChange={(e) => setNewFolderDesc(e.target.value)}
              placeholder="Scope description (optional)"
              className="w-full bg-[var(--royal-canvas)] border border-[var(--royal-border)] rounded px-3 py-2 text-xs text-[var(--royal-text)] placeholder:text-[var(--royal-text-muted)]/65 focus:outline-none focus:border-[var(--royal-primary)]"
            />
            <button
              type="submit"
              className="royal-btn-primary w-full py-2 px-3 text-xs rounded cursor-pointer transition-colors"
            >
              Add Folder
            </button>
          </form>
        </aside>

        {/* Active Folder Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {activeFolder && (
            <>
              <div
                style={{ borderTopColor: 'var(--royal-primary)' }}
                className="royal-workspace-surface border border-t-[3px] rounded p-6 space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--royal-border)] pb-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-[var(--royal-text)]">
                      {activeFolder.name}
                    </h2>
                    {activeFolder.description && (
                      <p className="text-xs text-[var(--royal-text-muted)] mt-1">
                        {activeFolder.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={citationStyle}
                      onChange={(e) => setCitationStyle(e.target.value as 'apa' | 'chicago')}
                      aria-label="Citation export style"
                      className="royal-workspace-alt border rounded px-2.5 py-1.5 text-xs text-[var(--royal-text)]"
                    >
                      <option value="apa">APA 7th</option>
                      <option value="chicago">Chicago 17th</option>
                    </select>
                    <button
                      type="button"
                      onClick={copyBibliography}
                      disabled={folderItems.length === 0}
                      className="royal-workspace-alt inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded text-[var(--royal-text)] hover:opacity-90 disabled:opacity-45 cursor-pointer"
                    >
                      {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAll ? 'Copied' : 'Copy Citations'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadBibliography}
                      disabled={folderItems.length === 0}
                      className="royal-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded disabled:opacity-45 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export .txt</span>
                    </button>
                  </div>
                </div>

                {/* Add Entry to Active Folder */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={addEntryId}
                    onChange={(e) => setAddEntryId(e.target.value)}
                    aria-label="Select monograph to save"
                    className="flex-1 bg-[var(--royal-canvas)] border border-[var(--royal-border)] rounded px-3 py-2 text-xs text-[var(--royal-text)]"
                  >
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.accessionNo} — {entry.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddEntryToFolder}
                    className="royal-btn-secondary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded hover:opacity-90 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save to Folder</span>
                  </button>
                </div>
              </div>

              {/* Saved Items & Notes */}
              {folderItems.length === 0 ? (
                <div className="royal-workspace-surface border rounded p-10 text-center text-sm text-[var(--royal-text-muted)]">
                  No monographs saved in this folder yet. Choose an entry above or click “Save to
                  Research Space” while reading any monograph.
                </div>
              ) : (
                <div className="space-y-4">
                  {folderItems.map((item) => {
                    const entry = entries.find((e) => e.id === item.entryId);
                    if (!entry) return null;
                    return (
                      <div
                        key={item.id}
                        style={{ borderTopColor: 'var(--royal-primary)' }}
                        className="royal-workspace-surface border border-t-2 rounded p-5 space-y-3 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-mono royal-text-secondary">
                              {entry.accessionNo} · {entry.dynastyName} · {entry.displayDate}
                            </div>
                            <h3 className="font-display text-lg font-semibold text-[var(--royal-text)] mt-0.5">
                              {entry.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onOpenEntry(entry.id)}
                              className="royal-workspace-alt inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded royal-text-primary hover:opacity-90 cursor-pointer"
                            >
                              <span>Open</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-[var(--royal-text-muted)] hover:text-[#B58A45] cursor-pointer"
                              aria-label="Remove item from folder"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium royal-text-accent mb-1">
                            Scholar Field Notes
                          </label>
                          <textarea
                            rows={2}
                            value={item.note}
                            onChange={(e) => handleNoteChange(item.id, e.target.value)}
                            placeholder="Record epigraphic comparisons, paleographic observations, or thesis notes..."
                            className="w-full bg-[var(--royal-canvas)] border border-[var(--royal-border)] rounded px-3 py-2 text-xs text-[var(--royal-text)] placeholder:text-[var(--royal-text-muted)]/65 focus:outline-none focus:border-[var(--royal-primary)]"
                          />
                        </div>

                        <p className="text-[11px] text-[var(--royal-text-muted)] pt-2 border-t border-[var(--royal-border)]">
                          {citationStyle === 'apa'
                            ? formatCitationAPA(entry)
                            : formatCitationChicago(entry)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
