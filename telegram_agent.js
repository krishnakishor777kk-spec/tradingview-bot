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
            scanMonthlyCycle: false,
            scanWeeklyCycle: false,
            scanDailyCycle: false,
            scan90mCycle: false,
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
    
    kb += "=== STUDY NOTES: VIDEOS 1-6 (QUARTERLY THEORY, TIME/PRICE ALIGNMENT, NARRATIVE, SMT BASICS) ===\n";
    kb += readNotesFile('video_notes_1_6.md') + "\n\n";
    
    return kb;
}

// Load Memory data
function getMemory() {
    const mem = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    if (!mem.activeTasks) mem.activeTasks = {};
    if (mem.activeTasks.scanMonthlyCycle === undefined) mem.activeTasks.scanMonthlyCycle = false;
    if (mem.activeTasks.scanWeeklyCycle === undefined) mem.activeTasks.scanWeeklyCycle = false;
    if (mem.activeTasks.scanDailyCycle === undefined) mem.activeTasks.scanDailyCycle = false;
    if (mem.activeTasks.scan90mCycle === undefined) mem.activeTasks.scan90mCycle = false;
    if (mem.activeTasks.scan15mSSMT !== undefined) {
        mem.activeTasks.scanDailyCycle = mem.activeTasks.scan15mSSMT;
        delete mem.activeTasks.scan15mSSMT;
    }
    return mem;
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
            headers: options.headers || {},
            timeout: 15000 // 15 seconds timeout
        };
        
        if (payload) {
            reqOpts.headers['Content-Length'] = Buffer.byteLength(payload);
        }
        
        const req = https.request(reqOpts, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Request timed out after 15 seconds"));
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

// Regex XML Parser Helper
function parseXmlValue(tag, block) {
    const regex = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`);
    const match = block.match(regex);
    return match ? match[1].trim() : "";
}

let newsCache = null;
let lastNewsFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

// Fetch economic calendar from faireconomy.media (Forex Factory feed)
async function fetchEconomicCalendar() {
    const now = Date.now();
    if (newsCache && (now - lastNewsFetchTime < CACHE_DURATION)) {
        console.log("[AGENT] Using cached economic calendar.");
        return newsCache;
    }
    
    try {
        console.log("[AGENT] Fetching economic calendar...");
        const res = await makeRequest("https://nfs.faireconomy.media/ff_calendar_thisweek.xml", { method: 'GET' });
        if (res.statusCode !== 200) {
            console.error("[AGENT] Economic calendar fetch failed:", res.statusCode);
            return newsCache || [];
        }
        
        const eventBlocks = res.body.split("<event>").slice(1);
        const parsedEvents = [];
        for (const block of eventBlocks) {
            const title = parseXmlValue("title", block);
            const country = parseXmlValue("country", block);
            const date = parseXmlValue("date", block);
            const time = parseXmlValue("time", block);
            const impact = parseXmlValue("impact", block);
            
            if (country === "USD" && (impact === "High" || impact === "Medium")) {
                parsedEvents.push({ title, country, date, time, impact });
            }
        }
        
        newsCache = parsedEvents;
        lastNewsFetchTime = now;
        return parsedEvents;
    } catch (err) {
        console.error("[AGENT] Economic calendar error:", err.message);
        return newsCache || [];
    }
}

// Format News Calendar Report
function formatNewsForTelegram(events, targetDate = null) {
    const todayStr = targetDate || moment().tz("America/New_York").format("MM-DD-YYYY");
    const todayEvents = events.filter(e => e.date === todayStr);
    
    let report = `📅 *USD Economic Calendar (Today: ${todayStr} EST)*:\n`;
    if (todayEvents.length === 0) {
        report += "_No high or medium impact USD news scheduled for today._\n\n";
    } else {
        todayEvents.forEach(e => {
            const flag = e.impact === 'High' ? '🔴 HIGH' : '🟠 MED';
            report += `- *${e.time}* | [${flag}] ${e.title}\n`;
        });
        report += "\n";
    }
    
    const upcomingEvents = events.filter(e => {
        const eDate = moment(e.date, "MM-DD-YYYY");
        const tDate = moment(todayStr, "MM-DD-YYYY");
        return eDate.isAfter(tDate);
    });
    
    if (upcomingEvents.length > 0) {
        report += `📅 *Upcoming USD News (This Week)*:\n`;
        upcomingEvents.slice(0, 5).forEach(e => {
            const dayOfWeek = moment(e.date, "MM-DD-YYYY").format("ddd");
            const flag = e.impact === 'High' ? '🔴 HIGH' : '🟠 MED';
            report += `- ${dayOfWeek} ${e.time} | [${flag}] ${e.title} (${e.date.slice(0, 5)})\n`;
        });
    }
    
    return report;
}

// Call Gemini API with Core Knowledge + Memory Context
async function askGemini(userMessage) {
    if (!GEMINI_API_KEY) {
        return "⚠️ Please set your `GEMINI_API_KEY` in the `.env` file first!";
    }
    
    const kb = compileKnowledgeBase();
    const mem = getMemory();
    
    const lessonsStr = mem.lessons.map((l, i) => `${i+1}. ${l}`).join('\n');
    
    // Fetch today's news for injection
    let newsStatusStr = "TODAY'S USD ECONOMIC NEWS SCHEDULE (EST):\n";
    try {
        const calendarEvents = await fetchEconomicCalendar();
        const todayStr = moment().tz("America/New_York").format("MM-DD-YYYY");
        const todayEvents = calendarEvents.filter(e => e.date === todayStr);
        if (todayEvents.length === 0) {
            newsStatusStr += "No high/medium impact USD news scheduled for today.\n";
        } else {
            todayEvents.forEach(e => {
                newsStatusStr += `- ${e.time}: [${e.impact} Impact] ${e.title}\n`;
            });
        }
    } catch (e) {
        newsStatusStr += "Economic calendar data unavailable.\n";
    }
    
    // Fetch latest scan findings from memory
    let scanResultsStr = "No SMT/FVG scan results available yet.";
    if (mem.latestScanResults) {
        scanResultsStr = `Last Scan Time: ${mem.latestScanResults.lastScanTime}\n\n`;
        
        if (mem.latestScanResults.monthly) {
            scanResultsStr += `1. MONTHLY CYCLE (4H TF, Weekly SMT):\n` +
                `- Current Week: ${mem.latestScanResults.monthly.currentWeek}\n` +
                `- Active Sweeps: ${JSON.stringify(mem.latestScanResults.monthly.detectedSMTs)}\n\n`;
        }
        if (mem.latestScanResults.weekly) {
            scanResultsStr += `2. WEEKLY CYCLE (1H TF, Daily SMT):\n` +
                `- Current Day: ${mem.latestScanResults.weekly.currentDay}\n` +
                `- Active Sweeps: ${JSON.stringify(mem.latestScanResults.weekly.detectedSMTs)}\n\n`;
        }
        if (mem.latestScanResults.daily) {
            scanResultsStr += `3. DAILY CYCLE (15M TF, Session SMT):\n` +
                `- Current Session: ${mem.latestScanResults.daily.currentSession}\n` +
                `- Active Sweeps: ${JSON.stringify(mem.latestScanResults.daily.detectedSMTs)}\n\n`;
        }
        if (mem.latestScanResults['90m']) {
            scanResultsStr += `4. 90-MINUTE CYCLE (5M TF, Quarter SMT):\n` +
                `- Current Quarter: ${mem.latestScanResults['90m'].currentQuarter}\n` +
                `- Active Sweeps: ${JSON.stringify(mem.latestScanResults['90m'].detectedSMTs)}\n`;
        }
    }
    
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

=== PRIVATE KNOWLEDGE BASE (VIDEOS 1-22) ===
${kb}

CURRENT MACRO RISK ENVIRONMENT:
${newsStatusStr}

LESSONS TAUGHT BY USER (PRIORITIZE THESE CORRECTIONS):
${lessonsStr || "No custom lessons taught yet. Listen to the user's feedback to learn."}

CURRENT STATE:
- Active scanning tasks: ${JSON.stringify(mem.activeTasks)}
- Watchlist target levels: ${JSON.stringify(mem.customAlerts)}

LATEST MARKET DATA & SCAN DETAILS:
${scanResultsStr}

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
    
    // Check if user is deactivating all scans
    if (lowercase.includes("stop scan") || lowercase.includes("clear scan")) {
        mem.activeTasks.scanMonthlyCycle = false;
        mem.activeTasks.scanWeeklyCycle = false;
        mem.activeTasks.scanDailyCycle = false;
        mem.activeTasks.scan90mCycle = false;
        mem.activeTasks.scanDailyGap = false;
        saveMemory(mem);
        return "⏹️ All custom scanning tasks deactivated.";
    }

    // Check Monthly Cycle activation/deactivation
    if ((lowercase.includes("monthly cycle") || lowercase.includes("monthly smt") || lowercase.includes("4h smt") || lowercase.includes("4h ssmt")) && (lowercase.includes("scan") || lowercase.includes("monitor") || lowercase.includes("inform"))) {
        mem.activeTasks.scanMonthlyCycle = true;
        mem.alertedSetupKeys = [];
        saveMemory(mem);
        return "✅ Monthly Cycle Scanning Activated: I will monitor the 4H chart for Weekly SMT sweeps and push alerts.";
    }
    if ((lowercase.includes("monthly cycle") || lowercase.includes("monthly smt") || lowercase.includes("4h smt") || lowercase.includes("4h ssmt")) && (lowercase.includes("stop") || lowercase.includes("clear") || lowercase.includes("deactivate"))) {
        mem.activeTasks.scanMonthlyCycle = false;
        saveMemory(mem);
        return "⏹️ Monthly Cycle SMT scan deactivated.";
    }

    // Check Weekly Cycle activation/deactivation
    if ((lowercase.includes("weekly cycle") || lowercase.includes("weekly smt") || lowercase.includes("1h smt") || lowercase.includes("1h ssmt")) && (lowercase.includes("scan") || lowercase.includes("monitor") || lowercase.includes("inform"))) {
        mem.activeTasks.scanWeeklyCycle = true;
        mem.alertedSetupKeys = [];
        saveMemory(mem);
        return "✅ Weekly Cycle Scanning Activated: I will monitor the 1H chart for Daily SMT sweeps and push alerts.";
    }
    if ((lowercase.includes("weekly cycle") || lowercase.includes("weekly smt") || lowercase.includes("1h smt") || lowercase.includes("1h ssmt")) && (lowercase.includes("stop") || lowercase.includes("clear") || lowercase.includes("deactivate"))) {
        mem.activeTasks.scanWeeklyCycle = false;
        saveMemory(mem);
        return "⏹️ Weekly Cycle SMT scan deactivated.";
    }

    // Check Daily Cycle activation/deactivation (15M TF, Session SMT)
    const hasDailySmtKeyword = lowercase.includes("daily cycle") || lowercase.includes("daily smt") ||
                               lowercase.includes("15m smt") || lowercase.includes("15m ssmt") || 
                               lowercase.includes("15-minute smt") || lowercase.includes("15-minute ssmt") || 
                               lowercase.includes("15 minute smt") || lowercase.includes("15 minute ssmt");
    if (hasDailySmtKeyword && (lowercase.includes("scan") || lowercase.includes("monitor") || lowercase.includes("inform"))) {
        mem.activeTasks.scanDailyCycle = true;
        mem.alertedSetupKeys = [];
        saveMemory(mem);
        return "✅ Daily Cycle Scanning Activated: I will monitor the 15M chart for Session-to-Session SMT sweeps and push alerts.";
    }
    if (hasDailySmtKeyword && (lowercase.includes("stop") || lowercase.includes("clear") || lowercase.includes("deactivate"))) {
        mem.activeTasks.scanDailyCycle = false;
        saveMemory(mem);
        return "⏹️ Daily Cycle SMT scan deactivated.";
    }

    // Check 90-Minute Cycle activation/deactivation (5M TF, Quarter SMT)
    const has90mSmtKeyword = lowercase.includes("90m cycle") || lowercase.includes("90m smt") ||
                             lowercase.includes("90-minute") || lowercase.includes("90 minute") ||
                             lowercase.includes("5m smt") || lowercase.includes("5m ssmt") ||
                             lowercase.includes("5-minute") || lowercase.includes("5 minute");
    if (has90mSmtKeyword && (lowercase.includes("scan") || lowercase.includes("monitor") || lowercase.includes("inform"))) {
        mem.activeTasks.scan90mCycle = true;
        mem.alertedSetupKeys = [];
        saveMemory(mem);
        return "✅ 90-Minute Cycle Scanning Activated: I will monitor the 5M chart for Quarter-to-Quarter SMT sweeps and push alerts.";
    }
    if (has90mSmtKeyword && (lowercase.includes("stop") || lowercase.includes("clear") || lowercase.includes("deactivate"))) {
        mem.activeTasks.scan90mCycle = false;
        saveMemory(mem);
        return "⏹️ 90-Minute Cycle SMT scan deactivated.";
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
    
    // Add today's news schedule
    try {
        const events = await fetchEconomicCalendar();
        const todayStr = moment().tz("America/New_York").format("MM-DD-YYYY");
        const todayEvents = events.filter(e => e.date === todayStr);
        report += `📅 *Economic News Today*:\n`;
        if (todayEvents.length === 0) {
            report += `- No high/medium impact USD news scheduled.\n\n`;
        } else {
            todayEvents.forEach(e => {
                const flag = e.impact === 'High' ? '🔴 HIGH' : '🟠 MED';
                report += `- ${e.time} | [${flag}] ${e.title}\n`;
            });
            report += "\n";
        }
    } catch (e) {
        report += `📅 *Economic News*: Failed to fetch\n\n`;
    }
    
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
    report += `- Monthly Cycle Scan (4H): ${mem.activeTasks.scanMonthlyCycle ? "✅ ON" : "❌ OFF"}\n`;
    report += `- Weekly Cycle Scan (1H): ${mem.activeTasks.scanWeeklyCycle ? "✅ ON" : "❌ OFF"}\n`;
    report += `- Daily Cycle Scan (15M): ${mem.activeTasks.scanDailyCycle ? "✅ ON" : "❌ OFF"}\n`;
    report += `- 90M Cycle Scan (5M): ${mem.activeTasks.scan90mCycle ? "✅ ON" : "❌ OFF"}\n`;
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
                    
                    if (text === '/news' || text.toLowerCase() === 'news') {
                        await sendTelegram("🔍 Fetching today's economic calendar...");
                        const events = await fetchEconomicCalendar();
                        const newsMsg = formatNewsForTelegram(events);
                        await sendTelegram(newsMsg);
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
                    try {
                        const aiReply = await askGemini(text);
                        await sendTelegram(aiReply);
                    } catch (err) {
                        console.error("[TELEGRAM] Gemini error:", err.message);
                        await sendTelegram(`⚠️ Failed to generate AI response: ${err.message}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error("[TELEGRAM] Polling error:", e.message);
    }
}

