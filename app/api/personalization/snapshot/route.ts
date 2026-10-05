import {getLiveScoreboard,getLeagueInjuryWatch} from "@/lib/live-nfl";
export const revalidate=60;
export async function GET(){const [board,injuries]=await Promise.all([getLiveScoreboard(),getLeagueInjuryWatch()]);return Response.json({games:board.games,injuries:injuries.rows,updatedAt:new Date().toISOString()})}