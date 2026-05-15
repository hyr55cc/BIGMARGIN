let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

const SAUDI_STOCKS = [
  {id:'2222',sym:'2222.SR',name:'أرامكو السعودية',cat:'big'},
  {id:'1120',sym:'1120.SR',name:'مصرف الراجحي',cat:'big'},
  {id:'2010',sym:'2010.SR',name:'سابك',cat:'big'},
  {id:'7010',sym:'7010.SR',name:'شركة stc',cat:'big'},
  {id:'1180',sym:'1180.SR',name:'مصرف الإنماء',cat:'big'},
  {id:'1030',sym:'1030.SR',name:'البنك الأهلي',cat:'big'},
  {id:'2082',sym:'2082.SR',name:'أكوا باور',cat:'big'},
  {id:'4030',sym:'4030.SR',name:'المملكة القابضة',cat:'big'},
  {id:'1060',sym:'1060.SR',name:'بنك الجزيرة',cat:'big'},
  {id:'1080',sym:'1080.SR',name:'بنك البلاد',cat:'big'},
  {id:'4321',sym:'4321.SR',name:'الوطنية للتعليم',cat:'small'},
  {id:'1832',sym:'1832.SR',name:'الشرق للدهانات',cat:'small'},
  {id:'2100',sym:'2100.SR',name:'وفرة',cat:'small'},
  {id:'6070',sym:'6070.SR',name:'الفرصة للتطوير',cat:'small'},
  {id:'1831',sym:'1831.SR',name:'متاحف',cat:'small'},
  {id:'2290',sym:'2290.SR',name:'أبيار',cat:'small'},
  {id:'3030',sym:'3030.SR',name:'سوداكيم',cat:'small'},
  {id:'4143',sym:'4143.SR',name:'دانة غاز',cat:'small'},
  {id:'2210',sym:'2210.SR',name:'زجاج',cat:'small'},
  {id:'4261',sym:'4261.SR',name:'منشآت',cat:'small'},
  {id:'4020',sym:'4020.SR',name:'دار الأركان',cat:'other'},
  {id:'2370',sym:'2370.SR',name:'ميدغلف للتأمين',cat:'other'},
  {id:'2280',sym:'2280.SR',name:'أنابيب السعودية',cat:'other'},
  {id:'6001',sym:'6001.SR',name:'هرفي للخدمات',cat:'other'},
  {id:'2090',sym:'2090.SR',name:'سيمكو',cat:'other'},
  {id:'4050',sym:'4050.SR',name:'سدافكو',cat:'other'},
  {id:'2120',sym:'2120.SR',name:'المجموعة السعودية',cat:'other'},
  {id:'7200',sym:'7200.SR',name:'STC Pay',cat:'other'},
  {id:'4001',sym:'4001.SR',name:'تطوير المباني',cat:'other'},
  {id:'2170',sym:'2170.SR',name:'الاتحاد لاتصالات',cat:'other'},
];

// ── الحصول على crumb + cookie من Yahoo Finance ──
async function getYahooCrumb() {
  try {
    // الخطوة 1: احصل على cookie
    const cookieRes = await fetch('https://finance.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    const cookies = cookieRes.headers.get('set-cookie') || '';

    // الخطوة 2: احصل على crumb
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Cookie': cookies,
      },
    });
    const crumb = await crumbRes.text();
    return { crumb: crumb.trim(), cookies };
  } catch(e) {
    console.error('getYahooCrumb failed:', e.message);
    return null;
  }
}

