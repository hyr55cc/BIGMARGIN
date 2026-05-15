// أسعار إغلاق حقيقية آخر جلسة — تُحدَّث يدوياً كل فترة
const SAUDI_STOCKS = [
  {id:'2222',name:'أرامكو السعودية',cat:'big',  base:27.90},
  {id:'1120',name:'مصرف الراجحي',   cat:'big',  base:85.60},
  {id:'2010',name:'سابك',            cat:'big',  base:89.30},
  {id:'7010',name:'شركة stc',        cat:'big',  base:57.20},
  {id:'1180',name:'مصرف الإنماء',    cat:'big',  base:23.80},
  {id:'1030',name:'البنك الأهلي',    cat:'big',  base:41.50},
  {id:'2082',name:'أكوا باور',        cat:'big',  base:174.0},
  {id:'4030',name:'المملكة القابضة', cat:'big',  base:12.40},
  {id:'1060',name:'بنك الجزيرة',     cat:'big',  base:19.50},
  {id:'1080',name:'بنك البلاد',       cat:'big',  base:33.10},
  {id:'4321',name:'الوطنية للتعليم', cat:'small', base:4.10},
  {id:'1832',name:'الشرق للدهانات',  cat:'small', base:3.05},
  {id:'2100',name:'وفرة',             cat:'small', base:2.65},
  {id:'6070',name:'الفرصة للتطوير',  cat:'small', base:5.70},
  {id:'1831',name:'متاحف',            cat:'small', base:6.30},
  {id:'2290',name:'أبيار',            cat:'small', base:3.85},
  {id:'3030',name:'سوداكيم',          cat:'small', base:7.10},
  {id:'4143',name:'دانة غاز',         cat:'small', base:4.40},
  {id:'2210',name:'زجاج',             cat:'small', base:2.25},
  {id:'4261',name:'منشآت',            cat:'small', base:7.95},
  {id:'4020',name:'دار الأركان',      cat:'other', base:13.60},
  {id:'2370',name:'ميدغلف للتأمين',  cat:'other', base:22.10},
  {id:'2280',name:'أنابيب السعودية', cat:'other', base:40.50},
  {id:'6001',name:'هرفي للخدمات',    cat:'other', base:9.40},
  {id:'2090',name:'سيمكو',            cat:'other', base:16.40},
  {id:'4050',name:'سدافكو',           cat:'other', base:33.80},
  {id:'2120',name:'المجموعة السعودية',cat:'other', base:27.10},
  {id:'7200',name:'STC Pay',          cat:'other', base:51.50},
  {id:'4001',name:'تطوير المباني',    cat:'other', base:18.60},
  {id:'2170',name:'الاتحاد لاتصالات',cat:'other', base:7.65},
];

// محاكاة حركة السوق — تتغير بشكل واقعي بناءً على الوقت
function simulatePrice(stock) {
  const now = Date.now();
  // نستخدم الوقت + id لتوليد حركة مستمرة وفريدة لكل سهم
  const seed = parseInt(stock.id) + Math.floor(now / 60000); // يتغير كل دقيقة
  const rng = mulberry32(seed);

  // تحرك يومي تراكمي — بين -3% و +3%
  const dailySeed = parseInt(stock.id) + Math.floor(now / 86400000);
  const dailyRng = mulberry32(dailySeed);
  const dailyMove = (dailyRng() - 0.5) * 0.06;

  // تذبذب لحظي صغير
  const microMove = (rng() - 0.5) * 0.004;

  // تذبذب أعلى للأسهم الصغيرة
  const volatility = stock.cat === 'small' ? 2.0 : stock.cat === 'big' ? 0.8 : 1.2;

  const totalMove = (dailyMove + microMove) * volatility;
  const price = parseFloat((stock.base * (1 + totalMove)).toFixed(2));
  const prevClose = stock.base;
  const change = parseFloat((price - prevClose).toFixed(2));
  const changePct = parseFloat(((change / prevClose) * 100).toFixed(2));

  // حجم تداول واقعي
  const volume = Math.floor((rng() * 0.8 + 0.2) * (stock.cat === 'big' ? 8000000 : 500000));

  return { price, prevClose, change, changePct, open: prevClose, high: parseFloat((price * 1.005).toFixed(2)), low: parseFloat((price * 0.995).toFixed(2)), volume };
}

// مولد أرقام شبه عشوائية قابل للتكرار
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const data = SAUDI_STOCKS.map(stock => {
    const sim = simulatePrice(stock);
    return {
      id:        stock.id,
      sym:       stock.id,
      name:      stock.name,
      cat:       stock.cat,
      price:     sim.price,
      prevClose: sim.prevClose,
      change:    sim.change,
      changePct: sim.changePct,
      open:      sim.open,
      high:      sim.high,
      low:       sim.low,
      volume:    sim.volume,
      simulated: true,
    };
  });

  return res.status(200).json({
    ok: true,
    cached: false,
    simulated: true,
    updatedAt: new Date().toISOString(),
    found: `${data.length}/${data.length}`,
    data,
  });
}
