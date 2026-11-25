import { useState } from 'react';
import { ArrowRight, Coins, Compass, Crown, Landmark, Scale, ScrollText } from 'lucide-react';
import type { ArchiveEntry, Dynasty } from '../types';

interface DynastiesPageProps {
  dynasties: Dynasty[];
  entries: ArchiveEntry[];
  initialDynastyId?: string;
  onOpenEntry: (entryId: string) => void;
}

export function DynastiesPage({
  dynasties,
  entries,
  initialDynastyId,
  onOpenEntry,
}: DynastiesPageProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialDynastyId || dynasties[0]?.id || 'maurya'
  );

  const dynasty = dynasties.find((d) => d.id === selectedId) || dynasties[0];
  const linkedEntries = entries.filter((e) => e.dynastyId === dynasty?.id);

  if (!dynasty) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-[var(--vh-border-strong)] pb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
          Dynastic Chronologies
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--vh-ink)] mt-1">
          Dynasties &amp; Administrative Traditions
        </h1>
        <p className="text-sm text-[var(--vh-ink-muted)] mt-2 max-w-2xl">
          Compare ruler lineages, statecraft frameworks, civic ethics, maritime trade, scientific
          innovations, and cultural patronage across six foundational South Asian polities.
        </p>
      </div>

      {/* Dynasty Selector Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select dynasty">
        {dynasties.map((d) => {
          const active = d.id === dynasty.id;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedId(d.id)}
              className={`px-4 py-2.5 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold shadow-sm'
                  : 'bg-[var(--vh-surface)] text-[var(--vh-ink)] border-[var(--vh-border)] hover:border-[#B58A45]'
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Active Dynasty Dossier */}
      <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-[4px] border-t-[#B58A45] rounded p-6 sm:p-8 space-y-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--vh-border)] pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
              <span className="font-mono font-semibold tabular-nums text-[var(--vh-gold-ink)]">
                {dynasty.period}
              </span>
              <span aria-hidden="true">·</span>
              <span>Capital: {dynasty.capital}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--vh-blue-ink)] font-medium">{dynasty.region}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--vh-ink)] mt-2">
              {dynasty.name}
            </h2>
          </div>

          <div className="text-xs text-[var(--vh-ink-muted)]">
            Key Sites: {dynasty.keyMonuments.join(' · ')}
          </div>
        </div>

        <p className="text-base leading-relaxed text-[var(--vh-ink)] max-w-3xl">{dynasty.overview}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--vh-surface-alt)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--vh-gold-ink)]">
              <ScrollText className="w-4 h-4 text-[#B58A45]" />
              <span>Administration &amp; Institutions</span>
            </div>
            <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed">
              {dynasty.administration}
            </p>
          </div>

          <div className="bg-[#22324B] border border-[#B58A45]/50 border-t-2 border-t-[#B58A45] rounded p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4EDE1]">
              <Scale className="w-4 h-4 text-[#B58A45]" />
              <span>Civic Ethics &amp; Statecraft</span>
            </div>
            <p className="text-sm text-[#DCC8AD] leading-relaxed">{dynasty.civicEthics}</p>
          </div>

          <div className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/50 border-t-2 border-t-[#7993AC] rounded p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--vh-ink)]">
              <Landmark className="w-4 h-4 text-[#7993AC]" />
              <span>Cultural &amp; Architectural Patronage</span>
            </div>
            <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed">
              {dynasty.culturalPatronage}
            </p>
          </div>
        </div>

        {(dynasty.tradeAndEconomy || dynasty.scientificLegacy) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dynasty.tradeAndEconomy && (
              <div className="bg-[var(--vh-surface-alt)] border border-[var(--vh-border)] border-t-2 border-t-[#B58A45] rounded p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--vh-gold-ink)]">
                  <Coins className="w-4 h-4 text-[#B58A45]" />
                  <span>Trade, Coinage &amp; Agrarian Economy</span>
                </div>
                <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed">
                  {dynasty.tradeAndEconomy}
                </p>
              </div>
            )}
            {dynasty.scientificLegacy && (
              <div className="bg-[var(--vh-french-blue-soft)] border border-[#7993AC]/50 border-t-2 border-t-[#7993AC] rounded p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--vh-ink)]">
                  <Compass className="w-4 h-4 text-[#7993AC]" />
                  <span>Scientific, Metallurgical &amp; Engineering Legacy</span>
                </div>
                <p className="text-sm text-[var(--vh-ink-muted)] leading-relaxed">
                  {dynasty.scientificLegacy}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ruler Chronologies Table */}
        <div className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-[var(--vh-ink)] flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#B58A45]" />
            <span>Principal Rulers &amp; Milestones</span>
          </h3>
          <div className="border border-[var(--vh-border)] rounded overflow-x-auto bg-[var(--vh-surface)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#22324B] border-b border-[#B58A45]/45 text-xs font-medium text-[#DCC8AD]">
                  <th className="py-3 px-4">Ruler</th>
                  <th className="py-3 px-4">Reign</th>
                  <th className="py-3 px-4">Imperial Title</th>
                  <th className="py-3 px-4">Historical Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vh-border)] text-sm">
                {dynasty.rulers.map((ruler) => (
                  <tr key={ruler.name} className="hover:bg-[var(--vh-row-hover)]">
                    <td className="py-3 px-4 font-medium text-[var(--vh-ink)] whitespace-nowrap">
                      {ruler.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-[var(--vh-gold-ink)]">
                      {ruler.reign}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--vh-blue-ink)] whitespace-nowrap">
                      {ruler.title}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--vh-ink)]/90 leading-relaxed">
                      {ruler.achievement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked Primary Sources */}
        <div className="space-y-3 pt-2">
          <h3 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
            Primary Sources in the Archive ({linkedEntries.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {linkedEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 border border-[var(--vh-border)] rounded bg-[var(--vh-surface-alt)] flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono text-[var(--vh-gold-ink)]">
                    {entry.accessionNo} · {entry.displayDate}
                  </div>
                  <div className="font-display text-sm font-semibold text-[var(--vh-ink)] truncate mt-0.5">
                    {entry.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenEntry(entry.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#B58A45] text-[#FAF6EE] rounded hover:bg-[#7993AC] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
