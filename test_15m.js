const yf = require('yahoo-finance2').default;
const yahooFinance = new yf();

async function test() {
    try {
        const period1 = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000); // 59 days ago
        const period2 = new Date();
        
        console.log("Fetching 15m data for ES=F...");
        const esResult = await yahooFinance.chart('ES=F', { period1, period2, interval: '15m' });
        console.log("Success! ES quotes loaded:", esResult.quotes.length);
        console.log("First quote date:", esResult.quotes[0].date);
        console.log("Last quote date:", esResult.quotes[esResult.quotes.length - 1].date);
    } catch (e) {
        console.error("Test failed:", e);
    }
}
test();
