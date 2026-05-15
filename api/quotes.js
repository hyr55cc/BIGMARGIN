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

let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < CACHE_TTL) {
      return res.status(200).json({ ok: true, cached: true, updatedAt: new Date(cache.ts).toISOString(), data: cache.data });
    }

    const symbols = SAUDI_STOCKS.map(s => s.sym).join(',');

    // محاولة أولى: query2 v7
    let json = await tryFetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`);

    // محاولة ثانية: query1 v7
    if (!json?.quoteResponse?.result?.length) {
      json = await tryFetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`);
    }

    // محاولة ثالثة: v8
    if (!json?.quoteResponse?.result?.length) {
      json = await tryFetch(`https://query1.finance.yahoo.com/v8/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose`);
    }

    const quotes = json?.quoteResponse?.result || [];

    const data = SAUDI_STOCKS.map(stock => {
      const q = quotes.find(r => r.symbol === stock.sym);
      if (!q) return { ...stock, price: null, error: 'not_found' };
      return {
        id: stock.id,
        sym: stock.sym,
        name: stock.name,
        cat: stock.cat,
        price:     q.regularMarketPrice             ?? null,
        change:    q.regularMarketChange            ?? null,
        changePct: q.regularMarketChangePercent     ?? null,
        prevClose: q.regularMarketPreviousClose     ?? null,
        open:      q.regularMarketOpen              ?? null,
        high:      q.regularMarketDayHigh           ?? null,
        low:       q.regularMarketDayLow            ?? null,
        volume:    q.regularMarketVolume            ?? null,
      };
    });

    cache = { data, ts: now };
    return res.status(200).json({ ok: true, cached: false, updatedAt: new Date().toISOString(), data });

  } catch (err) {
    if (cache.data) {
      return res.status(200).json({ ok: true, cached: true, stale: true, updatedAt: new Date(cache.ts).toISOString(), data: cache.data });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function tryFetch(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
      },
    });
    clearTimeout(timeout);
    if (!r.ok) { console.error('tryFetch HTTP', r.status, url); return null; }
    return await r.json();
  } catch(e) {
    console.error('tryFetch error:', e.message, url);
    return null;
  }
}
