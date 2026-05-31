const yf = require('yahoo-finance2').default;
const yahooFinance = new yf();

async function test() {
    try {
        const period1 = new Date('2006-01-01');
        const period2 = new Date('2026-05-30');
        
        const esResult = await yahooFinance.chart('ES=F', { period1, period2, interval: '1d' });
        console.log("Success! Data length:", esResult.quotes.length);
        console.log("First quote:", esResult.quotes[0]);
        console.log("Last quote:", esResult.quotes[esResult.quotes.length - 1]);
    } catch (e) {
        console.error("Test failed:", e);
    }
}
test();
