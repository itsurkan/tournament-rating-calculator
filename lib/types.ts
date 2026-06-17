export type ApiPlayer = {
  id: string
  name: string
  ranking: number | null
  provisional: boolean
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
}

export type TournamentResponse = {
  tournament: TournamentInfo
  players: ApiPlayer[]
  matches: ApiMatch[]
}
