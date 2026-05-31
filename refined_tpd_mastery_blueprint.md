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

## 2. The Absolute CSD & Displacement Rule
Displacement is the definitive confirmation of a Change in State of Delivery (CSD) in Candle 3. It is governed by an absolute, non-subjective mathematical rule:

* **Bullish CSD (Seeking Longs)**:
  * **Rule**: Candle 3 **must close completely above the OPEN price (body)** of the previous bearish candle (Candle 2).
  * **Wick Rule**: The high wick of Candle 2 is **ignored completely**. Only the body close matters.
* **Bearish CSD (Seeking Shorts)**:
  * **Rule**: Candle 3 **must close completely below the OPEN price (body)** of the previous bullish candle (Candle 2).
  * **Wick Rule**: The low wick of Candle 2 is **ignored completely**. Only the body close matters.

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

1. **The Setup**: We identify an **8:00 AM H1 TPD** pre-market.
2. **The Level**: We zoom in to the 15-Minute timeframe and map the **15M Reversion Level** of Candle 2.
3. **The Open**: We wait patiently for the **9:30 AM EST Equities Open**.
4. **The Tap**: At the 9:30 AM open, price pulls back to tap our **15M Reversion Level**.
5. **The Sweep (90M SSMT)**: At this exact tap, we watch the three indices (ES, NQ, YM). Some or all may sweep below the **Previous Session Low (PSL)**, but **at least one asset (the failure swing) must close above the PSL** to confirm the buy trigger.
6. **Macro Alignment**: For a **6H TPD** or a **2:00 AM 4H TPD**, we map the **1-Hour Reversion Level (1H RL)** and wait for a **15-Minute SSMT** relative to the **London Session** high/low.

---

## 5. Reversal vs. Working TPDs

| Characteristic | Reversal TPDs | Working TPDs |
| :--- | :--- | :--- |
| **Timeframes** | Higher Timeframes: **H4, H6, Daily, Weekly** | Intraday Timeframes: **H1 or lower** |
| **Primary Function** | Establishes the **Directional Foundation** (Macro Bias) | Intraday prediction of future SMTs and reversion entries |
| **Key Windows** | **12:00 AM (H6)** and **2:00 AM (H4)** | **7:00 AM, 8:00 AM, and 9:00 AM H1** |
| **Execution** | Defines whether we are purely buyers or sellers | Reversion level acts as the entry line during session opens |
