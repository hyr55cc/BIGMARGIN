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
const EXCHANGE = 'XSAU';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 دقائق

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();

  // أرجع الـ cache لو لا يزال صالحاً
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({
      ok: true,
      cached: true,
      updatedAt: new Date(cache.ts).toISOString(),
      data: cache.data,
    });
  }

  try {
    // Twelve Data يقبل حتى 120 رمز في طلب واحد مفصول بفاصلة
    const symbols = SAUDI_STOCKS.map(s => `${s.sym}:${EXCHANGE}`).join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${API_KEY}&dp=2`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Twelve Data HTTP ${r.status}`);
    const json = await r.json();

    // لو سهم واحد فقط يرجع object مش array
    const normalize = (key, val) => {
      if (val?.code) return null; // خطأ في هذا السهم
      return val;
    };

    const data = SAUDI_STOCKS.map(stock => {
      const key = `${stock.sym}:${EXCHANGE}`;
      const q = SAUDI_STOCKS.length === 1 ? json : (json[key] || json[stock.sym] || null);

      if (!q || q.code || !q.close) {
        return {
          id: stock.id,
          sym: stock.sym,
          name: stock.name,
          cat: stock.cat,
          price: null,
          error: q?.message || 'unavailable',
        };
      }

      const price     = parseFloat(q.close);
      const prevClose = parseFloat(q.previous_close);
      const change    = parseFloat((price - prevClose).toFixed(2));
      const changePct = parseFloat(((change / prevClose) * 100).toFixed(2));

      return {
        id:        stock.id,
        sym:       stock.sym,
        name:      stock.name,
        cat:       stock.cat,
        price,
        prevClose,
        change,
        changePct,
        open:      parseFloat(q.open)   || price,
        high:      parseFloat(q.high)   || price,
        low:       parseFloat(q.low)    || price,
        volume:    parseInt(q.volume)   || 0,
        source:    'twelvedata',
      };
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
    console.error('quotes error:', err.message);
    // أرجع الـ cache القديم إذا فشل الطلب
    if (cache.data) {
      return res.status(200).json({
        ok: true,
        cached: true,
        stale: true,
        updatedAt: new Date(cache.ts).toISOString(),
        data: cache.data,
      });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
