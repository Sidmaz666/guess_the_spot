import axios from 'axios';

// ============================================================
// CONFIGURATION
// ============================================================

const WIKIMEDIA_BASE_URL = process.env.WIKIMEDIA_BASE_URL || 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA_BASE_URL = process.env.WIKIPEDIA_BASE_URL || 'https://en.wikipedia.org/w/api.php';
const OPENVERSE_BASE_URL = process.env.OPENVERSE_BASE_URL || 'https://api.openverse.org/v1/images';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const BING_API_KEY = process.env.BING_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// ============================================================
// TYPES
// ============================================================

interface Photo {
  id: number;
  lat: number;
  lng: number;
  fileurl: string;
  title?: string;
  description?: string;
  author?: string;
  license?: string;
  width?: number;
  height?: number;
  size?: number;
  coordinates?: { lat: number; lon: number; primary?: boolean; globe?: string };
}

interface Stage {
  name: string;
  fn: () => Promise<Photo | null>;
  timeout: number;
  skip?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const JUNK_PATTERNS = [
  'encrypted-tbn0.gstatic.com', 'images.google.com/tbn', 'th?id=', 'tbn:',
  'google.com/images/spinner', 'data:image', 'base64,', 'googlelogo',
  'favicon', 'pixel', 'google.com/logo', 'gstatic.com', '1x1.gif',
  'placeholder', 'spacer', 'blank.gif', 'transparent',
  // CDN-protected / stock photo agencies that block hotlinking
  'alamy.com', 'alamyimg.com', 'istockphoto.com', 'gettyimages.com',
  '.shutterstock.com', 'dreamstime.com', '123rf.com', 'depositphotos.com',
  'canstockphoto.com', 'bigstockphoto.com', 'corbis.com',
  'agefotostock.com', 'superstock.com', 'stock.adobe.com',
  'stockphoto.com', 'dissolve.com', 'offset.com',
];

const GENERIC_TITLE_PATTERNS = [
  'view of earth', 'iss photo', 'satellite image', 'satellite view',
  'map of', 'diagram', 'location map', 'blank map', 'orthographic',
  'flag of', 'coat of arms', 'emblem', 'seal of',
  'logo', 'icon', 'symbol', 'wikidata', 'nasa image',
  'illustration of', 'stock photo', 'placeholder',
  'world map', 'globe view',
];

const GENERIC_URL_PATTERNS = [
  '-map.', '-map-', '/map.', 'maps.google', 'openstreetmap',
  'wikimedia.org/map', 'mapbox',
];

// ============================================================
// UTILITY
// ============================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isJunkUrl(url: string): boolean {
  if (JUNK_PATTERNS.some(p => url.toLowerCase().includes(p))) return true;
  if (GENERIC_URL_PATTERNS.some(p => url.toLowerCase().includes(p))) return true;
  return false;
}

function isGenericTitle(title?: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase();
  return GENERIC_TITLE_PATTERNS.some(p => lower.includes(p));
}

function countLocationTerms(title: string | undefined, terms: string[]): number {
  if (!title) return 0;
  const lower = title.toLowerCase();
  return terms.filter(t => lower.includes(t)).length;
}

function getLocationTerms(location?: any): string[] {
  if (!location) return [];
  const terms: string[] = [];
  const add = (v?: string) => { if (v && v.length > 2) terms.push(v.toLowerCase()); };
  add(location.city); add(location.state); add(location.country); add(location.localName);
  return terms;
}

function resolveUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname === '/iu/') {
      const orig = parsed.searchParams.get('u');
      if (orig) return decodeURIComponent(orig);
    }
    if (parsed.hostname.includes('googleusercontent.com')) {
      return url.replace(/=w\d+-h\d+(-c)?$/, '').replace(/=s\d+$/, '');
    }
  } catch { }
  return url;
}

function createPhotoObject(pageId: string | number, page: any, coords: any, imageInfo: any): Photo {
  const ext = imageInfo.extmetadata || {};
  return {
    id: typeof pageId === 'string' ? parseInt(pageId) || 0 : pageId,
    lat: parseFloat(coords.lat), lng: parseFloat(coords.lon),
    fileurl: imageInfo.url, title: page.title,
    description: ext.ImageDescription?.value || ext.ObjectName?.value,
    author: ext.Artist?.value || ext.Credit?.value || ext.Author?.value,
    license: ext.LicenseShortName?.value || ext.License?.value,
    width: imageInfo.width, height: imageInfo.height, size: imageInfo.size,
    coordinates: { lat: parseFloat(coords.lat), lon: parseFloat(coords.lon), primary: coords.primary, globe: coords.globe },
  };
}

