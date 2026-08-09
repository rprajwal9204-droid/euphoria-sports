"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const defaultClubs = [
  "Falcons",
  "Eagles",
  "Thunderbirds",
  "Griffins",
  "Phoenix",
];

const eventGroups = {
  "Men's Team Sports": [
    "Cricket",
    "Football",
    "Volleyball",
    "Basketball",
    "Kho Kho",
  ],
  "Women's Team Sports": [
    "Cricket",
    "Throwball",
    "Basketball",
    "Kho Kho",
  ],
  "Men's Doubles": [
    "Tennis",
    "Table Tennis",
    "Badminton",
    "Carrom",
  ],
  "Women's Doubles": [
    "Tennis",
    "Table Tennis",
    "Badminton",
    "Carrom",
  ],
  "Mixed Doubles": ["Tennis"],
  "Men's Individual": [
    "Marathon",
    "100m",
    "200m",
    "400m",
    "Long Jump",
    "Triple Jump",
    "Table Tennis",
    "Cycling",
  ],
  "Women's Individual": [
    "Marathon",
    "100m",
    "200m",
    "400m",
    "Long Jump",
    "Triple Jump",
    "Table Tennis",
    "Cycling",
  ],
};

/* ============================================================
   HELPERS
============================================================ */

function isFinal(status) {
  return String(status || "").toLowerCase() === "final";
}

function isTeamEvent(event) {
  if (!event) return false;

  const category = String(event.category || "").toLowerCase();
  const pointsType = String(event.points_type || "").toLowerCase();

  return (
    category.includes("team") ||
    pointsType.includes("team")
  );
}

function numericScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

/*
  Cricket overs conversion.

  Example:
  20       = 20 overs
  19.3     = 19 overs 3 balls
  19.6     = INVALID cricket notation

  Returns overs as decimal-equivalent overs.
  19.3 means 19 overs + 3/6 overs.
*/
function cricketOversToNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (!text) return null;

  if (!text.includes(".")) {
    const overs = Number(text);

    return Number.isFinite(overs) ? overs : null;
  }

  const parts = text.split(".");

  const overs = Number(parts[0]);
  const balls = Number(parts[1]);

  if (
    !Number.isFinite(overs) ||
    !Number.isFinite(balls) ||
    balls < 0 ||
    balls > 5
  ) {
    return null;
  }

  return overs + balls / 6;
}

/*
  Gets cricket innings information for each club.

  We use batting_first_club_id so the website knows
  which innings belongs to which club.
*/
function getCricketStats(match) {
  const battingFirst =
    match.batting_first_club_id !== null &&
    match.batting_first_club_id !== undefined &&
    match.batting_first_club_id !== ""
      ? Number(match.batting_first_club_id)
      : null;

  const clubA = Number(match.club_a_id);
  const clubB = Number(match.club_b_id);

  let firstRuns = numericScore(
    match.innings1_runs
  );

  let secondRuns = numericScore(
    match.innings2_runs
  );

  let firstOvers = cricketOversToNumber(
    match.innings1_overs
  );

  let secondOvers = cricketOversToNumber(
    match.innings2_overs
  );

  /*
    Fallback to innings_a / innings_b fields
    if the newer innings1/innings2 fields
    are not populated.
  */

  if (firstRuns === null) {
    firstRuns = numericScore(match.innings_a_runs);
  }

  if (secondRuns === null) {
    secondRuns = numericScore(match.innings_b_runs);
  }

  if (firstOvers === null) {
    firstOvers = cricketOversToNumber(
      match.innings_a_overs
    );
  }

  if (secondOvers === null) {
    secondOvers = cricketOversToNumber(
      match.innings_b_overs
    );
  }

  /*
    Another fallback using runs_a/runs_b.
  */

  if (firstRuns === null && battingFirst === clubA) {
    firstRuns = numericScore(match.runs_a);
  }

  if (firstRuns === null && battingFirst === clubB) {
    firstRuns = numericScore(match.runs_b);
  }

  if (secondRuns === null && battingFirst === clubA) {
    secondRuns = numericScore(match.runs_b);
  }

  if (secondRuns === null && battingFirst === clubB) {
    secondRuns = numericScore(match.runs_a);
  }

  return {
    battingFirst,
    firstRuns,
    secondRuns,
    firstOvers,
    secondOvers,
  };
}

