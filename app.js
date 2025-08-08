
// app.js - Final GodMode version
const API_KEY = "9d9674e89aed47b098f0d54257e81e35"; // embedded per user request
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const apiKeyInput = document.getElementById('apiKey');
const payoutApiInput = document.getElementById('payoutApi');
const assetsInput = document.getElementById('assets');
const countdownEl = document.getElementById('countdown');
const currentSignalEl = document.getElementById('currentSignal');
const assetEl = document.getElementById('asset');
const directionEl = document.getElementById('direction');
const confidenceEl = document.getElementById('confidence');
const reasonEl = document.getElementById('reason');
const logEl = document.getElementById('log');
const markWin = document.getElementById('markWin');
const markLoss = document.getElementById('markLoss');

let running=false;let timer=null;const cycleSeconds=300;let cycleRemaining=cycleSeconds;let lastSignal=null;let watchAssets=[];let payoutApi='';

function log(msg){ const d=new Date().toLocaleTimeString(); logEl.innerHTML = `<div>[${d}] ${msg}</div>` + logEl.innerHTML; }

function ema(values, period){ const k=2/(period+1); let out=[]; values.forEach((v,i)=>{ if(i===0) out.push(v); else out.push(v*k + out[i-1]*(1-k)); }); return out; }
function rsi(values, period=14){ if(values.length < period+1) return null; let gains=0, losses=0; for(let i=1;i<values.length;i++){ const d=values[i]-values[i-1]; if(d>0) gains+=d; else losses+=Math.abs(d); } const avgGain=gains/(values.length-1); const avgLoss=losses/(values.length-1) || 0.00001; const rs=avgGain/avgLoss; return 100 - (100/(1+rs)); }

async function fetchCandles(symbol, limit=60){
  if(!API_KEY) throw new Error('No API key set');
  const sym = symbol.replace('/','');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1min&outputsize=${limit}&apikey=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Candles fetch failed');
  const data = await res.json();
  if(data.values && Array.isArray(data.values)){
    return data.values.slice().reverse().map(v=>({ time:new Date(v.datetime).getTime(), open:parseFloat(v.open), high:parseFloat(v.high), low:parseFloat(v.low), close:parseFloat(v.close) }));
  } else { throw new Error('Unexpected candles format'); }
}

async function fetchPayouts(){ if(!payoutApi) return null; try{ const res = await fetch(payoutApi); if(!res.ok) return null; const data = await res.json(); if(Array.isArray(data)) return data; return null;}catch(e){return null;} }

function analyzeCandles(candles){
  if(!candles || candles.length < 12) return {direction:'NO_TRADE', confidence:0, reason:'Not enough data'};
  const closes = candles.map(c=>c.close);
  const ema5 = ema(closes,5).slice(-1)[0];
  const ema13 = ema(closes,13).slice(-1)[0];
  const r = rsi(closes,14);
  const last = candles[candles.length-1]; const prev = candles[candles.length-2];
  const bullish = last.close > last.open && last.close > prev.close;
  const bearish = last.close < last.open && last.close < prev.close;
  let direction='NO_TRADE', confidence=0, reason='';
  if(ema5 > ema13 && bullish && (r===null || r < 78)){
    direction='BUY'; confidence = Math.min(99, Math.round((ema5-ema13)/Math.abs(ema13)*100000) + (r?Math.round((78-r)/5):10) + 60);
    reason = `EMA5>EMA13 & bullish candle` + (r?` & RSI ${r.toFixed(1)}`:'');
  } else if(ema5 < ema13 && bearish && (r===null || r > 22)){
    direction='SELL'; confidence = Math.min(99, Math.round((ema13-ema5)/Math.abs(ema13)*100000) + (r?Math.round((r-22)/5):10) + 60);
    reason = `EMA5<EMA13 & bearish candle` + (r?` & RSI ${r.toFixed(1)}`:'');
  } else { direction='NO_TRADE'; reason='No clear trend'; }
  return {direction, confidence, reason};
}

async function runCycle(){
  try{
    let assets = watchAssets.slice();
    const payouts = await fetchPayouts();
    if(payouts && payouts.length){
      payouts.sort((a,b)=>b.payout - a.payout);
      assets = payouts.slice(0,2).map(p=>p.symbol.replace(/\\/g,'/'));
      log('Picked top 2 assets by payout: ' + assets.join(', '));
    } else {
      assets = assets.slice(0,2);
      log('Using watchlist (first 2): ' + assets.join(', '));
    }

    let final=null;
    for(const sym of assets){
      try{
        const candles = await fetchCandles(sym, 60);
        const analysis = analyzeCandles(candles);
        log(`${sym}: ${analysis.direction} (conf ${analysis.confidence}) - ${analysis.reason}`);
        if(analysis.direction === 'NO_TRADE' || analysis.confidence < 90){
          log('Rejected low-confidence or no-trade for ' + sym);
          continue;
  }        if(lastSignal && lastSignal.asset === sym && lastSignal.direction === analysis.direction){
          log('Skipped duplicate signal for ' + sym);
          continue;
        }
        final = {asset: sym, ...analysis};
        break;
      } catch(e){
        log('Fetch error for ' + sym + ': ' + e.message);
        continue;
      }
    }

    if(!final){
      countdownEl.textContent = 'NO SIGNAL';
      currentSignalEl.classList.add('hidden');
      lastSignal = null;
      log('No valid signal this cycle (no >=90% signals).');
      return;
    }

    try{ const tvSym = 'FX:' + final.asset.replace('/',''); createTVWidget(tvSym);} catch(e){}

    assetEl.textContent = final.asset;
    directionEl.textContent = final.direction;
    confidenceEl.textContent = final.confidence + '%';
    reasonEl.textContent = final.reason;
    currentSignalEl.classList.remove('hidden');
    lastSignal = {asset: final.asset, direction: final.direction};
    log('EMITTED -> ' + final.asset + ' ' + final.direction + ' (conf ' + final.confidence + ')');
  } catch(err){ log('Cycle error: ' + err.message); }
}

function startLoop(){ cycleRemaining = cycleSeconds; countdownEl.textContent = formatTime(cycleRemaining); timer = setInterval(async ()=>{ cycleRemaining--; if(cycleRemaining <= 0){ await runCycle(); cycleRemaining = cycleSeconds; } countdownEl.textContent = formatTime(cycleRemaining); }, 1000); }
function stopLoop(){ clearInterval(timer); timer = null; countdownEl.textContent='--:--'; }
function formatTime(s){ const m=String(Math.floor(s/60)).padStart(2,'0'); const sec=String(s%60).padStart(2,'0'); return `${m}:${sec}`; }

startBtn.addEventListener('click', ()=>{ payoutApi = payoutApiInput.value.trim(); watchAssets = assetsInput.value.split(',').map(s=>s.trim()).filter(Boolean); if(watchAssets.length===0){ alert('Enter at least one asset'); return; } startBtn.disabled=true; stopBtn.disabled=false; createTVWidget('FX:' + watchAssets[0].replace('/','')); startLoop(); log('GodMode started (embedded API key).'); });
stopBtn.addEventListener('click', ()=>{ startBtn.disabled=false; stopBtn.disabled=true; stopLoop(); log('GodMode stopped.'); });

markWin.addEventListener('click', ()=>{ log('User marked WIN for ' + assetEl.textContent); currentSignalEl.classList.add('hidden'); });
markLoss.addEventListener('click', ()=>{ log('User marked LOSS for ' + assetEl.textContent); currentSignalEl.classList.add('hidden'); });
