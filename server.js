const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// in-memory stores
let nextId = 1;
const challenges = {}; // id -> { id, type, payload, answer, start }
const history = []; // { id, type, correct, elapsedMs, answerSubmitted, correctAnswer, timestamp }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genChallenge(type) {
  const id = String(nextId++);
  let payload = {};
  let answer = 0;
  if (type === 'A') {
    const price = randInt(1, 999);
    payload = { price };
    answer = 1000 - price;
  } else if (type === 'B') {
    const price = randInt(100, 2000);
    payload = { price };
    answer = Math.round(price * 1.1);
  } else if (type === 'C') {
    const price = randInt(10, 5000);
    payload = { price };
    answer = Math.round(price * 0.9);
  } else if (type === 'D') {
    // 產生 1..5 種商品，總數量（各項 qty 相加）上限為 15，
    // 每項 qty 為 1..5，單價為 10..200。
    const n = randInt(1, 5);
    const items = [];
    // 最少每項 1 件，最多每項 5 件；總和上限 15
    const maxTotal = 15;
    // remaining 總數量隨機介於 n（每項至少 1）到 min(5*n, maxTotal)
    let remaining = randInt(n, Math.min(5 * n, maxTotal));
    for (let i = 0; i < n; i++) {
      // 每項至少留 1 給後面每個項目
      const itemsLeft = n - i;
      const minForThis = 1;
      const maxForThis = Math.min(5, remaining - (itemsLeft - 1));
      const qty = randInt(minForThis, maxForThis);
      remaining -= qty;
      const unit = randInt(2, 40) * 5
      items.push({ name: `商品${String.fromCharCode(65 + (i % 26))}`, qty, unit });
    }
    payload = { items };
    answer = items.reduce((s, it) => s + it.qty * it.unit, 0);
  } else {
    throw new Error('unknown type');
  }
  challenges[id] = { id, type, payload, answer, start: Date.now() };
  // Return payload but not the answer
  return { id, type, payload };
}

app.get('/api/challenge', (req, res) => {
  const type = (req.query.type || '').toUpperCase();
  if (!['A','B','C','D'].includes(type)) return res.status(400).json({ error: 'invalid type' });
  const ch = genChallenge(type);
  res.json(ch);
});

app.post('/api/answer', (req, res) => {
  const { id, answer } = req.body;
  if (!id || answer === undefined) return res.status(400).json({ error: 'missing id or answer' });
  const ch = challenges[id];
  if (!ch) return res.status(400).json({ error: 'challenge not found or expired' });
  if (!Number.isInteger(answer)) return res.status(400).json({ error: 'answer must be integer' });
  const elapsedMs = Date.now() - ch.start;
  const correct = Number(answer) === Number(ch.answer);
  history.unshift({
    id,
    type: ch.type,
    correct,
    elapsedMs,
    answerSubmitted: Number(answer),
    correctAnswer: ch.answer,
    timestamp: Date.now()
  });
  // remove challenge if correct or keep it (we remove to prevent reuse)
  if (correct) delete challenges[id];
  res.json({ correct, elapsedMs, correctAnswer: correct ? ch.answer : undefined });
});

app.get('/api/history', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  res.json(history.slice(0, limit));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