// Helper: Parse institutional quarters
function getInstitutionalQuarter(timestamp) {
    const m = moment(timestamp).tz("America/New_York");
    const hour = m.hour();
    const minute = m.minute();
    const day = m.day();

    if (day === 0 || day === 6) return null; // Skip weekends

    const minutesSinceMidnight = hour * 60 + minute;
    const dateStr = m.format("YYYY-MM-DD");

    if (minutesSinceMidnight >= 0 && minutesSinceMidnight < 360) {
        const q = Math.floor(minutesSinceMidnight / 90) + 1;
        return { session: 'LONDON', quarter: q, key: `${dateStr}-LONDON-Q${q}` };
    } else if (minutesSinceMidnight >= 360 && minutesSinceMidnight < 720) {
        const q = Math.floor((minutesSinceMidnight - 360) / 90) + 1;
        return { session: 'NY_AM', quarter: q, key: `${dateStr}-NY_AM-Q${q}` };
    } else if (minutesSinceMidnight >= 720 && minutesSinceMidnight < 1080) {
        const q = Math.floor((minutesSinceMidnight - 720) / 90) + 1;
        return { session: 'NY_PM', quarter: q, key: `${dateStr}-NY_PM-Q${q}` };
    } else if (minutesSinceMidnight >= 1080 && minutesSinceMidnight < 1440) {
        const q = Math.floor((minutesSinceMidnight - 1080) / 90) + 1;
        return { session: 'ASIA', quarter: q, key: `${dateStr}-ASIA-Q${q}` };
    }
    return null;
}

