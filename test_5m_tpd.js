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

function hasOverlap(low1, high1, low2, high2) {
    return Math.max(low1, low2) <= Math.min(high1, high2);
}

async function runTest() {
    console.log("=========================================");
    console.log("   5M TPD SMT STRATEGY TESTER           ");
    console.log("=========================================\n");

    const yf = new yahooFinance();
    const period1 = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000); // 59 days lookback
    const period2 = new Date();

    try {
        console.log(`Downloading 5-Minute continuous futures data for ES=F and NQ=F...`);
        const esResult = await yf.chart('ES=F', { period1, period2, interval: '5m' });
        const nqResult = await yf.chart('NQ=F', { period1, period2, interval: '5m' });

        if (!esResult.quotes || !nqResult.quotes || esResult.quotes.length === 0 || nqResult.quotes.length === 0) {
            throw new Error("Failed to retrieve 5-minute historical data.");
        }

        console.log(`Success! Loaded ${esResult.quotes.length} ES bars and ${nqResult.quotes.length} NQ bars.`);

        // Align bars by New York calendar date and time
        const nqMap = new Map();
        for (const bar of parseQuotes(nqResult.quotes)) {
            const dateStr = moment(bar.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
            nqMap.set(dateStr, bar);
        }

        const alignedBars = [];
        for (const esBar of parseQuotes(esResult.quotes)) {
            const dateStr = moment(esBar.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
            const nqBar = nqMap.get(dateStr);
            if (nqBar) {
                alignedBars.push({
                    date: dateStr,
                    timestamp: esBar.timestamp,
                    es: esBar,
                    nq: nqBar
                });
            }
        }
        alignedBars.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`Aligned ${alignedBars.length} 5m trading bars.`);

        // Group 5m bars by calendar date
        const dayMap = new Map();
        for (const bar of alignedBars) {
            const dateOnly = bar.date.split(" ")[0];
            if (!dayMap.has(dateOnly)) {
                dayMap.set(dateOnly, []);
            }
            dayMap.get(dateOnly).push(bar);
        }

        const sortedDates = Array.from(dayMap.keys()).sort();
        console.log(`Found ${sortedDates.length} distinct trading days.`);

        // Run simulation
        backtest5mTPD(sortedDates, dayMap);

    } catch (e) {
        console.error("Backtest failed:", e);
    }
}

