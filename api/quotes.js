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
const BATCH_SIZE = 7; // أقل من الحد 8 لضمان السلامة
const DELAY_MS = 62000; // انتظر 62 ثانية بين كل batch

// Cache طويل — نجلب مرة كل 15 دقيقة فقط
let cache = { data: null, ts: 0 };
const CACHE_TTL = 15 * 60 * 1000;

// cache خاص لجمع النتائج أثناء الجلب التدريجي
let partialCache = {};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchBatch(stocks) {
  const symbols = stocks.map(s => `${s.sym}:XSAU`).join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${API_KEY}&dp=2`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  if (json.status === 'error') throw new Error(json.message);
  return json;
}

function parseQuote(stock, json) {
  const key = `${stock.sym}:XSAU`;
  // لو سهم واحد فقط يرجع مباشرة بدون مفتاح
  const q = Object.keys(json).includes('close') ? json : (json[key] || null);

  if (!q || q.status === 'error' || !q.close) {
    return { id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, price: null, error: q?.message || 'unavailable' };
  }

  const price     = parseFloat(q.close);
  const prevClose = parseFloat(q.previous_close || q.open || price);
  const change    = parseFloat((price - prevClose).toFixed(2));
  const changePct = prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

  return {
    id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat,
    price, prevClose, change, changePct,
    open:   parseFloat(q.open)  || price,
    high:   parseFloat(q.high)  || price,
    low:    parseFloat(q.low)   || price,
    volume: parseInt(q.volume)  || 0,
    source: 'twelvedata',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  // ✅ أرجع الـ cache لو لا يزال صالحاً
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({
      ok: true, cached: true,
      updatedAt: new Date(cache.ts).toISOString(),
      data: cache.data,
    });
  }

  // لو في partial cache (من جلب سابق لم يكتمل) أرجعه مؤقتاً
  const hasPartial = Object.keys(partialCache).length > 0;

  try {
    const quotesMap = { ...partialCache };
    const chunks = [];
    for (let i = 0; i < SAUDI_STOCKS.length; i += BATCH_SIZE) {
      chunks.push(SAUDI_STOCKS.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const json = await fetchBatch(chunk);
        chunk.forEach(stock => {
          quotesMap[stock.id] = parseQuote(stock, json);
        });
        partialCache = { ...quotesMap };
      } catch (chunkErr) {
        console.error(`Batch ${i} error:`, chunkErr.message);
        // لو rate limit انتظر دقيقة وأعد المحاولة
        if (chunkErr.message.includes('credits') || chunkErr.message.includes('limit')) {
          await sleep(DELAY_MS);
          try {
            const json2 = await fetchBatch(chunk);
            chunk.forEach(stock => {
              quotesMap[stock.id] = parseQuote(stock, json2);
            });
            partialCache = { ...quotesMap };
          } catch (retryErr) {
            console.error(`Batch ${i} retry error:`, retryErr.message);
          }
        }
      }
      // تأخير بين الـ batches (ما عدا الأخير)
      if (i < chunks.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    const data = SAUDI_STOCKS.map(stock => quotesMap[stock.id] || {
      id: stock.id, sym: stock.sym, name: stock.name, cat: stock.cat, price: null, error: 'not_fetched'
    });

    const found = data.filter(d => d.price !== null).length;
    cache = { data, ts: now };
    partialCache = {};

    return res.status(200).json({
      ok: true, cached: false,
      updatedAt: new Date().toISOString(),
      found: `${found}/${SAUDI_STOCKS.length}`,
      data,
    });

  } catch (err) {
    console.error('Handler error:', err.message);
    // أرجع الـ cache القديم أو الـ partial
    const fallbackData = cache.data || SAUDI_STOCKS.map(s => ({
      ...s, price: null, error: 'api_error'
    }));
    return res.status(200).json({
      ok: true, cached: true, stale: true,
      error: err.message,
      data: fallbackData,
    });
  }
}
