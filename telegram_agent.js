const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const yahooFinance = require('yahoo-finance2').default;
const moment = require('moment-timezone');

// Load environment variables if .env exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
            process.env[key] = val;
        }
    });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MEMORY_FILE = path.join(__dirname, 'agent_memory.json');
const ALERTS_FILE = path.join(__dirname, 'alerts.json');

// Initialize Memory if not exists
if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
        lessons: [], // Rules/corrections taught by the user
        customAlerts: [], // Price alert levels set from phone
        activeTasks: {
            scan15mSSMT: false,
            scanDailyGap: false,
            customScanText: ""
        }
    }, null, 2));
}

// Helper: Read files safely
function readNotesFile(filename) {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    // Check in parent/brain directory as well
    const brainPath = path.join('C:\\Users\\monic\\.gemini\\antigravity\\brain\\9f09e6f0-07f2-48cc-a8a8-115bbf65edb8', filename);
    if (fs.existsSync(brainPath)) {
        return fs.readFileSync(brainPath, 'utf8');
    }
    return "";
}

// Compile all core trading notes into a master knowledge base
function compileKnowledgeBase() {
    console.log("[AGENT] Compiling core trading knowledge from workspace...");
    let kb = "CORE TRADING STRATEGY KNOWLEDGE BASE:\n\n";
    
    kb += "=== BLUEPRINT: TERMINUS PRICE DIVERGENCE (TPD) ===\n";
    kb += readNotesFile('refined_tpd_mastery_blueprint.md') + "\n\n";
    
    kb += "=== STUDY NOTES: THE SYSTEM (VIDEO 22) ===\n";
    kb += readNotesFile('video_22_the_system_notes.md') + "\n\n";
    
    kb += "=== STUDY NOTES: VIDEOS 17-22 (WEEKLY HALVING, CHRONOS) ===\n";
    kb += readNotesFile('video_notes_17_22.md') + "\n\n";
    
    kb += "=== STUDY NOTES: VIDEOS 12-15 (SMT, PREMIUM/DISCOUNT, SYNC) ===\n";
    kb += readNotesFile('video_notes_12_15.md') + "\n\n";
    
    kb += "=== STUDY NOTES: VIDEOS 7-11 (TIME ALIGNMENT, STOP LOSS, VALIDATION) ===\n";
    kb += readNotesFile('video_notes_7_11.md') + "\n\n";
    
    return kb;
}

// Load Memory data
function getMemory() {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
}

// Save Memory data
function saveMemory(mem) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

// HTTPS Request helper
function makeRequest(urlStr, options, payload = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const reqOpts = {
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + (u.search || ''),
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        if (payload) {
            reqOpts.headers['Content-Length'] = Buffer.byteLength(payload);
        }
        
        const req = https.request(reqOpts, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Send Telegram Message
async function sendTelegram(text) {
    if (!BOT_TOKEN || !CHAT_ID) return;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
    });
    try {
        await makeRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload);
    } catch (e) {
        console.error("[TELEGRAM] Send error:", e.message);
    }
}

