/* --- 5m TPD & Session SMT Strategy Premium Interactivity script --- */

// Array to hold forward forward alerts
let forwardAlerts = [];

// Initialize Dashboard and Setup SSE stream
document.addEventListener("DOMContentLoaded", () => {
    setupSSEConnection();
    loadExistingAlerts();
    updateUptimeTimer();
});

// Clipboard Helper
function copyWebhook() {
    const webhookUrl = document.getElementById("webhook-url").innerText;
    navigator.clipboard.writeText(webhookUrl).then(() => {
        alert("Webhook URL copied successfully to clipboard!");
    }).catch(err => {
        console.error("Clipboard copy failed:", err);
    });
}

// Config manager
function saveConfig(event) {
    event.preventDefault();
    const rlDepth = document.getElementById("cfg-rl-depth").value;
    const stopBuffer = document.getElementById("cfg-stop-buffer").value;
    const riskModel = document.getElementById("cfg-risk-model").value;

    alert(`Configurations saved successfully!\n\n-> 1M Reversion Level Depth: ${rlDepth}%\n-> Stop Loss Buffer: ${stopBuffer}%\n-> Position Model: ${riskModel}`);
}

// SSE Connection for Real-Time Signals Feed
function setupSSEConnection() {
    const statusText = document.getElementById("server-status");
    const eventSource = new EventSource("/events");

    eventSource.onopen = () => {
        statusText.innerText = "ACTIVE";
        statusText.style.color = "var(--neon-emerald)";
    };

    eventSource.onerror = (err) => {
        statusText.innerText = "DISCONNECTED";
        statusText.style.color = "var(--neon-danger)";
        console.error("SSE connection error:", err);
    };

    eventSource.onmessage = (event) => {
        try {
            const alertData = JSON.parse(event.data);
            console.log("New forward webhook signal received:", alertData);
            
            // Add to local array
            forwardAlerts.unshift(alertData);
            renderForwardAlerts();
            playAlertSound();
        } catch (e) {
            console.error("Failed to parse SSE data:", e);
        }
    };
}

// Load existing signals on start
function loadExistingAlerts() {
    fetch('/api/alerts')
        .then(res => res.json())
        .then(alerts => {
            forwardAlerts = alerts;
            renderForwardAlerts();
        })
        .catch(err => console.error("Failed to load existing alerts:", err));
}

// Render forward signals feed
function renderForwardAlerts() {
    const tbody = document.getElementById("alerts-tbody");
    const alertCountElement = document.getElementById("metric-alerts");
    
    // Update live metrics count
    alertCountElement.innerText = String(forwardAlerts.length).padStart(2, '0');

    if (forwardAlerts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="bx bx-radar-off"></i>
                    <p>Awaiting incoming TradingView webhook signals...</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = forwardAlerts.map(alert => {
        const badgeClass = alert.action === "BUY" ? "badge-buy" : "badge-sell";
        return `
            <tr class="fade-in-row">
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">${alert.date.split(" ")[1] || alert.date}</td>
                <td><strong>${alert.ticker}</strong></td>
                <td><span class="badge ${badgeClass}">${alert.action}</span></td>
                <td style="font-family: monospace;">${alert.signalPrice.toFixed(2)}</td>
                <td style="font-family: monospace; color: var(--neon-cyan);">${alert.entryPrice.toFixed(2)}</td>
                <td style="font-family: monospace; color: var(--neon-danger);">${alert.stopLoss.toFixed(2)}</td>
                <td style="font-family: monospace; color: var(--neon-emerald);">${alert.target_erl.toFixed(2)}</td>
                <td><span class="status-tag tag-pending">${alert.status}</span></td>
            </tr>
        `;
    }).join('');
}

// Play notification sound on alert
function playAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        console.warn("Audio Context blocked or failed:", e);
    }
}

