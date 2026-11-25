import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  createArchiveEntry,
  createGraphEdge,
  createGraphNode,
  deleteArchiveEntry,
  deleteGraphEdge,
  deleteGraphNode,
  testSemanticEmbeddings,
  updateArchiveEntry,
} from '../lib/api';
import type {
  ArchiveEntry,
  Dynasty,
  EntryCategory,
  GraphEdge,
  GraphNode,
  GraphNodeType,
} from '../types';

interface AdminPageProps {
  entries: ArchiveEntry[];
  dynasties: Dynasty[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onRefreshData: () => Promise<void>;
}

export function AdminPage({
  entries,
  dynasties,
  graphNodes,
  graphEdges,
  onRefreshData,
}: AdminPageProps) {
  const [tab, setTab] = useState<'entries' | 'graph' | 'embeddings'>('entries');

  // Archive entry form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<EntryCategory>('Inscription');
  const [dynastyId, setDynastyId] = useState(dynasties[0]?.id || 'maurya');
  const [displayDate, setDisplayDate] = useState('c. 1010 CE');
  const [script, setScript] = useState('Tamil & Grantha');
  const [summary, setSummary] = useState('');
  const [englishTranslation, setEnglishTranslation] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Graph node & edge form state
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<GraphNodeType>('Monument');
  const [nodeEra, setNodeEra] = useState('11th c. CE');
  const [nodeDesc, setNodeDesc] = useState('');

  const [edgeSource, setEdgeSource] = useState(graphNodes[0]?.id || '');
  const [edgeTarget, setEdgeTarget] = useState(graphNodes[1]?.id || '');
  const [edgeRelation, setEdgeRelation] = useState('patronized');

  // Embeddings tester state
  const [embedQuery, setEmbedQuery] = useState(
    'village assembly lottery elections and anti-corruption accountability'
  );
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [embedResult, setEmbedResult] = useState<{
    model: string;
    dimensions: number;
    previewVector: number[];
    matches: Array<{
      entryId: string;
      accessionNo: string;
      title: string;
      dynastyName: string;
      score: number;
    }>;
  } | null>(null);

  const resetEntryForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setCategory('Inscription');
    setDynastyId(dynasties[0]?.id || 'maurya');
    setDisplayDate('c. 1010 CE');
    setScript('Grantha');
    setSummary('');
    setEnglishTranslation('');
  };