// Helper: Parse chart quotes
function parseQuotes(quotes) {
    return quotes.map(q => ({
        timestamp: q.date.getTime(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close
    })).filter(q => q.open && q.high && q.low && q.close);
}



// Check custom watchlists set from phone
async function checkCustomAlerts() {
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
                    
                    const tapped = (low <= alert.level && high >= alert.level);
                    if (tapped) {
                        alert.status = 'TRIGGERED';
                        listChanged = true;
                        await sendTelegram(`🔔 *TARGET LEVEL TAP NOTIFICATION!* 🔔\n\n📈 *Asset*: ${alert.ticker}=F\n⚡ *Event*: Target level ${alert.level.toFixed(2)} was tapped!\n💵 *Current Close*: ${price.toFixed(2)}\n\n📱 Ready for next instructions!`);
                    }
                }
            }
            if (listChanged) {
                mem.customAlerts = mem.customAlerts.filter(a => a.status === 'PENDING');
                saveMemory(mem);
            }
        }
    } catch (e) {
        console.error("[ALERTS SCAN] Custom check failed:", e.message);
    }
}

// Scan and alert for automated SMT sweeps during session opens
// Helper: Get session name based on time
function getSession(timestamp) {
    const m = moment(timestamp).tz("America/New_York");
    const hour = m.hour();
    const minute = m.minute();
    const minutesSinceMidnight = hour * 60 + minute;
    
    if (minutesSinceMidnight >= 0 && minutesSinceMidnight < 360) {
        return 'LONDON';
    } else if (minutesSinceMidnight >= 360 && minutesSinceMidnight < 720) {
        return 'NY_AM';
    } else if (minutesSinceMidnight >= 720 && minutesSinceMidnight < 1080) {
        return 'NY_PM';
    } else if (minutesSinceMidnight >= 1080 && minutesSinceMidnight < 1440) {
        return 'ASIA';
    }
    return null;
}

