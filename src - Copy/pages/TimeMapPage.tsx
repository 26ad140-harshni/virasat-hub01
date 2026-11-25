import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import type { Dynasty, TimelineEvent } from '../types';

interface TimeMapPageProps {
  dynasties: Dynasty[];
  events: TimelineEvent[];
  colorMode: 'light' | 'dark';
  onOpenEntry: (entryId: string) => void;
  onOpenDynasty: (dynastyId: string) => void;
}

function formatYearLabel(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year} CE`;
}

export function TimeMapPage({
  dynasties,
  events,
  colorMode,
  onOpenEntry,
  onOpenDynasty,
}: TimeMapPageProps) {
  const [selectedYear, setSelectedYear] = useState<number>(1050);
  const [playing, setPlaying] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string>(events[8]?.id || events[0]?.id || '');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const activeDynasties = useMemo(
    () => dynasties.filter((d) => selectedYear >= d.startYear && selectedYear <= d.endYear),
    [dynasties, selectedYear]
  );

  const visibleEvents = useMemo(
    () => events.filter((e) => e.year <= selectedYear),
    [events, selectedYear]
  );

  const activeEvent =
    events.find((e) => e.id === activeEventId) || visibleEvents[visibleEvents.length - 1] || events[0];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setSelectedYear((prev) => {
        if (prev >= 1820) {
          setPlaying(false);
          return 1820;
        }
        return prev + 45;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [21.5, 78.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 10,
      zoomControl: true,
    });

    const initialStyle = colorMode === 'dark' ? 'dark_all' : 'light_all';
    const tiles = L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/${initialStyle}/{z}/{x}/{y}{r}.png`,
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 18,
      }
    ).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    tileLayerRef.current = tiles;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Swap map tiles cleanly when switching Light / Dark mode
  useEffect(() => {
    const tiles = tileLayerRef.current;
    if (!tiles) return;
    const style = colorMode === 'dark' ? 'dark_all' : 'light_all';
    tiles.setUrl(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`);
  }, [colorMode]);

  // Update Dynasty Polygons & Event Markers
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    dynasties.forEach((d) => {
      const isActive = selectedYear >= d.startYear && selectedYear <= d.endYear;
      const poly = L.polygon(d.polygonCoords, {
        color: isActive ? (colorMode === 'dark' ? '#DCC8AD' : '#22324B') : '#7993AC',
        weight: isActive ? 2.5 : 1,
        opacity: isActive ? 0.92 : 0.38,
        fillColor: isActive ? '#B58A45' : '#7993AC',
        fillOpacity: isActive ? 0.25 : 0.08,
        dashArray: isActive ? undefined : '4 4',
      });
      poly.bindTooltip(`${d.name} (${d.period})`, { sticky: true });
      poly.on('click', () => onOpenDynasty(d.id));
      poly.addTo(group);
    });

    visibleEvents.forEach((ev) => {
      const isCurrent = ev.id === activeEvent?.id;
      const marker = L.circleMarker([ev.lat, ev.lng], {
        radius: isCurrent ? 9 : 6,
        color: colorMode === 'dark' ? '#F4EDE1' : '#FAF6EE',
        weight: isCurrent ? 2.5 : 1.5,
        fillColor: isCurrent ? '#B58A45' : colorMode === 'dark' ? '#7993AC' : '#22324B',
        fillOpacity: 0.95,
      });

      marker.bindTooltip(`${ev.displayYear} · ${ev.title}`, { direction: 'top' });
      marker.on('click', () => {
        setActiveEventId(ev.id);
      });
      marker.addTo(group);
    });
  }, [dynasties, visibleEvents, selectedYear, activeEvent?.id, colorMode, onOpenDynasty]);

  const focusEventOnMap = (ev: TimelineEvent) => {
    setActiveEventId(ev.id);
    if (ev.year > selectedYear) {
      setSelectedYear(ev.year);
    }
    mapRef.current?.flyTo([ev.lat, ev.lng], 6, { duration: 0.6 });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--vh-border-strong)] pb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--vh-gold-ink)]">
            Spatial Chronology
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--vh-ink)] mt-1">
            Interactive Dynasty Time Map
          </h1>
        </div>
        <div className="font-mono text-lg font-semibold text-[var(--vh-gold-ink)] tabular-nums">
          Horizon: {formatYearLabel(selectedYear)}
        </div>
      </div>

      {/* Period Slider Controls */}
      <div className="bg-[var(--vh-champagne-soft)] border border-[var(--vh-border-strong)] rounded p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] cursor-pointer transition-colors"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{playing ? 'Pause Timeline' : 'Play Timeline'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setSelectedYear(-322);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 bg-[var(--vh-surface)] border border-[var(--vh-border-strong)] text-xs font-medium text-[var(--vh-ink)] rounded hover:bg-[var(--vh-surface-alt)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#B58A45]" />
              <span>322 BCE</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
            <span>Active Polities:</span>
            {activeDynasties.length > 0 ? (
              activeDynasties.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpenDynasty(d.id)}
                  className="font-medium text-[var(--vh-ink)] underline decoration-[#7993AC] underline-offset-4 cursor-pointer hover:text-[#B58A45]"
                >
                  {d.name}
                </button>
              ))
            ) : (
              <span>Inter-dynastic transition era</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-[var(--vh-ink-muted)] tabular-nums whitespace-nowrap">
            322 BCE
          </span>
          <input
            type="range"
            min={-322}
            max={1820}
            step={5}
            value={selectedYear}
            onChange={(e) => {
              setPlaying(false);
              setSelectedYear(Number(e.target.value));
            }}
            aria-label="Historical year slider"
            className="w-full accent-[#B58A45] cursor-pointer"
          />
          <span className="font-mono text-xs text-[var(--vh-ink-muted)] tabular-nums whitespace-nowrap">
            1820 CE
          </span>
        </div>
      </div>

      {/* Map + Timeline Drawer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div
            ref={mapContainerRef}
            className="w-full h-[460px] lg:h-[520px] rounded border border-[var(--vh-border-strong)] overflow-hidden z-10 shadow-md"
          />

          {activeEvent && (
            <div className="bg-[var(--vh-surface)] border border-[var(--vh-border)] border-t-2 border-t-[#7993AC] rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--vh-ink-muted)]">
                  <span className="font-mono font-semibold text-[var(--vh-gold-ink)] tabular-nums">
                    {activeEvent.displayYear}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--vh-blue-ink)] font-medium">
                    {activeEvent.dynastyName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeEvent.location}</span>
                </div>
                <h2 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
                  {activeEvent.title}
                </h2>
                <p className="text-xs text-[var(--vh-ink-muted)] leading-relaxed">
                  {activeEvent.summary}
                </p>
              </div>
              {activeEvent.linkedEntryId && (
                <button
                  type="button"
                  onClick={() => onOpenEntry(activeEvent.linkedEntryId!)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] text-xs font-semibold rounded hover:bg-[var(--vh-btn-primary-hover-bg)] hover:text-[var(--vh-btn-primary-hover-text)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <span>Read Monograph</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Chronological Event Drawer */}
        <aside className="lg:col-span-4 bg-[var(--vh-surface)] border border-[var(--vh-border)] rounded flex flex-col h-[520px] lg:h-auto lg:max-h-[630px] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#B58A45]/45 bg-[#22324B] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#F4EDE1]">
              Chronological Ledger
            </h2>
            <span className="font-mono text-xs text-[#DCC8AD] tabular-nums">
              {visibleEvents.length} / {events.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--vh-border)]">
            {events.map((ev) => {
              const unlocked = ev.year <= selectedYear;
              const selected = ev.id === activeEvent?.id;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => focusEventOnMap(ev)}
                  className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[var(--vh-french-blue-soft)] text-[var(--vh-ink)] border-l-2 border-l-[#B58A45]'
                      : unlocked
                      ? 'bg-[var(--vh-surface)] text-[var(--vh-ink)] hover:bg-[var(--vh-row-hover)]'
                      : 'bg-[var(--vh-surface)] opacity-45 hover:opacity-80 text-[var(--vh-ink-muted)]'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums ${
                      selected ? 'text-[var(--vh-gold-ink)] font-semibold' : 'text-[var(--vh-gold-ink)]'
                    }`}
                  >
                    <span>{ev.displayYear}</span>
                    <span className="text-[var(--vh-blue-ink)]">{ev.category}</span>
                  </div>
                  <div className="font-medium text-xs mt-1 text-[var(--vh-ink)]">{ev.title}</div>
                  <div className="text-[11px] mt-0.5 text-[var(--vh-ink-muted)]">{ev.location}</div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
