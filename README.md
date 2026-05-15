# 🏦 TASI Sim — Backend API

Backend مجاني لمحاكي تداول تاسي، مبني على **Vercel Serverless Functions**.  
يجلب أسعار الأسهم السعودية الحقيقية من Yahoo Finance.

---

## 📁 هيكل المشروع

```
tasi-backend/
├── api/
│   ├── quotes.js    ← أسعار الأسهم (كل الـ 30 أو سهم واحد)
│   └── history.js   ← تاريخ السعر (للرسوم البيانية)
├── vercel.json      ← إعدادات Vercel
├── package.json
└── README.md
```

---

## 🚀 خطوات النشر على Vercel (مجاناً)

### الخطوة 1 — إنشاء حساب Vercel
1. افتح [vercel.com](https://vercel.com)
2. اضغط **Sign Up** → سجل بـ GitHub أو Google

### الخطوة 2 — رفع الكود على GitHub
1. افتح [github.com](https://github.com) → New Repository
2. اسمه: `tasi-sim-backend`
3. ارفع ملفات المجلد كاملاً (api/ + vercel.json + package.json)

### الخطوة 3 — ربط Vercel بـ GitHub
1. في Vercel → **Add New Project**
2. اختر repository الـ `tasi-sim-backend`
3. اضغط **Deploy** — خلاص! ✅

### الخطوة 4 — احصل على رابط الـ API
بعد النشر ستحصل على رابط مثل:
```
https://tasi-sim-backend.vercel.app
```

---

## 📡 استخدام الـ API

### جلب جميع الأسهم الـ 30
```
GET https://your-app.vercel.app/api/quotes
```

**مثال على الرد:**
```json
{
  "ok": true,
  "cached": false,
  "updatedAt": "2026-05-15T10:30:00.000Z",
  "data": [
    {
      "id": "2222",
      "sym": "2222.SR",
      "name": "أرامكو السعودية",
      "cat": "big",
      "price": 28.55,
      "change": 0.25,
      "changePct": 0.88,
      "prevClose": 28.30,
      "open": 28.35,
      "high": 28.70,
      "low": 28.20,
      "volume": 12500000
    }
  ]
}
```

### جلب سهم واحد
```
GET https://your-app.vercel.app/api/quotes?symbol=2222
```

### جلب تاريخ السهم (للرسوم البيانية)
```
GET https://your-app.vercel.app/api/history?symbol=2222&period=1mo&interval=1d
```

**الفترات المتاحة:** `1d` `5d` `1mo` `3mo` `6mo` `1y`  
**الفترات الزمنية:** `1m` `5m` `15m` `1h` `1d` `1wk`

---

## ⚡ الـ Cache

- الـ API تخزن النتائج لمدة **15 دقيقة** لتجنب حجب Yahoo Finance
- السوق السعودي يعمل **الأحد - الخميس، 10:00 - 15:00** بتوقيت الرياض
- خارج ساعات التداول ستحصل على آخر سعر إغلاق

---

## 🔗 ربط اللعبة بالـ API

بعد النشر، افتح ملف اللعبة وغيّر السطر:
```javascript
const API_BASE = 'https://your-app.vercel.app';
```

---

## 🆓 حدود الخطة المجانية في Vercel

| | المجاني |
|---|---|
| Serverless Functions | 100 GB-hours/شهر |
| Bandwidth | 100 GB/شهر |
| Requests | غير محدود |

**أكثر من كافي للعبة!** ✅

---

## ❓ مشاكل شائعة

**Yahoo Finance يرجع خطأ 401؟**  
→ جرب تغيير `query1` إلى `query2` في الكود

**السهم لا يظهر؟**  
→ تأكد أن الرمز صحيح بإضافة `.SR` مثل `2222.SR`

**الأسعار قديمة؟**  
→ خارج ساعات السوق هذا طبيعي — الأسعار تتحدث عند فتح السوق