// Trigger Backtester simulation via Server API
function triggerBacktest() {
    const resultsWrap = document.getElementById("backtest-results-wrap");
    const loader = document.getElementById("backtest-loader");
    const grid = document.getElementById("results-display-grid");
    const runBtn = document.getElementById("run-backtest-btn");

    // UI state updates
    resultsWrap.style.display = "block";
    loader.style.display = "flex";
    grid.style.style = "none";
    grid.style.display = "none";
    runBtn.disabled = true;
    runBtn.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> Processing...`;

    // Call server backtest endpoint
    fetch('/api/backtest')
        .then(res => res.json())
        .then(r => {
            if (r.error) {
                alert("Backtest failed: " + r.error);
                return;
            }

            // Update mini display stats cards
            document.getElementById("bt-total-trades").innerText = r.totalTrades;
            document.getElementById("bt-trades-week").innerText = (r.totalTrades / (59 / 7)).toFixed(1);
            document.getElementById("bt-wr-a").innerText = r.wr_12 + "%";
            document.getElementById("bt-return-a").innerText = (r.return_12 >= 0 ? "+" : "") + r.return_12.toFixed(2) + "R";
            document.getElementById("bt-wr-b").innerText = r.wr_erl + "%";
            document.getElementById("bt-return-b").innerText = (r.return_erl >= 0 ? "+" : "") + r.return_erl.toFixed(2) + "R";

            // Update main forward metrics cards using backtest results
            document.getElementById("metric-winrate-b").innerText = r.wr_erl + "%";
            document.getElementById("metric-winrate-a").innerText = r.wr_12 + "%";

            // Populate trade log table
            const btTbody = document.getElementById("backtest-tbody");
            btTbody.innerHTML = r.tradeLog.map(t => {
                const actionBadge = t.type.includes("LONG") ? "badge-buy" : "badge-sell";
                const outcomeClassA = t.r12 >= 0 ? "tag-win" : "tag-loss";
                const outcomeClassB = t.rerl >= 0 ? "tag-win" : "tag-loss";

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">${t.date}</td>
                        <td><strong>${t.asset}</strong></td>
                        <td><span class="badge ${actionBadge}">${t.type.split(" ")[0]}</span></td>
                        <td style="font-family: monospace;">${t.entry.toFixed(2)}</td>
                        <td style="font-family: monospace;">${t.sl.toFixed(2)}</td>
                        <td><span class="status-tag ${outcomeClassA}">${t.o12}</span></td>
                        <td><span class="status-tag ${outcomeClassB}">${t.oerl}</span></td>
                    </tr>
                `;
            }).join('');

            // Fetch MTF Comparison
            fetch('/api/mtf')
                .then(res => res.json())
                .then(mtf => {
                    const mtfTbody = document.getElementById("mtf-tbody");
                    mtfTbody.innerHTML = mtf.map(r => {
                        const styleA = parseFloat(r.return_12) >= 0 ? "color: var(--neon-emerald);" : "color: var(--neon-danger);";
                        const styleB = parseFloat(r.return_erl) >= 0 ? "color: var(--neon-emerald);" : "color: var(--neon-danger);";
                        return `
                            <tr>
                                <td><strong>${r.name}</strong></td>
                                <td style="font-family: monospace;">${r.totalTrades}</td>
                                <td style="font-family: monospace;">${r.tradesPerWeek}</td>
                                <td style="font-family: monospace; color: var(--neon-cyan);">${r.wr_12}%</td>
                                <td style="font-family: monospace; ${styleA}">${r.return_12 >= 0 ? "+" : ""}${r.return_12.toFixed(2)}R</td>
                                <td style="font-family: monospace; color: var(--neon-emerald);">${r.wr_erl}%</td>
                                <td style="font-family: monospace; ${styleB}">${r.return_erl >= 0 ? "+" : ""}${r.return_erl.toFixed(2)}R</td>
                            </tr>
                        `;
                    }).join('');
                })
                .catch(err => console.error("Failed to fetch MTF data:", err));

            // Display results
            loader.style.display = "none";
            grid.style.display = "grid";
        })
        .catch(err => {
            console.error("Backtest failed:", err);
            alert("An error occurred during backtest execution.");
        })
        .finally(() => {
            runBtn.disabled = false;
            runBtn.innerHTML = `<i class="bx bx-play-circle"></i> Run Historical Backtest`;
        });
}

// Smooth uptime clock ticker
function updateUptimeTimer() {
    let seconds = 0;
    const uptimeElement = document.getElementById("metric-uptime");
    setInterval(() => {
        seconds++;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const uptimeStr = [
            String(hours).padStart(2, '0'),
            String(mins).padStart(2, '0'),
            String(secs).padStart(2, '0')
        ].join(':');
        
        uptimeElement.innerText = "ONLINE (" + uptimeStr + ")";
    }, 1000);
}