/*
  Returns the result of a club in a match.
*/
function getResultForClub(match, clubId) {
  const club = Number(clubId);

  const clubA = Number(match.club_a_id);
  const clubB = Number(match.club_b_id);

  const winner =
    match.winner_club_id === null ||
    match.winner_club_id === undefined ||
    match.winner_club_id === ""
      ? null
      : Number(match.winner_club_id);

  if (winner !== null) {
    if (winner === club) {
      return "win";
    }

    return "loss";
  }

  const scoreA = numericScore(match.score_a);
  const scoreB = numericScore(match.score_b);

  if (scoreA !== null && scoreB !== null) {
    if (scoreA === scoreB) {
      return "draw";
    }

    if (club === clubA && scoreA > scoreB) {
      return "win";
    }

    if (club === clubB && scoreB > scoreA) {
      return "win";
    }

    return "loss";
  }

  /*
    Cricket can have scores such as 185/6,
    so use innings runs as fallback.
  */

  const cricket = getCricketStats(match);

  if (
    cricket.firstRuns !== null &&
    cricket.secondRuns !== null &&
    cricket.battingFirst !== null
  ) {
    const firstClub = cricket.battingFirst;

    const secondClub =
      firstClub === clubA ? clubB : clubA;

    if (cricket.firstRuns === cricket.secondRuns) {
      return "draw";
    }

    if (
      club === firstClub &&
      cricket.firstRuns > cricket.secondRuns
    ) {
      return "win";
    }

    if (
      club === secondClub &&
      cricket.secondRuns > cricket.firstRuns
    ) {
      return "win";
    }

    return "loss";
  }

  return "no_result";
}

/* ============================================================
   SPORT POINTS
============================================================ */

function getSportPoints(sport, result) {
  const name = String(sport || "").toLowerCase();

  if (name === "football") {
    if (result === "win") return 3;
    if (result === "draw") return 1;
    return 0;
  }

  if (name === "cricket") {
    if (result === "win") return 2;
    if (result === "no_result") return 1;
    return 0;
  }

  if (name === "volleyball") {
    if (result === "win") return 3;
    return 0;
  }

  if (name === "basketball") {
    if (result === "win") return 2;
    if (result === "loss") return 1;
    return 0;
  }

  if (name === "throwball") {
    if (result === "win") return 2;
    return 0;
  }

  if (name === "kho kho") {
    if (result === "win") return 2;
    if (result === "draw") return 1;
    return 0;
  }

  if (result === "win") return 3;
  if (result === "draw") return 1;

  return 0;
}

/* ============================================================
   BUILD LEADERBOARD
============================================================ */

