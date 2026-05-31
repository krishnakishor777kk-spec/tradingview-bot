const yf = require('yahoo-finance2').default;
const yahooFinance = new yf();

async function test() {
    try {
        const period1 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
        const period2 = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
        
        console.log("Fetching historical 1m data (28-21 days ago) for ES=F...");
        const esResult = await yahooFinance.chart('ES=F', { period1, period2, interval: '1m' });
        console.log("Success! ES quotes loaded:", esResult.quotes.length);
    } catch (e) {
        console.error("Test failed:", e);
    }
}
test();
