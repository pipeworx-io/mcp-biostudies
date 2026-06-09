interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * EBI BioStudies MCP.
 *
 * EBI BioStudies is a keyless database of biological study descriptions that
 * links across EBI archives (ArrayExpress, PRIDE, etc.). It holds metadata,
 * attributes, and cross-archive links for studies spanning many data types.
 */


const BASE = 'https://www.ebi.ac.uk/biostudies/api/v1';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_studies',
    description:
      'Search EBI BioStudies — a keyless database of biological study descriptions that links across EBI archives (ArrayExpress, PRIDE, etc.). Find studies by keyword and get accession, title, authors, type, release date, and link/file counts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword query, e.g. "crispr" or "breast cancer".' },
        limit: { type: 'number', description: 'Max results per page, default 15, max 100.' },
        page: { type: 'number', description: 'Page number, default 1.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_study',
    description:
      'Get the metadata for a single EBI BioStudies study by accession (e.g. "S-EPMC6010251"). Returns the title, flattened attributes (abstract, release date, data source, etc.), and counts of links and subsections. EBI BioStudies links across EBI archives. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        accession: { type: 'string', description: 'Study accession, e.g. "S-EPMC6010251".' },
      },
      required: ['accession'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_studies':
        return await searchStudies(args);
      case 'get_study':
        return await getStudy(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchStudies(args: Record<string, unknown>): Promise<unknown> {
  const query = reqStr(args, 'query');
  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 15;
  if (!Number.isFinite(limit) || limit < 1) limit = 15;
  if (limit > 100) limit = 100;
  let page = typeof args.page === 'number' ? Math.floor(args.page) : 1;
  if (!Number.isFinite(page) || page < 1) page = 1;

  const url = `${BASE}/search?query=${encodeURIComponent(query)}&pageSize=${limit}&page=${page}`;
  const data = (await getJson(url)) as Record<string, unknown>;
  const hits = Array.isArray(data.hits) ? (data.hits as Record<string, unknown>[]) : [];

  const studies = hits.map((h) => ({
    accession: h.accession ?? null,
    title: h.title ?? null,
    author: h.author ?? null,
    type: h.type ?? null,
    release_date: h.release_date ?? null,
    links: h.links ?? null,
    files: h.files ?? null,
  }));

  return {
    total: data.totalHits ?? null,
    count: studies.length,
    studies,
  };
}

async function getStudy(args: Record<string, unknown>): Promise<unknown> {
  const accession = reqStr(args, 'accession');
  const url = `${BASE}/studies/${encodeURIComponent(accession)}`;

  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) {
    return { error: 'study not found', accession };
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: 'study not found', accession };
  }
  if (!data || typeof data !== 'object') {
    return { error: 'study not found', accession };
  }

  const section = isRecord(data.section) ? data.section : {};

  // Flatten top-level + section attributes into { name: value } pairs.
  const attributes: Record<string, unknown> = {};
  collectAttributes(data.attributes, attributes);
  collectAttributes(section.attributes, attributes);

  const subsections = Array.isArray(section.subsections) ? section.subsections : [];

  return {
    accession: data.accno ?? accession,
    title: attributes.Title ?? attributes.title ?? null,
    attributes,
    links_count: countLinks(section),
    n_subsections: subsections.length,
  };
}

// --- helpers ---------------------------------------------------------------

function collectAttributes(raw: unknown, out: Record<string, unknown>): void {
  if (!Array.isArray(raw)) return;
  for (const attr of raw) {
    if (isRecord(attr) && typeof attr.name === 'string' && !('reference' in attr)) {
      if (!(attr.name in out)) out[attr.name] = attr.value ?? null;
    }
  }
}

// Recursively count link entries anywhere under the section. Links appear as
// `links` arrays (sometimes nested arrays of {url, attributes}) on the section
// and on/within subsections, which may themselves be arrays.
function countLinks(node: unknown): number {
  let n = 0;
  if (Array.isArray(node)) {
    for (const item of node) n += countLinks(item);
    return n;
  }
  if (!isRecord(node)) return 0;
  if (Array.isArray(node.links)) n += flattenCount(node.links);
  if (Array.isArray(node.subsections)) n += countLinks(node.subsections);
  return n;
}

function flattenCount(links: unknown[]): number {
  let n = 0;
  for (const l of links) {
    if (Array.isArray(l)) n += flattenCount(l);
    else if (isRecord(l) && 'url' in l) n += 1;
  }
  return n;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`BioStudies: ${res.status} ${body}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing.`);
  return v.trim();
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
