"""
Analisis exploratorio (investigacion, NO produccion) de Oro (2 datasets), Nasdaq (USTEC) y US30
sobre datos reales de MT5 (retail broker), en linea con 27_SCALPING y 13_BACKTESTING.

- Sin lookahead: toda senal se calcula con datos hasta la barra i (cierre incluido); la entrada
  ejecuta en el open de la barra i+1.
- Ambiguedad SL/TP en la misma vela: supuesto BASE = pesimista (se asume que el SL se toca
  primero). El caso optimista se reporta aparte, solo para los setups ganadores, nunca mezclado.
- Coste: spread real de cada barra (columna SPREAD, en puntos -> convertido a precio con el
  tick size detectado de los propios datos). Se aplica medio spread en la barra de entrada y medio
  spread en la barra de salida (= spread completo ida y vuelta). No hay comision real disponible:
  se declara como limitacion.
- Resultados en multiplos de R (R = distancia de stop en precio), evita inventar tamano de cuenta.

Salidas: CSVs en engine/src/backtest/out/04_analisis_oro_nasdaq_us30/
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

DOWNLOADS = Path(r"C:\Users\V\Downloads")
OUT = Path(__file__).resolve().parent / "out" / "04_analisis_oro_nasdaq_us30"
OUT.mkdir(parents=True, exist_ok=True)

pd.set_option("display.width", 160)


# --------------------------------------------------------------------------------------
# Carga y utilidades
# --------------------------------------------------------------------------------------

def detect_point(path, col_idx=2, sample=2000):
    """Detecta el tamano de punto (tick) contando decimales reales usados en OPEN."""
    max_dec = 0
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        next(f)
        for i, line in enumerate(f):
            if i >= sample:
                break
            parts = line.rstrip("\n").split("\t")
            if len(parts) <= col_idx:
                continue
            val = parts[col_idx]
            if "." in val:
                max_dec = max(max_dec, len(val.split(".")[1]))
    return 10 ** (-max_dec) if max_dec > 0 else 1.0


def load_mt5_csv(path):
    df = pd.read_csv(path, sep="\t")
    df.columns = [c.strip("<>").lower() for c in df.columns]
    dt = pd.to_datetime(df["date"] + " " + df["time"], format="%Y.%m.%d %H:%M:%S")
    df.index = dt
    df = df.sort_index()
    return df[["open", "high", "low", "close", "tickvol", "vol", "spread"]]


def resample_ohlc(df, rule):
    o = df["open"].resample(rule).first()
    h = df["high"].resample(rule).max()
    l = df["low"].resample(rule).min()
    c = df["close"].resample(rule).last()
    v = df["tickvol"].resample(rule).sum()
    spr = df["spread"].resample(rule).mean()
    out = pd.concat([o, h, l, c, v, spr], axis=1)
    out.columns = ["open", "high", "low", "close", "tickvol", "spread"]
    return out.dropna(subset=["open", "high", "low", "close"])


def atr(df, n=14):
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(n).mean()


# --------------------------------------------------------------------------------------
# 1. Perfil estadistico
# --------------------------------------------------------------------------------------

def stats_profile(df, point, label, eff_window=20):
    rng = df["high"] - df["low"]
    body = df["close"] - df["open"]
    bullish = (body > 0).mean()
    bearish = (body < 0).mean()
    doji = (body == 0).mean()
    a = atr(df, 14)
    net_move = (df["close"] - df["close"].shift(eff_window)).abs()
    sum_range = rng.rolling(eff_window).sum()
    efficiency = (net_move / sum_range).replace([np.inf, -np.inf], np.nan)

    profile = {
        "label": label,
        "n_bars": int(len(df)),
        "date_start": str(df.index.min()),
        "date_end": str(df.index.max()),
        "point": point,
        "pct_bullish": round(float(bullish) * 100, 2),
        "pct_bearish": round(float(bearish) * 100, 2),
        "pct_doji": round(float(doji) * 100, 2),
        "avg_range_price": round(float(rng.mean()), 5),
        "avg_atr14_price": round(float(a.mean()), 5),
        "median_atr14_price": round(float(a.median()), 5),
        "avg_spread_points": round(float(df["spread"].mean()), 2),
        "pct_spread_zero": round(float((df["spread"] == 0).mean()) * 100, 2),
        "avg_efficiency_ratio_20bar": round(float(efficiency.mean()), 4),
        "median_efficiency_ratio_20bar": round(float(efficiency.median()), 4),
    }
    return profile


def hourly_dow_profile(df, label):
    ret = df["close"].pct_change()
    rng = (df["high"] - df["low"])
    tmp = pd.DataFrame({
        "hour": df.index.hour,
        "dow": df.index.dayofweek,
        "ret": ret,
        "rng": rng,
        "tickvol": df["tickvol"],
    }).dropna()
    by_hour = tmp.groupby("hour").agg(
        avg_ret_bps=("ret", lambda x: x.mean() * 10000),
        avg_abs_ret_bps=("ret", lambda x: x.abs().mean() * 10000),
        avg_range=("rng", "mean"),
        avg_tickvol=("tickvol", "mean"),
        n=("ret", "size"),
    ).reset_index()
    by_hour.insert(0, "asset", label)
    by_dow = tmp.groupby("dow").agg(
        avg_ret_bps=("ret", lambda x: x.mean() * 10000),
        avg_abs_ret_bps=("ret", lambda x: x.abs().mean() * 10000),
        avg_range=("rng", "mean"),
        avg_tickvol=("tickvol", "mean"),
        n=("ret", "size"),
    ).reset_index()
    by_dow.insert(0, "asset", label)
    return by_hour, by_dow


# --------------------------------------------------------------------------------------
# 2. Setups (generacion de senales) -- sin lookahead: senal en barra i, entrada open barra i+1
# --------------------------------------------------------------------------------------

def gen_range_breakout(df, a, n=20, vol_mult=1.5):
    roll_high = df["high"].rolling(n).max().shift(1)
    roll_low = df["low"].rolling(n).min().shift(1)
    vol_ma = df["tickvol"].rolling(n).mean().shift(1)
    long_sig = (df["close"] > roll_high) & (df["tickvol"] > vol_mult * vol_ma)
    short_sig = (df["close"] < roll_low) & (df["tickvol"] > vol_mult * vol_ma)
    return _signals_from_bool(df, a, long_sig, short_sig)


def gen_liquidity_sweep(df, a, n=20):
    prior_high = df["high"].rolling(n).max().shift(1)
    prior_low = df["low"].rolling(n).min().shift(1)
    short_sig = (df["high"] > prior_high) & (df["close"] < prior_high)
    long_sig = (df["low"] < prior_low) & (df["close"] > prior_low)
    return _signals_from_bool(df, a, long_sig, short_sig)


def gen_momentum_continuation(df, a, body_mult=1.2, vol_mult=1.3, n=20):
    vol_ma = df["tickvol"].rolling(n).mean().shift(1)
    body = df["close"] - df["open"]
    long_sig = (body > body_mult * a) & (df["tickvol"] > vol_mult * vol_ma)
    short_sig = (-body > body_mult * a) & (df["tickvol"] > vol_mult * vol_ma)
    return _signals_from_bool(df, a, long_sig, short_sig)


def gen_mean_reversion(df, a, n=50, z=2.0):
    ma = df["close"].rolling(n).mean()
    dist = (df["close"] - ma) / a
    dist_prev = dist.shift(1)
    short_sig = (dist > z) & (dist_prev <= z)
    long_sig = (dist < -z) & (dist_prev >= -z)
    return _signals_from_bool(df, a, long_sig, short_sig)


def gen_session_open_reaction(df, a, init_bars=2, window_bars=6):
    """Rango inicial de los primeros `init_bars` del dia calendario (server time, TZ sin
    confirmar) y breakout dentro de las siguientes `window_bars` -> entra en direccion ruptura."""
    dates = df.index.normalize()
    day_pos = df.groupby(dates).cumcount()
    first_mask = day_pos < init_bars
    day_high = df["high"].where(first_mask).groupby(dates).transform("max")
    day_low = df["low"].where(first_mask).groupby(dates).transform("min")
    day_high = day_high.groupby(dates).ffill()
    day_low = day_low.groupby(dates).ffill()
    in_window = (day_pos >= init_bars) & (day_pos < init_bars + window_bars)
    long_sig = in_window & (df["close"] > day_high) & (day_high.notna())
    short_sig = in_window & (df["close"] < day_low) & (day_low.notna())
    # solo la primera ruptura del dia
    long_sig = long_sig & (~long_sig.groupby(dates).apply(lambda s: s.cumsum().shift(fill_value=0) > 0).reset_index(level=0, drop=True).reindex(long_sig.index, fill_value=False))
    return _signals_from_bool(df, a, long_sig, short_sig)


def _signals_from_bool(df, a, long_sig, short_sig):
    long_sig = long_sig.fillna(False)
    short_sig = short_sig.fillna(False)
    idx = df.index
    n = len(df)
    valid = a.notna() & (df["open"].notna())
    recs = []
    li = np.where(long_sig.values & valid.values)[0]
    si = np.where(short_sig.values & valid.values)[0]
    for i in li:
        if i + 1 < n:
            recs.append((i + 1, 1))
    for i in si:
        if i + 1 < n:
            recs.append((i + 1, -1))
    if not recs:
        return pd.DataFrame(columns=["entry_idx", "direction"])
    sig = pd.DataFrame(recs, columns=["entry_idx", "direction"]).sort_values("entry_idx")
    sig = sig.drop_duplicates(subset=["entry_idx"], keep="first")  # si long y short coinciden en la misma barra, se descarta ambiguedad
    return sig.reset_index(drop=True)


SETUPS = {
    "range_breakout": gen_range_breakout,
    "liquidity_sweep": gen_liquidity_sweep,
    "momentum_continuation": gen_momentum_continuation,
    "mean_reversion": gen_mean_reversion,
    "session_open": gen_session_open_reaction,
}


# --------------------------------------------------------------------------------------
# 3. Motor de backtest de salidas (grid TP/SL en ATR, trailing, BE, time-stop)
# --------------------------------------------------------------------------------------

def simulate_exits(df, point, entries, atr_series, tp_mult, sl_mult, mode="plain",
                    time_stop_bars=None, same_bar_assumption="pessimistic", max_bars=300):
    """
    mode: 'plain' | 'be' | 'trail'  (be y trail se activan tras alcanzar 1x ATR de favor)
    time_stop_bars: si se define, cierra a mercado (close) tras N barras si no ha salido antes
    same_bar_assumption: 'pessimistic' (SL primero) u 'optimistic' (TP primero)
    Devuelve DataFrame de trades con columnas: entry_idx, direction, entry_price, exit_idx,
    exit_price, exit_reason, risk_price, pnl_R, bars_held
    """
    o = df["open"].values
    h = df["high"].values
    l = df["low"].values
    c = df["close"].values
    spr = df["spread"].values * point
    a = atr_series.values
    n = len(df)

    trades = []
    for _, row in entries.iterrows():
        i = int(row["entry_idx"])
        d = int(row["direction"])
        if i >= n or np.isnan(a[i]):
            continue
        entry_atr = a[i]
        if entry_atr <= 0 or np.isnan(entry_atr):
            continue
        entry_raw = o[i]
        half_spread_entry = spr[i] / 2.0
        entry_price = entry_raw + d * half_spread_entry  # cruzar el spread al entrar
        risk = sl_mult * entry_atr
        if risk <= 0:
            continue
        if d == 1:
            sl_price = entry_price - risk
            tp_price = entry_price + tp_mult * entry_atr
        else:
            sl_price = entry_price + risk
            tp_price = entry_price - tp_mult * entry_atr

        stop = sl_price
        target = tp_price
        activated = False  # para be/trail, tras 1xATR de favor
        exit_price = None
        exit_reason = None
        exit_idx = None
        j_end = min(n - 1, i + max_bars)
        for j in range(i, j_end + 1):
            hi, lo = h[j], l[j]
            hit_tp = (hi >= target) if d == 1 else (lo <= target)
            hit_sl = (lo <= stop) if d == 1 else (hi >= stop)

            if hit_tp and hit_sl:
                if same_bar_assumption == "pessimistic":
                    exit_price, exit_reason = stop, "SL"
                else:
                    exit_price, exit_reason = target, "TP"
                exit_idx = j
                break
            elif hit_sl:
                exit_price, exit_reason = stop, "SL"
                exit_idx = j
                break
            elif hit_tp:
                exit_price, exit_reason = target, "TP"
                exit_idx = j
                break

            # time-stop explicito
            if time_stop_bars is not None and (j - i) >= time_stop_bars:
                exit_price, exit_reason = c[j], "TIME"
                exit_idx = j
                break

            # actualizar be / trailing con el favorable-excursion visto en esta barra
            if mode in ("be", "trail"):
                fav = (hi - entry_price) if d == 1 else (entry_price - lo)
                if not activated and fav >= entry_atr:
                    activated = True
                if activated:
                    if mode == "be":
                        stop = entry_price
                    elif mode == "trail":
                        new_stop = (hi - entry_atr) if d == 1 else (lo + entry_atr)
                        if d == 1:
                            stop = max(stop, new_stop)
                        else:
                            stop = min(stop, new_stop)
        else:
            pass

        if exit_price is None:
            exit_idx = j_end
            exit_price = c[j_end]
            exit_reason = "EOD"

        half_spread_exit = spr[exit_idx] / 2.0
        exit_price_net = exit_price - d * half_spread_exit  # cruzar el spread al salir
        pnl_price = (exit_price_net - entry_price) * d
        pnl_R = pnl_price / risk
        trades.append({
            "entry_idx": i, "direction": d, "entry_price": entry_price,
            "exit_idx": exit_idx, "exit_price": exit_price_net, "exit_reason": exit_reason,
            "risk_price": risk, "pnl_R": pnl_R, "bars_held": exit_idx - i,
        })
    return pd.DataFrame(trades)


def trade_metrics(trades, df=None):
    if trades is None or len(trades) == 0:
        return None
    r = trades["pnl_R"].values
    wins = r[r > 0]
    losses = r[r <= 0]
    n = len(r)
    winrate = len(wins) / n if n else np.nan
    avg_win = wins.mean() if len(wins) else 0.0
    avg_loss = losses.mean() if len(losses) else 0.0
    gross_win = wins.sum() if len(wins) else 0.0
    gross_loss = -losses.sum() if len(losses) else 0.0
    pf = (gross_win / gross_loss) if gross_loss > 0 else (np.inf if gross_win > 0 else np.nan)
    expectancy = r.mean()
    cum = np.cumsum(r)
    peak = np.maximum.accumulate(cum)
    dd = cum - peak
    max_dd = dd.min() if len(dd) else 0.0
    rr = abs(avg_win / avg_loss) if avg_loss != 0 else np.nan
    return {
        "n_trades": int(n),
        "winrate_pct": round(float(winrate) * 100, 2),
        "avg_win_R": round(float(avg_win), 3),
        "avg_loss_R": round(float(avg_loss), 3),
        "rr": round(float(rr), 3) if rr == rr else None,
        "profit_factor": round(float(pf), 3) if pf not in (np.inf,) else 999.0,
        "expectancy_R": round(float(expectancy), 4),
        "cum_return_R": round(float(cum[-1]), 2) if n else 0.0,
        "max_drawdown_R": round(float(max_dd), 2),
    }


def walk_forward_halves(trades, n_bars):
    if trades is None or len(trades) == 0:
        return None, None
    mid = n_bars // 2
    h1 = trades[trades["entry_idx"] < mid]
    h2 = trades[trades["entry_idx"] >= mid]
    return trade_metrics(h1), trade_metrics(h2)


# --------------------------------------------------------------------------------------
# 4. Orquestacion por dataset
# --------------------------------------------------------------------------------------

DATASETS = [
    dict(
        key="xauusdm_m1_to_m5",
        label="XAUUSDm (Oro, broker 'm', M1->M5)",
        path=DOWNLOADS / "XAUUSDm_M1_.csv",
        rule="5min",
        time_stop_bars=24,
        max_bars=200,
    ),
    dict(
        key="xauusd247_m15_native",
        label="XAUUSD247 (Oro, broker/cuenta 247, M15 nativo)",
        path=DOWNLOADS / "XAUUSD247m_M15_202512110800_202609151715 otro mas tiempo.csv",
        rule=None,
        time_stop_bars=16,
        max_bars=100,
    ),
    dict(
        key="ustec_m1_to_m5",
        label="USTEC (Nasdaq, M1->M5)",
        path=DOWNLOADS / "USTEC_x100m_M1.csv",
        rule="5min",
        time_stop_bars=24,
        max_bars=200,
    ),
    dict(
        key="us30_m1_to_m5",
        label="US30 (M1->M5)",
        path=DOWNLOADS / "US30_x10m_M1_202606041449_202609151709.csv",
        rule="5min",
        time_stop_bars=24,
        max_bars=200,
    ),
]

TP_GRID = [1.0, 1.5, 2.0, 2.5]
SL_GRID = [0.5, 0.75, 1.0, 1.5]
MODES = ["plain", "be", "trail"]

MIN_TRADES = 100
MIN_PF = 1.3


def run_dataset(ds):
    point = detect_point(ds["path"])
    raw = load_mt5_csv(ds["path"])
    df = resample_ohlc(raw, ds["rule"]) if ds["rule"] else raw
    df = df[df["open"] > 0].copy()
    a = atr(df, 14)

    profile = stats_profile(df, point, ds["label"])
    by_hour, by_dow = hourly_dow_profile(df, ds["label"])

    screen_rows = []
    per_setup_entries = {}
    for name, gen in SETUPS.items():
        entries = gen(df, a)
        per_setup_entries[name] = entries
        if len(entries) == 0:
            screen_rows.append({"asset": ds["label"], "setup": name, "n_signals": 0})
            continue
        trades = simulate_exits(df, point, entries, a, tp_mult=1.5, sl_mult=1.0, mode="plain",
                                 time_stop_bars=ds["time_stop_bars"], max_bars=ds["max_bars"])
        m = trade_metrics(trades)
        row = {"asset": ds["label"], "setup": name, "n_signals": len(entries)}
        if m:
            row.update(m)
        screen_rows.append(row)
    screen_df = pd.DataFrame(screen_rows)

    # elegir top 2-3 setups por PF*log(n_trades) entre los que tengan >=30 señales para grid completo
    candidates = screen_df[(screen_df.get("n_trades", 0).fillna(0) >= 30)].copy()
    if len(candidates):
        candidates["score"] = candidates["profit_factor"].clip(upper=5) * np.log1p(candidates["n_trades"])
        top_setups = candidates.sort_values("score", ascending=False)["setup"].head(3).tolist()
    else:
        top_setups = list(SETUPS.keys())[:2]

    grid_rows = []
    winners = []
    for name in top_setups:
        entries = per_setup_entries[name]
        if len(entries) == 0:
            continue
        for tp in TP_GRID:
            for sl in SL_GRID:
                for mode in MODES:
                    for ts_on in (False, True):
                        ts = ds["time_stop_bars"] if ts_on else None
                        trades = simulate_exits(df, point, entries, a, tp_mult=tp, sl_mult=sl,
                                                 mode=mode, time_stop_bars=ts,
                                                 max_bars=ds["max_bars"],
                                                 same_bar_assumption="pessimistic")
                        m = trade_metrics(trades)
                        if not m:
                            continue
                        h1, h2 = walk_forward_halves(trades, len(df))
                        row = {
                            "asset": ds["label"], "setup": name, "tp_atr": tp, "sl_atr": sl,
                            "mode": mode, "time_stop": ts_on, **m,
                            "h1_pf": h1["profit_factor"] if h1 else None,
                            "h1_n": h1["n_trades"] if h1 else 0,
                            "h2_pf": h2["profit_factor"] if h2 else None,
                            "h2_n": h2["n_trades"] if h2 else 0,
                        }
                        grid_rows.append(row)
                        passes = (
                            m["n_trades"] >= MIN_TRADES and m["profit_factor"] >= MIN_PF and
                            h1 and h2 and h1["n_trades"] >= 10 and h2["n_trades"] >= 10 and
                            h1["profit_factor"] >= 1.0 and h2["profit_factor"] >= 1.0
                        )
                        if passes:
                            # sensibilidad optimista para el mismo combo, solo si pasa filtros
                            trades_opt = simulate_exits(df, point, entries, a, tp_mult=tp, sl_mult=sl,
                                                         mode=mode, time_stop_bars=ts,
                                                         max_bars=ds["max_bars"],
                                                         same_bar_assumption="optimistic")
                            m_opt = trade_metrics(trades_opt)
                            winners.append({**row, "opt_pf": m_opt["profit_factor"], "opt_cum_R": m_opt["cum_return_R"]})
    grid_df = pd.DataFrame(grid_rows)
    winners_df = pd.DataFrame(winners)

    return dict(profile=profile, by_hour=by_hour, by_dow=by_dow, screen=screen_df,
                grid=grid_df, winners=winners_df, top_setups=top_setups, n_bars=len(df))


def main():
    all_profiles = []
    all_hours = []
    all_dows = []
    all_screens = []
    all_winners = []
    summary = {}

    for ds in DATASETS:
        print(f"=== {ds['label']} ===")
        res = run_dataset(ds)
        all_profiles.append(res["profile"])
        all_hours.append(res["by_hour"])
        all_dows.append(res["by_dow"])
        all_screens.append(res["screen"])
        if len(res["winners"]):
            all_winners.append(res["winners"])
        summary[ds["key"]] = {
            "label": ds["label"],
            "n_bars": res["n_bars"],
            "top_setups_for_grid": res["top_setups"],
            "n_winners": int(len(res["winners"])),
        }
        res["grid"].to_csv(OUT / f"grid_{ds['key']}.csv", index=False)
        print(res["screen"].to_string(index=False))
        print(f"top setups for full grid: {res['top_setups']}  | winners passing filters: {len(res['winners'])}")
        print()

    pd.DataFrame(all_profiles).to_csv(OUT / "profile_all.csv", index=False)
    pd.concat(all_hours).to_csv(OUT / "hourly_all.csv", index=False)
    pd.concat(all_dows).to_csv(OUT / "dow_all.csv", index=False)
    pd.concat(all_screens).to_csv(OUT / "screen_all.csv", index=False)
    if all_winners:
        winners_all = pd.concat(all_winners)
        winners_all.to_csv(OUT / "winners_all.csv", index=False)
    else:
        winners_all = pd.DataFrame()
        (OUT / "winners_all.csv").write_text("no winners passed filters\n")

    with open(OUT / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("=== RESUMEN ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nTotal setups ganadores (pasan filtros) en todos los activos: {len(winners_all)}")
    if len(winners_all):
        print(winners_all.sort_values("profit_factor", ascending=False).to_string(index=False))


if __name__ == "__main__":
    main()
