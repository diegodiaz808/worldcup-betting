#!/usr/bin/env python3
"""Puebla los snapshots de public/data con datos de muestra del demo:
resultados del Mundial 2026 (anclados a hechos reales: España campeón con
valla casi invicta, Mbappé Botín de Oro) + apuestas y métricas simuladas
del sistema. Correr y despues rebuildear el demo estático."""
import json
import random
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
rng = random.Random(2026)

STRONG = {"Spain": 92, "Argentina": 90, "France": 89, "England": 87, "Brazil": 86,
          "Portugal": 85, "Germany": 84, "Netherlands": 83, "Norway": 80, "Uruguay": 80,
          "Belgium": 80, "Croatia": 79, "Italy": 82, "Colombia": 79, "Morocco": 79,
          "Mexico": 76, "USA": 76, "Japan": 76, "South Korea": 74, "Canada": 73}


def strength(team):
    return STRONG.get(team, rng.randint(65, 75))


def gen_score(home, away):
    if home == "Spain":
        return rng.choice([(2, 0), (1, 0), (3, 0)])
    if away == "Spain":
        return tuple(reversed(rng.choice([(2, 0), (1, 0), (3, 0)])))
    diff = strength(home) - strength(away) + 4  # leve ventaja local
    h = max(0, int(rng.gauss(1.3 + diff / 25, 1.0)))
    a = max(0, int(rng.gauss(1.1 - diff / 25, 0.9)))
    return min(h, 5), min(a, 4)


# ── 1. resultados en matches.json y detalles ─────────────────────────────
matches = json.loads((DATA / "matches.json").read_text())
for m in matches:
    h, a = gen_score(m["homeTeam"], m["awayTeam"])
    m["status"] = "finished"
    m["result"] = f"{h}-{a}"
(DATA / "matches.json").write_text(json.dumps(matches, ensure_ascii=False))

MARKETS = [
    ("player_shot_on_target", "Tiro al arco", "over 0.5 tiros al arco"),
    ("player_yellow_card", "Amarilla", "recibe tarjeta amarilla"),
    ("player_foul_committed", "Fouls cometidos", "over 1.5 fouls"),
    ("player_tackle", "Tackles", "over 1.5 tackles"),
    ("player_foul_drawn", "Fouls recibidos", "over 1.5 fouls recibidos"),
]
ALERT_MARKET = {"YELLOW_PRONE": 1, "YELLOW_RISK": 1, "HIGH_SHOTS": 0,
                "FOUL_MACHINE": 2, "ATTACKING_DEF": 3, "WC_HOT_STREAK": 0}

all_pick_rows = []
for m in matches:
    f = DATA / "matches" / f"{m['id']}.json"
    d = json.loads(f.read_text())
    d["match"]["status"] = "finished"
    d["match"]["result"] = m["result"]
    picks, seen = [], set()
    for al in d.get("alerts", []):
        if al["playerName"] in seen or len(picks) >= 6:
            continue
        seen.add(al["playerName"])
        mi = ALERT_MARKET.get(al["type"], 0)
        mid, mlabel, line = MARKETS[mi]
        odds = round(rng.uniform(1.55, 2.35), 2)
        prob = round(min(0.92, 1 / odds + rng.uniform(0.02, 0.12)), 2)
        picks.append({
            "player": al["playerName"], "country": al.get("country"), "flag": al.get("flag"),
            "marketId": mid, "marketLabel": mlabel, "market": mlabel, "line": line,
            "odds": odds, "confidence": al.get("confidence", "MEDIUM"),
            "confidenceScore": {"HIGH": 82, "MEDIUM": 64, "LOW": 45}.get(al.get("confidence"), 60) + rng.randint(-4, 6),
            "statBacking": al.get("description", ""), "probability": prob, "scope": "player",
        })
    combos = []
    if len(picks) >= 2:
        legs = picks[:2]
        total = round(legs[0]["odds"] * legs[1]["odds"], 2)
        combos.append({
            "id": f"cp-{m['id'][:8]}", "name": "Doble con respaldo estadístico",
            "description": "Las dos señales de mayor confianza del partido combinadas.",
            "riskLevel": "MODERADO", "picks": legs, "totalOdds": total,
            "combinedScore": round((legs[0]["confidenceScore"] + legs[1]["confidenceScore"]) / 2),
            "estimatedProbability": round(legs[0]["probability"] * legs[1]["probability"], 2),
        })
    (DATA / "matches" / f"{m['id']}-picks.json").write_text(
        json.dumps({"picks": picks, "combos": combos}, ensure_ascii=False))
    for p in picks:
        all_pick_rows.append((m, p))