function buildSportLeaderboard(
  sport,
  eventId,
  matches,
  clubRows
) {
  const table = {};

  clubRows.forEach((club) => {
    table[club.id] = {
      id: club.id,
      name: club.name,

      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      noResults: 0,

      pf: 0,
      pa: 0,
      pd: 0,

      cricketRunsFor: 0,
      cricketOversFor: 0,
      cricketRunsAgainst: 0,
      cricketOversAgainst: 0,

      nrr: 0,

      points: 0,
    };
  });

  const completed = matches.filter(
    (match) =>
      isFinal(match.status) &&
      Number(match.event_id) === Number(eventId)
  );

  completed.forEach((match) => {
    const clubA = table[match.club_a_id];
    const clubB = table[match.club_b_id];

    if (!clubA || !clubB) return;

    clubA.played += 1;
    clubB.played += 1;

    const resultA = getResultForClub(
      match,
      match.club_a_id
    );

    const resultB = getResultForClub(
      match,
      match.club_b_id
    );

    if (resultA === "win") clubA.wins += 1;
    if (resultB === "win") clubB.wins += 1;

    if (resultA === "draw") clubA.draws += 1;
    if (resultB === "draw") clubB.draws += 1;

    if (resultA === "loss") clubA.losses += 1;
    if (resultB === "loss") clubB.losses += 1;

    if (resultA === "no_result") {
      clubA.noResults += 1;
    }

    if (resultB === "no_result") {
      clubB.noResults += 1;
    }

    /*
      Normal numeric score statistics.
    */

    const scoreA = numericScore(match.score_a);
    const scoreB = numericScore(match.score_b);

    if (
      scoreA !== null &&
      scoreB !== null
    ) {
      clubA.pf += scoreA;
      clubA.pa += scoreB;

      clubB.pf += scoreB;
      clubB.pa += scoreA;
    }

    /*
      Cricket NRR statistics.
    */

    if (
      String(sport || "").toLowerCase() ===
      "cricket"
    ) {
      const cricket = getCricketStats(match);

      if (
        cricket.battingFirst !== null &&
        cricket.firstRuns !== null &&
        cricket.secondRuns !== null &&
        cricket.firstOvers !== null &&
        cricket.secondOvers !== null
      ) {
        const firstClub =
          cricket.battingFirst;

        const secondClub =
          firstClub === Number(match.club_a_id)
            ? Number(match.club_b_id)
            : Number(match.club_a_id);

        const firstRow = table[firstClub];
        const secondRow = table[secondClub];

        if (firstRow && secondRow) {
          firstRow.cricketRunsFor +=
            cricket.firstRuns;

          firstRow.cricketOversFor +=
            cricket.firstOvers;

          firstRow.cricketRunsAgainst +=
            cricket.secondRuns;

          firstRow.cricketOversAgainst +=
            cricket.secondOvers;

          secondRow.cricketRunsFor +=
            cricket.secondRuns;

          secondRow.cricketOversFor +=
            cricket.secondOvers;

          secondRow.cricketRunsAgainst +=
            cricket.firstRuns;

          secondRow.cricketOversAgainst +=
            cricket.firstOvers;
        }
      }
    }

    clubA.points += getSportPoints(
      sport,
      resultA
    );

    clubB.points += getSportPoints(
      sport,
      resultB
    );
  });

  /*
    Calculate NRR.
  */

  Object.values(table).forEach((club) => {
    club.pd = club.pf - club.pa;

    if (
      String(sport || "").toLowerCase() ===
      "cricket"
    ) {
      if (
        club.cricketOversFor > 0 &&
        club.cricketOversAgainst > 0
      ) {
        const runRateFor =
          club.cricketRunsFor /
          club.cricketOversFor;

        const runRateAgainst =
          club.cricketRunsAgainst /
          club.cricketOversAgainst;

        club.nrr =
          runRateFor - runRateAgainst;
      } else {
        club.nrr = 0;
      }
    }
  });

  /*
    Sorting.

    Cricket:
    Points → Wins → NRR → Runs For

    Football:
    Points → Wins → Goal Difference

    Other sports:
    Points → Wins → Point Difference
  */

  const sportName =
    String(sport || "").toLowerCase();

  const rows = Object.values(table).sort(
    (a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }

      if (sportName === "cricket") {
        if (b.nrr !== a.nrr) {
          return b.nrr - a.nrr;
        }

        return (
          b.cricketRunsFor -
          a.cricketRunsFor
        );
      }

      if (b.pd !== a.pd) {
        return b.pd - a.pd;
      }

      if (b.pf !== a.pf) {
        return b.pf - a.pf;
      }

      return a.name.localeCompare(
        b.name
      );
    }
  );

  return {
    rows,
    completedCount: completed.length,
  };
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return "0";
  }

  if (
    Number.isInteger(Number(value))
  ) {
    return Number(value);
  }

  return Number(value).toFixed(1);
}

function formatNRR(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0.000";
  }

  if (number > 0) {
    return `+${number.toFixed(3)}`;
  }

  return number.toFixed(3);
}

