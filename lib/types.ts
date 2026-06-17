export type ApiPlayer = {
  id: string
  name: string
  ranking: number | null
  /** Rating "weight" (experience) before the tournament; 0 for a new player. */
  weight: number
  provisional: boolean
  /** Link to the player's ligas.io profile, if resolvable. */
  profileUrl: string | null
}

export type ApiMatch = {
  gameId: number | string
  stageName: string
  winnerId: string
  loserId: string
  score: string
}

export type TournamentInfo = {
  id: string
  name: string
  orgName: string | null
  orgAlias: string
  location: string | null
  start: string | null
  format: string | null
  /** True when ligas has already processed this tournament into player ratings. */
  processed: boolean
  /** Link back to the tournament on ligas.io. */
  url: string
}

export type TournamentResponse = {
  tournament: TournamentInfo
  players: ApiPlayer[]
  matches: ApiMatch[]
}
