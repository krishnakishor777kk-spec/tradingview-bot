# Refined Terminus Price Divergence (TPD) Mastery Blueprint
*Jacob Speculates Private Mentorship – Core Execution Standard*

---

## 1. Structural Foundations of TPD
A Terminus Price Divergence (TPD) is a strictly time-locked, 3-candle algorithmic sequence that represents the transition of institutional order flow.

```
  [Candle 1] ──► The Reference Range (Sets the structural benchmark)
  [Candle 2] ──► The Sweep/Manipulation (Sweeps Candle 1's high/low)
  [Candle 3] ──► The Displacement/CSD (Confirms the institutional reversal)
```

---

## 2. Reversion Level Entry Rule (No CSD Confirmation Wait)
The Terminus Price Divergence (TPD) setup is executed strictly via limit orders at the mapped **Reversion Level**, without waiting for the 3-candle Change in State of Delivery (CSD) displacement close:

* **Execution Trigger**: Once Candle 2 (the sweep candle) closes, we immediately map the Reversion Level on the lower timeframe.
* **Direct Entry**: Place a Limit Order at the Reversion Level. Candle 3 (or later candles) can tap and fill the entry during their formation.
* **CSD Close Elimination**: We do **not** wait for Candle 3 to close above/below Candle 2's open to validate the trade.


---

## 3. Reversion Level (RL) Timeframe Scaling
The Reversion Level is the exact price point where price is expected to pull back (revert) in the subsequent session or quarter before initiating the real price expansion. 

To locate the CSD candle body/wick in the **2nd half of Candle 2**, you drop down exactly **one structural timeframe** according to this fixed scaling hierarchy:

| Primary TPD Timeframe (HTF) | Lower Timeframe to Map Reversion Level (LTF) |
| :--- | :--- |
| **Weekly TPD** | ➡️ **Daily Timeframe** |
| **Daily TPD** | ➡️ **4-Hour (H4) Timeframe** |
| **4-Hour TPD** | ➡️ **1-Hour (H1) Timeframe** |
| **1-Hour (H1) TPD** | ➡️ **15-Minute (M15) Timeframe** |
| **15-Minute (M15) TPD** | ➡️ **5-Minute (M5) Timeframe** |
| **5-Minute (M5) TPD** | ➡️ **1-Minute (M1) Timeframe** |

### Locating the CSD Candle:
1. Isolate the **2nd half of Candle 2**'s duration on the lower timeframe (e.g., the last 30 minutes of an H1 candle, which is the 8:30–9:00 AM window for an 8:00 AM candle).
2. **If Bullish**: Find the **lowest downclose candle** (bearish) in that 2nd half. Draw your level across its **entire wick (high to low)**.
3. **If Bearish**: Find the **highest upclose candle** (bullish) in that 2nd half. Draw your level across its **entire wick (high to low)**.

---

## 4. The 9:30 AM Execution & SSMT Tap Sequence
The transition from your pre-market setup to session execution follows a highly synchronized, time-locked sequence:

```
  [8:00 AM H1 TPD Setup]
           │
           ▼
  [Map 15-Minute Reversion Level]
           │
           ▼
  [Wait for 9:30 AM Equities Open]
           │
           ▼
  [Price pulls back to hit 15M RL] ──► Algorithmic Reversion
           │
           ▼
  [Verify 90-Minute SSMT Sweep] ─────► At least 1 asset MUST close above the PSL
```

1. **The Setup**: We identify an **8:00 AM H1 TPD** pre-market (Candle 1 and Candle 2).
2. **The Level**: We zoom in to the 15-Minute timeframe and map the **15M Reversion Level** of Candle 2.
3. **The Order**: Immediately upon Candle 2's close, we place a **Limit Buy/Sell Order** at the Reversion Level.
4. **The Tap (Fill)**: At the 9:30 AM open, price pulls back and taps our Reversion Level, filling the limit order instantly. We do **not** wait for any candle close (neither the H1 Candle 3 close nor the 5-Minute sweep candle close) to validate the fill.
5. **The Sweep (90M SSMT)**: We monitor the three indices (ES, NQ, YM) around the tap to verify the crack in correlation (SMT Divergence) confirming institutional involvement.
6. **Macro Alignment**: For a **6H TPD** or a **2:00 AM 4H TPD**, we map the **1-Hour Reversion Level (1H RL)** and place our limit orders there, waiting for the London Session open windows to tap.


---

## 5. Reversal vs. Working TPDs

| Characteristic | Reversal TPDs | Working TPDs |
| :--- | :--- | :--- |
| **Timeframes** | Higher Timeframes: **H4, H6, Daily, Weekly** | Intraday Timeframes: **H1 or lower** |
| **Primary Function** | Establishes the **Directional Foundation** (Macro Bias) | Intraday prediction of future SMTs and reversion entries |
| **Key Windows** | **12:00 AM (H6)** and **2:00 AM (H4)** | **7:00 AM, 8:00 AM, and 9:00 AM H1** |
| **Execution** | Defines whether we are purely buyers or sellers | Reversion level acts as the entry line during session opens |
