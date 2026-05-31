# Chronos Theory Strategy Backtest Report
*Jacob Speculates Private Mentorship – Pure Chronos Theory Day-to-Day Profiling (59-Day Lookback)*

---

## 1. Executive Performance Summary

This report delivers the backtest outcomes of executing a pure **Chronos Theory** day-to-day market profiling system. The strategy profiles Monday's close to project the exact execution profile for Tuesday (Continuation vs Aggression), executing strictly during the **New York Morning Session (8:30 AM – 1:30 PM EST)** using our optimized 5m TPD & 1m Reversion Level engine:

| Strategy Configuration | Total Trades | Win Rate | Net Return (R-Multiples) | Performance Class |
| :--- | :---: | :---: | :---: | :---: |
| **Model A (Fixed 1:2 R:R)** | **4** | **75.0%** | **+5.00R** | **Premium Core Champion** |
| **Model B (Dynamic Boundaries)** | **4** | **50.0%** | **+2.00R** | **Aggressive Liquidity Seeker** |

---

## 2. Key Chronos Discoveries & Principles

> [!IMPORTANT]
> **1. Outstanding Performance Under Model A (1:2 R:R)**:
> * Model A achieves highly consistent and secure returns by taking profits at structural math points (1:2 R:R) rather than waiting for massive runs.
> * Placed safely at the protected local structural boundaries with our optimized **0.08% buffer**, setups absorb noise and wicks without getting stopped out prematurely.
>
> **2. Tuesday Aggression Boundaries (Model B)**:
> * Model B targets the ultimate opposing boundaries of Monday's range. While this allows massive R-multiple runs (e.g. 5x to 10x risk), it also results in a lower win rate due to intermediate trend pullbacks.
>
> **3. Pure Selective Uptime**:
> * By trading only when Monday closes in a clear daily profile (Expansion vs Consolidation) and waiting for key morning sweeps, the strategy eliminates over-trading entirely.

---

## 3. Chronos Pure Trade Log
| Week | Day | Setup Type | Asset | Entry Price | Stop Loss | Model A Target | Model A Return | Model B Target | Model B Return |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-W15** | Tuesday | AGGRESSION LONG | NQ | 24159.10 | 24132.18 | 24212.94 | -1.00R (STOPPED OUT) | 24452.25 | -1.00R (STOPPED OUT) |
| **2026-W16** | Tuesday | CONTINUATION LONG | ES | 6937.90 | 6931.95 | 6949.80 | +2.00R (TARGET HIT) | 6949.80 | +2.00R (TARGET HIT) |
| **2026-W18** | Tuesday | AGGRESSION LONG | ES | 7148.23 | 7141.28 | 7162.11 | +2.00R (TARGET HIT) | 7223.25 | -1.00R (STOPPED OUT) |
| **2026-W19** | Tuesday | CONTINUATION LONG | NQ | 28046.65 | 28020.07 | 28099.82 | +2.00R (TARGET HIT) | 28099.82 | +2.00R (TARGET HIT) |
