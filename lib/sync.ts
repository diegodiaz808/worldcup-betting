import { prisma } from './prisma'

const API_HOST = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.FOOTBALL_API_KEY ?? ''

// National team IDs en api-football
// IDs verificados contra API-Football /teams?league=1&season=2026
const NATIONAL_TEAMS: Record<string, { id: number; flag: string }> = {
  Algeria:              { id: 1532, flag: '🇩🇿' },
  Argentina:            { id: 26,   flag: '🇦🇷' },
  Australia:            { id: 20,   flag: '🇦🇺' },
  Austria:              { id: 775,  flag: '🇦🇹' },
  Belgium:              { id: 1,    flag: '🇧🇪' },
  'Bosnia & Herzegovina': { id: 1113, flag: '🇧🇦' },
  Brazil:               { id: 6,    flag: '🇧🇷' },
  Canada:               { id: 5529, flag: '🇨🇦' },
  'Cape Verde Islands': { id: 1533, flag: '🇨🇻' },
  Colombia:             { id: 8,    flag: '🇨🇴' },
  'Congo DR':           { id: 1508, flag: '🇨🇩' },
  Croatia:              { id: 3,    flag: '🇭🇷' },
  Curaçao:              { id: 5530, flag: '🇨🇼' },
  'Czech Republic':     { id: 770,  flag: '🇨🇿' },
  Ecuador:              { id: 2382, flag: '🇪🇨' },
  Egypt:                { id: 32,   flag: '🇪🇬' },
  England:              { id: 10,   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  France:               { id: 2,    flag: '🇫🇷' },
  Germany:              { id: 25,   flag: '🇩🇪' },
  Ghana:                { id: 1504, flag: '🇬🇭' },
  Haiti:                { id: 2386, flag: '🇭🇹' },
  Iran:                 { id: 22,   flag: '🇮🇷' },
  Iraq:                 { id: 1567, flag: '🇮🇶' },
  'Ivory Coast':        { id: 1501, flag: '🇨🇮' },
  Japan:                { id: 12,   flag: '🇯🇵' },
  Jordan:               { id: 1548, flag: '🇯🇴' },
  Mexico:               { id: 16,   flag: '🇲🇽' },
  Morocco:              { id: 31,   flag: '🇲🇦' },
  Netherlands:          { id: 1118, flag: '🇳🇱' },
  'New Zealand':        { id: 4673, flag: '🇳🇿' },
  Norway:               { id: 1090, flag: '🇳🇴' },
  Panama:               { id: 11,   flag: '🇵🇦' },
  Paraguay:             { id: 2380, flag: '🇵🇾' },
  Portugal:             { id: 27,   flag: '🇵🇹' },
  Qatar:                { id: 1569, flag: '🇶🇦' },
  'Saudi Arabia':       { id: 23,   flag: '🇸🇦' },
  Scotland:             { id: 1108, flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  Senegal:              { id: 13,   flag: '🇸🇳' },
  'South Africa':       { id: 1531, flag: '🇿🇦' },
  'South Korea':        { id: 17,   flag: '🇰🇷' },
  Spain:                { id: 9,    flag: '🇪🇸' },
  Sweden:               { id: 5,    flag: '🇸🇪' },
  Switzerland:          { id: 15,   flag: '🇨🇭' },
  Tunisia:              { id: 28,   flag: '🇹🇳' },
  Türkiye:              { id: 777,  flag: '🇹🇷' },
  USA:                  { id: 2384, flag: '🇺🇸' },
  Uruguay:              { id: 7,    flag: '🇺🇾' },
  Uzbekistan:           { id: 1568, flag: '🇺🇿' },
}

// Club leagues para stats: Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Saudi Pro, MLS, Eredivisie
const CLUB_LEAGUES = [39, 140, 78, 135, 61, 307, 253, 88]
const teamIdCache = new Map<string, number>()

const TEAM_SEARCH_ALIAS: Record<string, string> = {
  'Cape Verde Islands': 'Cape Verde',
  'Congo DR': 'Congo DR',
  'Czech Republic': 'Czech Republic',
  'Ivory Coast': 'Côte d’Ivoire',
  'South Korea': 'Korea Republic',
  Türkiye: 'Turkey',
  USA: 'USA',
}

function apiFetch(path: string) {
  return fetch(`${API_HOST}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
    signal: AbortSignal.timeout(15000),
  }).then((r) => r.json())
}

async function resolveNationalTeamId(country: string, knownId: number) {
  if (knownId > 0) return knownId
  if (teamIdCache.has(country)) return teamIdCache.get(country) ?? 0

  const query = encodeURIComponent(TEAM_SEARCH_ALIAS[country] ?? country)
  try {
    const data = await apiFetch(`/teams?name=${query}`)
    const teams = (data?.response ?? []) as { team: { id: number; name: string; national: boolean } }[]
    const national = teams.find((t) => t.team.national) ?? teams[0]
    const id = national?.team?.id ?? 0
    teamIdCache.set(country, id)
    return id
  } catch {
    teamIdCache.set(country, 0)
    return 0
  }
}

function positionMap(pos: string): string {
  if (pos === 'Goalkeeper') return 'GK'
  if (pos === 'Defender')   return 'DEF'
  if (pos === 'Midfielder') return 'MID'
  return 'FWD'
}

// Calcula cuántos partidos jugó en los últimos N días
// La API no da fechas por partido, así que usamos toda la temporada como proxy
function extractStats(statistics: Record<string, unknown>[], preferLeagueIds: number[]) {
  // Priorizar ligas principales
  const best = statistics.find((s) => {
    const league = s.league as { id: number }
    return preferLeagueIds.includes(league.id)
  }) ?? statistics[0]

  if (!best) return null

  const games    = best.games    as Record<string, unknown>
  const goals    = best.goals    as Record<string, unknown>
  const shots    = best.shots    as Record<string, unknown>
  const passes   = best.passes   as Record<string, unknown>
  const tackles  = best.tackles  as Record<string, unknown>
  const fouls    = best.fouls    as Record<string, unknown>
  const cards    = best.cards    as Record<string, unknown>
  const dribbles = best.dribbles as Record<string, unknown>

  const matches = Number(games?.appearences ?? 0)
  if (matches === 0) return null

  return {
    matches,
    goals:          Number(goals?.total        ?? 0),
    assists:        Number(goals?.assists       ?? 0),
    rating:         parseFloat(String(games?.rating ?? '0')) || 0,
    shotsTotal:     Number(shots?.total        ?? 0),
    shotsOnTarget:  Number(shots?.on           ?? 0),
    passAccuracy:   Number(passes?.accuracy    ?? 0),
    foulsCommitted: Number(fouls?.committed    ?? 0),
    foulsDrawn:      Number(fouls?.drawn        ?? 0),
    yellowCards:    Number(cards?.yellow       ?? 0),
    redCards:       Number(cards?.red          ?? 0),
    tackles:        Number(tackles?.total      ?? 0),
    interceptions:  Number(tackles?.interceptions ?? 0),
    dribbles:       Number(dribbles?.success   ?? 0),
  }
}

async function fetchPlayerStats(playerId: number, season: number) {
  try {
    const data = await apiFetch(`/players?id=${playerId}&season=${season}`)
    const stats = data?.response?.[0]?.statistics ?? []
    return extractStats(stats, CLUB_LEAGUES)
  } catch {
    return null
  }
}

async function fetchNationalSquad(teamId: number) {
  try {
    const data = await apiFetch(`/players/squads?team=${teamId}`)
    return (data?.response?.[0]?.players ?? []) as { id: number; name: string; position: string; number: number }[]
  } catch {
    return []
  }
}

// Carga solo la nómina (1 llamada por país = 48 llamadas total, ~30 segundos)
// Players quedan con starterRate y posición pero sin stats de club
export async function syncAllSquads() {
  if (!API_KEY) return
  console.log('[sync] Cargando nóminas de los 48 países...')

  for (const [country, { id: configuredId, flag }] of Object.entries(NATIONAL_TEAMS)) {
    const teamId = configuredId > 0 ? configuredId : null
    if (!teamId) { console.log(`[sync] Sin ID para ${country}, skip.`); continue }

    const squad = await fetchNationalSquad(teamId)
    if (!squad.length) { console.log(`[sync] Squad vacío para ${country}`); continue }

    for (const p of squad) {
      const position  = positionMap(p.position)
      const externalId = `apif-${p.id}`
      await prisma.player.upsert({
        where:  { externalId },
        update: { name: p.name, country, flag, position },
        create: { externalId, name: p.name, country, club: '', position, flag, status: 'active', starterRate: position === 'GK' ? 1.0 : 0.75 },
      })
    }
    console.log(`[sync] ${country}: ${squad.length} jugadores en nómina`)
  }
  console.log('[sync] Nóminas completas.')
}

export async function syncPlayers() {
  if (!API_KEY) {
    console.log('[sync] No FOOTBALL_API_KEY, using mock data')
    await seedMockIfEmpty()
    return
  }

  console.log('[sync] Syncing players from api-football...')
  const currentSeason = 2024 // temporada 2024/25

  // Países que ya tienen jugadores en la DB → solo re-sincronizar si se fuerza
  const existing = await prisma.player.groupBy({ by: ['country'], _count: { id: true } })
  const existingCountries = new Set(existing.filter((e) => e._count.id >= 10).map((e) => e.country))

  for (const [country, { id: configuredId, flag }] of Object.entries(NATIONAL_TEAMS)) {
    if (existingCountries.has(country)) {
      console.log(`[sync] ${country} ya tiene jugadores, skip.`)
      continue
    }
    const teamId = await resolveNationalTeamId(country, configuredId)
    if (!teamId) {
      console.log(`[sync] Sin teamId para ${country}, skip squad.`)
      continue
    }
    console.log(`[sync] Fetching ${country} squad...`)
    const squad = await fetchNationalSquad(teamId)

    for (const squadPlayer of squad) {
      const position = positionMap(squadPlayer.position)
      const externalId = `apif-${squadPlayer.id}`

      // Upsert player
      const player = await prisma.player.upsert({
        where:  { externalId },
        update: { name: squadPlayer.name, country, flag, position },
        create: {
          externalId,
          name:       squadPlayer.name,
          country,
          club:       '',
          position,
          flag,
          status:     'active',
          starterRate: position === 'GK' ? 1.0 : 0.75,
        },
      })

      // Fetch club stats for current full season (6m proxy)
      const stats6m = await fetchPlayerStats(squadPlayer.id, currentSeason)
      if (!stats6m) continue

      // Update club name from stats
      try {
        const raw = await apiFetch(`/players?id=${squadPlayer.id}&season=${currentSeason}`)
        const club = raw?.response?.[0]?.statistics?.[0]?.team?.name ?? ''
        if (club) await prisma.player.update({ where: { id: player.id }, data: { club } })
      } catch { /* ignore */ }

      const gpm6 = stats6m.matches > 0 ? stats6m.goals / stats6m.matches : 0
      const score6 = stats6m.rating * 0.4 + gpm6 * 20 * 0.4 + (stats6m.shotsOnTarget / stats6m.matches) * 0.2

      await prisma.playerStats.upsert({
        where:  { playerId_period: { playerId: player.id, period: '6m' } },
        update: { ...stats6m, goalsPerMatch: gpm6, weightedScore: score6 },
        create: { playerId: player.id, period: '6m', ...stats6m, goalsPerMatch: gpm6, weightedScore: score6 },
      })

      // 2m: approximate as last ~40% of season stats (no per-month breakdown in free tier)
      // We scale down proportionally to simulate recent form
      const scale = 0.4
      const stats2m = {
        matches:        Math.max(1, Math.round(stats6m.matches * scale)),
        goals:          Math.round(stats6m.goals          * scale),
        assists:        Math.round(stats6m.assists        * scale),
        rating:         stats6m.rating,
        shotsTotal:     Math.round(stats6m.shotsTotal     * scale),
        shotsOnTarget:  Math.round(stats6m.shotsOnTarget  * scale),
        passAccuracy:   stats6m.passAccuracy,
        foulsCommitted: Math.round(stats6m.foulsCommitted * scale),
        foulsDrawn:      Math.round(stats6m.foulsDrawn      * scale),
        yellowCards:    Math.round(stats6m.yellowCards    * scale),
        redCards:       stats6m.redCards,
        tackles:        Math.round(stats6m.tackles        * scale),
        interceptions:  Math.round(stats6m.interceptions  * scale),
        dribbles:       Math.round(stats6m.dribbles       * scale),
      }
      const gpm2 = stats2m.matches > 0 ? stats2m.goals / stats2m.matches : 0
      const score2 = stats2m.rating * 0.4 + gpm2 * 20 * 0.4 + (stats2m.shotsOnTarget / stats2m.matches) * 0.2

      await prisma.playerStats.upsert({
        where:  { playerId_period: { playerId: player.id, period: '2m' } },
        update: { ...stats2m, goalsPerMatch: gpm2, weightedScore: score2 * 0.65 + score6 * 0.35 },
        create: { playerId: player.id, period: '2m', ...stats2m, goalsPerMatch: gpm2, weightedScore: score2 * 0.65 + score6 * 0.35 },
      })

      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  console.log('[sync] Players synced.')
}

// Sincroniza un solo país - útil para llamar desde la UI país por país sin timeout
export async function syncOneCountry(country: string): Promise<{ ok: boolean; players: number; message: string }> {
  if (!API_KEY) return { ok: false, players: 0, message: 'Sin API key' }

  const teamInfo = NATIONAL_TEAMS[country]
  if (!teamInfo) return { ok: false, players: 0, message: `País desconocido: ${country}` }

  const { id: configuredId, flag } = teamInfo
  const currentSeason = 2024
  const teamId = await resolveNationalTeamId(country, configuredId)
  if (!teamId) return { ok: false, players: 0, message: `Sin ID de API para ${country}` }

  const squad = await fetchNationalSquad(teamId)
  if (!squad.length) return { ok: false, players: 0, message: `Squad vacío para ${country}` }

  let count = 0
  for (const squadPlayer of squad) {
    const position  = positionMap(squadPlayer.position)
    const externalId = `apif-${squadPlayer.id}`
    const player = await prisma.player.upsert({
      where:  { externalId },
      update: { name: squadPlayer.name, country, flag, position },
      create: { externalId, name: squadPlayer.name, country, club: '', position, flag, status: 'active', starterRate: position === 'GK' ? 1.0 : 0.75 },
    })

    const stats6m = await fetchPlayerStats(squadPlayer.id, currentSeason)
    if (!stats6m) continue

    try {
      const raw = await apiFetch(`/players?id=${squadPlayer.id}&season=${currentSeason}`)
      const club = raw?.response?.[0]?.statistics?.[0]?.team?.name ?? ''
      if (club) await prisma.player.update({ where: { id: player.id }, data: { club } })
    } catch { /* ignore */ }

    const gpm6   = stats6m.matches > 0 ? stats6m.goals / stats6m.matches : 0
    const score6 = stats6m.rating * 0.4 + gpm6 * 20 * 0.4 + (stats6m.shotsOnTarget / stats6m.matches) * 0.2
    await prisma.playerStats.upsert({
      where:  { playerId_period: { playerId: player.id, period: '6m' } },
      update: { ...stats6m, goalsPerMatch: gpm6, weightedScore: score6 },
      create: { playerId: player.id, period: '6m', ...stats6m, goalsPerMatch: gpm6, weightedScore: score6 },
    })

    const scale   = 0.4
    const stats2m = {
      matches: Math.max(1, Math.round(stats6m.matches * scale)), goals: Math.round(stats6m.goals * scale),
      assists: Math.round(stats6m.assists * scale), rating: stats6m.rating,
      shotsTotal: Math.round(stats6m.shotsTotal * scale), shotsOnTarget: Math.round(stats6m.shotsOnTarget * scale),
      passAccuracy: stats6m.passAccuracy, foulsCommitted: Math.round(stats6m.foulsCommitted * scale),
      foulsDrawn: Math.round(stats6m.foulsDrawn * scale), yellowCards: Math.round(stats6m.yellowCards * scale),
      redCards: stats6m.redCards, tackles: Math.round(stats6m.tackles * scale),
      interceptions: Math.round(stats6m.interceptions * scale), dribbles: Math.round(stats6m.dribbles * scale),
    }
    const gpm2   = stats2m.matches > 0 ? stats2m.goals / stats2m.matches : 0
    const score2 = stats2m.rating * 0.4 + gpm2 * 20 * 0.4 + (stats2m.shotsOnTarget / stats2m.matches) * 0.2
    await prisma.playerStats.upsert({
      where:  { playerId_period: { playerId: player.id, period: '2m' } },
      update: { ...stats2m, goalsPerMatch: gpm2, weightedScore: score2 * 0.65 + score6 * 0.35 },
      create: { playerId: player.id, period: '2m', ...stats2m, goalsPerMatch: gpm2, weightedScore: score2 * 0.65 + score6 * 0.35 },
    })

    count++
    await new Promise((r) => setTimeout(r, 150))
  }

  console.log(`[sync] ${country}: ${count} jugadores sincronizados.`)
  return { ok: true, players: count, message: `${country}: ${count} jugadores` }
}

export async function syncMatches() {
  // World Cup 2026 fixtures desde api-football (leagueId=1, season=2026)
  if (!API_KEY) return

  try {
    const data = await apiFetch('/fixtures?league=1&season=2026')
    const fixtures = data?.response ?? []

    for (const f of fixtures) {
      const externalId = String(f.fixture.id)
      const status = f.fixture.status?.short === 'FT' ? 'finished'
                   : f.fixture.status?.short === '1H' || f.fixture.status?.short === '2H' ? 'live'
                   : 'scheduled'

      await prisma.match.upsert({
        where:  { externalId },
        update: {
          status,
          result: f.goals?.home != null ? `${f.goals.home}-${f.goals.away}` : null,
        },
        create: {
          externalId,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          homeFlag: NATIONAL_TEAMS[f.teams.home.name]?.flag ?? '🏳️',
          awayFlag: NATIONAL_TEAMS[f.teams.away.name]?.flag ?? '🏳️',
          date: new Date(f.fixture.date),
          result: f.goals?.home != null ? `${f.goals.home}-${f.goals.away}` : null,
          status,
          competition: 'FIFA World Cup 2026',
          round: f.league?.round ?? 'Group Stage',
          group: f.league?.round?.replace('Group Stage - ', '') ?? '',
        },
      })
    }
    console.log(`[sync] ${fixtures.length} matches synced.`)
  } catch (e) {
    console.error('[sync] match sync error:', e)
  }
}

const SYNC_TTL_HOURS = 12 // no re-sincronizar si el último sync fue hace menos de esto

export async function runFullSync(force = false) {
  // Evitar gastos innecesarios: si ya synceamos hace menos de TTL horas, skip
  if (!force) {
    const last = await prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
    })
    if (last) {
      const age = (Date.now() - last.createdAt.getTime()) / 1000 / 3600
      if (age < SYNC_TTL_HOURS) {
        return { success: true, skipped: true, message: `Último sync hace ${age.toFixed(1)}h - próximo en ${(SYNC_TTL_HOURS - age).toFixed(1)}h` }
      }
    }
  }

  const log = await prisma.syncLog.create({ data: { type: 'full', status: 'running' } })

  try {
    await syncAllSquads()   // 1 llamada por país → nóminas completas en ~30s
    await syncPlayers()     // stats de club (lento, skip países ya completos)
    await syncMatches()
    await syncRecentInternationalForm()
    await prisma.syncLog.update({
      where: { id: log.id },
      data:  { status: 'success', message: `Synced at ${new Date().toISOString()}` },
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.syncLog.update({ where: { id: log.id }, data: { status: 'error', message } })
    return { success: false, error: message }
  }
}

function emptyRecentAccumulator(flag: string) {
  return {
    flag,
    matches: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    corners: 0,
    yellowCards: 0,
    foulsCommitted: 0,
    shotsTotal: 0,
    shotsOnTarget: 0,
    possession: [] as number[],
  }
}

async function syncRecentInternationalForm() {
  if (!API_KEY) return

  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) // últimos 120 días (cubre amistosos de marzo/abril/mayo/junio)
  const teamAcc: Record<string, ReturnType<typeof emptyRecentAccumulator>> = {}
  const playerAcc: Record<string, {
    playerId: string
    matches: number
    goals: number
    assists: number
    yellowCards: number
    redCards: number
    shotsOnTarget: number
    shotsTotal: number
    foulsCommitted: number
    foulsDrawn: number
    tackles: number
    ratingSum: number
  }> = {}

  for (const [country, cfg] of Object.entries(NATIONAL_TEAMS)) {
    const teamId = await resolveNationalTeamId(country, cfg.id)
    if (!teamId) continue

    const fixturesData = await apiFetch(`/fixtures?team=${teamId}&last=10`)
    const fixtures = (fixturesData?.response ?? []) as {
      fixture: { id: number; date: string; status: { short: string } }
      league: { name: string }
      teams: { home: { name: string; id: number }; away: { name: string; id: number } }
      goals: { home: number | null; away: number | null }
    }[]

    const recent = fixtures.filter((f) => {
      const date = new Date(f.fixture.date)
      return f.fixture.status.short === 'FT' && date >= since && f.league.name !== 'World Cup'
    }).slice(0, 5) // hasta 5 partidos (amistosos + clasificatorios recientes)

    if (recent.length === 0) {
      console.log(`[sync] recent_nt: ${country} - 0 partidos no-WC en los últimos 120 días`)
      continue
    }
    console.log(`[sync] recent_nt: ${country} - ${recent.length} partidos recientes`)
    if (!teamAcc[country]) teamAcc[country] = emptyRecentAccumulator(cfg.flag)

    for (const f of recent) {
      const isHome = f.teams.home.id === teamId || f.teams.home.name === country
      teamAcc[country].matches++
      teamAcc[country].goalsFor += isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0)
      teamAcc[country].goalsAgainst += isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0)

      try {
        const statsData = await apiFetch(`/fixtures/statistics?fixture=${f.fixture.id}`)
        const stats = (statsData?.response ?? []) as { team: { id: number; name: string }; statistics: { type: string; value: unknown }[] }[]
        const ownStats = stats.find((s) => s.team.id === teamId || s.team.name === country)
        for (const s of ownStats?.statistics ?? []) {
          const val = typeof s.value === 'number' ? s.value : parseInt(String(s.value ?? '0')) || 0
          if (s.type === 'Corner Kicks') teamAcc[country].corners += val
          if (s.type === 'Yellow Cards') teamAcc[country].yellowCards += val
          if (s.type === 'Fouls') teamAcc[country].foulsCommitted += val
          if (s.type === 'Total Shots') teamAcc[country].shotsTotal += val
          if (s.type === 'Shots on Goal') teamAcc[country].shotsOnTarget += val
          if (s.type === 'Ball Possession') {
            const pct = parseFloat(String(s.value ?? '0').replace('%', '')) || 0
            teamAcc[country].possession.push(pct)
          }
        }

        const playerData = await apiFetch(`/fixtures/players?fixture=${f.fixture.id}`)
        const teams = (playerData?.response ?? []) as { team: { id: number; name: string }; players: { player: { id: number; name: string }; statistics: Record<string, unknown>[] }[] }[]
        const ownPlayers = teams.find((t) => t.team.id === teamId || t.team.name === country)?.players ?? []
        for (const entry of ownPlayers) {
          const player = await prisma.player.findUnique({ where: { externalId: `apif-${entry.player.id}` } })
          if (!player) continue

          const s = entry.statistics?.[0] ?? {}
          const games = s.games as Record<string, unknown> ?? {}
          const goals = s.goals as Record<string, unknown> ?? {}
          const shots = s.shots as Record<string, unknown> ?? {}
          const fouls = s.fouls as Record<string, unknown> ?? {}
          const cards = s.cards as Record<string, unknown> ?? {}
          const tackles = s.tackles as Record<string, unknown> ?? {}

          if (!playerAcc[player.id]) {
            playerAcc[player.id] = {
              playerId: player.id, matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
              shotsOnTarget: 0, shotsTotal: 0, foulsCommitted: 0, foulsDrawn: 0, tackles: 0, ratingSum: 0,
            }
          }
          const acc = playerAcc[player.id]
          acc.matches++
          acc.goals += Number(goals.total ?? 0)
          acc.assists += Number(goals.assists ?? 0)
          acc.yellowCards += Number(cards.yellow ?? 0)
          acc.redCards += Number(cards.red ?? 0)
          acc.shotsOnTarget += Number(shots.on ?? 0)
          acc.shotsTotal += Number(shots.total ?? 0)
          acc.foulsCommitted += Number(fouls.committed ?? 0)
          acc.foulsDrawn += Number(fouls.drawn ?? 0)
          acc.tackles += Number(tackles.total ?? 0)
          acc.ratingSum += parseFloat(String(games.rating ?? '0')) || 0
        }
      } catch { /* ignore one fixture */ }

      await new Promise((r) => setTimeout(r, 120))
    }
  }

  for (const [country, s] of Object.entries(teamAcc)) {
    const m = Math.max(s.matches, 1)
    const possession = s.possession.length > 0 ? s.possession.reduce((a, b) => a + b, 0) / s.possession.length : 0
    await prisma.teamRecentStats.upsert({
      where: { country },
      update: {
        flag: s.flag, matches: s.matches, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        corners: s.corners, yellowCards: s.yellowCards, foulsCommitted: s.foulsCommitted,
        shotsTotal: s.shotsTotal, shotsOnTarget: s.shotsOnTarget, possession,
        cornersPerMatch: s.corners / m, yellowsPerMatch: s.yellowCards / m,
        shotsPerMatch: s.shotsTotal / m, goalsForPerMatch: s.goalsFor / m,
      },
      create: {
        country, flag: s.flag, matches: s.matches, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        corners: s.corners, yellowCards: s.yellowCards, foulsCommitted: s.foulsCommitted,
        shotsTotal: s.shotsTotal, shotsOnTarget: s.shotsOnTarget, possession,
        cornersPerMatch: s.corners / m, yellowsPerMatch: s.yellowCards / m,
        shotsPerMatch: s.shotsTotal / m, goalsForPerMatch: s.goalsFor / m,
      },
    })
  }

  for (const acc of Object.values(playerAcc)) {
    const rating = acc.matches > 0 ? acc.ratingSum / acc.matches : 0
    const goalsPerMatch = acc.matches > 0 ? acc.goals / acc.matches : 0
    const weightedScore = rating * 0.4 + goalsPerMatch * 20 * 0.4 + (acc.shotsOnTarget / Math.max(acc.matches, 1)) * 0.2
    await prisma.playerStats.upsert({
      where: { playerId_period: { playerId: acc.playerId, period: 'recent_nt' } },
      update: {
        matches: acc.matches, goals: acc.goals, assists: acc.assists, rating, goalsPerMatch,
        shotsOnTarget: acc.shotsOnTarget, shotsTotal: acc.shotsTotal,
        foulsCommitted: acc.foulsCommitted, foulsDrawn: acc.foulsDrawn,
        yellowCards: acc.yellowCards, redCards: acc.redCards, tackles: acc.tackles,
        weightedScore,
      },
      create: {
        playerId: acc.playerId, period: 'recent_nt',
        matches: acc.matches, goals: acc.goals, assists: acc.assists, rating, goalsPerMatch,
        shotsOnTarget: acc.shotsOnTarget, shotsTotal: acc.shotsTotal,
        foulsCommitted: acc.foulsCommitted, foulsDrawn: acc.foulsDrawn,
        yellowCards: acc.yellowCards, redCards: acc.redCards, tackles: acc.tackles,
        weightedScore,
      },
    })
  }

  console.log(`[sync] Recent international form: ${Object.keys(teamAcc).length} teams, ${Object.keys(playerAcc).length} players.`)
}

// ─── Team stats sync: acumula stats del Mundial por equipo ───────────────────
export async function syncTeamStats() {
  if (!API_KEY) return

  // Obtener todos los partidos finalizados del Mundial
  const data = await apiFetch('/fixtures?league=1&season=2026&status=FT')
  const fixtures: Record<string, unknown>[] = data?.response ?? []
  if (fixtures.length === 0) return

  // Acumular stats por equipo a partir de las estadísticas de cada partido
  const acc: Record<string, {
    flag: string; matches: number; goalsFor: number; goalsAgainst: number
    corners: number; yellowCards: number; redCards: number; offsides: number
    foulsCommitted: number; shotsTotal: number; shotsOnTarget: number; possession: number[]
  }> = {}

  for (const f of fixtures) {
    const fixture = f as { fixture: { id: number }; teams: { home: { name: string }; away: { name: string } }; goals: { home: number; away: number } }
    const homeCountry = fixture.teams.home.name
    const awayCountry = fixture.teams.away.name

    // Inicializar si no existen
    for (const [country, isHome] of [[homeCountry, true], [awayCountry, false]] as [string, boolean][]) {
      if (!acc[country]) {
        acc[country] = { flag: NATIONAL_TEAMS[country]?.flag ?? '🏳️', matches: 0, goalsFor: 0, goalsAgainst: 0, corners: 0, yellowCards: 0, redCards: 0, offsides: 0, foulsCommitted: 0, shotsTotal: 0, shotsOnTarget: 0, possession: [] }
      }
      acc[country].matches++
      acc[country].goalsFor     += isHome ? (fixture.goals.home ?? 0) : (fixture.goals.away ?? 0)
      acc[country].goalsAgainst += isHome ? (fixture.goals.away ?? 0) : (fixture.goals.home ?? 0)
    }

    // Fetch stats del partido (corners, amarillas, etc.)
    try {
      const statsData = await apiFetch(`/fixtures/statistics?fixture=${fixture.fixture.id}`)
      const stats: Record<string, unknown>[] = statsData?.response ?? []

      for (const teamStats of stats) {
        const ts = teamStats as { team: { name: string }; statistics: { type: string; value: unknown }[] }
        const country = ts.team.name
        if (!acc[country]) continue

        for (const s of ts.statistics) {
          const val = typeof s.value === 'number' ? s.value : parseInt(String(s.value ?? '0')) || 0
          if (s.type === 'Corner Kicks')       acc[country].corners       += val
          if (s.type === 'Yellow Cards')        acc[country].yellowCards   += val
          if (s.type === 'Red Cards')           acc[country].redCards      += val
          if (s.type === 'Offsides')            acc[country].offsides      += val
          if (s.type === 'Fouls')               acc[country].foulsCommitted+= val
          if (s.type === 'Total Shots')         acc[country].shotsTotal    += val
          if (s.type === 'Shots on Goal')       acc[country].shotsOnTarget += val
          if (s.type === 'Ball Possession') {
            const pct = parseFloat(String(s.value ?? '0').replace('%', '')) || 0
            acc[country].possession.push(pct)
          }
        }
      }
      await new Promise((r) => setTimeout(r, 150))
    } catch { /* ignorar si falla un partido */ }
  }

  // Guardar en DB
  for (const [country, s] of Object.entries(acc)) {
    const m = Math.max(s.matches, 1)
    const avgPossession = s.possession.length > 0 ? s.possession.reduce((a, b) => a + b, 0) / s.possession.length : 0
    await prisma.teamStats.upsert({
      where:  { country },
      update: {
        flag: s.flag, matches: s.matches,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        corners: s.corners, yellowCards: s.yellowCards, redCards: s.redCards,
        offsides: s.offsides, foulsCommitted: s.foulsCommitted,
        shotsTotal: s.shotsTotal, shotsOnTarget: s.shotsOnTarget,
        possession: avgPossession,
        cornersPerMatch:  s.corners       / m,
        yellowsPerMatch:  s.yellowCards   / m,
        offsidesPerMatch: s.offsides      / m,
        shotsPerMatch:    s.shotsTotal    / m,
        goalsForPerMatch: s.goalsFor      / m,
      },
      create: {
        country, flag: s.flag, matches: s.matches,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        corners: s.corners, yellowCards: s.yellowCards, redCards: s.redCards,
        offsides: s.offsides, foulsCommitted: s.foulsCommitted,
        shotsTotal: s.shotsTotal, shotsOnTarget: s.shotsOnTarget,
        possession: avgPossession,
        cornersPerMatch:  s.corners       / m,
        yellowsPerMatch:  s.yellowCards   / m,
        offsidesPerMatch: s.offsides      / m,
        shotsPerMatch:    s.shotsTotal    / m,
        goalsForPerMatch: s.goalsFor      / m,
      },
    })
  }
  console.log(`[sync] TeamStats actualizadas para ${Object.keys(acc).length} equipos.`)
}

// ─── Lineup sync: corre 30 min antes del partido ─────────────────────────────
export async function syncUpcomingLineups() {
  if (!API_KEY) return { fetched: 0 }

  const now = new Date()
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000)   // hasta 10 min antes del KO
  const windowEnd   = new Date(now.getTime() + 40 * 60 * 1000)   // hasta 40 min antes del KO

  // Partidos que empiezan en los próximos 40 min o empezaron hace 10 min (lineups ya publicadas)
  const upcoming = await prisma.match.findMany({
    where: {
      status: 'scheduled',
      date: { gte: windowStart, lte: windowEnd },
      externalId: { not: null },
      lineupFetchedAt: null, // solo los que aún no tienen lineup
    },
  })

  if (upcoming.length === 0) return { fetched: 0 }

  let fetched = 0
  for (const match of upcoming) {
    try {
      const data = await apiFetch(`/fixtures/lineups?fixture=${match.externalId}`)
      const lineups: Record<string, unknown>[] = data?.response ?? []
      if (lineups.length < 2) continue

      type LineupPlayer = { player: { id: number; name: string; number: number }; pos: string }
      const mapXI = (lineup: Record<string, unknown>) =>
        ((lineup.startXI as LineupPlayer[]) ?? []).map((e) => ({
          id:       e.player.id,
          name:     e.player.name,
          number:   e.player.number,
          position: e.pos,
        }))

      await prisma.match.update({
        where: { id: match.id },
        data: {
          lineupHome:      mapXI(lineups[0] as Record<string, unknown>),
          lineupAway:      mapXI(lineups[1] as Record<string, unknown>),
          lineupFetchedAt: new Date(),
        },
      })
      fetched++
      console.log(`[lineup] ${match.homeTeam} vs ${match.awayTeam} - formaciones guardadas`)

      // Push notification a todos los suscriptores
      try {
        const { sendPushToAll } = await import('./push')
        await sendPushToAll(
          `⚽ Formación confirmada`,
          `${match.homeTeam} vs ${match.awayTeam} - el XI oficial está disponible`,
          `/matches/${match.id}`,
        )
      } catch { /* push opcional */ }
    } catch (e) {
      console.error(`[lineup] error fetching lineup for ${match.externalId}:`, e)
    }
  }
  return { fetched }
}

// ─── Post-match: stats WC de jugadores + liquidar picks ──────────────────────
export async function syncPostMatch() {
  if (!API_KEY) return

  // Partidos que terminaron en las últimas 3 horas y aún no tienen stats de jugadores
  const recent = new Date(Date.now() - 3 * 3600 * 1000)
  const finished = await prisma.match.findMany({
    where: {
      status: 'finished',
      externalId: { not: null },
      date: { gte: recent },
    },
  })
  if (finished.length === 0) return

  const { settleMatchPicks } = await import('./track')

  for (const match of finished) {
    try {
      // Fetch stats de jugadores del partido
      const data = await apiFetch(`/fixtures/players?fixture=${match.externalId}`)
      const teams: Record<string, unknown>[] = data?.response ?? []

      for (const team of teams) {
        const t = team as { players: { player: { name: string; id: number }; statistics: Record<string, unknown>[] }[] }
        for (const entry of t.players ?? []) {
          const playerName = entry.player.name
          const s = entry.statistics?.[0] ?? {}

          // Buscar jugador por nombre aproximado
          const player = await prisma.player.findFirst({
            where: { name: { contains: playerName.split(' ').pop() ?? playerName } },
          })
          if (!player) continue

          const games    = s.games    as Record<string, unknown> ?? {}
          const goals    = s.goals    as Record<string, unknown> ?? {}
          const shots    = s.shots    as Record<string, unknown> ?? {}
          const cards    = s.cards    as Record<string, unknown> ?? {}
          const fouls    = s.fouls    as Record<string, unknown> ?? {}
          const tackles  = s.tackles  as Record<string, unknown> ?? {}
          const passes   = s.passes   as Record<string, unknown> ?? {}

          const matchStat = {
            goals:          Number(goals.total     ?? 0),
            assists:        Number(goals.assists    ?? 0),
            yellowCards:    Number(cards.yellow     ?? 0),
            redCards:       Number(cards.red        ?? 0),
            shotsOnTarget:  Number(shots.on         ?? 0),
            foulsCommitted: Number(fouls.committed  ?? 0),
            foulsDrawn:      Number(fouls.drawn      ?? 0),
            tackles:        Number(tackles.total    ?? 0),
            passAccuracy:   parseFloat(String(passes.accuracy ?? '0')) || 0,
            rating:         parseFloat(String(games.rating    ?? '0')) || 0,
            minutesPlayed:  Number(games.minutes    ?? 90),
          }

          await prisma.worldCupMatchStats.upsert({
            where:  { playerId_matchId: { playerId: player.id, matchId: match.id } },
            update: matchStat,
            create: { playerId: player.id, matchId: match.id, ...matchStat },
          })

          // Actualizar acumulado WC del jugador
          const all = await prisma.worldCupMatchStats.findMany({ where: { playerId: player.id } })
          const n = all.length || 1
          await prisma.worldCupStats.upsert({
            where:  { playerId: player.id },
            update: {
              matches:        all.length,
              goals:          all.reduce((s, x) => s + x.goals, 0),
              assists:        all.reduce((s, x) => s + x.assists, 0),
              yellowCards:    all.reduce((s, x) => s + x.yellowCards, 0),
              redCards:       all.reduce((s, x) => s + x.redCards, 0),
              shotsOnTarget:  all.reduce((s, x) => s + x.shotsOnTarget, 0),
              foulsCommitted: all.reduce((s, x) => s + x.foulsCommitted, 0),
              foulsDrawn:      all.reduce((s, x) => s + x.foulsDrawn, 0),
              tackles:        all.reduce((s, x) => s + x.tackles, 0),
              rating:         all.reduce((s, x) => s + x.rating, 0) / n,
            },
            create: {
              playerId: player.id,
              matches:        all.length,
              goals:          all.reduce((s, x) => s + x.goals, 0),
              assists:        all.reduce((s, x) => s + x.assists, 0),
              yellowCards:    all.reduce((s, x) => s + x.yellowCards, 0),
              redCards:       all.reduce((s, x) => s + x.redCards, 0),
              shotsOnTarget:  all.reduce((s, x) => s + x.shotsOnTarget, 0),
              foulsCommitted: all.reduce((s, x) => s + x.foulsCommitted, 0),
              foulsDrawn:      all.reduce((s, x) => s + x.foulsDrawn, 0),
              tackles:        all.reduce((s, x) => s + x.tackles, 0),
              rating:         all.reduce((s, x) => s + x.rating, 0) / n,
            },
          })
        }
      }

      // Liquidar picks pendientes de este partido
      if (match.externalId) {
        await settleMatchPicks(match.id, match.externalId)
      }

      console.log(`[post-match] ${match.homeTeam} vs ${match.awayTeam} procesado`)
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      console.error(`[post-match] error en ${match.externalId}:`, e)
    }
  }
}

// ─── Daily sync: jugadores + partidos, una vez por día ───────────────────────
export async function runDailySync() {
  console.log('[cron] Daily sync running...')
  await syncMatches()
  await syncTeamStats()
  // Refresca stats de jugadores solo si nunca se ha hecho o hace +24h
  const last = await prisma.syncLog.findFirst({ where: { status: 'success' }, orderBy: { createdAt: 'desc' } })
  const age = last ? (Date.now() - last.createdAt.getTime()) / 3600000 : 999
  if (age >= 24) {
    await syncPlayers()
    const log = await prisma.syncLog.create({ data: { type: 'daily', status: 'running' } })
    await prisma.syncLog.update({ where: { id: log.id }, data: { status: 'success', message: 'daily' } })
  }
  console.log('[cron] Daily sync done.')
}

// ─── Mock data fallback (sin API key) ────────────────────────────────────────
async function seedMockIfEmpty() {
  const count = await prisma.player.count()
  if (count > 0) return
  console.log('[sync] Seeding mock players...')

  const MOCK = [
    { name: 'Kylian Mbappé',     country: 'France',    club: 'Real Madrid',        position: 'FWD', flag: '🇫🇷', starterRate: 0.98, s2m: { goals:9,  assists:3,  matches:10, rating:8.2, shotsOnTarget:22, shotsTotal:38, passAccuracy:81, foulsCommitted:8,  yellowCards:1, redCards:0, tackles:6,  interceptions:2,  dribbles:24 } },
    { name: 'Erling Haaland',    country: 'Norway',    club: 'Manchester City',     position: 'FWD', flag: '🇳🇴', starterRate: 0.96, s2m: { goals:12, assists:2,  matches:10, rating:8.4, shotsOnTarget:26, shotsTotal:40, passAccuracy:72, foulsCommitted:6,  yellowCards:0, redCards:0, tackles:3,  interceptions:1,  dribbles:8  } },
    { name: 'Vinicius Jr.',      country: 'Brazil',    club: 'Real Madrid',        position: 'FWD', flag: '🇧🇷', starterRate: 0.97, s2m: { goals:10, assists:6,  matches:10, rating:8.3, shotsOnTarget:24, shotsTotal:41, passAccuracy:78, foulsCommitted:9,  yellowCards:1, redCards:0, tackles:7,  interceptions:3,  dribbles:48 } },
    { name: 'Jude Bellingham',   country: 'England',   club: 'Real Madrid',        position: 'MID', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', starterRate: 0.98, s2m: { goals:8,  assists:5,  matches:10, rating:8.4, shotsOnTarget:18, shotsTotal:30, passAccuracy:87, foulsCommitted:6,  yellowCards:1, redCards:0, tackles:20, interceptions:12, dribbles:22 } },
    { name: 'Lamine Yamal',      country: 'Spain',     club: 'FC Barcelona',       position: 'FWD', flag: '🇪🇸', starterRate: 0.95, s2m: { goals:8,  assists:9,  matches:10, rating:8.5, shotsOnTarget:19, shotsTotal:33, passAccuracy:84, foulsCommitted:4,  yellowCards:0, redCards:0, tackles:8,  interceptions:4,  dribbles:42 } },
    { name: 'Lionel Messi',      country: 'Argentina', club: 'Inter Miami',        position: 'FWD', flag: '🇦🇷', starterRate: 0.96, s2m: { goals:7,  assists:8,  matches:9,  rating:8.4, shotsOnTarget:17, shotsTotal:29, passAccuracy:86, foulsCommitted:5,  yellowCards:0, redCards:0, tackles:5,  interceptions:3,  dribbles:28 } },
    { name: 'Harry Kane',        country: 'England',   club: 'Bayern Munich',      position: 'FWD', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', starterRate: 0.98, s2m: { goals:11, assists:4,  matches:10, rating:8.1, shotsOnTarget:25, shotsTotal:40, passAccuracy:79, foulsCommitted:7,  yellowCards:0, redCards:0, tackles:5,  interceptions:2,  dribbles:10 } },
    { name: 'Rodri',             country: 'Spain',     club: 'Manchester City',    position: 'MID', flag: '🇪🇸', starterRate: 0.94, s2m: { goals:2,  assists:4,  matches:10, rating:8.1, shotsOnTarget:5,  shotsTotal:10, passAccuracy:93, foulsCommitted:9,  yellowCards:2, redCards:0, tackles:28, interceptions:20, dribbles:6  } },
    { name: 'Mohamed Salah',     country: 'Egypt',     club: 'Liverpool',          position: 'FWD', flag: '🇪🇬', starterRate: 0.95, s2m: { goals:9,  assists:7,  matches:10, rating:8.2, shotsOnTarget:20, shotsTotal:34, passAccuracy:81, foulsCommitted:7,  yellowCards:0, redCards:0, tackles:8,  interceptions:4,  dribbles:26 } },
    { name: 'Florian Wirtz',     country: 'Germany',   club: 'Bayer Leverkusen',   position: 'MID', flag: '🇩🇪', starterRate: 0.94, s2m: { goals:7,  assists:9,  matches:10, rating:8.3, shotsOnTarget:15, shotsTotal:26, passAccuracy:86, foulsCommitted:5,  yellowCards:0, redCards:0, tackles:11, interceptions:6,  dribbles:32 } },
    { name: 'Sadio Mané',        country: 'Senegal',   club: 'Al-Nassr',           position: 'FWD', flag: '🇸🇳', starterRate: 0.96, s2m: { goals:8,  assists:3,  matches:9,  rating:7.8, shotsOnTarget:19, shotsTotal:32, passAccuracy:78, foulsCommitted:10, yellowCards:1, redCards:0, tackles:11, interceptions:5,  dribbles:29 } },
    { name: 'Darwin Núñez',      country: 'Uruguay',   club: 'Liverpool',          position: 'FWD', flag: '🇺🇾', starterRate: 0.92, s2m: { goals:8,  assists:2,  matches:9,  rating:7.7, shotsOnTarget:20, shotsTotal:34, passAccuracy:72, foulsCommitted:14, yellowCards:2, redCards:0, tackles:6,  interceptions:2,  dribbles:16 } },
    { name: 'Achraf Hakimi',     country: 'Morocco',   club: 'Paris Saint-Germain',position: 'DEF', flag: '🇲🇦', starterRate: 0.97, s2m: { goals:3,  assists:7,  matches:10, rating:7.9, shotsOnTarget:7,  shotsTotal:13, passAccuracy:84, foulsCommitted:8,  yellowCards:2, redCards:0, tackles:17, interceptions:11, dribbles:20 } },
    { name: 'Cristiano Ronaldo', country: 'Portugal',  club: 'Al-Nassr',           position: 'FWD', flag: '🇵🇹', starterRate: 0.97, s2m: { goals:9,  assists:1,  matches:9,  rating:7.9, shotsOnTarget:23, shotsTotal:39, passAccuracy:79, foulsCommitted:7,  yellowCards:1, redCards:0, tackles:4,  interceptions:2,  dribbles:11 } },
    { name: 'Federico Valverde', country: 'Uruguay',   club: 'Real Madrid',        position: 'MID', flag: '🇺🇾', starterRate: 0.95, s2m: { goals:5,  assists:6,  matches:10, rating:8.0, shotsOnTarget:12, shotsTotal:22, passAccuracy:88, foulsCommitted:8,  yellowCards:2, redCards:0, tackles:25, interceptions:15, dribbles:18 } },
  ]

  for (const p of MOCK) {
    const externalId = `mock-${p.name.toLowerCase().replace(/\s/g, '-')}`
    const player = await prisma.player.upsert({
      where:  { externalId },
      update: {},
      create: { externalId, name: p.name, country: p.country, club: p.club, position: p.position, flag: p.flag, status: 'active', starterRate: p.starterRate },
    })

    const s = { foulsDrawn: 0, ...p.s2m }
    const gpm2 = s.matches > 0 ? s.goals / s.matches : 0
    const score2 = s.rating * 0.4 + gpm2 * 20 * 0.4 + (s.shotsOnTarget / s.matches) * 0.2

    await prisma.playerStats.upsert({
      where:  { playerId_period: { playerId: player.id, period: '2m' } },
      update: { ...s, goalsPerMatch: gpm2, weightedScore: score2 },
      create: { playerId: player.id, period: '2m', ...s, goalsPerMatch: gpm2, weightedScore: score2 },
    })

    const s6 = { ...s, matches: Math.round(s.matches * 2.5), goals: Math.round(s.goals * 2.4), assists: Math.round(s.assists * 2.4), shotsOnTarget: Math.round(s.shotsOnTarget * 2.4), shotsTotal: Math.round(s.shotsTotal * 2.4), foulsCommitted: Math.round(s.foulsCommitted * 2.4), foulsDrawn: Math.round((s.foulsDrawn ?? 0) * 2.4), yellowCards: Math.round(s.yellowCards * 2.4), tackles: Math.round(s.tackles * 2.4), interceptions: Math.round(s.interceptions * 2.4), dribbles: Math.round(s.dribbles * 2.4) }
    const gpm6 = s6.matches > 0 ? s6.goals / s6.matches : 0
    const score6 = s6.rating * 0.4 + gpm6 * 20 * 0.4 + (s6.shotsOnTarget / s6.matches) * 0.2

    await prisma.playerStats.upsert({
      where:  { playerId_period: { playerId: player.id, period: '6m' } },
      update: { ...s6, goalsPerMatch: gpm6, weightedScore: score6 },
      create: { playerId: player.id, period: '6m', ...s6, goalsPerMatch: gpm6, weightedScore: score6 },
    })
  }

  // Seed mock matches
  const MATCHES = [
    { h: 'France',    a: 'Brazil',    hf: '🇫🇷', af: '🇧🇷', date: '2026-06-12T20:00:00Z', result: '1-2', status: 'finished', group: 'A' },
    { h: 'Spain',     a: 'Germany',   hf: '🇪🇸', af: '🇩🇪', date: '2026-06-13T17:00:00Z', result: '2-1', status: 'finished', group: 'B' },
    { h: 'Argentina', a: 'Portugal',  hf: '🇦🇷', af: '🇵🇹', date: '2026-06-14T20:00:00Z', result: '2-0', status: 'finished', group: 'C' },
    { h: 'Senegal',   a: 'Morocco',   hf: '🇸🇳', af: '🇲🇦', date: '2026-06-15T17:00:00Z', result: '1-1', status: 'finished', group: 'D' },
    { h: 'England',   a: 'Uruguay',   hf: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', af: '🇺🇾', date: '2026-06-06T18:00:00Z', result: null,  status: 'live',     group: 'E' },
    { h: 'Senegal',   a: 'Uruguay',   hf: '🇸🇳', af: '🇺🇾', date: '2026-06-09T20:00:00Z', result: null,  status: 'scheduled', group: 'D' },
    { h: 'France',    a: 'Germany',   hf: '🇫🇷', af: '🇩🇪', date: '2026-06-10T17:00:00Z', result: null,  status: 'scheduled', group: 'A' },
    { h: 'Brazil',    a: 'Argentina', hf: '🇧🇷', af: '🇦🇷', date: '2026-06-11T20:00:00Z', result: null,  status: 'scheduled', group: 'C' },
    { h: 'Spain',     a: 'Portugal',  hf: '🇪🇸', af: '🇵🇹', date: '2026-06-12T17:00:00Z', result: null,  status: 'scheduled', group: 'B' },
    { h: 'Morocco',   a: 'England',   hf: '🇲🇦', af: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', date: '2026-06-13T20:00:00Z', result: null,  status: 'scheduled', group: 'E' },
  ]
  for (const m of MATCHES) {
    const externalId = `mock-${m.h}-${m.a}`
    await prisma.match.upsert({
      where:  { externalId },
      update: {},
      create: { externalId, homeTeam: m.h, awayTeam: m.a, homeFlag: m.hf, awayFlag: m.af, date: new Date(m.date), result: m.result, status: m.status, competition: 'FIFA World Cup 2026', round: 'Group Stage', group: m.group },
    })
  }
  console.log('[sync] Mock data seeded.')
}

export async function seedPlayersIfEmpty() {
  const count = await prisma.player.count()
  if (count > 0) return
  if (API_KEY) {
    await syncPlayers()
    await syncMatches()
  } else {
    await seedMockIfEmpty()
  }
}