  const handleEditEntry = (entry: ArchiveEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setSubtitle(entry.subtitle);
    setCategory(entry.category);
    setDynastyId(entry.dynastyId);
    setDisplayDate(entry.displayDate);
    setScript(entry.script);
    setSummary(entry.summary);
    setEnglishTranslation(entry.englishTranslation);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSavingEntry(true);
    try {
      const payload: Partial<ArchiveEntry> = {
        title: title.trim(),
        subtitle: subtitle.trim() || 'Archival Monograph',
        category,
        dynastyId,
        displayDate,
        script,
        summary,
        englishTranslation,
      };
      if (editingId) {
        await updateArchiveEntry(editingId, payload);
      } else {
        await createArchiveEntry(payload);
      }
      await onRefreshData();
      resetEntryForm();
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteArchiveEntry(id);
    await onRefreshData();
  };

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeLabel.trim()) return;
    await createGraphNode({
      label: nodeLabel.trim(),
      type: nodeType,
      era: nodeEra.trim(),
      description: nodeDesc.trim(),
    });
    setNodeLabel('');
    setNodeDesc('');
    await onRefreshData();
  };

  const handleAddEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeSource || !edgeTarget || !edgeRelation.trim()) return;
    await createGraphEdge({
      source: edgeSource,
      target: edgeTarget,
      relation: edgeRelation.trim(),
    });
    await onRefreshData();
  };

  const handleRunEmbeddings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!embedQuery.trim()) return;
    setEmbedLoading(true);
    setEmbedError(null);
    try {
      const result = await testSemanticEmbeddings(embedQuery.trim());
      setEmbedResult(result);
    } catch (error) {
      setEmbedError(error instanceof Error ? error.message : 'Failed to test embeddings.');
    } finally {
      setEmbedLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-[var(--vh-border-strong)] pb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Curatorial Management Console
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--vh-ink)] mt-1">
          Archive &amp; Knowledge Graph CMS
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-2">
          Manage primary monographs, update knowledge graph relationships, and benchmark Gemini
          vector embeddings.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('entries')}
          className={`px-4 py-2 text-xs font-medium rounded cursor-pointer border transition-colors ${
            tab === 'entries'
              ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
              : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:border-[#B58A45]'
          }`}
        >
          Archive Entries ({entries.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('graph')}
          className={`px-4 py-2 text-xs font-medium rounded cursor-pointer border transition-colors ${
            tab === 'graph'
              ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
              : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:border-[#B58A45]'
          }`}
        >
          Knowledge Graph ({graphNodes.length} Nodes · {graphEdges.length} Edges)
        </button>
        <button
          type="button"
          onClick={() => setTab('embeddings')}
          className={`px-4 py-2 text-xs font-medium rounded cursor-pointer border transition-colors ${
            tab === 'embeddings'
              ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
              : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:border-[#B58A45]'
          }`}
        >
          Test Embeddings
        </button>
      </div>

      {tab === 'entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSaveEntry}
            className="lg:col-span-5 bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
              {editingId ? 'Edit Archive Monograph' : 'Add New Archive Monograph'}
            </h2>
            <div>
              <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)] focus:outline-none focus:border-[#B58A45]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)] focus:outline-none focus:border-[#B58A45]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EntryCategory)}
                  className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                >
                  <option value="Manuscript">Manuscript</option>
                  <option value="Inscription">Inscription</option>
                  <option value="Monument">Monument</option>
                  <option value="Treatise">Treatise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Dynasty</label>
                <select
                  value={dynastyId}
                  onChange={(e) => setDynastyId(e.target.value)}
                  className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                >
                  {dynasties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Display Date</label>
                <input
                  type="text"
                  value={displayDate}
                  onChange={(e) => setDisplayDate(e.target.value)}
                  className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Script</label>
                <input
                  type="text"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">Summary</label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--vh-ink-muted)] mb-1">
                English Translation Excerpt
              </label>
              <textarea
                rows={2}
                value={englishTranslation}
                onChange={(e) => setEnglishTranslation(e.target.value)}
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={savingEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingId ? 'Save Changes' : 'Create Entry'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetEntryForm}
                  className="px-3 py-2 text-xs font-medium border border-[var(--vh-border)] rounded text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)] cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#22324B] border-b border-[#B58A45]/45 text-xs font-medium text-[#DCC8AD]">
                  <th className="py-3 px-4">Accession</th>
                  <th className="py-3 px-4">Monograph</th>
                  <th className="py-3 px-4">Dynasty</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vh-border)] text-xs">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--vh-row-hover)]">
                    <td className="py-3 px-4 font-mono text-[var(--vh-gold-ink)] tabular-nums">
                      {entry.accessionNo}
                    </td>
                    <td className="py-3 px-4 font-medium text-[var(--vh-ink)]">{entry.title}</td>
                    <td className="py-3 px-4 text-[var(--vh-blue-ink)]">{entry.dynastyName}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                      <button
                        type="button"
                        onClick={() => handleEditEntry(entry)}
                        className="text-[var(--vh-gold-ink)] font-semibold hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-[var(--vh-ink-muted)] hover:text-[var(--vh-ink)] hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleAddNode}
              className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded p-6 space-y-3 shadow-sm"
            >
              <h2 className="font-display text-base font-semibold text-[var(--vh-ink)]">
                Add Graph Node
              </h2>
              <input
                type="text"
                required
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder="Node label (e.g., Nalanda Mahavihara)"
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value as GraphNodeType)}
                  className="bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                >
                  <option value="Dynasty">Dynasty</option>
                  <option value="Ruler">Ruler</option>
                  <option value="Monument">Monument</option>
                  <option value="Manuscript">Manuscript</option>
                  <option value="Script">Script</option>
                  <option value="Concept">Concept</option>
                </select>
                <input
                  type="text"
                  value={nodeEra}
                  onChange={(e) => setNodeEra(e.target.value)}
                  placeholder="Era"
                  className="bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
                />
              </div>
              <textarea
                rows={2}
                value={nodeDesc}
                onChange={(e) => setNodeDesc(e.target.value)}
                placeholder="Brief historical description..."
                className="w-full bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
              >
                Create Node
              </button>
            </form>

            <form
              onSubmit={handleAddEdge}
              className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/50 rounded p-6 space-y-3 shadow-sm"
            >
              <h2 className="font-display text-base font-semibold text-[var(--vh-ink)]">
                Connect Nodes (Edge)
              </h2>
              <select
                value={edgeSource}
                onChange={(e) => setEdgeSource(e.target.value)}
                className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
              >
                {graphNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    Source: {n.label} ({n.type})
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={edgeRelation}
                onChange={(e) => setEdgeRelation(e.target.value)}
                placeholder="Relation (e.g., patronized, inscribed_in)"
                className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
              />
              <select
                value={edgeTarget}
                onChange={(e) => setEdgeTarget(e.target.value)}
                className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-xs text-[var(--vh-ink)]"
              >
                {graphNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    Target: {n.label} ({n.type})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-[#B58A45] text-[#FAF6EE] text-xs font-semibold rounded hover:bg-[#7993AC] cursor-pointer transition-colors"
              >
                Create Edge
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded p-5 space-y-6 shadow-sm">
            <div>
              <h3 className="font-display text-base font-semibold text-[var(--vh-ink)] mb-3">
                Graph Nodes ({graphNodes.length})
              </h3>
              <div className="max-h-64 overflow-y-auto divide-y divide-[var(--vh-border)] border border-[var(--vh-border)] rounded bg-[var(--vh-input-alt)]">
                {graphNodes.map((n) => (
                  <div key={n.id} className="px-3 py-2 flex items-center justify-between text-xs">
                    <span>
                      <span className="font-medium text-[var(--vh-ink)]">{n.label}</span>{' '}
                      <span className="text-[var(--vh-gold-ink)]">· {n.type}</span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteGraphNode(n.id);
                        await onRefreshData();
                      }}
                      className="text-[var(--vh-ink-muted)] hover:text-[#B58A45] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-semibold text-[var(--vh-ink)] mb-3">
                Labeled Edges ({graphEdges.length})
              </h3>
              <div className="max-h-64 overflow-y-auto divide-y divide-[var(--vh-border)] border border-[var(--vh-border)] rounded bg-[var(--vh-input-alt)]">
                {graphEdges.map((edge) => {
                  const s = graphNodes.find((n) => n.id === edge.source)?.label || edge.source;
                  const t = graphNodes.find((n) => n.id === edge.target)?.label || edge.target;
                  return (
                    <div key={edge.id} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--vh-ink)]">
                        {s}{' '}
                        <span className="font-mono text-[var(--vh-gold-ink)]">
                          —[{edge.relation}]→
                        </span>{' '}
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteGraphEdge(edge.id);
                          await onRefreshData();
                        }}
                        className="text-[var(--vh-ink-muted)] hover:text-[#B58A45] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'embeddings' && (
        <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#7993AC] rounded p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--vh-ink)]">
              Gemini Vector Embedding &amp; Cosine Similarity Benchmark
            </h2>
            <p className="text-xs text-[var(--vh-ink-muted)] mt-1">
              Calls{' '}
              <span className="font-mono text-[var(--vh-gold-ink)] font-semibold">
                gemini-embedding-2
              </span>{' '}
              server-side to embed your query and rank primary archival monographs by cosine
              similarity.
            </p>
          </div>

          <form onSubmit={handleRunEmbeddings} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={embedQuery}
              onChange={(e) => setEmbedQuery(e.target.value)}
              className="flex-1 bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded px-3.5 py-2.5 text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
              placeholder="Enter an archival concept or research query..."
            />
            <button
              type="submit"
              disabled={embedLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
            >
              {embedLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Generate &amp; Rank Embeddings</span>
            </button>
          </form>

          {embedError && (
            <div className="p-4 bg-[var(--vh-champagne-soft)] border border-[#B58A45] rounded text-xs text-[var(--vh-ink)]">
              {embedError}
            </div>
          )}

          {embedResult && (
            <div className="space-y-4">
              <div className="p-4 bg-[var(--vh-input-alt)] border border-[var(--vh-border)] rounded text-xs font-mono text-[var(--vh-ink-muted)] space-y-1">
                <div>
                  Model: <span className="text-[var(--vh-ink)] font-semibold">{embedResult.model}</span> ·
                  Vector Dimensions:{' '}
                  <span className="text-[var(--vh-gold-ink)] font-semibold tabular-nums">
                    {embedResult.dimensions}
                  </span>
                </div>
                <div className="truncate">
                  Head Vector: [{embedResult.previewVector.map((v) => v.toFixed(4)).join(', ')}, ...]
                </div>
              </div>

              <div className="border border-[var(--vh-border)] rounded overflow-hidden bg-[var(--vh-surface)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#22324B] border-b border-[#B58A45]/45 text-[#DCC8AD]">
                      <th className="py-2.5 px-4">Accession</th>
                      <th className="py-2.5 px-4">Monograph</th>
                      <th className="py-2.5 px-4">Dynasty</th>
                      <th className="py-2.5 px-4 text-right">Similarity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--vh-border)]">
                    {embedResult.matches.map((m) => (
                      <tr key={m.entryId} className="hover:bg-[var(--vh-row-hover)]">
                        <td className="py-2.5 px-4 font-mono text-[var(--vh-gold-ink)]">
                          {m.accessionNo}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-[var(--vh-ink)]">{m.title}</td>
                        <td className="py-2.5 px-4 text-[var(--vh-blue-ink)]">{m.dynastyName}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[var(--vh-gold-ink)] font-semibold">
                          {m.score.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
