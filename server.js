// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');

const DATA_FILE = path.join(__dirname, 'data.json');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''; // optional, for verifying initData
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// init db file
let db = { leaderboard: [], referrals: [] };
try{
  if(fs.existsSync(DATA_FILE)){
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  }
}catch(e){ console.error('data file error', e); }

// save helper
function saveDB(){ fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }

/* Optional: verify Telegram initData (server-side)
   Telegram sends initData string to WebApp. To verify authenticity you can HMAC it with bot token.
   Example usage: send initData to server and verify before trusting user identity.
*/
function checkTelegramInitData(initData) {
  if(!TELEGRAM_BOT_TOKEN) return false;
  // initData is the whole query string, e.g. "auth_date=...&user=..."
  const params = new URLSearchParams(initData);
  const checkString = [...params.entries()].sort().map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  const hash = params.get('hash');
  return hmac === hash;
}

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
  const list = (db.leaderboard || []).slice().sort((a,b)=>b.score - a.score).slice(0,100);
  res.json(list);
});

// POST /submit  { name, score }
app.post('/submit', (req, res) => {
  const { name, score } = req.body;
  if(!name || typeof score !== 'number') return res.status(400).json({ error: 'invalid' });
  const idx = db.leaderboard.findIndex(p => p.name === name);
  if(idx >= 0){
    if(score > db.leaderboard[idx].score) db.leaderboard[idx].score = score;
  } else {
    db.leaderboard.push({ name, score, date: Date.now() });
  }
  saveDB();
  res.json({ ok: true });
});

// POST /referral { ref, newUser }
app.post('/referral', (req, res) => {
  const { ref, newUser } = req.body;
  if(!ref || !newUser) return res.status(400).json({ error: 'invalid' });
  db.referrals.push({ ref, newUser, date: Date.now() });
  saveDB();
  res.json({ ok: true });
});

// simple status
app.get('/', (req,res)=> res.send('ClickCoin backend running'));

// start
app.listen(PORT, ()=> console.log('Server running on port', PORT));