// ── جلب من Yahoo Finance مع crumb ──
async function fetchWithCrumb(symbols) {
  const auth = await getYahooCrumb();
  if (!auth?.crumb) return null;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${encodeURIComponent(auth.crumb)}`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Cookie': auth.cookies,
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return null;
    const json = await r.json();
    return json?.quoteResponse?.result || null;
  } catch(e) {
    console.error('fetchWithCrumb failed:', e.message);
    return null;
  }
}

// ── جلب من Stooq (مصدر بديل مجاني) ──
async function fetchFromStooq(stockId) {
  try {
    const sym = `${stockId}.sa`; // رمز Stooq للسوق السعودي
    const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=json`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) return null;
    const json = await r.json();
    const s = json?.symbols?.[0];
    if (!s || !s.close) return null;
    return {
      price: parseFloat(s.close),
      open: parseFloat(s.open),
      high: parseFloat(s.high),
      low: parseFloat(s.low),
      volume: parseInt(s.volume) || 0,
      prevClose: parseFloat(s.open), // تقريب
      change: parseFloat(s.close) - parseFloat(s.open),
      changePct: ((parseFloat(s.close) - parseFloat(s.open)) / parseFloat(s.open)) * 100,
    };
  } catch(e) {
    return null;
  }
}

// ── جلب سهم واحد من Yahoo Chart API (لا يحتاج crumb) ──
async function fetchSingleChart(sym) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return null;
    const json = await r.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;
    return {
      price: parseFloat(price?.toFixed(2)),
      prevClose: parseFloat(prevClose?.toFixed(2)),
      change: parseFloat(change?.toFixed(2)),
      changePct: parseFloat(changePct?.toFixed(2)),
      open: meta.regularMarketOpen || price,
      high: meta.regularMarketDayHigh || price,
      low: meta.regularMarketDayLow || price,
      volume: meta.regularMarketVolume || 0,
    };
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  // أرجع الـ cache لو لا يزال صالحاً
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ok: true, cached: true, updatedAt: new Date(cache.ts).toISOString(), data: cache.data });
  }

  try {
    const symbols = SAUDI_STOCKS.map(s => s.sym).join(',');
    let quotesMap = {};

    // ── المحاولة 1: Yahoo مع crumb ──
    const crumbResults = await fetchWithCrumb(symbols);
    if (crumbResults?.length) {
      crumbResults.forEach(q => {
        quotesMap[q.symbol.replace('.SR', '')] = {
          price:     parseFloat((q.regularMarketPrice || 0).toFixed(2)),
          change:    parseFloat((q.regularMarketChange || 0).toFixed(2)),
          changePct: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
          prevClose: parseFloat((q.regularMarketPreviousClose || 0).toFixed(2)),
          open:      parseFloat((q.regularMarketOpen || 0).toFixed(2)),
          high:      parseFloat((q.regularMarketDayHigh || 0).toFixed(2)),
          low:       parseFloat((q.regularMarketDayLow || 0).toFixed(2)),
          volume:    q.regularMarketVolume || 0,
          source:    'yahoo',
        };
      });
    }

    // ── المحاولة 2: Yahoo Chart API لكل سهم ناقص ──
    const missing = SAUDI_STOCKS.filter(s => !quotesMap[s.id]);
    if (missing.length > 0) {
      // نجلب بالتوازي - 5 في المرة
      const chunks = [];
      for (let i = 0; i < missing.length; i += 5) chunks.push(missing.slice(i, i+5));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async s => {
          const q = await fetchSingleChart(s.sym);
          if (q) quotesMap[s.id] = { ...q, source: 'yahoo-chart' };
        }));
      }
    }

    // ── بناء النتيجة النهائية ──
    const data = SAUDI_STOCKS.map(stock => {
      const q = quotesMap[stock.id];
      if (!q || !q.price) {
        return { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, price: null, error: 'unavailable' };
      }
      return { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, ...q };
    });

    const found = data.filter(d => d.price !== null).length;
    cache = { data, ts: now };

    return res.status(200).json({
      ok: true,
      cached: false,
      updatedAt: new Date().toISOString(),
      found: `${found}/${SAUDI_STOCKS.length}`,
      data,
    });

  } catch (err) {
    console.error('Handler error:', err);
    if (cache.data) {
      return res.status(200).json({ ok: true, cached: true, stale: true, updatedAt: new Date(cache.ts).toISOString(), data: cache.data });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