# ── 2. bets.json: tracker con resultados ─────────────────────────────────
bets = []
sample = rng.sample(all_pick_rows, min(28, len(all_pick_rows)))
for i, (m, p) in enumerate(sample):
    won = rng.random() < 0.58
    day = m["date"][:10]
    bets.append({
        "id": f"demobet{i:03d}", "comboId": None, "matchId": m["id"],
        "matchName": f"{m['homeTeam']} vs {m['awayTeam']}",
        "player": p["player"], "marketId": p["marketId"], "marketLabel": p["marketLabel"],
        "line": p["line"], "odds": p["odds"], "stake": 1,
        "result": "won" if won else "lost",
        "profit": round(p["odds"] - 1, 2) if won else -1,
        "notes": "", "createdAt": f"{day}T15:00:00.000Z", "settledAt": f"{day}T22:30:00.000Z",
    })
bets.sort(key=lambda b: b["createdAt"], reverse=True)
(DATA / "bets.json").write_text(json.dumps(bets, ensure_ascii=False))

# ── 3. combos.json ───────────────────────────────────────────────────────
def combo(nid, name, risk, picks, just, edge, insight, prob):
    return {"id": nid, "name": name, "riskLevel": risk,
            "totalOdds": round(eval("*".join(str(p["odds"]) for p in picks)), 2),
            "realProbability": prob, "picks": picks,
            "justification": just, "edgeTip": edge, "marketInsight": insight,
            "createdAt": "2026-06-24T18:00:00.000Z"}

cp = lambda pl, mk, od, cf: {"player": pl, "market": mk, "odds": od, "confidence": cf}
combos_out = [
    combo("demo-c1", "Motor de fouls sudamericano", "MODERADO",
          [cp("N. De La Cruz", "Over 1.5 fouls cometidos", 1.62, "HIGH"),
           cp("R. Pereyra", "Over 1.5 fouls cometidos", 1.70, "HIGH")],
          "Ambos promedian mas de 2 fouls por partido en los ultimos 6 meses y el arbitro designado cobra 28 fouls por partido.",
          "Los mercados de fouls ajustan mas lento que los de goles: ahi esta el margen.",
          "Las casas subestiman los fouls de mediocampistas defensivos en partidos de eliminacion.", 0.41),
    combo("demo-c2", "Tiros al arco de los tanques", "MODERADO",
          [cp("K. Mbappé", "Over 1.5 tiros al arco", 1.48, "HIGH"),
           cp("L. Messi", "Over 1.5 tiros al arco", 1.55, "HIGH"),
           cp("J. Bellingham", "Over 0.5 tiros al arco", 1.30, "HIGH")],
          "Los tres llegan con 4+ tiros al arco por partido en el Mundial y sus equipos concentran el volumen ofensivo.",
          "En seleccion, el volumen de tiros de las estrellas sube ~20% versus sus clubes.",
          "El over de tiros al arco individual paga mejor que el team total con la misma probabilidad implicita.", 0.38),
    combo("demo-c3", "Amarillas en el clasico", "ARRIESGADO",
          [cp("E. Álvarez", "Recibe amarilla", 2.75, "MEDIUM"),
           cp("K. Sebelebele", "Recibe amarilla", 3.10, "MEDIUM")],
          "Laterales que marcan a los extremos mas encarados del rival; ambos con 1 amarilla cada 3 partidos.",
          "Amarillas correlacionan con el arbitro: este muestra 5.2 por partido.",
          "El mercado de amarillas individuales es el menos eficiente del Mundial.", 0.19),
]
(DATA / "combos.json").write_text(json.dumps(combos_out, ensure_ascii=False))

# ── 4. system.json ───────────────────────────────────────────────────────
acc = []
for mid, hr, n, ao in [("player_shot_on_target", 0.66, 118, 1.58), ("player_yellow_card", 0.38, 74, 2.85),
                       ("player_foul_committed", 0.61, 96, 1.72), ("player_tackle", 0.57, 68, 1.80),
                       ("player_foul_drawn", 0.52, 58, 1.85), ("match_corners", 0.62, 42, 1.75)]:
    won = round(n * hr)
    roi = (won * (ao - 1) - (n - won)) / n  # fracción (el front multiplica x100)
    acc.append({"marketId": mid, "total": n, "won": won, "hitRate": round(hr, 3),
                "avgOdds": ao, "roi": round(roi, 3)})

daily, insights_txt = [], [
    "Los overs de tiros al arco rindieron por encima del cierre de linea.",
    "Dia flojo en amarillas: arbitros permisivos en los tres partidos.",
    "Los fouls de mediocampistas siguen siendo el mercado mas rentable.",
    "El sistema evito los favoritos sobreajustados y protegio el ROI.",
]
for i in range(11, 28):
    n = rng.randint(18, 34)
    hr = rng.uniform(0.48, 0.68)
    won = round(n * hr)
    roi = (won * 0.78 - (n - won)) / n  # fracción
    daily.append({"date": f"2026-06-{i:02d}", "won": won, "lost": n - won,
                  "hitRate": round(hr, 3), "roi": round(roi, 3),
                  "aiInsight": insights_txt[i % len(insights_txt)]})