function createPhotoFromUrl(url: string, lat: number, lon: number, title?: string, author?: string, width?: number, height?: number): Photo {
  return { id: Math.floor(Math.random() * 2147483647), lat, lng: lon, fileurl: url, title, author, width, height, coordinates: { lat, lon, primary: true, globe: 'earth' } };
}

async function verifyImageUrl(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const resp = await axios.head(url, {
      headers: { 'User-Agent': randomUA(), 'Accept': 'image/webp,image/*,*/*', 'Range': 'bytes=0-0' },
      timeout: timeoutMs,
      validateStatus: s => s >= 200 && s < 400,
      maxRedirects: 3,
    });
    return true;
  } catch {
    // Some CDNs reject HEAD — try a tiny GET
    try {
      const resp = await axios.get(url, {
        headers: { 'User-Agent': randomUA(), 'Accept': 'image/webp,image/*,*/*', 'Range': 'bytes=0-0' },
        timeout: timeoutMs,
        validateStatus: s => s >= 200 && s < 400,
        maxRedirects: 3,
        responseType: 'stream',
      });
      resp.data.destroy();
      return true;
    } catch {
      return false;
    }
  }
}

async function fetchWithUA(url: string, retries = 3, timeoutMs = 10000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': randomUA(), Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: timeoutMs,
        validateStatus: s => s >= 200 && s < 300,
      });
      return response.data;
    } catch (error: any) {
      if (attempt === retries) throw new Error(`Fetch failed: ${error.message}`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let tid: NodeJS.Timeout;
  const to = new Promise<never>((_, reject) => { tid = setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms); });
  try { return await Promise.race([promise, to]); } finally { clearTimeout(tid!); }
}

function createLocationKeywords(location?: any): string[] {
  if (!location) return [];
  const k: string[] = [];
  const add = (s?: string) => { if (s && s.length > 2) k.push(s); };
  if (location.displayName?.length < 150) k.push(location.displayName);
  if (location.city && location.country) add(`${location.city}, ${location.country}`);
  if (location.city) add(location.city);
  if (location.state && location.country) add(`${location.state}, ${location.country}`);
  if (location.localName && location.localName.length > 2) add(location.localName);
  if (location.country) add(location.country);
  return k;
}

function getWikimediaFileUrl(page: any): string | null {
  const info = page.imageinfo?.[0];
  if (info?.url) return info.url;
  if (page.thumbnail?.source) {
    const m = page.thumbnail.source.match(/\/\d+px-(.+?)(?:\?|$)/);
    if (m) { const f = m[1].charAt(0), s = m[1].charAt(1); return `https://upload.wikimedia.org/wikipedia/commons/${f}/${s}/${m[1]}`; }
    return page.thumbnail.source;
  }
  return null;
}

// ============================================================
// STAGE 1: PLAYWRIGHT — Browser-based multi-engine image search
// ============================================================

