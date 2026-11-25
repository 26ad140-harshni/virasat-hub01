import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  SEED_ARCHIVE_ENTRIES,
  SEED_DYNASTIES,
  SEED_LEXICON,
  SEED_STORIES,
  SEED_TIMELINE_EVENTS,
  SUPPORTED_LANGUAGES,
} from './src/data/seedData.ts';
import { SEED_GRAPH_EDGES, SEED_GRAPH_NODES } from './src/data/seedGraphData.ts';
import type {
  ArchiveEntry,
  GraphEdge,
  GraphNode,
  ResearchFolder,
  SavedResearchItem,
  SupportedLanguage,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'virasat-store.json');

interface ScholarSpaceRecord {
  folders: ResearchFolder[];
  items: SavedResearchItem[];
}

interface VirasatStore {
  entries: ArchiveEntry[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  translations: Record<string, { translatedText: string; culturalNote: string; updatedAt: string }>;
  embeddings: Record<string, number[]>;
  researchSpaces: Record<string, ScholarSpaceRecord>;
}

function createInitialStore(): VirasatStore {
  return {
    entries: [...SEED_ARCHIVE_ENTRIES],
    graphNodes: [...SEED_GRAPH_NODES],
    graphEdges: [...SEED_GRAPH_EDGES],
    translations: {},
    embeddings: {},
    researchSpaces: {},
  };
}

function loadStore(): VirasatStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = createInitialStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<VirasatStore>;
    const seedById = new Map(SEED_ARCHIVE_ENTRIES.map((e) => [e.id, e]));
    const loadedEntries =
      Array.isArray(parsed.entries) && parsed.entries.length > 0
        ? parsed.entries.map((entry) => {
            const seedMatch = seedById.get(entry.id);
            if (!seedMatch) return entry;
            return {
              ...entry,
              historicalContext: entry.historicalContext || seedMatch.historicalContext,
              epigraphicNotes: entry.epigraphicNotes || seedMatch.epigraphicNotes,
            };
          })
        : [...SEED_ARCHIVE_ENTRIES];
    return {
      entries: loadedEntries,
      graphNodes:
        Array.isArray(parsed.graphNodes) && parsed.graphNodes.length > 0 ? parsed.graphNodes : [...SEED_GRAPH_NODES],
      graphEdges:
        Array.isArray(parsed.graphEdges) && parsed.graphEdges.length > 0 ? parsed.graphEdges : [...SEED_GRAPH_EDGES],
      translations: parsed.translations ?? {},
      embeddings: parsed.embeddings ?? {},
      researchSpaces: parsed.researchSpaces ?? {},
    };
  } catch (error) {
    console.error('Failed to load virasat-store.json, using initial seed:', error);
    return createInitialStore();
  }
}

function saveStore(store: VirasatStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist virasat-store.json:', error);
  }
}

function getGenAIClient(): GoogleGenAI {
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGeminiErrorMessage(error: unknown, fallback = 'Gemini service is temporarily busy.'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number; status?: string } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // not raw JSON
  }
  return raw || fallback;
}

function isTransientGeminiError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

function stripJsonCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  request: Parameters<GoogleGenAI['models']['generateContent']>[0],
  fallbackModels: string[] = []
) {
  const candidateModels = [request.model, ...fallbackModels.filter((m) => m !== request.model)];
  let lastError: unknown;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx += 1) {
    const modelName = candidateModels[mIdx];
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const nextConfig = request.config ? { ...request.config } : undefined;
        if (nextConfig) {
          if (modelName === 'gemini-3.1-flash-lite') {
            nextConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
          } else if (modelName === 'gemini-3.5-flash-lite' || modelName === 'gemini-3-flash-preview') {
            delete nextConfig.thinkingConfig;
          }
        }
        return await ai.models.generateContent({
          ...request,
          model: modelName,
          ...(nextConfig ? { config: nextConfig } : {}),
        });
      } catch (error) {
        lastError = error;
        if (!isTransientGeminiError(error)) {
          throw error;
        }
        const delayMs = 300 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    console.warn(`Model ${modelName} hit transient unavailability, trying next fallback if available.`);
  }

  throw lastError;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function lexicalScore(query: string, entry: ArchiveEntry): number {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f\u0b80-\u0bff]+/i)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;
  const corpus = `${entry.title} ${entry.subtitle} ${entry.dynastyName} ${entry.category} ${entry.summary} ${entry.scholarlyAnalysis} ${entry.keyTerms.join(' ')}`.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (corpus.includes(token)) hits += 1;
  }
  return hits / tokens.length;
}

