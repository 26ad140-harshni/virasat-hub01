import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ArrowRight, Loader2, Mic, MicOff, RotateCcw, Search } from 'lucide-react';
import { startVoiceCaptureSession, type VoiceCaptureHandle } from '../lib/scholarUtils';
import type { GraphEdge, GraphNode, GraphNodeType } from '../types';

interface GraphPageProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: 'light' | 'dark';
  onOpenEntry: (entryId: string) => void;
  onOpenDynasty: (dynastyId: string) => void;
}

const NODE_TYPES: Array<'All' | GraphNodeType> = [
  'All',
  'Dynasty',
  'Ruler',
  'Monument',
  'Manuscript',
  'Script',
  'Concept',
];

const TYPE_COLORS: Record<GraphNodeType, string> = {
  Dynasty: '#22324B',
  Ruler: '#B58A45',
  Monument: '#7993AC',
  Manuscript: '#8F6B2F',
  Script: '#DCC8AD',
  Concept: '#4A6580',
};

interface SimNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relation: string;
}

export function GraphPage({
  nodes,
  edges,
  colorMode,
  onOpenEntry,
  onOpenDynasty,
}: GraphPageProps) {
  const [typeFilter, setTypeFilter] = useState<'All' | GraphNodeType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const voiceRef = useRef<VoiceCaptureHandle | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    return () => voiceRef.current?.stop();
  }, []);

  const toggleGraphVoiceSearch = () => {
    if (voiceListening) {
      voiceRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    voiceRef.current = startVoiceCaptureSession({
      languageCode: 'auto',
      onStart: () => {
        setVoiceListening(true);
        setVoiceTranscribing(false);
      },
      onTranscribing: () => {
        setVoiceListening(false);
        setVoiceTranscribing(true);
      },
      onTranscript: (text) => setSearchQuery(text),
      onEnd: () => {
        setVoiceListening(false);
        setVoiceTranscribing(false);
      },
    });
  };

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes.filter((n) => {
      if (typeFilter !== 'All' && n.type !== typeFilter) return false;
      if (!q) return true;
      return (
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      );
    });
  }, [nodes, typeFilter, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () => edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [edges, filteredNodeIds]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || filteredNodes[0] || null;

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const isOutgoing = e.source === selectedNode.id;
        const otherId = isOutgoing ? e.target : e.source;
        const other = nodes.find((n) => n.id === otherId);
        return {
          id: e.id,
          relation: e.relation.replace(/_/g, ' '),
          direction: isOutgoing ? '→' : '←',
          other,
        };
      });
  }, [edges, nodes, selectedNode]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = svgEl.clientWidth || 860;
    const height = 560;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const container = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = filteredEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relation: e.relation.replace(/_/g, ' '),
      }));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(115)
      )
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(34));

    const isDark = colorMode === 'dark';

    const linkGroup = container
      .append('g')
      .attr('stroke', isDark ? '#7993AC' : '#7993AC')
      .attr('stroke-opacity', isDark ? 0.6 : 0.55)
      .attr('stroke-width', 1.5)
      .selectAll('line')
      .data(simLinks)
      .join('line');

    const linkLabels = container
      .append('g')
      .selectAll('text')
      .data(simLinks)
      .join('text')
      .text((d) => d.relation)
      .attr('font-size', '9px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', isDark ? '#DCC8AD' : '#534D41')
      .attr('text-anchor', 'middle');

    const nodeGroup = container
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        setSelectedNodeId(d.id);
      })
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroup
      .append('circle')
      .attr('r', (d) => (d.type === 'Dynasty' ? 16 : 11))
      .attr('fill', (d) =>
        d.type === 'Dynasty' && isDark ? '#F4EDE1' : TYPE_COLORS[d.type]
      )
      .attr('stroke', (d) =>
        d.id === selectedNodeId ? '#B58A45' : isDark ? '#7993AC' : '#FAF6EE'
      )
      .attr('stroke-width', (d) => (d.id === selectedNodeId ? 3.5 : 2));

    nodeGroup
      .append('text')
      .text((d) => d.label)
      .attr('dy', (d) => (d.type === 'Dynasty' ? 28 : 23))
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-family', 'Lora, serif')
      .attr('font-weight', (d) => (d.id === selectedNodeId ? '700' : '500'))
      .attr('fill', isDark ? '#F4EDE1' : '#22324B');

    simulation.on('tick', () => {
      linkGroup
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      linkLabels
        .attr('x', (d) => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2 - 4);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredEdges, selectedNodeId, colorMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-[var(--vh-border-strong)] pb-5">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Relational Epigraphy
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--vh-ink)] mt-1">
          Historical Knowledge Graph
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-1.5 max-w-2xl">
          Drag nodes, zoom with your trackpad, or filter entity types to trace intellectual and
          dynastic lineages across South Asian history.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {NODE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                typeFilter === type
                  ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] font-semibold'
                  : 'bg-[var(--vh-input-bg)] text-[var(--vh-ink)] border border-[var(--vh-border)] hover:border-[#B58A45]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--vh-gold-ink)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={voiceListening ? 'Listening...' : 'Filter graph nodes...'}
              className="bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] rounded pl-8 pr-3 py-1.5 text-xs text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
            />
          </div>
          <button
            type="button"
            onClick={toggleGraphVoiceSearch}
            disabled={voiceTranscribing}
            aria-label={voiceListening ? 'Stop voice filter' : 'Voice filter graph nodes'}
            className={`p-2 border rounded cursor-pointer disabled:opacity-60 ${
              voiceListening
                ? 'bg-[#B58A45] text-[#FAF6EE] border-[#B58A45] animate-pulse'
                : 'bg-[var(--vh-input-bg)] border-[var(--vh-border-strong)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)]'
            }`}
          >
            {voiceTranscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B58A45]" />
            ) : voiceListening ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-[#B58A45]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setTypeFilter('All');
              setSearchQuery('');
            }}
            className="p-2 bg-[var(--vh-input-bg)] border border-[var(--vh-border-strong)] rounded text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
            aria-label="Reset graph filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#B58A45]" />
          </button>
        </div>
      </div>

      {/* Graph Canvas + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          className={`lg:col-span-8 border border-[var(--vh-border)] rounded overflow-hidden shadow-md ${
            colorMode === 'dark' ? 'bg-[#18253A]' : 'bg-[#FAF6EE]'
          }`}
        >
          <svg
            ref={svgRef}
            className={`w-full h-[560px] ${
              colorMode === 'dark' ? 'bg-[#18253A]' : 'bg-[#FAF6EE]'
            }`}
          />
        </div>

        <aside className="lg:col-span-4 bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#7993AC] rounded p-6 flex flex-col justify-between space-y-5 shadow-md">
          {selectedNode ? (
            <>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
                    <span className="font-mono font-semibold text-[var(--vh-gold-ink)]">
                      {selectedNode.type}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[var(--vh-blue-ink)]">
                      {selectedNode.era}
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-[var(--vh-ink)] mt-1">
                    {selectedNode.label}
                  </h2>
                  <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed mt-2">
                    {selectedNode.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[var(--vh-border)] space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--vh-gold-ink)]">
                    Connected Relationships ({connectedEdges.length})
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {connectedEdges.map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => rel.other && setSelectedNodeId(rel.other.id)}
                        className="w-full text-left px-3 py-2 rounded bg-[var(--vh-surface-alt)] hover:bg-[var(--vh-french-blue-soft)] border border-[var(--vh-border)] text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <span className="text-[var(--vh-gold-ink)] font-mono text-[11px]">
                          {rel.direction} {rel.relation}
                        </span>
                        <span className="font-medium text-[var(--vh-ink)] truncate">
                          {rel.other?.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--vh-border)] flex flex-wrap gap-2">
                {selectedNode.linkedEntryId && (
                  <button
                    type="button"
                    onClick={() => onOpenEntry(selectedNode.linkedEntryId!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
                  >
                    <span>Open Monograph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {selectedNode.linkedDynastyId && (
                  <button
                    type="button"
                    onClick={() => onOpenDynasty(selectedNode.linkedDynastyId!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#7993AC] bg-[var(--vh-french-blue-soft)] text-[var(--vh-ink)] text-xs font-medium rounded hover:bg-[#7993AC] hover:text-[#FAF6EE] cursor-pointer transition-colors"
                  >
                    <span>View Dynasty</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--vh-ink-muted)]">
              Select a node in the graph to inspect details.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
