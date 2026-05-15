const SAUDI_STOCKS = [
  {id:'2222',sym:'2222',name:'أرامكو السعودية',cat:'big'},
  {id:'1120',sym:'1120',name:'مصرف الراجحي',cat:'big'},
  {id:'2010',sym:'2010',name:'سابك',cat:'big'},
  {id:'7010',sym:'7010',name:'شركة stc',cat:'big'},
  {id:'1180',sym:'1180',name:'مصرف الإنماء',cat:'big'},
  {id:'1030',sym:'1030',name:'البنك الأهلي',cat:'big'},
  {id:'2082',sym:'2082',name:'أكوا باور',cat:'big'},
  {id:'4030',sym:'4030',name:'المملكة القابضة',cat:'big'},
  {id:'1060',sym:'1060',name:'بنك الجزيرة',cat:'big'},
  {id:'1080',sym:'1080',name:'بنك البلاد',cat:'big'},
  {id:'4321',sym:'4321',name:'الوطنية للتعليم',cat:'small'},
  {id:'1832',sym:'1832',name:'الشرق للدهانات',cat:'small'},
  {id:'2100',sym:'2100',name:'وفرة',cat:'small'},
  {id:'6070',sym:'6070',name:'الفرصة للتطوير',cat:'small'},
  {id:'1831',sym:'1831',name:'متاحف',cat:'small'},
  {id:'2290',sym:'2290',name:'أبيار',cat:'small'},
  {id:'3030',sym:'3030',name:'سوداكيم',cat:'small'},
  {id:'4143',sym:'4143',name:'دانة غاز',cat:'small'},
  {id:'2210',sym:'2210',name:'زجاج',cat:'small'},
  {id:'4261',sym:'4261',name:'منشآت',cat:'small'},
  {id:'4020',sym:'4020',name:'دار الأركان',cat:'other'},
  {id:'2370',sym:'2370',name:'ميدغلف للتأمين',cat:'other'},
  {id:'2280',sym:'2280',name:'أنابيب السعودية',cat:'other'},
  {id:'6001',sym:'6001',name:'هرفي للخدمات',cat:'other'},
  {id:'2090',sym:'2090',name:'سيمكو',cat:'other'},
  {id:'4050',sym:'4050',name:'سدافكو',cat:'other'},
  {id:'2120',sym:'2120',name:'المجموعة السعودية',cat:'other'},
  {id:'7200',sym:'7200',name:'STC Pay',cat:'other'},
  {id:'4001',sym:'4001',name:'تطوير المباني',cat:'other'},
  {id:'2170',sym:'2170',name:'الاتحاد لاتصالات',cat:'other'},
];

const API_KEY = 'fa3181ee46f84bea82cc1e8e02fd6146';
const BATCH_SIZE = 7;

// Global cache — يبقى في الذاكرة طالما الـ serverless instance شغّال
const stockCache = {}; // { id: { price, change, ... , ts } }
const STOCK_TTL = 15 * 60 * 1000; // 15 دقيقة لكل سهم

// نحسب رقم الـ batch الحالي بناءً على الوقت
// كل دقيقة نجلب batch مختلف — بالتناوب
function getCurrentBatchIndex() {
  const minute = Math.floor(Date.now() / 60000);
  const totalBatches = Math.ceil(SAUDI_STOCKS.length / BATCH_SIZE);
  return minute % totalBatches;
}

function isStale(id) {
  if (!stockCache[id]) return true;
  return Date.now() - stockCache[id].ts > STOCK_TTL;
}

function parseQuote(stock, q) {
  if (!q || q.status === 'error' || !q.close) {
    return null;
  }
  const price     = parseFloat(q.close);
  const prevClose = parseFloat(q.previous_close || q.open || price);
  const change    = parseFloat((price - prevClose).toFixed(2));
  const changePct = prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;
  return {
    price, prevClose, change, changePct,
    open:   parseFloat(q.open)  || price,
    high:   parseFloat(q.high)  || price,
    low:    parseFloat(q.low)   || price,
    volume: parseInt(q.volume)  || 0,
    ts:     Date.now(),
    source: 'twelvedata',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // حدد الـ batch الحالي بناءً على الدقيقة الحالية
    const batchIndex = getCurrentBatchIndex();
    const start = batchIndex * BATCH_SIZE;
    const batch = SAUDI_STOCKS.slice(start, start + BATCH_SIZE);

    // جلب فقط الأسهم التي انتهت صلاحيتها
    const toFetch = batch.filter(s => isStale(s.id));

    if (toFetch.length > 0) {
      const symbols = toFetch.map(s => `${s.sym}:XSAU`).join(',');
      const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${API_KEY}&dp=2`;

      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const json = await r.json();
        if (json.status !== 'error') {
          toFetch.forEach(stock => {
            const key = `${stock.sym}:XSAU`;
            // لو سهم واحد يرجع مباشرة
            const q = toFetch.length === 1
              ? (json.close ? json : json[key])
              : json[key];
            const parsed = parseQuote(stock, q);
            if (parsed) stockCache[stock.id] = parsed;
          });
        }
      }
    }

    // بناء الرد الكامل من الـ cache
    const data = SAUDI_STOCKS.map(stock => {
      const cached = stockCache[stock.id];
      if (!cached) {
        return { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, price: null, error: 'pending' };
      }
      return {
        id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat,
        price:     cached.price,
        change:    cached.change,
        changePct: cached.changePct,
        prevClose: cached.prevClose,
        open:      cached.open,
        high:      cached.high,
        low:       cached.low,
        volume:    cached.volume,
        updatedAt: new Date(cached.ts).toISOString(),
      };
    });

    const found = data.filter(d => d.price !== null).length;
    const totalBatches = Math.ceil(SAUDI_STOCKS.length / BATCH_SIZE);

    return res.status(200).json({
      ok: true,
      found: `${found}/${SAUDI_STOCKS.length}`,
      currentBatch: `${batchIndex + 1}/${totalBatches}`,
      nextBatchIn: `${60 - new Date().getSeconds()}s`,
      updatedAt: new Date().toISOString(),
      data,
    });

  } catch (err) {
    console.error('Handler error:', err.message);
    // أرجع ما في الـ cache حتى لو فيه خطأ
    const data = SAUDI_STOCKS.map(stock => {
      const cached = stockCache[stock.id];
      return cached
        ? { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, ...cached }
        : { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, price: null, error: 'error' };
    });
    return res.status(200).json({ ok: true, stale: true, error: err.message, data });
  }
}
