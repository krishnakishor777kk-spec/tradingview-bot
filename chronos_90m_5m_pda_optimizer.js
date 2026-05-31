const fs = require('fs');
const path = require('path');
const yahooFinance = require('yahoo-finance2').default;
const moment = require('moment-timezone');

function parseQuotes(quotes) {
    return quotes.map(q => ({
        timestamp: q.date.getTime(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
    })).filter(q => q.open && q.high && q.low && q.close);
}

function getInstitutionalQuarter(timestamp) {
    const m = moment(timestamp).tz("America/New_York");
    const hour = m.hour();
    const minute = m.minute();
    const day = m.day();

    if (day === 0 || day === 6) return null;

    const minutesSinceMidnight = hour * 60 + minute;
    const dateStr = m.format("YYYY-MM-DD");

    if (minutesSinceMidnight >= 0 && minutesSinceMidnight < 360) {
        const q = Math.floor(minutesSinceMidnight / 90) + 1;
        return { session: 'LONDON', quarter: q, key: `${dateStr}-LONDON-Q${q}` };
    }
    else if (minutesSinceMidnight >= 360 && minutesSinceMidnight < 720) {
        const q = Math.floor((minutesSinceMidnight - 360) / 90) + 1;
        return { session: 'NY_AM', quarter: q, key: `${dateStr}-NY_AM-Q${q}` };
    }
    else if (minutesSinceMidnight >= 720 && minutesSinceMidnight < 1080) {
        const q = Math.floor((minutesSinceMidnight - 720) / 90) + 1;
        return { session: 'NY_PM', quarter: q, key: `${dateStr}-NY_PM-Q${q}` };
    }
    else if (minutesSinceMidnight >= 1080 && minutesSinceMidnight < 1440) {
        const q = Math.floor((minutesSinceMidnight - 1080) / 90) + 1;
        return { session: 'ASIA', quarter: q, key: `${dateStr}-ASIA-Q${q}` };
    }
    return null;
}

function buildClockAligned5MCandles(bars1m) {
    const groups = new Map();
    for (const bar of bars1m) {
        const m = moment(bar.timestamp).tz("America/New_York");
        const hour = m.hour();
        const minute = m.minute();
        const blockMinute = Math.floor(minute / 5) * 5;
        const key = m.format("YYYY-MM-DD") + " " + hour.toString().padStart(2, '0') + ":" + blockMinute.toString().padStart(2, '0');
        
        if (!groups.has(key)) {
            groups.set(key, {
                key: key,
                timestamp: m.clone().minute(blockMinute).second(0).millisecond(0).valueOf(),
                bars: []
            });
        }
        groups.get(key).bars.push(bar);
    }
    
    const candles5m = [];
    for (const [key, group] of groups.entries()) {
        const esBars = group.bars.map(b => b.es);
        const nqBars = group.bars.map(b => b.nq);
        
        candles5m.push({
            date: key,
            timestamp: group.timestamp,
            es: {
                open: esBars[0].open,
                high: Math.max(...esBars.map(b => b.high)),
                low: Math.min(...esBars.map(b => b.low)),
                close: esBars[esBars.length - 1].close
            },
            nq: {
                open: nqBars[0].open,
                high: Math.max(...nqBars.map(b => b.high)),
                low: Math.min(...nqBars.map(b => b.low)),
                close: nqBars[nqBars.length - 1].close
            },
            bars1m: group.bars
        });
    }
    return candles5m.sort((a, b) => a.timestamp - b.timestamp);
}

function buildClockAligned15MCandles(bars1m) {
    const groups = new Map();
    for (const bar of bars1m) {
        const m = moment(bar.timestamp).tz("America/New_York");
        const hour = m.hour();
        const minute = m.minute();
        const blockMinute = Math.floor(minute / 15) * 15;
        const key = m.format("YYYY-MM-DD") + " " + hour.toString().padStart(2, '0') + ":" + blockMinute.toString().padStart(2, '0');
        
        if (!groups.has(key)) {
            groups.set(key, {
                key: key,
                timestamp: m.clone().minute(blockMinute).second(0).millisecond(0).valueOf(),
                bars: []
            });
        }
        groups.get(key).bars.push(bar);
    }
    
    const candles15m = [];
    for (const [key, group] of groups.entries()) {
        const esBars = group.bars.map(b => b.es);
        const nqBars = group.bars.map(b => b.nq);
        
        candles15m.push({
            date: key,
            timestamp: group.timestamp,
            es: {
                open: esBars[0].open,
                high: Math.max(...esBars.map(b => b.high)),
                low: Math.min(...esBars.map(b => b.low)),
                close: esBars[esBars.length - 1].close
            },
            nq: {
                open: nqBars[0].open,
                high: Math.max(...nqBars.map(b => b.high)),
                low: Math.min(...nqBars.map(b => b.low)),
                close: nqBars[nqBars.length - 1].close
            }
        });
    }
    return candles15m.sort((a, b) => a.timestamp - b.timestamp);
}

function buildClockAligned1HCandles(bars1m) {
    const groups = new Map();
    for (const bar of bars1m) {
        const m = moment(bar.timestamp).tz("America/New_York");
        const hour = m.hour();
        const key = m.format("YYYY-MM-DD") + " " + hour.toString().padStart(2, '0') + ":00";
        
        if (!groups.has(key)) {
            groups.set(key, {
                key: key,
                timestamp: m.clone().minute(0).second(0).millisecond(0).valueOf(),
                bars: []
            });
        }
        groups.get(key).bars.push(bar);
    }
    
    const candles1h = [];
    for (const [key, group] of groups.entries()) {
        const esBars = group.bars.map(b => b.es);
        const nqBars = group.bars.map(b => b.nq);
        
        candles1h.push({
            date: key,
            timestamp: group.timestamp,
            es: {
                open: esBars[0].open,
                high: Math.max(...esBars.map(b => b.high)),
                low: Math.min(...esBars.map(b => b.low)),
                close: esBars[esBars.length - 1].close
            },
            nq: {
                open: nqBars[0].open,
                high: Math.max(...nqBars.map(b => b.high)),
                low: Math.min(...nqBars.map(b => b.low)),
                close: nqBars[nqBars.length - 1].close
            }
        });
    }
    return candles1h.sort((a, b) => a.timestamp - b.timestamp);
}

function addEMAs(h1Candles, period) {
    const k = 2 / (period + 1);
    let emaES = h1Candles[0].es.close;
    let emaNQ = h1Candles[0].nq.close;
    
    for (let i = 0; i < h1Candles.length; i++) {
        const esClose = h1Candles[i].es.close;
        const nqClose = h1Candles[i].nq.close;
        
        emaES = esClose * k + emaES * (1 - k);
        emaNQ = nqClose * k + emaNQ * (1 - k);
        
        h1Candles[i].es.ema = emaES;
        h1Candles[i].nq.ema = emaNQ;
    }
}

function find15MGaps(candles15m) {
    const gaps = [];
    for (let i = 2; i < candles15m.length; i++) {
        const c1 = candles15m[i - 2];
        const c2 = candles15m[i - 1];
        const c3 = candles15m[i];
        
        if (c3.es.low > c1.es.high) gaps.push({ asset: 'ES', type: 'BULLISH', high: c3.es.low, low: c1.es.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.nq.low > c1.nq.high) gaps.push({ asset: 'NQ', type: 'BULLISH', high: c3.nq.low, low: c1.nq.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.es.high < c1.es.low) gaps.push({ asset: 'ES', type: 'BEARISH', high: c1.es.low, low: c3.es.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.nq.high < c1.nq.low) gaps.push({ asset: 'NQ', type: 'BEARISH', high: c1.nq.low, low: c3.nq.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
    }
    return gaps;
}

function find1HGaps(candles1h) {
    const gaps = [];
    for (let i = 2; i < candles1h.length; i++) {
        const c1 = candles1h[i - 2];
        const c2 = candles1h[i - 1];
        const c3 = candles1h[i];
        
        if (c3.es.low > c1.es.high) gaps.push({ asset: 'ES', type: 'BULLISH', high: c3.es.low, low: c1.es.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.nq.low > c1.nq.high) gaps.push({ asset: 'NQ', type: 'BULLISH', high: c3.nq.low, low: c1.nq.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.es.high < c1.es.low) gaps.push({ asset: 'ES', type: 'BEARISH', high: c1.es.low, low: c3.es.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
        if (c3.nq.high < c1.nq.low) gaps.push({ asset: 'NQ', type: 'BEARISH', high: c1.nq.low, low: c3.nq.high, formedTimestamp: c3.timestamp, mitigated: false, mitigatedTimestamp: null });
    }
    return gaps;
}

function mitigateGaps(gaps, bars1m) {
    for (const bar of bars1m) {
        for (const fvg of gaps) {
            if (fvg.mitigated || bar.timestamp <= fvg.formedTimestamp) continue;
            
            const assetLower = fvg.asset.toLowerCase();
            const closePrice = bar[assetLower].close;
            
            if (fvg.type === 'BULLISH' && closePrice < fvg.low) {
                fvg.mitigated = true;
                fvg.mitigatedTimestamp = bar.timestamp;
            } else if (fvg.type === 'BEARISH' && closePrice > fvg.high) {
                fvg.mitigated = true;
                fvg.mitigatedTimestamp = bar.timestamp;
            }
        }
    }
}

function groupCandlesIntoQuarters(candles5m) {
    const quartersMap = new Map();
    for (const c5m of candles5m) {
        const qr = getInstitutionalQuarter(c5m.timestamp);
        if (!qr) continue;
        
        if (!quartersMap.has(qr.key)) {
            quartersMap.set(qr.key, {
                key: qr.key,
                session: qr.session,
                quarter: qr.quarter,
                date: qr.key.slice(0, 10),
                timestamp: c5m.timestamp,
                candles5m: [],
                es: { high: 0, low: 999999 },
                nq: { high: 0, low: 999999 }
            });
        }
        
        const qObj = quartersMap.get(qr.key);
        qObj.candles5m.push(c5m);
        qObj.es.high = Math.max(qObj.es.high, c5m.es.high);
        qObj.es.low = Math.min(qObj.es.low, c5m.es.low);
        qObj.nq.high = Math.max(qObj.nq.high, c5m.nq.high);
        qObj.nq.low = Math.min(qObj.nq.low, c5m.nq.low);
    }
    
    return Array.from(quartersMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function simulateStrategy(sortedQuarters, uniqueBars, gaps, h1Candles, options) {
    const { entryStyle, slBuffer, trendFilter, sessionFilter, riskReward } = options;
    let stats = { trades: 0, wins: 0, losses: 0, profit: 0 };

    const barIndexMap = new Map();
    for (let idx = 0; idx < uniqueBars.length; idx++) {
        barIndexMap.set(uniqueBars[idx].timestamp, idx);
    }

    const getOutcomeSlice = (t) => {
        const idx = barIndexMap.get(t);
        if (idx === undefined) return uniqueBars;
        return uniqueBars.slice(idx);
    };

    const getH1EMA = (timestamp, asset) => {
        const activeH1 = h1Candles.find(c => timestamp >= c.timestamp && timestamp < c.timestamp + 3600000);
        return activeH1 ? activeH1[asset].ema : null;
    };

    for (let qIdx = 1; qIdx < sortedQuarters.length; qIdx++) {
        const prevQ = sortedQuarters[qIdx - 1];
        const currQ = sortedQuarters[qIdx];

        if (prevQ.candles5m.length === 0 || currQ.candles5m.length === 0) continue;

        const prevHighES = prevQ.es.high;
        const prevLowES = prevQ.es.low;
        const prevHighNQ = prevQ.nq.high;
        const prevLowNQ = prevQ.nq.low;

        let blockExecuted = false;

        for (let cIdx = 0; cIdx < currQ.candles5m.length; cIdx++) {
            if (blockExecuted) break;

            const c5m = currQ.candles5m[cIdx];
            const m = moment(c5m.timestamp).tz("America/New_York");
            const hour = m.hour();
            const minute = m.minute();

            // Session Filter
            if (sessionFilter) {
                const inLondon = (hour === 2 || hour === 3 || hour === 4);
                const inNY = (hour === 8 && minute >= 30) || (hour === 9 || hour === 10 || hour === 11 || hour === 13 || hour === 14 || hour === 15);
                if (!inLondon && !inNY) continue;
            }

            // --- 1. BULLISH SWEEP LONG ---
            const esSweptL = c5m.es.low < prevLowES;
            const nqSweptL = c5m.nq.low < prevLowNQ;
            const bullishSMT = (esSweptL && !nqSweptL) || (nqSweptL && !esSweptL);

            if (bullishSMT) {
                const fs = nqSweptL ? "es" : "nq";
                const sweepingLow = c5m[fs].low;

                // Trend Filter
                if (trendFilter) {
                    const emaVal = getH1EMA(c5m.timestamp, fs);
                    if (emaVal && c5m[fs].close < emaVal) continue; // skip longs if price is below H1 EMA
                }

                const activeFVG = gaps.find(f => {
                    if (f.asset !== fs.toUpperCase()) return false;
                    if (f.mitigated && c5m.timestamp > f.mitigatedTimestamp) return false;
                    if (c5m.timestamp <= f.formedTimestamp) return false;
                    return f.type === 'BULLISH' && sweepingLow <= f.high && sweepingLow >= f.low;
                });

                if (activeFVG) {
                    const sl = c5m[fs].low * (1 - slBuffer);

                    if (entryStyle === 'DIRECT') {
                        const entry = c5m[fs].close;
                        const risk = entry - sl;

                        if (risk > 0) {
                            const last1MOf5M = c5m.bars1m[c5m.bars1m.length - 1];
                            const outcomes = getOutcomeSlice(last1MOf5M.timestamp);
                            const target = entry + riskReward * risk;

                            let r = -1.0;
                            let outcomeStr = "STOPPED OUT";
                            for (let k = 1; k < outcomes.length; k++) {
                                const o = outcomes[k];
                                if (o[fs].low <= sl) { r = -1.0; outcomeStr = "STOPPED OUT"; break; }
                                if (o[fs].high >= target) { r = riskReward; outcomeStr = "TARGET HIT"; break; }
                            }
                            if (outcomeStr === "STOPPED OUT" && outcomes.length > 0) {
                                let slHit = false;
                                for (const o of outcomes) { if (o[fs].low <= sl) { slHit = true; break; } }
                                if (!slHit) {
                                    const exit = outcomes[outcomes.length - 1][fs].close;
                                    r = (exit - entry) / risk;
                                }
                            }

                            stats.trades++;
                            if (r > 0) stats.wins++; else stats.losses++;
                            stats.profit += r;
                            blockExecuted = true;
                        }
                    } else if (entryStyle === 'TPD') {
                        if (cIdx + 1 < currQ.candles5m.length) {
                            const c3 = currQ.candles5m[cIdx + 1];
                            const csdBullish = c3[fs].close > c5m[fs].open;

                            if (csdBullish) {
                                const bars2ndHalf = c5m.bars1m.slice(-2);
                                let reversionLevel = null;

                                const downcloseBars = bars2ndHalf.filter(b => b[fs].close < b[fs].open);
                                if (downcloseBars.length > 0) {
                                    let lowestVal = 999999;
                                    let bestBar = null;
                                    for (const b of downcloseBars) {
                                        if (b[fs].low < lowestVal) {
                                            lowestVal = b[fs].low;
                                            bestBar = b;
                                        }
                                    }
                                    reversionLevel = bestBar[fs].high;
                                } else {
                                    reversionLevel = Math.min(bars2ndHalf[0][fs].high, bars2ndHalf[1][fs].high);
                                }

                                if (reversionLevel) {
                                    const last1MOfC3 = c3.bars1m[c3.bars1m.length - 1];
                                    const outcomes = getOutcomeSlice(last1MOfC3.timestamp);

                                    let tapped = false;
                                    let tappedIndex = -1;

                                    for (let k = 1; k < outcomes.length; k++) {
                                        const o = outcomes[k];
                                        if (o[fs].low <= sl) break;
                                        if (o[fs].low <= reversionLevel) {
                                            tapped = true;
                                            tappedIndex = k;
                                            break;
                                        }
                                    }

                                    if (tapped && tappedIndex !== -1) {
                                        const entry = reversionLevel;
                                        const risk = entry - sl;

                                        if (risk > 0) {
                                            const tradeOutcomes = outcomes.slice(tappedIndex + 1);
                                            const target = entry + riskReward * risk;

                                            let r = -1.0;
                                            let outcomeStr = "STOPPED OUT";
                                            for (const o of tradeOutcomes) {
                                                if (o[fs].low <= sl) { r = -1.0; outcomeStr = "STOPPED OUT"; break; }
                                                if (o[fs].high >= target) { r = riskReward; outcomeStr = "TARGET HIT"; break; }
                                            }
                                            if (outcomeStr === "STOPPED OUT" && tradeOutcomes.length > 0) {
                                                let slHit = false;
                                                for (const o of tradeOutcomes) { if (o[fs].low <= sl) { slHit = true; break; } }
                                                if (!slHit) {
                                                    const exit = tradeOutcomes[tradeOutcomes.length - 1][fs].close;
                                                    r = (exit - entry) / risk;
                                                }
                                            }

                                            stats.trades++;
                                            if (r > 0) stats.wins++; else stats.losses++;
                                            stats.profit += r;
                                            blockExecuted = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (blockExecuted) break;

            // --- 2. BEARISH SWEEP SHORT ---
            const esSweptH = c5m.es.high > prevHighES;
            const nqSweptH = c5m.nq.high > prevHighNQ;
            const bearishSMT = (esSweptH && !nqSweptH) || (nqSweptH && !esSweptH);

            if (bearishSMT) {
                const fs = nqSweptH ? "es" : "nq";
                const sweepingHigh = c5m[fs].high;

                // Trend Filter
                if (trendFilter) {
                    const emaVal = getH1EMA(c5m.timestamp, fs);
                    if (emaVal && c5m[fs].close > emaVal) continue; // skip shorts if price is above H1 EMA
                }

                const activeFVG = gaps.find(f => {
                    if (f.asset !== fs.toUpperCase()) return false;
                    if (f.mitigated && c5m.timestamp > f.mitigatedTimestamp) return false;
                    if (c5m.timestamp <= f.formedTimestamp) return false;
                    return f.type === 'BEARISH' && sweepingHigh >= f.low && sweepingHigh <= f.high;
                });

                if (activeFVG) {
                    const sl = c5m[fs].high * (1 + slBuffer);

                    if (entryStyle === 'DIRECT') {
                        const entry = c5m[fs].close;
                        const risk = sl - entry;

                        if (risk > 0) {
                            const last1MOf5M = c5m.bars1m[c5m.bars1m.length - 1];
                            const outcomes = getOutcomeSlice(last1MOf5M.timestamp);
                            const target = entry - riskReward * risk;

                            let r = -1.0;
                            let outcomeStr = "STOPPED OUT";
                            for (let k = 1; k < outcomes.length; k++) {
                                const o = outcomes[k];
                                if (o[fs].high >= sl) { r = -1.0; outcomeStr = "STOPPED OUT"; break; }
                                if (o[fs].low <= target) { r = riskReward; outcomeStr = "TARGET HIT"; break; }
                            }
                            if (outcomeStr === "STOPPED OUT" && outcomes.length > 0) {
                                let slHit = false;
                                for (const o of outcomes) { if (o[fs].high >= sl) { slHit = true; break; } }
                                if (!slHit) {
                                    const exit = outcomes[outcomes.length - 1][fs].close;
                                    r = (entry - exit) / risk;
                                }
                            }

                            stats.trades++;
                            if (r > 0) stats.wins++; else stats.losses++;
                            stats.profit += r;
                            blockExecuted = true;
                        }
                    } else if (entryStyle === 'TPD') {
                        if (cIdx + 1 < currQ.candles5m.length) {
                            const c3 = currQ.candles5m[cIdx + 1];
                            const csdBearish = c3[fs].close < c5m[fs].open;

                            if (csdBearish) {
                                const bars2ndHalf = c5m.bars1m.slice(-2);
                                let reversionLevel = null;

                                const upcloseBars = bars2ndHalf.filter(b => b[fs].close > b[fs].open);
                                if (upcloseBars.length > 0) {
                                    let highestVal = 0;
                                    let bestBar = null;
                                    for (const b of upcloseBars) {
                                        if (b[fs].high > highestVal) {
                                            highestVal = b[fs].high;
                                            bestBar = b;
                                        }
                                    }
                                    reversionLevel = bestBar[fs].low;
                                } else {
                                    reversionLevel = Math.max(bars2ndHalf[0][fs].low, bars2ndHalf[1][fs].low);
                                }

                                if (reversionLevel) {
                                    const last1MOfC3 = c3.bars1m[c3.bars1m.length - 1];
                                    const outcomes = getOutcomeSlice(last1MOfC3.timestamp);

                                    let tapped = false;
                                    let tappedIndex = -1;

                                    for (let k = 1; k < outcomes.length; k++) {
                                        const o = outcomes[k];
                                        if (o[fs].high >= sl) break;
                                        if (o[fs].high >= reversionLevel) {
                                            tapped = true;
                                            tappedIndex = k;
                                            break;
                                        }
                                    }

                                    if (tapped && tappedIndex !== -1) {
                                        const entry = reversionLevel;
                                        const risk = sl - entry;

                                        if (risk > 0) {
                                            const tradeOutcomes = outcomes.slice(tappedIndex + 1);
                                            const target = entry - riskReward * risk;

                                            let r = -1.0;
                                            let outcomeStr = "STOPPED OUT";
                                            for (const o of tradeOutcomes) {
                                                if (o[fs].high >= sl) { r = -1.0; outcomeStr = "STOPPED OUT"; break; }
                                                if (o[fs].low <= target) { r = riskReward; outcomeStr = "TARGET HIT"; break; }
                                            }
                                            if (outcomeStr === "STOPPED OUT" && tradeOutcomes.length > 0) {
                                                let slHit = false;
                                                for (const o of tradeOutcomes) { if (o[fs].high >= sl) { slHit = true; break; } }
                                                if (!slHit) {
                                                    const exit = tradeOutcomes[tradeOutcomes.length - 1][fs].close;
                                                    r = (entry - exit) / risk;
                                                }
                                            }

                                            stats.trades++;
                                            if (r > 0) stats.wins++; else stats.losses++;
                                            stats.profit += r;
                                            blockExecuted = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const wr = stats.trades > 0 ? (stats.wins / stats.trades * 100).toFixed(1) : "0.0";
    return { stats, wr };
}

async function runOptimization() {
    console.log("==========================================================================");
    console.log("   CHRONOS 90M SSMT MULTI-PARAMETER OPTIMIZATION ENGINE                 ");
    console.log("==========================================================================\n");

    const yf = new yahooFinance();
    const aligned1MBars = [];
    const lookbackDays = 28;
    const chunkSize = 7;

    try {
        console.log(`Downloading last ${lookbackDays} days of 1-Minute granularity data in ${chunkSize}-day chunks...`);
        for (let start = lookbackDays; start > 0; start -= chunkSize) {
            const end = Math.max(0, start - chunkSize);
            const period1 = new Date(Date.now() - start * 24 * 60 * 60 * 1000);
            const period2 = new Date(Date.now() - end * 24 * 60 * 60 * 1000);

            console.log(` -> Chunk: ${start} to ${end} days ago...`);
            const esResult = await yf.chart('ES=F', { period1, period2, interval: '1m' });
            const nqResult = await yf.chart('NQ=F', { period1, period2, interval: '1m' });

            if (esResult.quotes && nqResult.quotes) {
                const nqMap = new Map();
                for (const bar of parseQuotes(nqResult.quotes)) {
                    const dateStr = moment(bar.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
                    nqMap.set(dateStr, bar);
                }

                for (const esBar of parseQuotes(esResult.quotes)) {
                    const dateStr = moment(esBar.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
                    const nqBar = nqMap.get(dateStr);
                    if (nqBar) {
                        aligned1MBars.push({
                            date: dateStr,
                            timestamp: esBar.timestamp,
                            es: esBar,
                            nq: nqBar
                        });
                    }
                }
            }
        }

        aligned1MBars.sort((a, b) => a.timestamp - b.timestamp);
        const uniqueBars = [];
        const seen = new Set();
        for (const bar of aligned1MBars) {
            if (!seen.has(bar.timestamp)) {
                seen.add(bar.timestamp);
                uniqueBars.push(bar);
            }
        }

        console.log(`Aligned ${uniqueBars.length} unique 1-Minute bars.`);

        const candles5m = buildClockAligned5MCandles(uniqueBars);
        const candles15m = buildClockAligned15MCandles(uniqueBars);
        const candles1h = buildClockAligned1HCandles(uniqueBars);

        // Add 20-period EMA to H1 candles
        addEMAs(candles1h, 20);

        const gaps15m = find15MGaps(candles15m);
        const gaps1h = find1HGaps(candles1h);

        mitigateGaps(gaps15m, uniqueBars);
        mitigateGaps(gaps1h, uniqueBars);

        const sortedQuarters = groupCandlesIntoQuarters(candles5m);

        console.log("\nGrid searching parameters to locate peak expectancy...");
        
        const slBuffers = [0.0008, 0.0012, 0.0015, 0.0020];
        const trendFilters = [false, true];
        const sessionFilters = [false, true];
        const riskRewards = [1.5, 2.0, 2.5];
        const entryStyles = ['DIRECT', 'TPD'];
        const pdaFilters = ['H1', 'M15'];

        let results = [];

        for (const entryStyle of entryStyles) {
            for (const pdaFilter of pdaFilters) {
                const targetGaps = pdaFilter === 'H1' ? gaps1h : gaps15m;
                
                for (const slBuffer of slBuffers) {
                    for (const trendFilter of trendFilters) {
                        for (const sessionFilter of sessionFilters) {
                            for (const riskReward of riskRewards) {
                                
                                const options = { entryStyle, slBuffer, trendFilter, sessionFilter, riskReward };
                                const res = simulateStrategy(sortedQuarters, uniqueBars, targetGaps, candles1h, options);
                                
                                results.push({
                                    pdaFilter,
                                    entryStyle,
                                    slBuffer,
                                    trendFilter,
                                    sessionFilter,
                                    riskReward,
                                    trades: res.stats.trades,
                                    winRate: parseFloat(res.wr),
                                    profit: res.stats.profit
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort by net profit descending
        results.sort((a, b) => b.profit - a.profit);

        console.log("\n==========================================================================");
        console.log("   TOP 10 PEAK PROFITABILITY COMBINATIONS                                ");
        console.log("==========================================================================");
        console.log("Rank | PDA | Style  | SL Buf | Trend? | Session?| R:R  | Trades | Win % | Net R");
        console.log("-----+-----+--------+--------+--------+---------+------+--------+-------+-----");
        for (let i = 0; i < Math.min(10, results.length); i++) {
            const r = results[i];
            console.log(
                `${String(i + 1).padStart(4)} | ` +
                `${r.pdaFilter.padEnd(3)} | ` +
                `${r.entryStyle.padEnd(6)} | ` +
                `${(r.slBuffer * 100).toFixed(2)}% | ` +
                `${String(r.trendFilter).padEnd(6)} | ` +
                `${String(r.sessionFilter).padEnd(7)} | ` +
                `${r.riskReward.toFixed(1)}  | ` +
                `${String(r.trades).padStart(6)} | ` +
                `${r.winRate.toFixed(1)}% | ` +
                `${(r.profit >= 0 ? "+" : "")}${r.profit.toFixed(2)}R`
            );
        }
        console.log("==========================================================================\n");

    } catch (e) {
        console.error("Optimization failed:", e);
    }
}

runOptimization();