total = sum(a["total"] for a in acc)
won_t = sum(a["won"] for a in acc)
profit = round(sum(a["total"] * a["roi"] for a in acc), 2)
system = {"accuracy": acc, "daily": daily,
          "summary": {"totalBets": total, "wonBets": won_t,
                      "hitRate": round(won_t / total, 3), "totalStake": total,
                      "totalProfit": profit, "roi": round(profit / total, 3),
                      "totalSuggestions": 456, "pendingSuggestions": 0}}
(DATA / "system.json").write_text(json.dumps(system, ensure_ascii=False))

# ── 5. insights (Mundial al dia / Jugadores) ─────────────────────────────
def rp(pid, name, country, flag, pos, value, matches_n):
    return {"id": pid, "name": name, "country": country, "flag": flag, "position": pos,
            "value": value, "matches": matches_n, "perMatch": round(value / matches_n, 2)}

goals = [rp("wc-mbappe", "K. Mbappé", "France", "🇫🇷", "FWD", 5, 3),
         rp("wc-messi", "L. Messi", "Argentina", "🇦🇷", "FWD", 4, 3),
         rp("wc-bellingham", "J. Bellingham", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MID", 4, 3),
         rp("wc-haaland", "E. Haaland", "Norway", "🇳🇴", "FWD", 3, 3),
         rp("wc-ftorres", "F. Torres", "Spain", "🇪🇸", "FWD", 3, 3),
         rp("wc-vinicius", "Vinicius Jr", "Brazil", "🇧🇷", "FWD", 3, 3),
         rp("wc-kane", "H. Kane", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "FWD", 2, 3),
         rp("wc-lautaro", "L. Martínez", "Argentina", "🇦🇷", "FWD", 2, 3),
         rp("wc-gyokeres", "V. Gyökeres", "Sweden", "🇸🇪", "FWD", 2, 3),
         rp("wc-alvarez", "J. Álvarez", "Argentina", "🇦🇷", "FWD", 2, 3)]
sot = [rp("wc-mbappe", "K. Mbappé", "France", "🇫🇷", "FWD", 14, 3),
       rp("wc-messi", "L. Messi", "Argentina", "🇦🇷", "FWD", 12, 3),
       rp("wc-vinicius", "Vinicius Jr", "Brazil", "🇧🇷", "FWD", 11, 3),
       rp("wc-haaland", "E. Haaland", "Norway", "🇳🇴", "FWD", 10, 3),
       rp("wc-yamal", "L. Yamal", "Spain", "🇪🇸", "FWD", 10, 3),
       rp("wc-kane", "H. Kane", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "FWD", 9, 3),
       rp("wc-ftorres", "F. Torres", "Spain", "🇪🇸", "FWD", 8, 3),
       rp("wc-bellingham", "J. Bellingham", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MID", 8, 3),
       rp("wc-pulisic", "C. Pulisic", "USA", "🇺🇸", "FWD", 7, 3),
       rp("wc-son", "H. Son", "South Korea", "🇰🇷", "FWD", 7, 3)]
yellows = [rp("wc-delacruz", "N. De La Cruz", "Uruguay", "🇺🇾", "MID", 2, 3),
           rp("wc-rodri", "Rodri", "Spain", "🇪🇸", "MID", 2, 3),
           rp("wc-casemiro", "Casemiro", "Brazil", "🇧🇷", "MID", 2, 3),
           rp("wc-rice", "D. Rice", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MID", 2, 3),
           rp("wc-ealvarez", "E. Álvarez", "Mexico", "🇲🇽", "MID", 2, 3),
           rp("wc-tchouameni", "A. Tchouaméni", "France", "🇫🇷", "MID", 1, 3),
           rp("wc-gravenberch", "R. Gravenberch", "Netherlands", "🇳🇱", "MID", 1, 3),
           rp("wc-zubimendi", "M. Zubimendi", "Spain", "🇪🇸", "MID", 1, 3),
           rp("wc-mactallister", "A. Mac Allister", "Argentina", "🇦🇷", "MID", 1, 3),
           rp("wc-reijnders", "T. Reijnders", "Netherlands", "🇳🇱", "MID", 1, 3)]
fouls_c = [rp("wc-delacruz", "N. De La Cruz", "Uruguay", "🇺🇾", "MID", 11, 3),
           rp("wc-casemiro", "Casemiro", "Brazil", "🇧🇷", "MID", 10, 3),
           rp("wc-ealvarez", "E. Álvarez", "Mexico", "🇲🇽", "MID", 9, 3),
           rp("wc-rodri", "Rodri", "Spain", "🇪🇸", "MID", 8, 3),
           rp("wc-rice", "D. Rice", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MID", 8, 3),
           rp("wc-tchouameni", "A. Tchouaméni", "France", "🇫🇷", "MID", 7, 3),
           rp("wc-paredes", "L. Paredes", "Argentina", "🇦🇷", "MID", 7, 3),
           rp("wc-gravenberch", "R. Gravenberch", "Netherlands", "🇳🇱", "MID", 6, 3),
           rp("wc-anguissa", "F. Anguissa", "Cameroon", "🇨🇲", "MID", 6, 3),
           rp("wc-amrabat", "S. Amrabat", "Morocco", "🇲🇦", "MID", 6, 3)]
fouls_d = [rp("wc-yamal", "L. Yamal", "Spain", "🇪🇸", "FWD", 13, 3),
           rp("wc-mbappe", "K. Mbappé", "France", "🇫🇷", "FWD", 11, 3),
           rp("wc-vinicius", "Vinicius Jr", "Brazil", "🇧🇷", "FWD", 11, 3),
           rp("wc-messi", "L. Messi", "Argentina", "🇦🇷", "FWD", 9, 3),
           rp("wc-doku", "J. Doku", "Belgium", "🇧🇪", "FWD", 9, 3),
           rp("wc-kvara", "K. Kvaratskhelia", "Georgia", "🇬🇪", "FWD", 8, 3),
           rp("wc-son", "H. Son", "South Korea", "🇰🇷", "FWD", 7, 3),
           rp("wc-pulisic", "C. Pulisic", "USA", "🇺🇸", "FWD", 7, 3),
           rp("wc-leao", "R. Leão", "Portugal", "🇵🇹", "FWD", 6, 3),
           rp("wc-olise", "M. Olise", "France", "🇫🇷", "FWD", 6, 3)]

def trend(pid, name, country, flag, pos, metric, label, base, wc, total_v, n, summary, up=True):
    return {"id": f"t-{pid}", "playerId": pid, "name": name, "country": country, "flag": flag,
            "position": pos, "metric": metric, "label": label, "baselinePerMatch": base,
            "worldCupPerMatch": wc, "worldCupTotal": total_v, "matches": n,
            "change": round((wc - base) / base * 100 if base else 0, 1),
            "direction": "up" if up else "down", "summary": summary}

surprises = [
    trend("wc-ftorres", "F. Torres", "Spain", "🇪🇸", "FWD", "goals", "Goles", 0.38, 1.0, 3, 3,
          "Triplicó su promedio goleador de club: 1 gol por partido en el grupo."),
    trend("wc-yamal", "L. Yamal", "Spain", "🇪🇸", "FWD", "foulsDrawn", "Fouls recibidos", 2.1, 4.3, 13, 3,
          "El jugador mas fouleado del torneo: los rivales solo lo paran con infracciones."),
    trend("wc-bellingham", "J. Bellingham", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MID", "goals", "Goles", 0.45, 1.33, 4, 3,
          "De mediocampista a goleador: 4 goles en la fase de grupos."),
]
dropoffs = [
    trend("wc-kane", "H. Kane", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "FWD", "shotsOnTarget", "Tiros al arco", 2.4, 1.2, 9, 3,
          "La mitad de su volumen habitual: Inglaterra canaliza todo por Bellingham.", up=False),
    trend("wc-haaland", "E. Haaland", "Norway", "🇳🇴", "FWD", "goals", "Goles", 1.1, 0.66, 3, 3,
          "Debajo de su promedio de club: Noruega genera poco juego para el 9.", up=False),
]

def rankings(limit):
    return {"yellowCards": {"label": "Amarillas", "players": yellows[:limit]},
            "shotsOnTarget": {"label": "Tiros al arco", "players": sot[:limit]},
            "goals": {"label": "Goles", "players": goals[:limit]},
            "foulsCommitted": {"label": "Fouls cometidos", "players": fouls_c[:limit]},
            "foulsDrawn": {"label": "Fouls recibidos", "players": fouls_d[:limit]}}

(DATA / "insights-limit5.json").write_text(json.dumps(
    {"rankings": rankings(5), "surprises": surprises, "dropOffs": dropoffs}, ensure_ascii=False))
(DATA / "insights-players.json").write_text(json.dumps(
    {"rankings": rankings(10), "surprises": surprises, "dropOffs": dropoffs}, ensure_ascii=False))

print(f"OK: {len(matches)} partidos con resultado, {len(bets)} bets, "
      f"{len(combos_out)} combos, system ROI {system['summary']['roi']}%")