function backtest5mTPD(sortedDates, dayMap) {
    let tradeLog = [];
    let totalTrades = 0;
    let wins_12 = 0;
    let losses_12 = 0;
    let return_12 = 0;

    let wins_erl = 0;
    let losses_erl = 0;
    let return_erl = 0;

    // We start from day 1 so we can check day 0 for trend direction
    for (let i = 1; i < sortedDates.length; i++) {
        const prevDayStr = sortedDates[i - 1];
        const currentDayStr = sortedDates[i];
        
        const prevDayBars = dayMap.get(prevDayStr);
        const currentDayBars = dayMap.get(currentDayStr);

        const dailyBias = "BOTH";

        // Sort current day bars chronologically
        currentDayBars.sort((a, b) => a.timestamp - b.timestamp);

        // Scan NY session: 8:30 AM to 1:30 PM EST
        const sessionBars = currentDayBars.filter(b => {
            const m = moment(b.timestamp).tz("America/New_York");
            const h = m.hour();
            const min = m.minute();
            const totalMins = h * 60 + min;
            return totalMins >= 8 * 60 + 30 && totalMins < 13 * 60 + 30; // 8:30 AM to 1:30 PM
        });

        // We also need the rest of the day for outcome scanning (until 4:00 PM close)
        const outcomeBars = currentDayBars.filter(b => {
            const m = moment(b.timestamp).tz("America/New_York");
            const h = m.hour();
            const min = m.minute();
            const totalMins = h * 60 + min;
            return totalMins >= 8 * 60 + 30 && totalMins < 16 * 60; // 8:30 AM to 4:00 PM
        });

        let dayExecuted = false;

        // Loop through session bars looking for a 5m TPD setup
        // Need at least 3 bars to form a TPD sequence
        for (let j = 2; j < sessionBars.length; j++) {
            if (dayExecuted) break;

            const c1 = sessionBars[j - 2];
            const c2 = sessionBars[j - 1];
            const c3 = sessionBars[j];

            // 1. BULLISH SETUP
            if (dailyBias === "BULLISH" || dailyBias === "BOTH") {
                // Candle 2 sweeps Candle 1's low on NQ or ES
                const nqSwept = c2.nq.low < c1.nq.low;
                const esSwept = c2.es.low < c1.es.low;

                // Classical SMT: one swept, one failed
                const bullishSMT = (nqSwept && !esSwept) || (esSwept && !nqSwept);

                if (bullishSMT) {
                    const failureSwingAsset = nqSwept ? "ES" : "NQ";
                    const sweepAsset = nqSwept ? "NQ" : "ES";

                    // Candle 3 Displacement / CSD: body close above Candle 2 open
                    const fs_csd = c3[failureSwingAsset.toLowerCase()].close > c2[failureSwingAsset.toLowerCase()].open;
                    const sw_csd = c3[sweepAsset.toLowerCase()].close > c2[sweepAsset.toLowerCase()].open;

                    if (fs_csd && sw_csd) {
                        // Confirmed 5m TPD setup on failureSwingAsset!
                        // Map 1M Reversion Level: bottom 10% of Candle 2
                        const fs_c2 = c2[failureSwingAsset.toLowerCase()];
                        const rl_low = fs_c2.low;
                        const rl_high = fs_c2.low + 0.10 * (fs_c2.high - fs_c2.low);

                        // Look for pullback in subsequent bars
                        const c3Index = outcomeBars.findIndex(b => b.timestamp === c3.timestamp);
                        if (c3Index === -1) continue;

                        const pullbackBars = outcomeBars.slice(c3Index + 1);
                        
                        for (let k = 0; k < pullbackBars.length; k++) {
                            const pBar = pullbackBars[k];
                            const pAsset = pBar[failureSwingAsset.toLowerCase()];

                            // Did we violate the stop level before tapping?
                            if (pAsset.low < fs_c2.low) {
                                break; // setup invalidated before entry
                            }

                            // Tap the Reversion Level
                            if (pAsset.low <= rl_high && pAsset.low >= fs_c2.low) {
                                // Entry filled!
                                const entryPrice = rl_high;
                                const stopLoss = fs_c2.low * 0.9992; // 0.08% buffer
                                const risk = entryPrice - stopLoss;

                                if (risk > 0) {
                                    const target_12 = entryPrice + 2 * risk;
                                    const target_erl = fs_c2.high; // Model B Opposing range ERL target

                                    // Scan outcome from here to EOD
                                    const tradeOutcomeBars = pullbackBars.slice(k + 1);
                                    let outcome_12 = "OPEN";
                                    let r_12 = 0;

                                    for (const oBar of tradeOutcomeBars) {
                                        const oAsset = oBar[failureSwingAsset.toLowerCase()];
                                        if (oAsset.low <= stopLoss) {
                                            outcome_12 = "STOPPED OUT";
                                            r_12 = -1.0;
                                            break;
                                        }
                                        if (oAsset.high >= target_12) {
                                            outcome_12 = "TARGET HIT";
                                            r_12 = 2.0;
                                            break;
                                        }
                                    }

                                    if (outcome_12 === "OPEN" && tradeOutcomeBars.length > 0) {
                                        const finalAsset = tradeOutcomeBars[tradeOutcomeBars.length - 1][failureSwingAsset.toLowerCase()];
                                        r_12 = (finalAsset.close - entryPrice) / risk;
                                        outcome_12 = `EOD CLOSE (${r_12 >= 0 ? "+" : ""}${r_12.toFixed(2)}R)`;
                                    }

                                    let outcome_erl = "OPEN";
                                    let r_erl = 0;

                                    for (const oBar of tradeOutcomeBars) {
                                        const oAsset = oBar[failureSwingAsset.toLowerCase()];
                                        if (oAsset.low <= stopLoss) {
                                            outcome_erl = "STOPPED OUT";
                                            r_erl = -1.0;
                                            break;
                                        }
                                        if (oAsset.high >= target_erl) {
                                            outcome_erl = "ERL TARGET HIT";
                                            r_erl = (target_erl - entryPrice) / risk;
                                            break;
                                        }
                                    }

                                    if (outcome_erl === "OPEN" && tradeOutcomeBars.length > 0) {
                                        const finalAsset = tradeOutcomeBars[tradeOutcomeBars.length - 1][failureSwingAsset.toLowerCase()];
                                        r_erl = (finalAsset.close - entryPrice) / risk;
                                        outcome_erl = `EOD CLOSE (${r_erl >= 0 ? "+" : ""}${r_erl.toFixed(2)}R)`;
                                    }

                                    if (r_12 > 0) wins_12++; else losses_12++;
                                    return_12 += r_12;

                                    if (r_erl > 0) wins_erl++; else losses_erl++;
                                    return_erl += r_erl;

                                    tradeLog.push({
                                        date: pBar.date,
                                        type: "BULLISH (LONG)",
                                        asset: failureSwingAsset,
                                        entry: entryPrice,
                                        sl: stopLoss,
                                        risk: risk,
                                        r12: r_12,
                                        rerl: r_erl,
                                        o12: outcome_12,
                                        oerl: outcome_erl
                                    });

                                    totalTrades++;
                                    dayExecuted = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // 2. BEARISH SETUP
            if (dailyBias === "BEARISH" || dailyBias === "BOTH") {
                // Candle 2 sweeps Candle 1's high on NQ or ES
                const nqSwept = c2.nq.high > c1.nq.high;
                const esSwept = c2.es.high > c1.es.high;

                // Classical SMT: one swept, one failed
                const bearishSMT = (nqSwept && !esSwept) || (esSwept && !nqSwept);

                if (bearishSMT) {
                    const failureSwingAsset = nqSwept ? "ES" : "NQ";
                    const sweepAsset = nqSwept ? "NQ" : "ES";

                    // Candle 3 Displacement / CSD: body close below Candle 2 open
                    const fs_csd = c3[failureSwingAsset.toLowerCase()].close < c2[failureSwingAsset.toLowerCase()].open;
                    const sw_csd = c3[sweepAsset.toLowerCase()].close < c2[sweepAsset.toLowerCase()].open;

                    if (fs_csd && sw_csd) {
                        // Confirmed 5m TPD setup on failureSwingAsset!
                        // Map 1M Reversion Level: top 10% of Candle 2
                        const fs_c2 = c2[failureSwingAsset.toLowerCase()];
                        const rl_high = fs_c2.high;
                        const rl_low = fs_c2.high - 0.10 * (fs_c2.high - fs_c2.low);

                        // Look for pullback in subsequent bars
                        const c3Index = outcomeBars.findIndex(b => b.timestamp === c3.timestamp);
                        if (c3Index === -1) continue;

                        const pullbackBars = outcomeBars.slice(c3Index + 1);
                        
                        for (let k = 0; k < pullbackBars.length; k++) {
                            const pBar = pullbackBars[k];
                            const pAsset = pBar[failureSwingAsset.toLowerCase()];

                            // Did we violate the stop level before tapping?
                            if (pAsset.high > fs_c2.high) {
                                break; // setup invalidated before entry
                            }

                            // Tap the Reversion Level
                            if (pAsset.high >= rl_low && pAsset.high <= fs_c2.high) {
                                // Entry filled!
                                const entryPrice = rl_low;
                                const stopLoss = fs_c2.high * 1.0008; // 0.08% buffer
                                const risk = stopLoss - entryPrice;

                                if (risk > 0) {
                                    const target_12 = entryPrice - 2 * risk;
                                    const target_erl = fs_c2.low; // Model B Opposing range ERL target

                                    // Scan outcome from here to EOD
                                    const tradeOutcomeBars = pullbackBars.slice(k + 1);
                                    let outcome_12 = "OPEN";
                                    let r_12 = 0;

                                    for (const oBar of tradeOutcomeBars) {
                                        const oAsset = oBar[failureSwingAsset.toLowerCase()];
                                        if (oAsset.high >= stopLoss) {
                                            outcome_12 = "STOPPED OUT";
                                            r_12 = -1.0;
                                            break;
                                        }
                                        if (oAsset.low <= target_12) {
                                            outcome_12 = "TARGET HIT";
                                            r_12 = 2.0;
                                            break;
                                        }
                                    }

                                    if (outcome_12 === "OPEN" && tradeOutcomeBars.length > 0) {
                                        const finalAsset = tradeOutcomeBars[tradeOutcomeBars.length - 1][failureSwingAsset.toLowerCase()];
                                        r_12 = (entryPrice - finalAsset.close) / risk;
                                        outcome_12 = `EOD CLOSE (${r_12 >= 0 ? "+" : ""}${r_12.toFixed(2)}R)`;
                                    }

                                    let outcome_erl = "OPEN";
                                    let r_erl = 0;

                                    for (const oBar of tradeOutcomeBars) {
                                        const oAsset = oBar[failureSwingAsset.toLowerCase()];
                                        if (oAsset.high >= stopLoss) {
                                            outcome_erl = "STOPPED OUT";
                                            r_erl = -1.0;
                                            break;
                                        }
                                        if (oAsset.low <= target_erl) {
                                            outcome_erl = "ERL TARGET HIT";
                                            r_erl = (entryPrice - target_erl) / risk;
                                            break;
                                        }
                                    }

                                    if (outcome_erl === "OPEN" && tradeOutcomeBars.length > 0) {
                                        const finalAsset = tradeOutcomeBars[tradeOutcomeBars.length - 1][failureSwingAsset.toLowerCase()];
                                        r_erl = (entryPrice - finalAsset.close) / risk;
                                        outcome_erl = `EOD CLOSE (${r_erl >= 0 ? "+" : ""}${r_erl.toFixed(2)}R)`;
                                    }

                                    if (r_12 > 0) wins_12++; else losses_12++;
                                    return_12 += r_12;

                                    if (r_erl > 0) wins_erl++; else losses_erl++;
                                    return_erl += r_erl;

                                    tradeLog.push({
                                        date: pBar.date,
                                        type: "BEARISH (SHORT)",
                                        asset: failureSwingAsset,
                                        entry: entryPrice,
                                        sl: stopLoss,
                                        risk: risk,
                                        r12: r_12,
                                        rerl: r_erl,
                                        o12: outcome_12,
                                        oerl: outcome_erl
                                    });

                                    totalTrades++;
                                    dayExecuted = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const wr_12 = totalTrades > 0 ? ((wins_12 / totalTrades) * 100).toFixed(1) : 0;
    const wr_erl = totalTrades > 0 ? ((wins_erl / totalTrades) * 100).toFixed(1) : 0;
    const tradesPerWeek = (totalTrades / (59 / 7)).toFixed(1);

    console.log("=========================================");
    console.log("           BACKTEST RESULTS              ");
    console.log("=========================================");
    console.log(`Total Trades:             ${totalTrades}`);
    console.log(`Trades Per Week:          ${tradesPerWeek}`);
    console.log(`Model A (1:2 R:R) WR:     ${wr_12}% (Return: ${return_12 >= 0 ? "+" : ""}${return_12.toFixed(2)}R)`);
    console.log(`Model B (ERL Target) WR:  ${wr_erl}% (Return: ${return_erl >= 0 ? "+" : ""}${return_erl.toFixed(2)}R)`);
    console.log("=========================================");

    console.log("\nSample Trades Log (first 10):");
    console.log(tradeLog.slice(0, 10));
}

runTest();