// Helper: Get previous session name
function getPreviousSession(session) {
    if (session === 'LONDON') return 'ASIA';
    if (session === 'NY_AM') return 'LONDON';
    if (session === 'NY_PM') return 'NY_AM';
    if (session === 'ASIA') return 'NY_PM';
    return null;
}

// Scan and alert for all 4 SMT cycles: Monthly (4H TF), Weekly (1H TF), Daily (15M TF), 90M (5M TF)
async function runCycleScans() {
    const mem = getMemory();
    const yf = new yahooFinance();
    const now = new Date();
    
    let memoryUpdated = false;
    if (!mem.latestScanResults) {
        mem.latestScanResults = {};
    }
    
    mem.latestScanResults.lastScanTime = moment().tz("America/New_York").format("YYYY-MM-DD HH:mm:ss EST");
    
    if (!mem.alertedSetupKeys) {
        mem.alertedSetupKeys = [];
    }

    // 1. MONTHLY & WEEKLY CYCLES (1H chart data)
    try {
        console.log("[SCANNER] Running Monthly and Weekly SMT scans (1H)...");
        const start30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const esRes = await yf.chart('ES=F', { period1: start30d, period2: now, interval: '1h' });
        const nqRes = await yf.chart('NQ=F', { period1: start30d, period2: now, interval: '1h' });
        
        if (esRes.quotes && nqRes.quotes) {
            const es1h = parseQuotes(esRes.quotes);
            const nq1h = parseQuotes(nqRes.quotes);
            
            const nqMap = new Map();
            nq1h.forEach(q => nqMap.set(moment(q.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm"), q));
            
            const aligned1h = [];
            es1h.forEach(es => {
                const dateStr = moment(es.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
                const nq = nqMap.get(dateStr);
                if (nq) aligned1h.push({ date: dateStr, timestamp: es.timestamp, es, nq });
            });
            
            const lastES1h = es1h[es1h.length - 1];
            const lastNQ1h = nq1h[nq1h.length - 1];
            
            // --- Monthly Cycle: Weekly SMT (4H TF equivalent, using 1H data) ---
            const weeksMap = new Map();
            aligned1h.forEach(bar => {
                const weekKey = moment(bar.timestamp).tz("America/New_York").format("YYYY-GG-WW");
                if (!weeksMap.has(weekKey)) {
                    weeksMap.set(weekKey, {
                        key: weekKey,
                        timestamp: bar.timestamp,
                        highES: 0,
                        lowES: 999999,
                        highNQ: 0,
                        lowNQ: 999999,
                        bars: []
                    });
                }
                const wObj = weeksMap.get(weekKey);
                wObj.bars.push(bar);
                wObj.highES = Math.max(wObj.highES, bar.es.high);
                wObj.lowES = Math.min(wObj.lowES, bar.es.low);
                wObj.highNQ = Math.max(wObj.highNQ, bar.nq.high);
                wObj.lowNQ = Math.min(wObj.lowNQ, bar.nq.low);
            });
            
            const sortedWeeks = Array.from(weeksMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            if (sortedWeeks.length >= 2) {
                const prevW = sortedWeeks[sortedWeeks.length - 2];
                const latestW = sortedWeeks[sortedWeeks.length - 1];
                const monthlyDetected = [];
                
                for (const bar of latestW.bars) {
                    const esSweptL = bar.es.low < prevW.lowES;
                    const nqSweptL = bar.nq.low < prevW.lowNQ;
                    if ((esSweptL && !nqSweptL) || (nqSweptL && !esSweptL)) {
                        const failureAsset = nqSweptL ? "ES" : "NQ";
                        const sweeperAsset = nqSweptL ? "NQ" : "ES";
                        const setupKey = `MONTHLY-BULLISH-SMT-${latestW.key}-${failureAsset}`;
                        const smtDesc = `Bullish Weekly SMT: ${sweeperAsset} swept low (${(sweeperAsset==='NQ'?prevW.lowNQ:prevW.lowES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!monthlyDetected.includes(smtDesc)) monthlyDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *MONTHLY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📈 *Setup*: Bullish Weekly SMT (4H TF)\n` +
                                `📅 *Week*: \`${latestW.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous week low (${(sweeperAsset==='NQ'?prevW.lowNQ:prevW.lowES).toFixed(2)}), but ${failureAsset} respected low.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (stronger). Look for limit buy entries at the **4H Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scanMonthlyCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                    
                    const esSweptH = bar.es.high > prevW.highES;
                    const nqSweptH = bar.nq.high > prevW.highNQ;
                    if ((esSweptH && !nqSweptH) || (nqSweptH && !esSweptH)) {
                        const failureAsset = nqSweptH ? "ES" : "NQ";
                        const sweeperAsset = nqSweptH ? "NQ" : "ES";
                        const setupKey = `MONTHLY-BEARISH-SMT-${latestW.key}-${failureAsset}`;
                        const smtDesc = `Bearish Weekly SMT: ${sweeperAsset} swept high (${(sweeperAsset==='NQ'?prevW.highNQ:prevW.highES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!monthlyDetected.includes(smtDesc)) monthlyDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *MONTHLY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📉 *Setup*: Bearish Weekly SMT (4H TF)\n` +
                                `📅 *Week*: \`${latestW.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous week high (${(sweeperAsset==='NQ'?prevW.highNQ:prevW.highES).toFixed(2)}), but ${failureAsset} respected high.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (weaker). Look for limit sell entries at the **4H Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scanMonthlyCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                }
                
                mem.latestScanResults.monthly = {
                    currentWeek: latestW.key,
                    currentPrices: { ES: lastES1h ? lastES1h.close : null, NQ: lastNQ1h ? lastNQ1h.close : null },
                    detectedSMTs: monthlyDetected.length > 0 ? monthlyDetected : ["None"]
                };
            }
            
            // --- Weekly Cycle: Daily SMT (1H TF, using last 7 days of 1H data) ---
            const start7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const daysMap = new Map();
            aligned1h.forEach(bar => {
                if (bar.timestamp >= start7d) {
                    const dateKey = moment(bar.timestamp).tz("America/New_York").format("YYYY-MM-DD");
                    if (!daysMap.has(dateKey)) {
                        daysMap.set(dateKey, {
                            key: dateKey,
                            timestamp: bar.timestamp,
                            highES: 0,
                            lowES: 999999,
                            highNQ: 0,
                            lowNQ: 999999,
                            bars: []
                        });
                    }
                    const dObj = daysMap.get(dateKey);
                    dObj.bars.push(bar);
                    dObj.highES = Math.max(dObj.highES, bar.es.high);
                    dObj.lowES = Math.min(dObj.lowES, bar.es.low);
                    dObj.highNQ = Math.max(dObj.highNQ, bar.nq.high);
                    dObj.lowNQ = Math.min(dObj.lowNQ, bar.nq.low);
                }
            });
            
            const sortedDays = Array.from(daysMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            if (sortedDays.length >= 2) {
                const prevD = sortedDays[sortedDays.length - 2];
                const latestD = sortedDays[sortedDays.length - 1];
                const weeklyDetected = [];
                
                for (const bar of latestD.bars) {
                    const esSweptL = bar.es.low < prevD.lowES;
                    const nqSweptL = bar.nq.low < prevD.lowNQ;
                    if ((esSweptL && !nqSweptL) || (nqSweptL && !esSweptL)) {
                        const failureAsset = nqSweptL ? "ES" : "NQ";
                        const sweeperAsset = nqSweptL ? "NQ" : "ES";
                        const setupKey = `WEEKLY-BULLISH-SMT-${latestD.key}-${failureAsset}`;
                        const smtDesc = `Bullish Daily SMT: ${sweeperAsset} swept low (${(sweeperAsset==='NQ'?prevD.lowNQ:prevD.lowES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!weeklyDetected.includes(smtDesc)) weeklyDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *WEEKLY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📈 *Setup*: Bullish Daily SMT (1H TF)\n` +
                                `📅 *Day*: \`${latestD.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous day low (${(sweeperAsset==='NQ'?prevD.lowNQ:prevD.lowES).toFixed(2)}), but ${failureAsset} respected low.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (stronger). Look for limit buy entries at the **1H Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scanWeeklyCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                    
                    const esSweptH = bar.es.high > prevD.highES;
                    const nqSweptH = bar.nq.high > prevD.highNQ;
                    if ((esSweptH && !nqSweptH) || (nqSweptH && !esSweptH)) {
                        const failureAsset = nqSweptH ? "ES" : "NQ";
                        const sweeperAsset = nqSweptH ? "NQ" : "ES";
                        const setupKey = `WEEKLY-BEARISH-SMT-${latestD.key}-${failureAsset}`;
                        const smtDesc = `Bearish Daily SMT: ${sweeperAsset} swept high (${(sweeperAsset==='NQ'?prevD.highNQ:prevD.highES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!weeklyDetected.includes(smtDesc)) weeklyDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *WEEKLY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📉 *Setup*: Bearish Daily SMT (1H TF)\n` +
                                `📅 *Day*: \`${latestD.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous day high (${(sweeperAsset==='NQ'?prevD.highNQ:prevD.highES).toFixed(2)}), but ${failureAsset} respected high.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (weaker). Look for limit sell entries at the **1H Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scanWeeklyCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                }
                
                mem.latestScanResults.weekly = {
                    currentDay: latestD.key,
                    currentPrices: { ES: lastES1h ? lastES1h.close : null, NQ: lastNQ1h ? lastNQ1h.close : null },
                    detectedSMTs: weeklyDetected.length > 0 ? weeklyDetected : ["None"]
                };
            }
        }
    } catch (e) {
        console.error("[SCANNER] Monthly/Weekly check failed:", e.message);
    }

    // 2. DAILY CYCLE (15M chart data, Session SMT)
    try {
        console.log("[SCANNER] Running Daily Cycle SMT scans (15M)...");
        const start24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const esRes = await yf.chart('ES=F', { period1: start24h, period2: now, interval: '15m' });
        const nqRes = await yf.chart('NQ=F', { period1: start24h, period2: now, interval: '15m' });
        
        if (esRes.quotes && nqRes.quotes) {
            const es15m = parseQuotes(esRes.quotes);
            const nq15m = parseQuotes(nqRes.quotes);
            
            const lastES15m = es15m[es15m.length - 1];
            const lastNQ15m = nq15m[nq15m.length - 1];
            
            if (lastES15m && lastNQ15m) {
                const currentSessionType = getSession(lastES15m.timestamp);
                if (currentSessionType) {
                    const prevSessionType = getPreviousSession(currentSessionType);
                    const todayStr = moment().tz("America/New_York").format("YYYY-MM-DD");
                    const yesterdayStr = moment().subtract(1, 'day').tz("America/New_York").format("YYYY-MM-DD");
                    
                    let prevSessionHighES = 0;
                    let prevSessionLowES = 999999;
                    let prevSessionHighNQ = 0;
                    let prevSessionLowNQ = 999999;
                    let prevSessionFound = false;
                    
                    const currentSessionBars = [];
                    const nqMap = new Map();
                    nq15m.forEach(q => nqMap.set(moment(q.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm"), q));
                    
                    for (const es of es15m) {
                        const dateStr = moment(es.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
                        const nq = nqMap.get(dateStr);
                        if (!nq) continue;
                        
                        const barSession = getSession(es.timestamp);
                        const barDate = moment(es.timestamp).tz("America/New_York").format("YYYY-MM-DD");
                        
                        const isPrevSessionDate = (currentSessionType === 'LONDON' && prevSessionType === 'ASIA')
                            ? (barDate === yesterdayStr || barDate === todayStr)
                            : (barDate === todayStr || barDate === yesterdayStr);
                        
                        if (barSession === prevSessionType && isPrevSessionDate) {
                            prevSessionFound = true;
                            prevSessionHighES = Math.max(prevSessionHighES, es.high);
                            prevSessionLowES = Math.min(prevSessionLowES, es.low);
                            prevSessionHighNQ = Math.max(prevSessionHighNQ, nq.high);
                            prevSessionLowNQ = Math.min(prevSessionLowNQ, nq.low);
                        }
                        
                        if (barSession === currentSessionType && barDate === todayStr) {
                            currentSessionBars.push({ es, nq, date: dateStr });
                        }
                    }
                    
                    if (prevSessionFound && currentSessionBars.length > 0) {
                        const dailyDetected = [];
                        const currentSessionKey = `${todayStr}-${currentSessionType}`;
                        
                        for (const bar of currentSessionBars) {
                            const esSweptL = bar.es.low < prevSessionLowES;
                            const nqSweptL = bar.nq.low < prevSessionLowNQ;
                            if ((esSweptL && !nqSweptL) || (nqSweptL && !esSweptL)) {
                                const failureAsset = nqSweptL ? "ES" : "NQ";
                                const sweeperAsset = nqSweptL ? "NQ" : "ES";
                                const setupKey = `DAILY-BULLISH-SMT-${currentSessionKey}-${failureAsset}`;
                                const smtDesc = `Bullish Session SMT: ${sweeperAsset} swept low (${(sweeperAsset==='NQ'?prevSessionLowNQ:prevSessionLowES).toFixed(2)}), but ${failureAsset} failed.`;
                                if (!dailyDetected.includes(smtDesc)) dailyDetected.push(smtDesc);
                                
                                if (!mem.alertedSetupKeys.includes(setupKey)) {
                                    const alertMsg = `🚨 *DAILY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                        `📈 *Setup*: Bullish 15M Session SMT\n` +
                                        `📅 *Session*: \`${currentSessionKey}\`\n` +
                                        `⚡ *Divergence*: ${sweeperAsset} swept previous session low (${(sweeperAsset==='NQ'?prevSessionLowNQ:prevSessionLowES).toFixed(2)}), but ${failureAsset} respected low.\n\n` +
                                        `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (stronger). Look for limit buy entries at the **15M Reversion Level** of Candle 2!`;
                                    if (mem.activeTasks && mem.activeTasks.scanDailyCycle) {
                                        mem.alertedSetupKeys.push(setupKey);
                                        memoryUpdated = true;
                                        await sendTelegram(alertMsg);
                                    }
                                }
                            }
                            
                            const esSweptH = bar.es.high > prevSessionHighES;
                            const nqSweptH = bar.nq.high > prevSessionHighNQ;
                            if ((esSweptH && !nqSweptH) || (nqSweptH && !esSweptH)) {
                                const failureAsset = nqSweptH ? "ES" : "NQ";
                                const sweeperAsset = nqSweptH ? "NQ" : "ES";
                                const setupKey = `DAILY-BEARISH-SMT-${currentSessionKey}-${failureAsset}`;
                                const smtDesc = `Bearish Session SMT: ${sweeperAsset} swept high (${(sweeperAsset==='ES'?prevSessionHighES:prevSessionHighNQ).toFixed(2)}), but ${failureAsset} failed.`;
                                if (!dailyDetected.includes(smtDesc)) dailyDetected.push(smtDesc);
                                
                                if (!mem.alertedSetupKeys.includes(setupKey)) {
                                    const alertMsg = `🚨 *DAILY CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                        `📉 *Setup*: Bearish 15M Session SMT\n` +
                                        `📅 *Session*: \`${currentSessionKey}\`\n` +
                                        `⚡ *Divergence*: ${sweeperAsset} swept previous session high (${(sweeperAsset==='ES'?prevSessionHighES:prevSessionHighNQ).toFixed(2)}), but ${failureAsset} respected high.\n\n` +
                                        `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (weaker). Look for limit sell entries at the **15M Reversion Level** of Candle 2!`;
                                    if (mem.activeTasks && mem.activeTasks.scanDailyCycle) {
                                        mem.alertedSetupKeys.push(setupKey);
                                        memoryUpdated = true;
                                        await sendTelegram(alertMsg);
                                    }
                                }
                            }
                        }
                        
                        mem.latestScanResults.daily = {
                            currentSession: currentSessionKey,
                            currentPrices: { ES: lastES15m ? lastES15m.close : null, NQ: lastNQ15m ? lastNQ15m.close : null },
                            detectedSMTs: dailyDetected.length > 0 ? dailyDetected : ["None"]
                        };
                    }
                }
            }
        }
    } catch (e) {
        console.error("[SCANNER] Daily Cycle check failed:", e.message);
    }

    // 3. 90-MINUTE CYCLE (5M chart data, Quarter SMT)
    try {
        console.log("[SCANNER] Running 90M Cycle SMT scans (5M)...");
        const start24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const esRes = await yf.chart('ES=F', { period1: start24h, period2: now, interval: '5m' });
        const nqRes = await yf.chart('NQ=F', { period1: start24h, period2: now, interval: '5m' });
        
        if (esRes.quotes && nqRes.quotes) {
            const es5m = parseQuotes(esRes.quotes);
            const nq5m = parseQuotes(nqRes.quotes);
            
            const lastES5m = es5m[es5m.length - 1];
            const lastNQ5m = nq5m[nq5m.length - 1];
            
            const nqMap = new Map();
            nq5m.forEach(q => nqMap.set(moment(q.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm"), q));
            
            const quartersMap = new Map();
            es5m.forEach(es => {
                const dateStr = moment(es.timestamp).tz("America/New_York").format("YYYY-MM-DD HH:mm");
                const nq = nqMap.get(dateStr);
                if (nq) {
                    const qr = getInstitutionalQuarter(es.timestamp);
                    if (qr) {
                        if (!quartersMap.has(qr.key)) {
                            quartersMap.set(qr.key, {
                                key: qr.key,
                                timestamp: es.timestamp,
                                highES: 0,
                                lowES: 999999,
                                highNQ: 0,
                                lowNQ: 999999,
                                bars: []
                            });
                        }
                        const qObj = quartersMap.get(qr.key);
                        qObj.bars.push({ es, nq });
                        qObj.highES = Math.max(qObj.highES, es.high);
                        qObj.lowES = Math.min(qObj.lowES, es.low);
                        qObj.highNQ = Math.max(qObj.highNQ, nq.high);
                        qObj.lowNQ = Math.min(qObj.lowNQ, nq.low);
                    }
                }
            });
            
            const sortedQuarters = Array.from(quartersMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            if (sortedQuarters.length >= 2) {
                const prevQ = sortedQuarters[sortedQuarters.length - 2];
                const latestQ = sortedQuarters[sortedQuarters.length - 1];
                const q90mDetected = [];
                
                for (const bar of latestQ.bars) {
                    const esSweptL = bar.es.low < prevQ.lowES;
                    const nqSweptL = bar.nq.low < prevQ.lowNQ;
                    if ((esSweptL && !nqSweptL) || (nqSweptL && !esSweptL)) {
                        const failureAsset = nqSweptL ? "ES" : "NQ";
                        const sweeperAsset = nqSweptL ? "NQ" : "ES";
                        const setupKey = `90M-BULLISH-SMT-${latestQ.key}-${failureAsset}`;
                        const smtDesc = `Bullish Quarter SMT: ${sweeperAsset} swept low (${(sweeperAsset==='NQ'?prevQ.lowNQ:prevQ.lowES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!q90mDetected.includes(smtDesc)) q90mDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *90-MINUTE CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📈 *Setup*: Bullish 5M Quarter SMT\n` +
                                `📅 *Quarter*: \`${latestQ.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous quarter low (${(sweeperAsset==='NQ'?prevQ.lowNQ:prevQ.lowES).toFixed(2)}), but ${failureAsset} respected low.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (stronger). Look for limit buy entries at the **5M Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scan90mCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                    
                    const esSweptH = bar.es.high > prevQ.highES;
                    const nqSweptH = bar.nq.high > prevQ.highNQ;
                    if ((esSweptH && !nqSweptH) || (nqSweptH && !esSweptH)) {
                        const failureAsset = nqSweptH ? "ES" : "NQ";
                        const sweeperAsset = nqSweptH ? "NQ" : "ES";
                        const setupKey = `90M-BEARISH-SMT-${latestQ.key}-${failureAsset}`;
                        const smtDesc = `Bearish Quarter SMT: ${sweeperAsset} swept high (${(sweeperAsset==='NQ'?prevQ.highNQ:prevQ.highES).toFixed(2)}), but ${failureAsset} failed.`;
                        if (!q90mDetected.includes(smtDesc)) q90mDetected.push(smtDesc);
                        
                        if (!mem.alertedSetupKeys.includes(setupKey)) {
                            const alertMsg = `🚨 *90-MINUTE CYCLE SMT SWEEP DETECTED!* 🚨\n\n` +
                                `📉 *Setup*: Bearish 5M Quarter SMT\n` +
                                `📅 *Quarter*: \`${latestQ.key}\`\n` +
                                `⚡ *Divergence*: ${sweeperAsset} swept previous quarter high (${(sweeperAsset==='NQ'?prevQ.highNQ:prevQ.highES).toFixed(2)}), but ${failureAsset} respected high.\n\n` +
                                `🎯 *Strategy Action*: ${failureAsset} is the **Failure Swing Asset** (weaker). Look for limit sell entries at the **5M Reversion Level** of Candle 2!`;
                            if (mem.activeTasks && mem.activeTasks.scan90mCycle) {
                                mem.alertedSetupKeys.push(setupKey);
                                memoryUpdated = true;
                                await sendTelegram(alertMsg);
                            }
                        }
                    }
                }
                
                mem.latestScanResults['90m'] = {
                    currentQuarter: latestQ.key,
                    currentPrices: { ES: lastES5m ? lastES5m.close : null, NQ: lastNQ5m ? lastNQ5m.close : null },
                    detectedSMTs: q90mDetected.length > 0 ? q90mDetected : ["None"]
                };
            }
        }
    } catch (e) {
        console.error("[SCANNER] 90M Cycle check failed:", e.message);
    }
    
    saveMemory(mem);
}

// Main background scheduler
async function runAlertsCheck() {
    // 1. Run user-defined custom price level alerts
    await checkCustomAlerts();
    
    // 2. Run automated SMT sweep cycles scanner
    await runCycleScans();
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
    askGemini,
    fetchEconomicCalendar,
    compileKnowledgeBase,
    runCycleScans
};

// If run directly, start polling and bind to port for Render health checks
if (require.main === module) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env!");
        process.exit(1);
    }

    // HTTP Server to pass Render health checks & receive TradingView Webhooks
    const http = require('http');
    const PORT = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/webhook') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                console.log(`[WEBHOOK] Received alert: "${body}"`);
                try {
                    let alertText = body;
                    // Attempt to parse JSON
                    try {
                        const json = JSON.parse(body);
                        alertText = json.message || json.text || JSON.stringify(json, null, 2);
                    } catch (e) {
                        // Not JSON, fallback to raw text
                    }
                    
                    // Push alert to Telegram
                    await sendTelegram(`🚨 *TRADINGVIEW ALERT* 🚨\n\n${alertText}`);
                    
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Webhook received & forwarded to Telegram');
                } catch (err) {
                    console.error("[WEBHOOK] Error processing alert:", err.message);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error processing webhook');
                }
            });
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Trading Assistant is Active and Scanning!');
        }
    });
    
    server.listen(PORT, () => {
        console.log(`[AGENT] HTTP Webhook server listening on port ${PORT}`);
    });

    startPolling();
}