function entryToEmbeddingText(entry: ArchiveEntry): string {
  return `${entry.accessionNo} ${entry.title} (${entry.dynastyName}, ${entry.displayDate}, ${entry.category}). ${entry.summary} ${entry.englishTranslation} ${entry.scholarlyAnalysis} Key terms: ${entry.keyTerms.join(', ')}`;
}

async function rankEntriesWithGeminiEmbeddings(
  ai: GoogleGenAI,
  store: VirasatStore,
  query: string,
  topK: number
): Promise<{
  queryVector: number[];
  ranked: Array<{ entry: ArchiveEntry; score: number }>;
}> {
  const queryEmbedRes = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: query,
  });
  const queryVector = queryEmbedRes.embeddings?.[0]?.values ?? [];
  if (queryVector.length === 0) {
    throw new Error('Gemini returned an empty embedding vector.');
  }

  // Generate & cache any missing entry embeddings in batches
  const missingEntries = store.entries.filter((e) => !store.embeddings[e.id] || store.embeddings[e.id].length === 0);
  if (missingEntries.length > 0) {
    const batchTexts = missingEntries.map(entryToEmbeddingText);
    const batchRes = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: batchTexts,
    });
    const vectors = batchRes.embeddings ?? [];
    missingEntries.forEach((entry, idx) => {
      const vec = vectors[idx]?.values;
      if (vec && vec.length > 0) {
        store.embeddings[entry.id] = vec;
      }
    });
    saveStore(store);
  }

  const ranked = store.entries
    .map((entry) => {
      const vec = store.embeddings[entry.id];
      const vecSim = vec ? cosineSimilarity(queryVector, vec) : 0;
      const lex = lexicalScore(query, entry);
      const score = vecSim > 0 ? vecSim * 0.85 + lex * 0.15 : lex;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { queryVector, ranked };
}

function getScholarId(req: express.Request): string {
  const raw = String(req.header('x-scholar-id') || 'guest-scholar').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || 'guest-scholar';
}

function ensureScholarSpace(store: VirasatStore, scholarId: string): ScholarSpaceRecord {
  if (!store.researchSpaces[scholarId]) {
    store.researchSpaces[scholarId] = {
      folders: [
        {
          id: 'fld-epigraphy',
          name: 'Epigraphy & Civic Charters',
          description: 'Primary inscriptions, copper-plate charters, and local governance edicts.',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'fld-architecture',
          name: 'Monumental Stonecraft',
          description: 'Temples, stupas, and proportional masonry studies.',
          createdAt: new Date().toISOString(),
        },
      ],
      items: [
        {
          id: 'itm-default-1',
          folderId: 'fld-epigraphy',
          entryId: 'ent-07',
          note: 'Compare Kudavolai ward audit disqualifications with Mauryan Adhyaksha accountability.',
          savedAt: new Date().toISOString(),
        },
      ],
    };
    saveStore(store);
  }
  return store.researchSpaces[scholarId];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const store = loadStore();

  // Primary dataset route
  app.get('/api/data', (_req, res) => {
    res.json({
      dynasties: SEED_DYNASTIES,
      events: SEED_TIMELINE_EVENTS,
      entries: store.entries,
      stories: SEED_STORIES,
      lexicon: SEED_LEXICON,
      graphNodes: store.graphNodes,
      graphEdges: store.graphEdges,
    });
  });

  // Admin CMS: Archive Entries CRUD
  app.post('/api/entries', (req, res) => {
    const body = req.body as Partial<ArchiveEntry>;
    if (!body.title || !body.dynastyId || !body.category) {
      res.status(400).json({ error: 'Title, dynastyId, and category are required.' });
      return;
    }
    const dynasty = SEED_DYNASTIES.find((d) => d.id === body.dynastyId);
    const id = `ent-${Date.now().toString(36)}`;
    const nextNumber = 1000 + store.entries.length + 1;
    const created: ArchiveEntry = {
      id,
      accessionNo: body.accessionNo?.trim() || `VH-${nextNumber}`,
      title: String(body.title).trim().slice(0, 180),
      subtitle: String(body.subtitle || 'Curated Archival Monograph').trim().slice(0, 220),
      category: body.category,
      dynastyId: body.dynastyId,
      dynastyName: dynasty?.name ?? String(body.dynastyName || 'Regional Polity'),
      year: Number(body.year ?? 1000),
      displayDate: String(body.displayDate || 'c. 1000 CE').trim().slice(0, 80),
      script: String(body.script || 'Devanagari').trim().slice(0, 80),
      language: String(body.language || 'Sanskrit').trim().slice(0, 80),
      material: String(body.material || 'Palm-Leaf Manuscript').trim().slice(0, 120),
      dimensions: String(body.dimensions || 'Archival Folio').trim().slice(0, 100),
      provenance: String(body.provenance || 'South Asian Regional Repository').trim().slice(0, 160),
      imageUrl: String(body.imageUrl || '/src/assets/images/manuscript_palm_leaf_1795522709190.jpg').trim(),
      summary: String(body.summary || '').trim().slice(0, 1000),
      originalExcerpt: String(body.originalExcerpt || '').trim().slice(0, 1500),
      transliteration: String(body.transliteration || '').trim().slice(0, 1500),
      englishTranslation: String(body.englishTranslation || '').trim().slice(0, 2000),
      scholarlyAnalysis: String(body.scholarlyAnalysis || '').trim().slice(0, 2000),
      keyTerms: Array.isArray(body.keyTerms) ? body.keyTerms.slice(0, 8).map(String) : ['Archive'],
      citationAuthor: String(body.citationAuthor || 'Virasat Editorial Board').trim().slice(0, 140),
      repository: String(body.repository || 'Virasat Digital Archive').trim().slice(0, 140),
    };
    store.entries.unshift(created);
    delete store.embeddings[created.id];
    saveStore(store);
    res.status(201).json(created);
  });

  app.put('/api/entries/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Archive entry not found.' });
      return;
    }
    const existing = store.entries[idx];
    const body = req.body as Partial<ArchiveEntry>;
    const dynasty = body.dynastyId ? SEED_DYNASTIES.find((d) => d.id === body.dynastyId) : undefined;
    const updated: ArchiveEntry = {
      ...existing,
      ...body,
      id: existing.id,
      dynastyName: dynasty?.name ?? body.dynastyName ?? existing.dynastyName,
    };
    store.entries[idx] = updated;
    delete store.embeddings[updated.id];
    saveStore(store);
    res.json(updated);
  });

  app.delete('/api/entries/:id', (req, res) => {
    const { id } = req.params;
    const before = store.entries.length;
    store.entries = store.entries.filter((e) => e.id !== id);
    if (store.entries.length === before) {
      res.status(404).json({ error: 'Archive entry not found.' });
      return;
    }
    delete store.embeddings[id];
    saveStore(store);
    res.json({ deleted: id });
  });

  // Admin CMS: Knowledge Graph Nodes & Edges CRUD
  app.post('/api/graph/nodes', (req, res) => {
    const body = req.body as Partial<GraphNode>;
    if (!body.label || !body.type) {
      res.status(400).json({ error: 'Node label and type are required.' });
      return;
    }
    const node: GraphNode = {
      id: `node-${Date.now().toString(36)}`,
      label: String(body.label).trim().slice(0, 80),
      type: body.type,
      era: String(body.era || 'Historical').trim().slice(0, 60),
      description: String(body.description || '').trim().slice(0, 400),
      linkedEntryId: body.linkedEntryId || undefined,
      linkedDynastyId: body.linkedDynastyId || undefined,
    };
    store.graphNodes.push(node);
    saveStore(store);
    res.status(201).json(node);
  });

  app.delete('/api/graph/nodes/:id', (req, res) => {
    const { id } = req.params;
    store.graphNodes = store.graphNodes.filter((n) => n.id !== id);
    store.graphEdges = store.graphEdges.filter((e) => e.source !== id && e.target !== id);
    saveStore(store);
    res.json({ deleted: id });
  });

  app.post('/api/graph/edges', (req, res) => {
    const body = req.body as Partial<GraphEdge>;
    if (!body.source || !body.target || !body.relation) {
      res.status(400).json({ error: 'Edge source, target, and relation are required.' });
      return;
    }
    const edge: GraphEdge = {
      id: `ed-${Date.now().toString(36)}`,
      source: String(body.source),
      target: String(body.target),
      relation: String(body.relation).trim().slice(0, 60),
    };
    store.graphEdges.push(edge);
    saveStore(store);
    res.status(201).json(edge);
  });

  app.delete('/api/graph/edges/:id', (req, res) => {
    const { id } = req.params;
    store.graphEdges = store.graphEdges.filter((e) => e.id !== id);
    saveStore(store);
    res.json({ deleted: id });
  });

  // Scholar Research Space endpoints
  app.get('/api/research-space', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    res.json(space);
  });

  app.post('/api/research-space/folders', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required.' });
      return;
    }
    const folder: ResearchFolder = {
      id: `fld-${Date.now().toString(36)}`,
      name: name.trim().slice(0, 80),
      description: String(description || '').trim().slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    space.folders.push(folder);
    saveStore(store);
    res.status(201).json(folder);
  });

  app.delete('/api/research-space/folders/:id', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    const { id } = req.params;
    space.folders = space.folders.filter((f) => f.id !== id);
    space.items = space.items.filter((i) => i.folderId !== id);
    saveStore(store);
    res.json({ deleted: id });
  });

  app.post('/api/research-space/items', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    const { folderId, entryId, note } = req.body as { folderId?: string; entryId?: string; note?: string };
    if (!folderId || !entryId) {
      res.status(400).json({ error: 'folderId and entryId are required.' });
      return;
    }
    const existing = space.items.find((i) => i.folderId === folderId && i.entryId === entryId);
    if (existing) {
      existing.note = note !== undefined ? String(note).slice(0, 2000) : existing.note;
      saveStore(store);
      res.json(existing);
      return;
    }
    const item: SavedResearchItem = {
      id: `itm-${Date.now().toString(36)}`,
      folderId,
      entryId,
      note: String(note || '').slice(0, 2000),
      savedAt: new Date().toISOString(),
    };
    space.items.unshift(item);
    saveStore(store);
    res.status(201).json(item);
  });

  app.put('/api/research-space/items/:id', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    const { id } = req.params;
    const item = space.items.find((i) => i.id === id);
    if (!item) {
      res.status(404).json({ error: 'Saved item not found.' });
      return;
    }
    const { note, folderId } = req.body as { note?: string; folderId?: string };
    if (note !== undefined) item.note = String(note).slice(0, 2000);
    if (folderId) item.folderId = folderId;
    saveStore(store);
    res.json(item);
  });

  app.delete('/api/research-space/items/:id', (req, res) => {
    const scholarId = getScholarId(req);
    const space = ensureScholarSpace(store, scholarId);
    const { id } = req.params;
    space.items = space.items.filter((i) => i.id !== id);
    saveStore(store);
    res.json({ deleted: id });
  });

  // Gemini AI: Vector Embedding & Semantic Similarity Tester
  app.post('/api/embed', async (req, res) => {
    try {
      const { query } = req.body as { query?: string };
      if (!query || !query.trim()) {
        res.status(400).json({ error: 'Query text is required.' });
        return;
      }
      const ai = getGenAIClient();
      const { queryVector, ranked } = await rankEntriesWithGeminiEmbeddings(ai, store, query.trim(), 6);
      res.json({
        model: 'gemini-embedding-2',
        dimensions: queryVector.length,
        previewVector: queryVector.slice(0, 12),
        matches: ranked.map(({ entry, score }) => ({
          entryId: entry.id,
          accessionNo: entry.accessionNo,
          title: entry.title,
          dynastyName: entry.dynastyName,
          score: Number(score.toFixed(4)),
        })),
      });
    } catch (error) {
      console.error('Embedding API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate embeddings via Gemini API.',
      });
    }
  });

  const TARGET_SCRIPT_REGEX: Record<string, RegExp> = {
    ta: /[\u0B80-\u0BFF]/,
    hi: /[\u0900-\u097F]/,
    mr: /[\u0900-\u097F]/,
    sa: /[\u0900-\u097F]/,
    ne: /[\u0900-\u097F]/,
    te: /[\u0C00-\u0C7F]/,
    ml: /[\u0D00-\u0D7F]/,
    kn: /[\u0C80-\u0CFF]/,
    bn: /[\u0980-\u09FF]/,
    as: /[\u0980-\u09FF]/,
    gu: /[\u0A80-\u0AFF]/,
    pa: /[\u0A00-\u0A7F]/,
    or: /[\u0B00-\u0B7F]/,
    ar: /[\u0600-\u06FF]/,
    ur: /[\u0600-\u06FF]/,
    fa: /[\u0600-\u06FF]/,
    ja: /[\u3040-\u30FF\u4E00-\u9FFF]/,
    ko: /[\uAC00-\uD7AF]/,
    zh: /[\u4E00-\u9FFF]/,
  };

  // Gemini AI: Multilingual Translation with Server Caching & Resilient Retry
  app.post('/api/translate', async (req, res) => {
    try {
      const { entryId, text, targetLang } = req.body as {
        entryId?: string;
        text?: string;
        targetLang?: SupportedLanguage;
      };
      const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
      const sourceText = String(text || '').trim();
      if (!sourceText || !langMeta || !targetLang) {
        res.status(400).json({ error: 'Valid text and targetLang (en, ta, hi, te, ml, kn) are required.' });
        return;
      }

      const cacheKey = `${entryId || 'custom'}:${targetLang}:${sourceText.length}:${sourceText.slice(0, 60)}`;
      const cached = store.translations[cacheKey];
      const scriptCheck = targetLang !== 'en' ? TARGET_SCRIPT_REGEX[targetLang] : undefined;
      const isCachedValid =
        cached &&
        Boolean(cached.translatedText?.trim()) &&
        (targetLang === 'en' || cached.translatedText.trim() !== sourceText) &&
        (!scriptCheck || scriptCheck.test(cached.translatedText));

      if (isCachedValid) {
        res.json({
          ...cached,
          targetLang,
          cached: true,
        });
        return;
      }

      const ai = getGenAIClient();
      const response = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: `Translate the following historical archival passage accurately into ${langMeta.label} (${langMeta.nativeName}) using authentic ${langMeta.label} script, preserving scholarly dignity and proper historical terms. Also provide one concise cultural/linguistic note in ${langMeta.label}.\n\nPassage:\n${sourceText}`,
          config: {
            systemInstruction: `You are an academic South Asian epigraphist and philologist. Translate faithfully into ${langMeta.label} (${langMeta.nativeName}) script without inventing historical facts. Ensure translatedText is genuinely written in ${langMeta.label}, not left untranslated.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translatedText: {
                  type: Type.STRING,
                  description: `Accurate scholarly translation written in ${langMeta.label} (${langMeta.nativeName}) script.`,
                },
                culturalNote: {
                  type: Type.STRING,
                  description: `Brief 1-sentence contextual or philological note in ${langMeta.label}.`,
                },
              },
              required: ['translatedText', 'culturalNote'],
            },
          },
        },
        ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite']
      );

      const parsed = JSON.parse(stripJsonCodeFences(response.text ?? '{}')) as {
        translatedText?: string;
        culturalNote?: string;
      };
      const translatedOutput = (parsed.translatedText ?? '').trim();
      if (!translatedOutput) {
        throw new Error(`Translation engine returned an empty ${langMeta.label} response. Please retry.`);
      }
      if (scriptCheck && !scriptCheck.test(translatedOutput)) {
        throw new Error(`Translation output was not in ${langMeta.label} (${langMeta.nativeName}) script. Please retry.`);
      }

      const payload = {
        translatedText: translatedOutput,
        culturalNote: (parsed.culturalNote ?? '').trim(),
        updatedAt: new Date().toISOString(),
      };
      store.translations[cacheKey] = payload;
      saveStore(store);

      res.json({
        ...payload,
        targetLang,
        cached: false,
      });
    } catch (error) {
      console.error('Translation API error:', error);
      res.status(502).json({
        error: extractGeminiErrorMessage(error, 'Failed to translate text via Gemini API.'),
      });
    }
  });

  const ttsCache = new Map<string, string>();
  const normalizedSpeechCache = new Map<string, string>();
  const ALLOWED_VOICES = new Set(['Kore', 'Zephyr', 'Charon', 'Puck', 'Fenrir']);

  const LOCALE_ARTICULATION_GUIDE: Record<string, string> = {
    'en-IN':
      'Native educated Indian English (en-IN) speaker with crisp pronunciation of South Asian historical proper nouns and warm scholarly cadence.',
    'ta-IN':
      'Native Tamil (ta-IN) speaker from Tamil Nadu with exact classical and modern Tamil phonology: precise retroflex ழ (zh), ள, ண, alveolar ற, ன, dental த, exact short vs. long vowel quantities (குறில் vs நெடில்), crisp geminate stops (க், ச், ட், த், ப்), and natural Tamil prosody with zero foreign or Hindi accent.',
    'hi-IN':
      'Native Hindi (hi-IN) speaker with authentic Khariboli pronunciation: clear aspirated vs. unaspirated stops (ख/क, घ/ग, थ/त, भ/ब), retroflex ट/ड/ड़/ढ़, proper anusvara/chandrabindu nasalization, natural schwa deletion, and zero foreign accent.',
    'te-IN':
      'Native Telugu (te-IN) speaker with authentic ajanta vowel-ending cadence, crisp geminate consonants, accurate aspirated stops, and natural Telugu intonation with zero foreign accent.',
    'ml-IN':
      'Native Malayalam (ml-IN) speaker from Kerala with exact phonology: distinct ഴ, റ, ള, authentic chillu endings (ൻ, ർ, ൽ, ൾ, ൺ), nasalized clusters, and natural Malayalam cadence.',
    'kn-IN':
      'Native Kannada (kn-IN) speaker with crisp mahaprana aspirated consonants, distinct retroflex ಳ/ಣ, accurate vowel lengths, and authentic Kannada intonation.',
  };

  async function prepareNativeSpeechText(
    ai: GoogleGenAI,
    rawText: string,
    localeKey: string,
    langLabel: string
  ): Promise<string> {
    const baseLang = localeKey.toLowerCase().split('-')[0];
    if (baseLang === 'en') {
      return rawText
        .replace(/\bVH-(\d+)\b/g, 'V H $1')
        .replace(/\bBCE\b/g, 'B C E')
        .replace(/\bCE\b/g, 'C E')
        .trim();
    }

    const scriptRegex = TARGET_SCRIPT_REGEX[baseLang];
    const hasLatin = /[A-Za-z]/.test(rawText);
    const hasDigits = /\d/.test(rawText);
    const missingNativeScript = scriptRegex ? !scriptRegex.test(rawText) : false;

    if (!hasLatin && !hasDigits && !missingNativeScript) {
      return rawText;
    }

    const normKey = `${localeKey}:${rawText}`;
    const cachedNorm = normalizedSpeechCache.get(normKey);
    if (cachedNorm) {
      return cachedNorm;
    }

    try {
      const normResponse = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-3.1-flash-lite',
          contents: `Target Spoken Language: ${langLabel} (${localeKey})\n\nInput Text:\n${rawText}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction: `You prepare text for a native Text-to-Speech voice in ${langLabel} (${localeKey}) so every single word is pronounced with 100% authentic native accent and zero code-switching glitches.
Rules:
1. Output ONLY the speech-ready text in pure ${langLabel} (${localeKey}) — no explanations, no quotes, no markdown.
2. If any sentence or phrase is in English or another language, translate it naturally into idiomatic spoken ${langLabel}.
3. Convert ALL digits, years, dates, and accession codes (like VH-1007, 919, 322 BCE) into natural spoken words in ${langLabel} (e.g., for Tamil: "ஆவணம் ஆயிரத்து ஏழு", "தொள்ளாயிரத்து பத்தொன்பது", "பொது ஆண்டிற்கு முன் முன்னூற்று இருபத்திரண்டு").
4. Transliterate ALL remaining proper nouns, dynasties, or loanwords phonetically into the native script of ${langLabel} (if ${langLabel} uses a non-Latin script like Tamil, Devanagari, Telugu, Malayalam, Kannada, Bengali, etc., there must be ZERO Latin A-Z letters and ZERO ASCII 0-9 digits in your output).
5. Use clean natural punctuation (commas and periods) for smooth spoken rhythm.`,
          },
        },
        ['gemini-3-flash-preview', 'gemini-3.5-flash-lite']
      );
      const normalized = (normResponse.text ?? '').trim();
      if (normalized) {
        if (normalizedSpeechCache.size >= 60) {
          const oldest = normalizedSpeechCache.keys().next().value;
          if (oldest) normalizedSpeechCache.delete(oldest);
        }
        normalizedSpeechCache.set(normKey, normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Speech phonetic normalization fallback:', err);
    }

    return rawText;
  }

  // Gemini AI: Neural Text-to-Speech for crisp multilingual voice clarity
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, languageName, languageCode, voiceName, pitch } = req.body as {
        text?: string;
        languageName?: string;
        languageCode?: string;
        voiceName?: string;
        pitch?: number;
      };
      const cleanText = String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_`#>]/g, '')
        .replace(/\[([^\]]+)\]/g, '$1')
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 3000);

      if (!cleanText) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const selectedVoice = voiceName && ALLOWED_VOICES.has(voiceName) ? voiceName : 'Kore';
      const localeKey = String(languageCode || 'en-IN').trim().slice(0, 16);
      const langLabel = String(languageName || localeKey || 'the passage language').trim().slice(0, 60);
      const numericPitch = typeof pitch === 'number' && Number.isFinite(pitch)
        ? Math.min(1.3, Math.max(0.7, Number(pitch.toFixed(2))))
        : 1.0;

      const pitchDirective =
        numericPitch <= 0.88
          ? 'deep, warm lower vocal pitch with calm gravitas'
          : numericPitch >= 1.12
          ? 'bright, lifted upper vocal pitch with crisp airy clarity'
          : 'natural, well-balanced mid-range vocal pitch';

      const localeArticulation =
        LOCALE_ARTICULATION_GUIDE[localeKey] ||
        `Native ${langLabel} (${localeKey}) speaker with exact native phonology, authentic regional prosody, crisp articulation, and zero foreign accent.`;

      const cacheKey = `${selectedVoice}:${localeKey}:${numericPitch.toFixed(2)}:${cleanText}`;
      const cachedAudio = ttsCache.get(cacheKey);
      if (cachedAudio) {
        res.json({
          audioBase64: cachedAudio,
          mimeType: 'audio/wav',
          voiceName: selectedVoice,
          cached: true,
        });
        return;
      }

      const ai = getGenAIClient();
      const speechReadyText = await prepareNativeSpeechText(ai, cleanText, localeKey, langLabel);

      const response = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: speechReadyText,
                  speechMetadata: {
                    style: `${localeArticulation} Speak in pure ${langLabel} (${localeKey}) at a natural, clear, unhurried pace with ${pitchDirective}, clean breath pauses at punctuation, and studio-grade clarity.`,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        },
        ['gemini-3.8-flash-tts']
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Gemini TTS returned no audio data.' });
        return;
      }

      if (ttsCache.size >= 40) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName: selectedVoice,
        cached: false,
      });
    } catch (error) {
      console.error('TTS API error:', error);
      res.status(502).json({
        error: extractGeminiErrorMessage(error, 'Failed to synthesize clear speech via Gemini TTS.'),
      });
    }
  });

  // Gemini AI: Multilingual Speech Transcription for Voice Search & Voice Input
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, languageCode, languageName } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        languageCode?: string;
        languageName?: string;
      };

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Recorded audio data is required for transcription.' });
        return;
      }

      const rawMime = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      const safeMime = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'].includes(rawMime)
        ? rawMime
        : 'audio/webm';

      const langHint =
        languageName || languageCode
          ? `Expected language/locale hint: ${languageName || ''} (${languageCode || 'auto'}).`
          : 'Auto-detect the spoken language.';

      const ai = getGenAIClient();
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: audioBase64,
              },
            },
            {
              text: `Transcribe this spoken audio accurately in its original spoken language and native script (for example Tamil in தமிழ் script, Hindi in देवनागरी script, Telugu in తెలుగు script, Malayalam in മലയാളം script, Kannada in ಕನ್ನಡ script, English in Latin script). ${langHint} Output ONLY the exact transcribed query or sentence without quotes or extra commentary.`,
            },
          ],
        },
      });

      const transcript = (response.text ?? '').trim().replace(/^["']|["']$/g, '');
      res.json({ transcript });
    } catch (error) {
      console.error('Transcription API error:', error);
      res.status(502).json({
        error: extractGeminiErrorMessage(error, 'Failed to transcribe voice audio via Gemini.'),
      });
    }
  });

  // Gemini AI: RAG Research Assistant with Vector Similarity & Citation Grounding
  app.post('/api/chat', async (req, res) => {
    try {
      const { question, history, language } = req.body as {
        question?: string;
        history?: Array<{ role: 'user' | 'assistant'; text: string }>;
        language?: string;
      };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Please enter a research question.' });
        return;
      }

      const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === language);
      const languageDirective = selectedLang
        ? `Respond in ${selectedLang.label} (${selectedLang.nativeName}), using natural, idiomatic, respectful academic phrasing in ${selectedLang.label} script. Set detectedLanguageCode to "${selectedLang.speechLocale}" and detectedLanguageName to "${selectedLang.label}".`
        : 'Respond in the exact same language and script as the Scholar Question (for example Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, French, Spanish, or English). Set detectedLanguageCode to the matching BCP-47 speech locale (e.g., "ta-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN", "en-IN", "fr-FR") and detectedLanguageName to its English language name.';

      const ai = getGenAIClient();
      let ranked: Array<{ entry: ArchiveEntry; score: number }> = [];

      try {
        const result = await rankEntriesWithGeminiEmbeddings(ai, store, question.trim(), 4);
        ranked = result.ranked;
      } catch (embedErr) {
        console.warn('Embedding retrieval fallback to lexical matching:', embedErr);
        ranked = store.entries
          .map((entry) => ({ entry, score: lexicalScore(question, entry) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
      }

      const contextBlocks = ranked
        .map(
          ({ entry, score }) =>
            `[ID: ${entry.id} | ${entry.accessionNo}] ${entry.title} (${entry.dynastyName}, ${entry.displayDate}, ${entry.category}) [Similarity: ${score.toFixed(3)}]\nExcerpt: ${entry.englishTranslation}\nAnalysis: ${entry.scholarlyAnalysis}\nProvenance: ${entry.provenance}`
        )
        .join('\n\n---\n\n');

      const dynastySummary = SEED_DYNASTIES.map(
        (d) => `${d.name} (${d.period}, Capital: ${d.capital}): ${d.overview} Ethics: ${d.civicEthics}`
      ).join('\n');

      const conversationTrail = Array.isArray(history)
        ? history
            .slice(-4)
            .map((m) => `${m.role === 'user' ? 'Scholar' : 'Assistant'}: ${m.text}`)
            .join('\n')
        : '';

      const response = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: `Language Instruction: ${languageDirective}\n\nPrior Conversation:\n${conversationTrail || 'None'}\n\nRetrieved Primary Archive Sources:\n${contextBlocks}\n\nDynastic Reference Summaries:\n${dynastySummary}\n\nScholar Question:\n${question.trim()}`,
          config: {
            systemInstruction:
              'You are the Virasat Hub Historical Research Assistant. Answer the scholar’s question clearly and rigorously, strictly grounded in the Retrieved Primary Archive Sources and Dynastic Reference Summaries provided. Always reference specific accession numbers (e.g., VH-1007) in "answer" and list cited entry IDs in citedEntryIds. Keep written answers concise (2–3 paragraphs). Also generate "spokenText" in the EXACT same target language, formatted strictly for native Text-to-Speech pronunciation: use 100% pure native script of the target language with natural spoken grammar, spell out ALL numbers, years, and accession numbers as words in the target language (e.g., in Tamil spell out numbers in Tamil words and write "ஆவணம் ஆயிரத்து ஏழு" instead of "VH-1007"), transliterate any proper nouns into accurate native script, omit ALL parenthetical English words/abbreviations (like BCE/CE), and use short clear clauses with commas for natural breathing pauses. Whenever the response language is NOT English, also provide an accurate "englishTranslation" of "answer" in English (or an empty string if the response is already in English).',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description: 'Grounded historical response referencing accession numbers in the target language.',
                },
                spokenText: {
                  type: Type.STRING,
                  description: '100% native-script, phonetic speech-ready narration in the target language with numbers and proper nouns written out naturally in the target script for exact TTS pronunciation.',
                },
                englishTranslation: {
                  type: Type.STRING,
                  description: 'Full English translation of the answer when the response language is not English; empty string if already English.',
                },
                detectedLanguageCode: {
                  type: Type.STRING,
                  description: 'BCP-47 speech locale for the response language, e.g., en-IN, ta-IN, hi-IN, te-IN, ml-IN, kn-IN, fr-FR.',
                },
                detectedLanguageName: {
                  type: Type.STRING,
                  description: 'English name of the response language, e.g., English, Tamil, Hindi.',
                },
                citedEntryIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'IDs (e.g., ent-07) of archive entries directly cited in the answer.',
                },
              },
              required: ['answer', 'spokenText', 'englishTranslation', 'detectedLanguageCode', 'detectedLanguageName', 'citedEntryIds'],
            },
          },
        },
        ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite']
      );

      const parsed = JSON.parse(stripJsonCodeFences(response.text ?? '{}')) as {
        answer?: string;
        spokenText?: string;
        englishTranslation?: string;
        detectedLanguageCode?: string;
        detectedLanguageName?: string;
        citedEntryIds?: string[];
      };

      const citedSet = new Set(parsed.citedEntryIds ?? []);
      const citations = ranked
        .filter(({ entry }) => citedSet.has(entry.id) || citedSet.size === 0)
        .slice(0, 3)
        .map(({ entry, score }) => ({
          entryId: entry.id,
          accessionNo: entry.accessionNo,
          title: entry.title,
          dynastyName: entry.dynastyName,
          relevanceScore: Number(score.toFixed(3)),
        }));

      const answerText = parsed.answer || 'No archival synthesis could be generated.';
      const resolvedLocale = parsed.detectedLanguageCode || selectedLang?.speechLocale || 'en-IN';
      let englishTranslation = (parsed.englishTranslation || '').trim();

      // Guarantee an English translation is visible whenever the assistant replies in a non-English language
      if (!englishTranslation && !resolvedLocale.toLowerCase().startsWith('en') && answerText) {
        try {
          const transRes = await generateContentWithRetry(
            ai,
            {
              model: 'gemini-3.1-flash-lite',
              contents: `Translate the following historical answer accurately into English. Output ONLY the English translation:\n\n${answerText}`,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              },
            },
            ['gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen']
          );
          englishTranslation = (transRes.text ?? '').trim();
        } catch (transErr) {
          console.warn('Secondary English translation generation skipped:', transErr);
        }
      }

      res.json({
        answer: answerText,
        spokenText: parsed.spokenText || answerText,
        englishTranslation,
        detectedLanguageCode: resolvedLocale,
        detectedLanguageName: parsed.detectedLanguageName || selectedLang?.label || 'English',
        citations,
      });
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(502).json({
        error: extractGeminiErrorMessage(error, 'Research Assistant failed to reach Gemini API.'),
      });
    }
  });

  // Serve Vite in dev or built static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Virasat Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
