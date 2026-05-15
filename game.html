// api/history.js — تاريخ سعر السهم (للرسوم البيانية)
// يُرجع بيانات آخر 30 يوم

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, period = '1mo', interval = '1d' } = req.query;

  if (!symbol) {
    return res.status(400).json({ ok: false, error: 'symbol is required' });
  }

  try {
    const sym = symbol.includes('.SR') ? symbol : `${symbol}.SR`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${period}`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!r.ok) throw new Error(`Yahoo error: ${r.status}`);
    const json = await r.json();

    const result = json.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const history = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ? parseFloat(closes[i].toFixed(2)) : null,
    })).filter(d => d.close !== null);

    return res.status(200).json({ ok: true, symbol: sym, period, interval, history });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