const SEARCH_ENGINES = [
  {
    name: 'google',
    buildUrl: (q: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`,
    extractScript: `(() => {
      const urls = [];
      document.querySelectorAll('div[data-ou]').forEach(el => { const ou = el.getAttribute('data-ou'); if(ou) urls.push(ou); });
      if(!urls.length) {
        document.querySelectorAll('a[href*="/imgres?"]').forEach(a => {
          try { const u = new URL(a.href); const imgurl = u.searchParams.get('imgurl'); if(imgurl) urls.push(decodeURIComponent(imgurl)); } catch(e){}
        });
      }
      return [...new Set(urls)].slice(0,20);
    })()`,
  },
  {
    name: 'bing',
    buildUrl: (q: string) => `https://www.bing.com/images/search?q=${encodeURIComponent(q)}`,
    extractScript: `(() => {
      const urls = [];
      document.querySelectorAll('a.iusc').forEach(a => {
        try { const m = JSON.parse(a.getAttribute('m')); if(m.murl) urls.push(m.murl); } catch(e){}
      });
      return [...new Set(urls)].slice(0,20);
    })()`,
  },
  {
    name: 'duckduckgo',
    buildUrl: (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
    extractScript: `(() => {
      const urls = [];
      document.querySelectorAll('img.tile--img__media, img.js-images-tile, img[data-src]').forEach(img => {
        const src = img.getAttribute('data-src') || img.src;
        if(src && !src.startsWith('data:')) urls.push(src);
      });
      return [...new Set(urls)].slice(0,20);
    })()`,
  },
];

async function findChromiumPath(): Promise<string | null> {
  // 1) @sparticuz/chromium-min (Vercel/production — executablePath is async)
  try {
    const cm: any = await import('@sparticuz/chromium-min');
    const ep = typeof cm.executablePath === 'function' ? await cm.executablePath() : cm.executablePath;
    if (ep && typeof ep === 'string') return ep;
  } catch {}

  // 2) Playwright-installed chromium in ms-playwright cache
  try {
    const os = require('os') as typeof import('os');
    const path = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const home = os.homedir();
    const candidates = [
      path.join(home, 'AppData', 'Local', 'ms-playwright'),
      path.join(home, '.cache', 'ms-playwright'),
      '/tmp/ms-playwright',
    ];
    for (const base of candidates) {
      if (!fs.existsSync(base)) continue;
      const entries = fs.readdirSync(base).filter((e: string) => e.startsWith('chromium-'));
      entries.sort().reverse();
      for (const dir of entries) {
        const dirPath = path.join(base, dir);
        const leafDirs = fs.readdirSync(dirPath).filter((e: string) => {
          const s = fs.statSync(path.join(dirPath, e));
          return s.isDirectory();
        });
        for (const leaf of leafDirs) {
          for (const name of ['chrome', 'chromium', 'chrome-headless-shell']) {
            for (const ext of ['exe', '']) {
              const full = path.join(dirPath, leaf, ext ? `${name}.${ext}` : name);
              if (fs.existsSync(full)) return full;
            }
          }
        }
      }
    }
  } catch {}

  // 3) System-installed Chrome / Chromium
  try {
    const fs = require('fs') as typeof import('fs');
    const checks = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of checks) {
      if (fs.existsSync(p)) return p;
    }
  } catch {}

  return null;
}

async function stagePlaywrightMultiEngine(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;

  let playwright: any;
  let chromiumArgs: string[];
  try {
    playwright = await import('playwright-core');
    const cm: any = await import('@sparticuz/chromium-min').catch(() => null);
    chromiumArgs = cm?.args ?? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless'];

    const execPath = await findChromiumPath();
    if (!execPath) return null;

    for (const keyword of keywords) {
      for (const engine of SEARCH_ENGINES) {
        let browser: any = null;
        try {
          browser = await playwright.chromium.launch({
            args: chromiumArgs,
            executablePath: execPath,
            headless: true,
          });
          const context = await browser.newContext({ userAgent: randomUA() });
          const page = await context.newPage();
          await page.goto(engine.buildUrl(keyword), { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(2500 + Math.random() * 2000);

          try { await page.evaluate(`(async()=>{for(let i=0;i<3;i++){window.scrollTo(0,document.body.scrollHeight);await new Promise(r=>setTimeout(r,1200));}window.scrollTo(0,0);})()`); } catch {}
          await page.waitForTimeout(1500);

          const urls: string[] = await page.evaluate(engine.extractScript).catch(() => []);
          await browser.close().catch(() => {});

          const resolved = urls.map(resolveUrl).filter((u: string) => !isJunkUrl(u) && u.startsWith('http'));
          if (resolved.length === 0) continue;

          const locationTerms = getLocationTerms(location);
          const kwParts = keyword.toLowerCase().split(',').map((s: string) => s.trim());
          const scored = resolved.map((url: string) => ({
            url,
            score: (kwParts.some((p: string) => url.toLowerCase().includes(p)) ? 2 : 0) +
              (locationTerms.some((t: string) => url.toLowerCase().includes(t)) ? 2 : 0),
          })).sort((a: any, b: any) => b.score - a.score);

          return createPhotoFromUrl(scored[0].url, lat, lon, keyword, engine.name);
        } catch {
          if (browser) await browser.close().catch(() => {});
          continue;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

// ============================================================
// STAGE 2: DuckDuckGo — Axios VQD fallback
// ============================================================

async function stageDuckDuckGoAxios(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;

  for (const keyword of keywords) {
    try {
      const htmlResp = await axios.get(`https://duckduckgo.com/?q=${encodeURIComponent(keyword)}&iax=images&ia=images`, {
        headers: { 'User-Agent': randomUA(), Accept: 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 8000, responseType: 'text',
      });
      const html = typeof htmlResp.data === 'string' ? htmlResp.data : String(htmlResp.data);
      const vqd = html.match(/vqd=([\d-]+)/)?.[1] || html.match(/"vqd":"([\d-]+)"/)?.[1];
      if (!vqd) continue;

      const imageData = await withTimeout(fetchWithUA(`https://duckduckgo.com/i.js?q=${encodeURIComponent(keyword)}&o=json&vqd=${vqd}`, 2, 5000), 5000);
      if (!imageData?.results) continue;

      const locationTerms = getLocationTerms(location);
      const scored = imageData.results
        .filter((r: any) => r.image && !isJunkUrl(r.image) && !r.image.endsWith('.svg'))
        .map((r: any) => ({
          url: resolveUrl(r.image),
          title: r.title || '',
          score: countLocationTerms(r.title, locationTerms) * 3 +
            (r.title?.toLowerCase().includes(keyword.toLowerCase()) ? 2 : 0) +
            (r.url?.toLowerCase().includes(keyword.toLowerCase().split(',')[0]) ? 1 : 0),
          skipGeneric: isGenericTitle(r.title),
        }))
        .filter((r: any) => !r.skipGeneric && !isJunkUrl(r.url))
        .sort((a: any, b: any) => b.score - a.score);

      if (scored.length === 0) continue;
      for (const candidate of scored.slice(0, 5)) {
        const ok = await verifyImageUrl(candidate.url).catch(() => false);
        if (ok) return createPhotoFromUrl(candidate.url, lat, lon, candidate.title || keyword);
      }
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 3: Google Custom Search API
// ============================================================

async function stageGoogleSearch(lat: number, lon: number, location?: any): Promise<Photo | null> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return null;
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;

  for (const keyword of keywords) {
    try {
      const data = await withTimeout(fetchWithUA(`https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(keyword)}&searchType=image&safe=active&num=5`, 1, 5000), 5000);
      if (!data?.items) continue;

      const locationTerms = getLocationTerms(location);
      const scored = data.items
        .filter((i: any) => i.link && !isJunkUrl(i.link) && !i.link.endsWith('.svg'))
        .map((i: any) => ({ url: i.link, score: countLocationTerms(i.title, locationTerms) * 3 + countLocationTerms(i.snippet, locationTerms) * 2 }))
        .filter((r: any) => !isGenericTitle(r.url))
        .sort((a: any, b: any) => b.score - a.score);
      if (scored.length === 0) continue;
      return createPhotoFromUrl(scored[0].url, lat, lon, keyword);
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 4: Bing API
// ============================================================

async function stageBingSearch(lat: number, lon: number, location?: any): Promise<Photo | null> {
  if (!BING_API_KEY) return null;
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;

  for (const keyword of keywords) {
    try {
      const data = await withTimeout(fetchWithUA(`https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(keyword)}&count=5&safeSearch=Strict`, 1, 5000), 5000);
      if (!data?.value) continue;

      const locationTerms = getLocationTerms(location);
      const scored = data.value
        .filter((i: any) => i.contentUrl && !isJunkUrl(i.contentUrl))
        .map((i: any) => ({ url: i.contentUrl, score: countLocationTerms(i.name, locationTerms) * 3 }))
        .filter((r: any) => !isGenericTitle(r.url))
        .sort((a: any, b: any) => b.score - a.score);
      if (scored.length === 0) continue;
      return createPhotoFromUrl(scored[0].url, lat, lon, keyword);
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 5: Wikimedia Commons Geosearch
// ============================================================

async function stageWikimediaGeosearch(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const locationTerms = getLocationTerms(location);

  for (let radius = 100; radius <= 10000; radius *= 2) {
    try {
      const data = await withTimeout(fetchWithUA(
        `${WIKIMEDIA_BASE_URL}?${new URLSearchParams({ action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lon}`, ggsradius: String(Math.min(radius, 10000)), ggsnamespace: '6', ggslimit: '25', prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|size|timestamp', format: 'json', origin: '*' })}`,
        2, 5000,
      ), 6000);
      const pages = data.query?.pages;
      if (!pages) continue;

      const candidates: Array<{ page: any; pageId: string; coords: any; info: any; score: number }> = [];

      for (const pageId of Object.keys(pages).filter(k => k !== '-1')) {
        const page = pages[pageId];
        const coords = page.coordinates?.[0];
        const info = page.imageinfo?.[0];
        if (!info?.url || isJunkUrl(info.url)) continue;

        const dist = coords ? haversineKm(lat, lon, parseFloat(coords.lat), parseFloat(coords.lon)) : Infinity;
        const title = page.title || '';
        const desc = (info.extmetadata?.ImageDescription?.value || '').toLowerCase();
        let score = 0;

        if (coords) { score += 10; if (dist < 1) score += 15; else if (dist < 5) score += 10; else if (dist < 20) score += 5; }
        score += countLocationTerms(title, locationTerms) * 8;
        score += countLocationTerms(desc, locationTerms) * 5;
        if (isGenericTitle(title)) score -= 20;
        if (desc.includes('photograph') || desc.includes('photo of')) score += 3;

        candidates.push({ page, pageId, coords, info, score });
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates.find(c => c.score > -15);
      if (best) {
        const coords = best.coords || { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
        return createPhotoObject(best.pageId, best.page, coords, best.info);
      }
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 6: Wikipedia Article (with coordinate check)
// ============================================================

async function stageWikipediaArticle(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;
  const locationTerms = getLocationTerms(location);

  for (const keyword of keywords) {
    try {
      const data = await withTimeout(fetchWithUA(
        `${WIKIPEDIA_BASE_URL}?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: keyword, gsrlimit: '5', prop: 'pageimages|coordinates|info', pithumbsize: '800', format: 'json', origin: '*' })}`,
        2, 5000,
      ), 6000);
      const pages = data.query?.pages;
      if (!pages) continue;

      const candidates: Array<{ page: any; score: number }> = [];
      for (const page of Object.values(pages) as any[]) {
        if (!page.thumbnail?.source && !page.pageimage) continue;
        const coords = page.coordinates?.[0];
        let score = 0;
        if (coords) {
          const dist = haversineKm(lat, lon, coords.lat, coords.lon);
          if (dist < 5) score += 20; else if (dist < 20) score += 10; else if (dist < 50) score += 5; else score -= 10;
        } else { score -= 5; }
        score += countLocationTerms(page.title, locationTerms) * 10;
        if (isGenericTitle(page.title)) score -= 15;
        candidates.push({ page, score });
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates.find(c => c.score > 5);
      if (!best) continue;

      const thumb = best.page.thumbnail?.source || best.page.pageimage;
      if (!thumb) continue;
      const coords = best.page.coordinates?.[0];
      const pc = coords ? { lat: coords.lat.toString(), lon: coords.lon.toString() } : { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
      return createPhotoObject(best.page.pageid || Math.random().toString(), best.page, pc, { url: thumb, width: best.page.thumbnail?.width || 800, height: best.page.thumbnail?.height || 600 });
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 7: Wikimedia Name Search
// ============================================================

async function stageWikimediaNameSearch(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;
  const terms = getLocationTerms(location);

  for (const keyword of keywords) {
    try {
      const sd = await withTimeout(fetchWithUA(`${WIKIMEDIA_BASE_URL}?${new URLSearchParams({ action: 'query', list: 'search', srsearch: keyword, srnamespace: '6', srlimit: '15', format: 'json', origin: '*' })}`, 2, 5000), 6000);
      const results = sd.query?.search;
      if (!results) continue;

      const ids = results.slice(0, 8).map((r: any) => r.pageid).filter(Boolean);
      const id = await withTimeout(fetchWithUA(`${WIKIMEDIA_BASE_URL}?${new URLSearchParams({ action: 'query', pageids: ids.join('|'), prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|size', format: 'json', origin: '*' })}`, 1, 5000), 5000);
      const pgs = id.query?.pages;
      if (!pgs) continue;

      const candidates: Array<{ pid: string; page: any; score: number }> = [];
      for (const pid of Object.keys(pgs).filter(k => k !== '-1')) {
        const page = pgs[pid]; const url = getWikimediaFileUrl(page); if (!url) continue;
        let score = countLocationTerms(page.title, terms) * 5;
        if (isGenericTitle(page.title)) score -= 15;
        const coords = page.coordinates?.[0];
        if (coords) { const d = haversineKm(lat, lon, coords.lat, coords.lon); score += d < 10 ? 15 : d < 50 ? 5 : 0; }
        candidates.push({ pid, page, score });
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates.find(c => c.score > -10);
      if (!best) continue;
      const coords = best.page.coordinates?.[0];
      const pc = coords ? { lat: coords.lat.toString(), lon: coords.lon.toString() } : { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
      return createPhotoObject(best.pid, best.page, pc, best.page.imageinfo?.[0] || {});
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 8: Openverse
// ============================================================

async function stageOpenverse(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const queries = location ? [`"${location.displayName}"`, `${location.city || ''} ${location.country || ''}`, `${location.country || ''} landscape`] : ['landscape photography'];
  const terms = getLocationTerms(location);

  for (const q of queries) {
    try {
      const data = await withTimeout(fetchWithUA(`${OPENVERSE_BASE_URL}/?${new URLSearchParams({ q, page_size: '20', license: 'cc0,by,by-sa,by-nc,by-nc-sa,by-nd,by-nc-nd', source: 'flickr,wikimedia', mature: 'false' })}`, 1, 5000), 5000);
      if (!data?.results) continue;

      const scored = data.results
        .filter((i: any) => !i.mature && i.url && !isJunkUrl(i.url))
        .map((i: any) => ({ url: i.url, title: i.title, score: countLocationTerms(i.title, terms) * 5, skipGeneric: isGenericTitle(i.title) }))
        .filter((r: any) => !r.skipGeneric)
        .sort((a: any, b: any) => b.score - a.score);
      if (scored.length === 0) continue;
      return createPhotoFromUrl(scored[0].url, lat, lon, scored[0].title);
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 9: Country Fallback
// ============================================================

async function stageCountryFallback(lat: number, lon: number, location?: any): Promise<Photo | null> {
  const country = location?.country;
  if (!country) return null;

  for (const kw of [country, `${country} landscape`, `${country} city`, `${country} landmark`]) {
    try {
      const data = await withTimeout(fetchWithUA(
        `${WIKIMEDIA_BASE_URL}?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: kw, gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|size', format: 'json', origin: '*' })}`,
        1, 5000,
      ), 6000);
      const pages = data.query?.pages;
      if (!pages) continue;

      const candidates: Array<{ pid: string; page: any; score: number }> = [];
      for (const pid of Object.keys(pages).filter(k => k !== '-1')) {
        const page = pages[pid]; const info = page.imageinfo?.[0]; if (!info?.url) continue;
        let score = 0;
        const coords = page.coordinates?.[0];
        if (coords) { const d = haversineKm(lat, lon, coords.lat, coords.lon); if (d < 100) score += 10; else if (d < 500) score += 5; }
        candidates.push({ pid, page, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length === 0) continue;

      const best = candidates[0];
      const coords = best.page.coordinates?.[0];
      const pc = coords ? { lat: coords.lat.toString(), lon: coords.lon.toString() } : { lat: lat.toString(), lon: lon.toString(), primary: false, globe: 'earth' };
      return createPhotoObject(best.pid, best.page, pc, best.page.imageinfo?.[0]);
    } catch { continue; }
  }
  return null;
}

// ============================================================
// STAGE 10: Pexels / Pixabay
// ============================================================

async function stagePexels(lat: number, lon: number, location?: any): Promise<Photo | null> {
  if (!PEXELS_API_KEY) return null;
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;
  const terms = getLocationTerms(location);

  for (const kw of keywords) {
    try {
      const data = await withTimeout(fetchWithUA(`https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=5`, 1, 5000), 5000);
      const photos = data?.photos?.filter((p: any) => p.src?.large).map((p: any) => ({ url: p.src.large, score: countLocationTerms(p.alt || '', terms) * 3, skip: isGenericTitle(p.alt) })).filter((r: any) => !r.skip).sort((a: any, b: any) => b.score - a.score);
      if (photos?.length) return createPhotoFromUrl(photos[0].url, lat, lon, kw);
    } catch { continue; }
  }
  return null;
}

async function stagePixabay(lat: number, lon: number, location?: any): Promise<Photo | null> {
  if (!PIXABAY_API_KEY) return null;
  const keywords = createLocationKeywords(location);
  if (keywords.length === 0) return null;
  const terms = getLocationTerms(location);

  for (const kw of keywords) {
    try {
      const data = await withTimeout(fetchWithUA(`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(kw)}&image_type=photo&per_page=5&safesearch=true`, 1, 5000), 5000);
      const hits = data?.hits?.filter((h: any) => h.webformatURL).map((h: any) => ({ url: h.webformatURL, score: countLocationTerms(h.tags || '', terms) * 5, skip: isGenericTitle(h.tags) })).filter((r: any) => !r.skip).sort((a: any, b: any) => b.score - a.score);
      if (hits?.length) return createPhotoFromUrl(hits[0].url, lat, lon, kw);
    } catch { continue; }
  }
  return null;
}

// ============================================================
// MAIN PIPELINE — parallel race
// ============================================================

async function runStage(s: Stage): Promise<Photo | null> {
  try {
    const photo = await withTimeout(s.fn(), s.timeout);
    if (photo && photo.fileurl && !photo.fileurl.includes('wikimedia.org')) {
      const ok = await verifyImageUrl(photo.fileurl).catch(() => false);
      if (!ok) return null;
    }
    return photo;
  } catch {
    return null;
  }
}

async function raceStages(stages: Stage[]): Promise<Photo | null> {
  if (stages.length === 0) return null;
  // Kick off all stage promises at once, then return the first non-null
  const wrapped = stages.map(s =>
    runStage(s).then(r => ({ from: s.name, photo: r })).catch(() => ({ from: s.name, photo: null as Photo | null }))
  );
  const results = await Promise.all(wrapped);
  return results.find(r => r.photo !== null)?.photo || null;
}

export async function getNearbyPhotoWithFallback(lat: number, lon: number, _radius = 5000, location?: any): Promise<Photo | null> {
  const fastStages: Stage[] = [
    { name: 'DuckDuckGo Axios', fn: () => stageDuckDuckGoAxios(lat, lon, location), timeout: 10000 },
    { name: 'Openverse', fn: () => stageOpenverse(lat, lon, location), timeout: 8000 },
    { name: 'Wikipedia Article', fn: () => stageWikipediaArticle(lat, lon, location), timeout: 8000 },
    { name: 'Google Custom Search', fn: () => stageGoogleSearch(lat, lon, location), timeout: 8000, skip: !GOOGLE_API_KEY || !GOOGLE_CX },
    { name: 'Bing Search', fn: () => stageBingSearch(lat, lon, location), timeout: 8000, skip: !BING_API_KEY },
  ];

  const slowStages: Stage[] = [
    { name: 'Wikimedia Geosearch', fn: () => stageWikimediaGeosearch(lat, lon, location), timeout: 12000 },
    { name: 'Wikimedia Name Search', fn: () => stageWikimediaNameSearch(lat, lon, location), timeout: 8000 },
    { name: 'Country Fallback', fn: () => stageCountryFallback(lat, lon, location), timeout: 10000 },
    { name: 'Pexels', fn: () => stagePexels(lat, lon, location), timeout: 8000, skip: !PEXELS_API_KEY },
    { name: 'Pixabay', fn: () => stagePixabay(lat, lon, location), timeout: 8000, skip: !PIXABAY_API_KEY },
  ];

  // Wave 1: fast sources in parallel — should resolve in ~3-8s
  const hit1 = await raceStages(fastStages.filter(s => !s.skip));
  if (hit1) return hit1;

  // Wave 1.5: Playwright (slow, browser launch) while slower sources also run
  const bonusStages: Stage[] = [
    { name: 'Playwright Browser', fn: () => stagePlaywrightMultiEngine(lat, lon, location), timeout: 20000 },
    ...slowStages.filter(s => !s.skip),
  ];
  return await raceStages(bonusStages);
}

export async function getNearbyPhotoWikimedia(place: { lat: number; lon: number }, location?: any): Promise<Photo | null> {
  return stageWikimediaGeosearch(place.lat, place.lon, location);
}

export async function getNearbyPhotoOpenverse(lat: number, lon: number, _radius?: number, location?: any): Promise<Photo | null> {
  return stageOpenverse(lat, lon, location);
}
