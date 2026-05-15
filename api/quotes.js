// api/quotes.js — Vercel Serverless Function
// جلب أسعار الأسهم السعودية من Yahoo Finance

const SAUDI_STOCKS = [
  // كبرى السوق - Top 10
  { id: '2222', sym: '2222.SR', name: 'أرامكو السعودية',      cat: 'big'   },
  { id: '1120', sym: '1120.SR', name: 'مصرف الراجحي',         cat: 'big'   },
  { id: '2010', sym: '2010.SR', name: 'سابك',                  cat: 'big'   },
  { id: '7010', sym: '7010.SR', name: 'شركة stc',              cat: 'big'   },
  { id: '1180', sym: '1180.SR', name: 'مصرف الإنماء',          cat: 'big'   },
  { id: '1030', sym: '1030.SR', name: 'البنك الأهلي',          cat: 'big'   },
  { id: '2082', sym: '2082.SR', name: 'أكوا باور',             cat: 'big'   },
  { id: '4030', sym: '4030.SR', name: 'المملكة القابضة',       cat: 'big'   },
  { id: '1060', sym: '1060.SR', name: 'بنك الجزيرة',           cat: 'big'   },
  { id: '1080', sym: '1080.SR', name: 'بنك البلاد',            cat: 'big'   },
  // صغرى السوق - Small Cap 10
  { id: '4321', sym: '4321.SR', name: 'الوطنية للتعليم',       cat: 'small' },
  { id: '1832', sym: '1832.SR', name: 'الشرق للدهانات',        cat: 'small' },
  { id: '2100', sym: '2100.SR', name: 'وفرة',                  cat: 'small' },
  { id: '6070', sym: '6070.SR', name: 'الفرصة للتطوير',        cat: 'small' },
  { id: '1831', sym: '1831.SR', name: 'متاحف',                 cat: 'small' },
  { id: '2290', sym: '2290.SR', name: 'أبيار',                 cat: 'small' },
  { id: '3030', sym: '3030.SR', name: 'سوداكيم',               cat: 'small' },
  { id: '4143', sym: '4143.SR', name: 'دانة غاز',              cat: 'small' },
  { id: '2210', sym: '2210.SR', name: 'زجاج',                  cat: 'small' },
  { id: '4261', sym: '4261.SR', name: 'منشآت',                 cat: 'small' },
  // متنوعة - Diversified 10
  { id: '4020', sym: '4020.SR', name: 'دار الأركان',           cat: 'other' },
  { id: '2370', sym: '2370.SR', name: 'ميدغلف للتأمين',        cat: 'other' },
  { id: '2280', sym: '2280.SR', name: 'أنابيب السعودية',       cat: 'other' },
  { id: '6001', sym: '6001.SR', name: 'هرفي للخدمات',          cat: 'other' },
  { id: '2090', sym: '2090.SR', name: 'سيمكو',                 cat: 'other' },
  { id: '4050', sym: '4050.SR', name: 'سدافكو',                cat: 'other' },
  { id: '2120', sym: '2120.SR', name: 'المجموعة السعودية',     cat: 'other' },
  { id: '7200', sym: '7200.SR', name: 'STC Pay',               cat: 'other' },
  { id: '4001', sym: '4001.SR', name: 'تطوير المباني',         cat: 'other' },
  { id: '2170', sym: '2170.SR', name: 'الاتحاد لاتصالات',     cat: 'other' },
];

// Cache للتقليل من الطلبات المتكررة (15 دقيقة)
let cache = { data: null, ts: 0 };
const CACHE_TTL = 15 * 60 * 1000;

async function fetchYahooQuotes(symbols) {
  const joined = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,shortName,longName`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'ar,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
  const json = await res.json();
  return json.quoteResponse?.result || [];
}

export default async function handler(req, res) {
  // CORS headers — تسمح للـ frontend بالوصول
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // طلب سهم واحد
  const { symbol } = req.query;

  try {
    // استخدام الـ cache إذا كانت البيانات جديدة
    const now = Date.now();
    if (cache.data && now - cache.ts < CACHE_TTL && !symbol) {
      return res.status(200).json({ ok: true, cached: true, data: cache.data });
    }

    const symbols = symbol
      ? [symbol.includes('.SR') ? symbol : `${symbol}.SR`]
      : SAUDI_STOCKS.map(s => s.sym);

    // Yahoo Finance يقبل حتى 100 رمز في طلب واحد
    const quotes = await fetchYahooQuotes(symbols);

    const data = SAUDI_STOCKS.map(stock => {
      const q = quotes.find(r => r.symbol === stock.sym);
      if (!q) {
        return {
          id: stock.id,
          sym: stock.sym,
          name: stock.name,
          cat: stock.cat,
          price: null,
          change: null,
          changePct: null,
          prevClose: null,
          open: null,
          high: null,
          low: null,
          volume: null,
          error: 'not_found',
        };
      }
      return {
        id: stock.id,
        sym: stock.sym,
        name: stock.name,
        cat: stock.cat,
        price:     q.regularMarketPrice,
        change:    q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        prevClose: q.regularMarketPreviousClose,
        open:      q.regularMarketOpen,
        high:      q.regularMarketDayHigh,
        low:       q.regularMarketDayLow,
        volume:    q.regularMarketVolume,
      };
    }).filter(s => !symbol || s.sym === (symbol.includes('.SR') ? symbol : `${symbol}.SR`));

    // حفظ في الـ cache
    if (!symbol) {
      cache = { data, ts: now };
    }

    return res.status(200).json({ ok: true, cached: false, updatedAt: new Date().toISOString(), data });

  } catch (err) {
    console.error('Quotes error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