// Call Gemini API with Core Knowledge + Memory Context
async function askGemini(userMessage) {
    if (!GEMINI_API_KEY) {
        return "⚠️ Please set your `GEMINI_API_KEY` in the `.env` file first!";
    }
    
    const kb = compileKnowledgeBase();
    const mem = getMemory();
    
    const lessonsStr = mem.lessons.map((l, i) => `${i+1}. ${l}`).join('\n');
    
    const systemPrompt = `You are the personal Trading Assistant co-pilot for the user. You have been loaded with their private trading notes, blueprints, and rules. 
Your brain contains the complete core content of Jacob Speculates mentorship (Videos 1-22).
You must evaluate setups, answer questions, and respond ONLY using these core trading rules.

CORE RULES TO REMEMBER:
1. Weekly Halving Theory: Expectations of Low/High of Week forming in first half (Mon-Wed) or second half (Thu-Fri).
2. TPD (Terminus Price Divergence): Enters strictly at Reversion Levels (RL) on the lower timeframe without waiting for CSD Candle 3 close.
3. Stop Loss: Placed at the sweep candle high/low plus a buffer of 0.08%.
4. SMT local validation: Bullish failure swing asset must pullback to at least 50% discount of its local swing range, bearish to 50% premium.
5. News volatility dictates the 3/2 or 2/3 distribution of the week.
6. Decoupled markets (e.g. ES in Premium, NQ in Discount) are low probability and should be avoided.

LESSONS TAUGHT BY USER (PRIORITIZE THESE CORRECTIONS):
${lessonsStr || "No custom lessons taught yet. Listen to the user's feedback to learn."}

CURRENT STATE:
- Active scanning tasks: ${JSON.stringify(mem.activeTasks)}
- Watchlist target levels: ${JSON.stringify(mem.customAlerts)}

Your tone should be professional, clear, and highly aligned with institutional trading concepts. Do not use standard retail trading slang.
Keep responses concise since the user is reading this on a phone.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = JSON.stringify({
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        contents: [
            {
                role: "user",
                parts: [{ text: userMessage }]
            }
        ]
    });
    
    try {
        const res = await makeRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload);
        
        if (res.statusCode !== 200) {
            return `Error from Gemini (${res.statusCode}): ${res.body}`;
        }
        
        const data = JSON.parse(res.body);
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return `Failed to query Gemini: ${e.message}`;
    }
}

// Parse Dynamic Tasks from Phone
async function parseAndSetTask(text) {
    const mem = getMemory();
    const lowercase = text.toLowerCase();
    
    // Check if user is asking to scan for 15M SSMT
    if (lowercase.includes("15m ssmt") && (lowercase.includes("scan") || lowercase.includes("monitor") || lowercase.includes("inform"))) {
        mem.activeTasks.scan15mSSMT = true;
        saveMemory(mem);
        return "✅ Scanning Task Activated: I will scan ES, NQ, and YM for 15-Minute SSMT setups and push alerts immediately to your phone.";
    }
    
    // Check if user is clearing scans
    if (lowercase.includes("stop scan") || lowercase.includes("clear scan")) {
        mem.activeTasks.scan15mSSMT = false;
        mem.activeTasks.scanDailyGap = false;
        saveMemory(mem);
        return "⏹️ All custom scanning tasks deactivated.";
    }
    
    // Check for daily gap alerts
    if (lowercase.includes("daily gap") || lowercase.includes("gap alert")) {
        // Look for numbers representing price levels
        const match = text.match(/\d+[\.,]?\d*/);
        if (match) {
            const level = parseFloat(match[0].replace(',', '.'));
            const isES = lowercase.includes("es");
            const ticker = isES ? "ES" : "NQ";
            
            mem.customAlerts.push({
                id: Date.now(),
                ticker: ticker,
                type: "GAP",
                level: level,
                status: "PENDING"
            });
            saveMemory(mem);
            return `🔔 Alert Set: I will monitor the Daily Gap on ${ticker} at ${level.toFixed(2)} and text you the moment price taps it.`;
        }
    }
    
    // Check if teaching a lesson / correction
    if (lowercase.startsWith("remember") || lowercase.startsWith("learn") || lowercase.includes("correct rule")) {
        const lesson = text.replace(/^(remember|learn|correct rule)\s*:?/i, '').trim();
        mem.lessons.push(lesson);
        saveMemory(mem);
        return `🧠 Memory Updated! I have learned this rule and will apply it to all future scans and questions:\n"${lesson}"`;
    }
    
    return null;
}

// Generate Scanner Status Report
async function generateScannerStatus() {
    let report = "📊 *LIVE SCANNER STATUS* 📊\n\n";
    
    try {
        const yf = new yahooFinance();
        const period1 = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours
        const esRes = await yf.chart('ES=F', { period1, interval: '15m' });
        const nqRes = await yf.chart('NQ=F', { period1, interval: '15m' });
        
        if (esRes.quotes && nqRes.quotes) {
            const lastES = esRes.quotes[esRes.quotes.length - 1];
            const lastNQ = nqRes.quotes[nqRes.quotes.length - 1];
            
            report += `📈 *Current Prices*:\n`;
            report += `*ES*: ${lastES.close.toFixed(2)} (High: ${lastES.high.toFixed(2)} | Low: ${lastES.low.toFixed(2)})\n`;
            report += `*NQ*: ${lastNQ.close.toFixed(2)} (High: ${lastNQ.high.toFixed(2)} | Low: ${lastNQ.low.toFixed(2)})\n\n`;
        }
    } catch (err) {
        report += `⚠️ Market data fetch failed: ${err.message}\n\n`;
    }
    
    const mem = getMemory();
    report += `🛡️ *Active Custom Tasks*:\n`;
    report += `- 15M SSMT Scan: ${mem.activeTasks.scan15mSSMT ? "✅ ON" : "❌ OFF"}\n`;
    report += `- Daily Gap Scan: ${mem.activeTasks.scanDailyGap ? "✅ ON" : "❌ OFF"}\n\n`;
    
    if (mem.customAlerts.length > 0) {
        report += `🔔 *Active Watchlist*:\n`;
        mem.customAlerts.forEach(a => {
            report += `- ${a.ticker} @ ${a.level.toFixed(2)} (${a.status})\n`;
        });
        report += "\n";
    }
    
    // Show recent alerts from alerts.json
    if (fs.existsSync(ALERTS_FILE)) {
        const alerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
        if (alerts.length > 0) {
            report += `🚨 *Recent Alerts (Last 3)*:\n`;
            alerts.slice(0, 3).forEach(a => {
                report += `- ${a.date} | ${a.ticker} ${a.action} @ ${a.entryPrice.toFixed(2)} (${a.status})\n`;
            });
        }
    }
    
    return report;
}

// Telegram Updates Polling Listener
let lastUpdateId = 0;
async function pollTelegramUpdates() {
    if (!BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
    
    try {
        const res = await makeRequest(url, { method: 'GET' });
        if (res.statusCode !== 200) return;
        
        const data = JSON.parse(res.body);
        if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;
                
                if (update.message && update.message.chat.id.toString() === CHAT_ID) {
                    const text = update.message.text;
                    console.log(`[TELEGRAM] Message received: "${text}"`);
                    
                    // 1. Process default command shortcuts
                    if (text === '/status' || text.toLowerCase() === 'status') {
                        const statusReport = await generateScannerStatus();
                        await sendTelegram(statusReport);
                        continue;
                    }
                    
                    if (text === '/bias' || text.toLowerCase() === 'bias') {
                        const biasMsg = await askGemini("What is the current Daily Bias trend structure based on the Monday close and expansion profiles? Tell me standard rules and what you see.");
                        await sendTelegram(biasMsg);
                        continue;
                    }
                    
                    // 2. Check for dynamic custom scan tasks / target alerts / rules
                    const taskResponse = await parseAndSetTask(text);
                    if (taskResponse) {
                        await sendTelegram(taskResponse);
                        continue;
                    }
                    
                    // 3. Fallback: Normal AI Assistant Chat
                    await sendTelegram("🤖 Thinking...");
                    const aiReply = await askGemini(text);
                    await sendTelegram(aiReply);
                }
            }
        }
    } catch (e) {
        console.error("[TELEGRAM] Polling error:", e.message);
    }
}

// Live price monitor to fire alerts set by the user from phone
async function runAlertsCheck() {
    const mem = getMemory();
    if (mem.customAlerts.length === 0) return;
    
    try {
        const yf = new yahooFinance();
        const period1 = new Date(Date.now() - 30 * 60 * 1000); // 30 mins
        const esRes = await yf.chart('ES=F', { period1, interval: '5m' });
        const nqRes = await yf.chart('NQ=F', { period1, interval: '5m' });
        
        if (esRes.quotes && nqRes.quotes) {
            const lastES = esRes.quotes[esRes.quotes.length - 1];
            const lastNQ = nqRes.quotes[nqRes.quotes.length - 1];
            
            let listChanged = false;
            
            for (let alert of mem.customAlerts) {
                if (alert.status === 'PENDING') {
                    const price = alert.ticker === 'ES' ? lastES.close : lastNQ.close;
                    const high = alert.ticker === 'ES' ? lastES.high : lastNQ.high;
                    const low = alert.ticker === 'ES' ? lastES.low : lastNQ.low;
                    
                    // Simple check if price tapped the level
                    const tapped = (low <= alert.level && high >= alert.level);
                    if (tapped) {
                        alert.status = 'TRIGGERED';
                        listChanged = true;
                        
                        await sendTelegram(`🔔 *TARGET LEVEL TAP NOTIFICATION!* 🔔\n\n📈 *Asset*: ${alert.ticker}=F\n⚡ *Event*: Target level ${alert.level.toFixed(2)} was tapped!\n💵 *Current Close*: ${price.toFixed(2)}\n\n📱 Ready for next instructions!`);
                    }
                }
            }
            
            if (listChanged) {
                // Filter out triggered alerts to keep memory clean
                mem.customAlerts = mem.customAlerts.filter(a => a.status === 'PENDING');
                saveMemory(mem);
            }
        }
    } catch (e) {
        console.error("[ALERTS SCAN] Price scan failed:", e.message);
    }
}

// Background poll loops
function startPolling() {
    console.log("[AGENT] Starting Telegram bot listener...");
    setInterval(pollTelegramUpdates, 2000); // Poll Telegram updates every 2 seconds
    setInterval(runAlertsCheck, 15000); // Check custom watchlist alerts every 15 seconds
}

// Expose functions for server integration
module.exports = {
    startPolling,
    sendTelegram,
    askGemini
};

// If run directly, start polling and bind to port for Render health checks
if (require.main === module) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env!");
        process.exit(1);
    }

    // Simple dummy server to pass Render health checks
    const http = require('http');
    const PORT = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Trading Assistant is Active and Scanning!');
    });
    server.listen(PORT, () => {
        console.log(`[AGENT] Dummy HTTP server listening on port ${PORT}`);
    });

    startPolling();
}