/* ============================================================
   MAIN PAGE
============================================================ */

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [points, setPoints] = useState({});
  const [events, setEvents] = useState([]);
  const [clubRows, setClubRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [
    selectedTeamSport,
    setSelectedTeamSport,
  ] = useState("");

  async function load() {
    setLoading(true);

    const [
      {
        data: matchData,
        error: matchError,
      },
      {
        data: resultData,
        error: resultError,
      },
      {
        data: eventData,
        error: eventError,
      },
      {
        data: clubData,
        error: clubError,
      },
    ] = await Promise.all([
      supabase
        .from("matches")
        .select(`
          id,
          event_id,
          club_a_id,
          club_b_id,
          score_a,
          score_b,
          status,
          match_time,
          winner_club_id,

          batting_first_club_id,

          innings1_runs,
          innings1_wickets,
          innings1_overs,

          innings2_runs,
          innings2_wickets,
          innings2_overs,

          runs_a,
          wickets_a,
          overs_a,

          runs_b,
          wickets_b,
          overs_b,

          allotted_overs,

          innings_a_runs,
          innings_a_overs,

          innings_b_runs,
          innings_b_overs,

          events(
            id,
            name,
            gender,
            category,
            points_type
          ),

          club_a:club_a_id(name),
          club_b:club_b_id(name)
        `)
        .order("match_time", {
          ascending: true,
        }),

      supabase
        .from("event_results")
        .select(`
          club_id,
          points,
          clubs(name)
        `),

      supabase
        .from("events")
        .select("*")
        .order("id"),

      supabase
        .from("clubs")
        .select("*")
        .order("id"),
    ]);

    if (matchError) {
      console.error(
        "Matches error:",
        matchError
      );
    }

    if (resultError) {
      console.error(
        "Results error:",
        resultError
      );
    }

    if (eventError) {
      console.error(
        "Events error:",
        eventError
      );
    }

    if (clubError) {
      console.error(
        "Clubs error:",
        clubError
      );
    }

    setMatches(matchData || []);
    setEvents(eventData || []);
    setClubRows(clubData || []);

    /*
      Overall championship points.
    */

    const totals = {};

    (resultData || []).forEach(
      (result) => {
        const name =
          result.clubs?.name;

        if (name) {
          totals[name] =
            (totals[name] || 0) +
            Number(
              result.points || 0
            );
        }
      }
    );

    defaultClubs.forEach(
      (club) => {
        totals[club] =
          totals[club] || 0;
      }
    );

    (clubData || []).forEach(
      (club) => {
        totals[club.name] =
          totals[club.name] || 0;
      }
    );

    setPoints(totals);

    /*
      Select first team sport.
    */

    const teamEvents =
      (eventData || []).filter(
        (event) =>
          isTeamEvent(event)
      );

    if (teamEvents.length > 0) {
      setSelectedTeamSport(
        (current) => {
          if (
            current &&
            teamEvents.some(
              (event) =>
                String(event.id) ===
                String(current)
            )
          ) {
            return current;
          }

          return String(
            teamEvents[0].id
          );
        }
      );
    } else {
      setSelectedTeamSport("");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel =
      supabase
        .channel(
          "euphoria-public-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "matches",
          },
          load
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_results",
          },
          load
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "events",
          },
          load
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  /* ==========================================================
     MATCH GROUPS
  ========================================================== */

  const upcomingMatches =
    matches.filter(
      (match) =>
        String(
          match.status || ""
        ).toLowerCase() ===
        "upcoming"
    );

  const liveMatches =
    matches.filter(
      (match) =>
        String(
          match.status || ""
        ).toLowerCase() ===
        "live"
    );

  const completedMatches =
    matches.filter((match) =>
      isFinal(match.status)
    );

  /* ==========================================================
     OVERALL LEADERBOARD
  ========================================================== */

  const leaderboard = Object.keys(
    points
  ).sort(
    (a, b) =>
      (points[b] || 0) -
      (points[a] || 0)
  );

  /* ==========================================================
     TEAM SPORTS
  ========================================================== */

  const teamSports =
    events.filter((event) =>
      isTeamEvent(event)
    );

  const selectedEvent =
    teamSports.find(
      (event) =>
        String(event.id) ===
        String(
          selectedTeamSport
        )
    );

  let sportLeaderboard = {
    rows: [],
    completedCount: 0,
  };

  if (selectedEvent) {
    sportLeaderboard =
      buildSportLeaderboard(
        selectedEvent.name,
        selectedEvent.id,
        matches,
        clubRows
      );
  }

  const selectedSportName =
    String(
      selectedEvent?.name || ""
    ).toLowerCase();

  const isCricket =
    selectedSportName ===
    "cricket";

  const isFootball =
    selectedSportName ===
    "football";

  const usesPD =
    selectedSportName ===
      "basketball" ||
    selectedSportName ===
      "volleyball";

  /* ==========================================================
     MATCH CARD
  ========================================================== */

  function MatchCard({ match }) {
    return (
      <div className="match">
        <div>
          <b>
            {match.club_a?.name ||
              "TBD"}
          </b>

          <strong>
            {match.score_a || "—"}
          </strong>
        </div>

        <div>
          <b>
            {match.club_b?.name ||
              "TBD"}
          </b>

          <strong>
            {match.score_b || "—"}
          </strong>
        </div>

        <small>
          {match.events?.name}
          {" · "}
          {match.events?.gender}
          {" · "}
          {match.status}
        </small>
      </div>
    );
  }

  /* ==========================================================
     MOBILE LEADERBOARD CARD
  ========================================================== */

  function MobileLeaderboardRow({
    row,
    index,
  }) {
    const medal =
      index === 0
        ? "🥇"
        : index === 1
        ? "🥈"
        : index === 2
        ? "🥉"
        : `${index + 1}`;

    return (
      <div
        className={`mobileStandingsRow ${
          index < 3
            ? "topThree"
            : ""
        }`}
      >
        <div className="mobileRank">
          {medal}
        </div>

        <div className="mobileClub">
          <strong>
            {row.name}
          </strong>

          <div className="mobileStats">
            <span>
              P {row.played}
            </span>

            <span>
              W {row.wins}
            </span>

            {!isCricket &&
              !isFootball && (
                <span>
                  L {row.losses}
                </span>
              )}

            {isCricket && (
              <>
                <span>
                  L {row.losses}
                </span>

                <span>
                  NR {row.noResults}
                </span>
              </>
            )}

            {isFootball && (
              <span>
                L {row.losses}
              </span>
            )}
          </div>

          {isCricket && (
            <div className="mobileSecondary">
              NRR{" "}
              <b>
                {formatNRR(
                  row.nrr
                )}
              </b>
            </div>
          )}

          {isFootball && (
            <div className="mobileSecondary">
              GD{" "}
              <b>
                {formatNumber(
                  row.pd
                )}
              </b>
            </div>
          )}

          {usesPD && (
            <div className="mobileSecondary">
              PD{" "}
              <b>
                {formatNumber(
                  row.pd
                )}
              </b>
            </div>
          )}
        </div>

        <div className="mobilePoints">
          <strong>
            {row.points}
          </strong>

          <small>PTS</small>
        </div>
      </div>
    );
  }

  return (
    <main>

      {/* ======================================================
          STYLES
      ====================================================== */}

      <style jsx>{`
        .standingsDesktop {
          display: block;
          width: 100%;
        }

        .standingsMobile {
          display: none;
        }

        .standingsTable {
          width: 100%;
          border-collapse: collapse;
          margin-top: 18px;
        }

        .standingsTable th {
          text-align: center;
          padding: 11px 8px;
          font-size: 12px;
          opacity: 0.65;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.12);
        }

        .standingsTable td {
          padding: 14px 8px;
          text-align: center;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .standingsTable td.clubCell {
          text-align: left;
          font-weight: 700;
        }

        .topRow {
          background: rgba(
            255,
            255,
            255,
            0.045
          );
        }

        .mobileStandings {
          margin-top: 16px;
        }

        .mobileStandingsRow {
          width: 100%;
          display: grid;
          grid-template-columns:
            36px minmax(0, 1fr) 58px;
          align-items: center;
          gap: 8px;
          padding: 13px 8px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.09);
          box-sizing: border-box;
        }

        .mobileStandingsRow.topThree {
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          border-radius: 10px;
          margin-bottom: 4px;
        }

        .mobileRank {
          text-align: center;
          font-size: 18px;
          font-weight: 800;
        }

        .mobileClub {
          min-width: 0;
        }

        .mobileClub strong {
          display: block;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobileStats {
          display: flex;
          gap: 8px;
          margin-top: 5px;
          font-size: 11px;
          opacity: 0.7;
          flex-wrap: wrap;
        }

        .mobileSecondary {
          margin-top: 4px;
          font-size: 11px;
          opacity: 0.72;
        }

        .mobilePoints {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .mobilePoints strong {
          font-size: 20px;
          line-height: 1;
        }

        .mobilePoints small {
          font-size: 9px;
          margin-top: 3px;
          opacity: 0.6;
        }

        .tableLegend {
          margin-top: 12px;
          font-size: 11px;
          line-height: 1.6;
          opacity: 0.65;
        }

        @media (max-width: 700px) {
          .standingsDesktop {
            display: none;
          }

          .standingsMobile {
            display: block;
          }

          .section {
            width: 100%;
          }
        }
      `}</style>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header>
        <div className="logo">
          EUPHORIA{" "}
          <span>SPORTS</span>
        </div>

        <a href="/admin">
          ADMIN
        </a>
      </header>

      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="hero">
        <small>
          INTER-CLUB SPORTS
          CHAMPIONSHIP
        </small>

        <h1>
          THE GAME
          <br />
          IS ON.
        </h1>

        <p>
          Live scores, results and
          the race for the Euphoria
          Club Championship.
        </p>
      </section>

      <section className="wrap">

        {/* ====================================================
            LIVE + UPCOMING
        ==================================================== */}

        <div className="grid">

          <div className="card">
            <div className="live">
              🔴 LIVE
            </div>

            <h2>
              Live Matches
            </h2>

            {loading ? (
              <p>Loading...</p>
            ) : liveMatches.length ===
              0 ? (
              <p className="muted">
                No live matches right
                now.
              </p>
            ) : (
              liveMatches.map(
                (match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                  />
                )
              )
            )}
          </div>

          <div className="card">
            <div className="live">
              🟡 UPCOMING
            </div>

            <h2>
              Upcoming Matches
            </h2>

            {loading ? (
              <p>Loading...</p>
            ) : upcomingMatches.length ===
              0 ? (
              <p className="muted">
                No upcoming matches.
              </p>
            ) : (
              upcomingMatches.map(
                (match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                  />
                )
              )
            )}
          </div>

        </div>

        {/* ====================================================
            COMPLETED
        ==================================================== */}

        <div className="card section">
          <h2>
            ✅ Completed Matches
          </h2>

          {loading ? (
            <p>Loading...</p>
          ) : completedMatches.length ===
            0 ? (
            <p className="muted">
              No completed matches
              yet.
            </p>
          ) : (
            completedMatches.map(
              (match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                />
              )
            )
          )}
        </div>

        {/* ====================================================
            OVERALL CLUB POINTS
        ==================================================== */}

        <div className="card">
          <h2>
            🏆 Overall Club
            Championship
          </h2>

          {leaderboard.map(
            (club, index) => (
              <div
                className="rank"
                key={club}
              >
                <span>
                  {index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : index + 1}
                </span>

                <b>
                  {club}
                </b>

                <strong>
                  {points[club] || 0}
                </strong>
              </div>
            )
          )}
        </div>

        {/* ====================================================
            TEAM SPORT LEADERBOARDS
        ==================================================== */}

        <div className="card section">

          <h2>
            🏆 Team Sport
            Leaderboards
          </h2>

          <p className="muted">
            Live standings calculated
            automatically from
            completed matches.
          </p>

          {teamSports.length ===
          0 ? (
            <p className="muted">
              No team sports have
              been added yet.
            </p>
          ) : (
            <>
              <label
                style={{
                  display: "block",
                  marginTop: "18px",
                }}
              >
                <b>
                  Select Sport
                </b>

                <select
                  value={
                    selectedTeamSport
                  }
                  onChange={(event) =>
                    setSelectedTeamSport(
                      event.target.value
                    )
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "450px",
                    marginTop: "8px",
                    padding: "10px",
                  }}
                >
                  {teamSports.map(
                    (event) => (
                      <option
                        key={event.id}
                        value={event.id}
                      >
                        {event.gender} ·{" "}
                        {event.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              {selectedEvent && (
                <>
                  <h3
                    style={{
                      marginTop: "24px",
                    }}
                  >
                    {selectedEvent.name}
                    {" — "}
                    {
                      selectedEvent.gender
                    }
                  </h3>

                  {sportLeaderboard.completedCount ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          "18px 0",
                      }}
                    >
                      <p className="muted">
                        No matches
                        played yet.
                      </p>

                      <p>
                        All clubs
                        currently
                        have{" "}
                        <b>0</b>{" "}
                        matches
                        played.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* =================================================
                          DESKTOP TABLE
                      ================================================== */}

                      <div className="standingsDesktop">

                        <table className="standingsTable">

                          <thead>
                            <tr>
                              <th>
                                POS
                              </th>

                              <th
                                style={{
                                  textAlign:
                                    "left",
                                }}
                              >
                                CLUB
                              </th>

                              <th>
                                P
                              </th>

                              <th>
                                W
                              </th>

                              {!isCricket &&
                                !isFootball && (
                                  <th>
                                    D
                                  </th>
                                )}

                              {isFootball && (
                                <th>
                                  D
                                </th>
                              )}

                              <th>
                                L
                              </th>

                              {isCricket && (
                                <th>
                                  NR
                                </th>
                              )}

                              {isCricket && (
                                <th>
                                  NRR
                                </th>
                              )}

                              {isFootball && (
                                <th>
                                  GD
                                </th>
                              )}

                              {usesPD && (
                                <>
                                  <th>
                                    PF
                                  </th>

                                  <th>
                                    PA
                                  </th>

                                  <th>
                                    PD
                                  </th>
                                </>
                              )}

                              <th>
                                PTS
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {sportLeaderboard.rows.map(
                              (
                                row,
                                index
                              ) => (
                                <tr
                                  key={
                                    row.id
                                  }
                                  className={
                                    index <
                                    3
                                      ? "topRow"
                                      : ""
                                  }
                                >
                                  <td
                                    style={{
                                      fontWeight:
                                        "800",
                                    }}
                                  >
                                    {index ===
                                    0
                                      ? "🥇"
                                      : index ===
                                        1
                                      ? "🥈"
                                      : index ===
                                        2
                                      ? "🥉"
                                      : index +
                                        1}
                                  </td>

                                  <td className="clubCell">
                                    {
                                      row.name
                                    }
                                  </td>

                                  <td>
                                    {
                                      row.played
                                    }
                                  </td>

                                  <td>
                                    {
                                      row.wins
                                    }
                                  </td>

                                  {(isFootball ||
                                    (!isCricket &&
                                      !usesPD)) && (
                                    <td>
                                      {
                                        row.draws
                                      }
                                    </td>
                                  )}

                                  <td>
                                    {
                                      row.losses
                                    }
                                  </td>

                                  {isCricket && (
                                    <td>
                                      {
                                        row.noResults
                                      }
                                    </td>
                                  )}

                                  {isCricket && (
                                    <td
                                      style={{
                                        fontWeight:
                                          "700",
                                      }}
                                    >
                                      {formatNRR(
                                        row.nrr
                                      )}
                                    </td>
                                  )}

                                  {isFootball && (
                                    <td
                                      style={{
                                        fontWeight:
                                          "700",
                                      }}
                                    >
                                      {row.pd >
                                      0
                                        ? "+"
                                        : ""}
                                      {
                                        row.pd
                                      }
                                    </td>
                                  )}

                                  {usesPD && (
                                    <>
                                      <td>
                                        {formatNumber(
                                          row.pf
                                        )}
                                      </td>

                                      <td>
                                        {formatNumber(
                                          row.pa
                                        )}
                                      </td>

                                      <td
                                        style={{
                                          fontWeight:
                                            "700",
                                        }}
                                      >
                                        {row.pd >
                                        0
                                          ? "+"
                                          : ""}
                                        {formatNumber(
                                          row.pd
                                        )}
                                      </td>
                                    </>
                                  )}

                                  <td
                                    style={{
                                      fontWeight:
                                        "900",
                                      fontSize:
                                        "16px",
                                    }}
                                  >
                                    {
                                      row.points
                                    }
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>

                        <div className="tableLegend">
                          <b>P</b>{" "}
                          Played ·{" "}
                          <b>W</b>{" "}
                          Won ·{" "}
                          <b>D</b>{" "}
                          Draw ·{" "}
                          <b>L</b>{" "}
                          Lost ·{" "}
                          {isCricket && (
                            <>
                              <b>NR</b>{" "}
                              No Result ·{" "}
                              <b>NRR</b>{" "}
                              Net Run Rate ·{" "}
                            </>
                          )}
                          {isFootball && (
                            <>
                              <b>GD</b>{" "}
                              Goal Difference ·{" "}
                            </>
                          )}
                          {usesPD && (
                            <>
                              <b>PF</b>{" "}
                              Points For ·{" "}
                              <b>PA</b>{" "}
                              Points Against ·{" "}
                              <b>PD</b>{" "}
                              Point Difference ·{" "}
                            </>
                          )}
                          <b>PTS</b>{" "}
                          Competition Points
                        </div>
                      </div>

                      {/* =================================================
                          MOBILE CARDS
                      ================================================== */}

                      <div className="standingsMobile">

                        {sportLeaderboard.rows.map(
                          (
                            row,
                            index
                          ) => (
                            <MobileLeaderboardRow
                              key={
                                row.id
                              }
                              row={row}
                              index={
                                index
                              }
                            />
                          )
                        )}

                        <div className="tableLegend">
                          {isCricket ? (
                            <>
                              <b>P</b>{" "}
                              Played ·{" "}
                              <b>W</b>{" "}
                              Won ·{" "}
                              <b>L</b>{" "}
                              Lost ·{" "}
                              <b>NR</b>{" "}
                              No Result ·{" "}
                              <b>NRR</b>{" "}
                              Net Run Rate ·{" "}
                              <b>PTS</b>{" "}
                              Points
                            </>
                          ) : (
                            <>
                              <b>P</b>{" "}
                              Played ·{" "}
                              <b>W</b>{" "}
                              Won ·{" "}
                              <b>L</b>{" "}
                              Lost ·{" "}
                              <b>PTS</b>{" "}
                              Points
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ====================================================
            POINTS SYSTEM
        ==================================================== */}

        <div className="card section">

          <h2>
            Points System
          </h2>

          <div className="rules">

            <div>
              <b>
                Team
              </b>

              <span>
                🥇 25 · 🥈 15 · 🥉 7
              </span>
            </div>

            <div>
              <b>
                Doubles / Mixed
              </b>

              <span>
                🥇 15 · 🥈 10 · 🥉 7
              </span>
            </div>

            <div>
              <b>
                Individual
              </b>

              <span>
                🥇 10 · 🥈 7 · 🥉 5
              </span>
            </div>

          </div>
        </div>

        {/* ====================================================
            EVENTS
        ==================================================== */}

        <div className="card section">

          <h2>
            Events
          </h2>

          {Object.entries(
            eventGroups
          ).map(
            ([group, sports]) => (
              <div
                className="eventGroup"
                key={group}
              >
                <h3>
                  {group}
                </h3>

                <div className="pills">
                  {sports.map(
                    (sport) => (
                      <span
                        key={sport}
                      >
                        {sport}
                      </span>
                    )
                  )}
                </div>
              </div>
            )
          )}

          {events.length > 0 && (
            <div
              className="eventGroup"
              style={{
                marginTop: "24px",
              }}
            >
              <h3>
                Added Events
              </h3>

              <div className="pills">
                {events.map(
                  (event) => (
                    <span
                      key={event.id}
                    >
                      {event.name}
                      {" · "}
                      {event.gender}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

        </div>

      </section>
    </main>
  );
}
