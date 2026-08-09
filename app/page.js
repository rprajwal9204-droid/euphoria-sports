"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* =========================================================
   FIXED CLUB NAMES USED ONLY FOR OVERALL POINT DISPLAY
========================================================= */

const defaultClubNames = [
  "Falcons",
  "Eagles",
  "Thunderbirds",
  "Griffins",
  "Phoenix",
];

/* =========================================================
   HELPERS
========================================================= */

function isFinal(status) {
  return (
    String(status || "").toLowerCase() ===
    "final"
  );
}

function isTeamEvent(event) {
  if (!event) return false;

  const category = String(
    event.category || ""
  ).toLowerCase();

  const pointsType = String(
    event.points_type || ""
  ).toLowerCase();

  return (
    category.includes("team") ||
    pointsType.includes("team")
  );
}

function isCricket(event) {
  if (!event) return false;

  return (
    String(event.name || "")
      .trim()
      .toLowerCase() === "cricket" &&
    isTeamEvent(event)
  );
}

/* =========================================================
   CRICKET OVERS

   19.3 = 19 overs + 3 balls
========================================================= */

function oversToBalls(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }

  const parts = text.split(".");

  const overs = Number(parts[0]);

  const balls =
    parts.length > 1
      ? Number(parts[1])
      : 0;

  if (
    !Number.isInteger(overs) ||
    !Number.isInteger(balls)
  ) {
    return null;
  }

  if (balls < 0 || balls > 5) {
    return null;
  }

  return overs * 6 + balls;
}

function ballsToOvers(balls) {
  if (
    balls === null ||
    balls === undefined ||
    balls <= 0
  ) {
    return 0;
  }

  const completeOvers =
    Math.floor(balls / 6);

  const remainingBalls =
    balls % 6;

  return (
    completeOvers +
    remainingBalls / 6
  );
}

/* =========================================================
   CRICKET NRR DENOMINATOR

   If all out, use allotted overs.
   Otherwise use actual overs faced.
========================================================= */

function cricketOversForNRR(
  overs,
  wickets,
  allottedOvers
) {
  const actualBalls =
    oversToBalls(overs);

  const allottedBalls =
    oversToBalls(allottedOvers);

  if (actualBalls === null) {
    return null;
  }

  /*
    10 wickets = all out.
    For an all-out innings, ICC-style NRR
    calculations use the full allotted overs.
  */

  if (
    Number(wickets) >= 10 &&
    allottedBalls !== null
  ) {
    return ballsToOvers(
      allottedBalls
    );
  }

  return ballsToOvers(
    actualBalls
  );
}

/* =========================================================
   CRICKET MATCH RESULT
========================================================= */

function cricketResult(
  match,
  clubId
) {
  const a =
    Number(match.club_a_id);

  const b =
    Number(match.club_b_id);

  const club =
    Number(clubId);

  const runsA =
    Number(match.innings_a_runs);

  const runsB =
    Number(match.innings_b_runs);

  if (
    !Number.isFinite(runsA) ||
    !Number.isFinite(runsB)
  ) {
    return "no_result";
  }

  if (runsA === runsB) {
    return "tie";
  }

  if (club === a) {
    return runsA > runsB
      ? "win"
      : "loss";
  }

  if (club === b) {
    return runsB > runsA
      ? "win"
      : "loss";
  }

  return "no_result";
}

/* =========================================================
   CRICKET POINTS
========================================================= */

function cricketPoints(result) {
  if (result === "win") return 2;

  if (result === "tie") return 1;

  if (result === "no_result") return 1;

  return 0;
}

/* =========================================================
   OTHER SPORTS POINTS
========================================================= */

function getSportPoints(
  sport,
  result
) {
  const name = String(
    sport || ""
  ).toLowerCase();

  if (name === "football") {
    if (result === "win") return 3;

    if (result === "draw") return 1;

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

/* =========================================================
   NORMAL SPORTS RESULT
========================================================= */

function normalResult(
  match,
  clubId
) {
  const a =
    Number(match.club_a_id);

  const b =
    Number(match.club_b_id);

  const club =
    Number(clubId);

  const scoreA =
    Number(match.score_a);

  const scoreB =
    Number(match.score_b);

  if (
    !Number.isFinite(scoreA) ||
    !Number.isFinite(scoreB)
  ) {
    return "no_result";
  }

  if (scoreA === scoreB) {
    return "draw";
  }

  if (club === a) {
    return scoreA > scoreB
      ? "win"
      : "loss";
  }

  if (club === b) {
    return scoreB > scoreA
      ? "win"
      : "loss";
  }

  return "no_result";
}

/* =========================================================
   CRICKET LEADERBOARD
========================================================= */

function buildCricketLeaderboard(
  eventId,
  matches,
  clubs
) {
  const table = {};

  clubs.forEach((club) => {
    table[club.id] = {
      id: club.id,
      name: club.name,

      played: 0,
      wins: 0,
      losses: 0,
      noResults: 0,
      ties: 0,

      runsFor: 0,
      runsAgainst: 0,

      totalBallsFor: 0,
      totalBallsAgainst: 0,

      nrr: 0,
      points: 0,
    };
  });

  const completed =
    matches.filter(
      (match) =>
        isFinal(match.status) &&
        Number(match.event_id) ===
          Number(eventId)
    );

  completed.forEach((match) => {
    const clubA =
      table[match.club_a_id];

    const clubB =
      table[match.club_b_id];

    if (!clubA || !clubB) {
      return;
    }

    const runsA =
      Number(match.innings_a_runs);

    const runsB =
      Number(match.innings_b_runs);

    if (
      !Number.isFinite(runsA) ||
      !Number.isFinite(runsB)
    ) {
      return;
    }

    clubA.played += 1;
    clubB.played += 1;

    const resultA =
      cricketResult(
        match,
        match.club_a_id
      );

    const resultB =
      cricketResult(
        match,
        match.club_b_id
      );

    /* Results */

    if (resultA === "win")
      clubA.wins += 1;

    if (resultB === "win")
      clubB.wins += 1;

    if (resultA === "loss")
      clubA.losses += 1;

    if (resultB === "loss")
      clubB.losses += 1;

    if (resultA === "tie")
      clubA.ties += 1;

    if (resultB === "tie")
      clubB.ties += 1;

    if (resultA === "no_result")
      clubA.noResults += 1;

    if (resultB === "no_result")
      clubB.noResults += 1;

    /* Points */

    clubA.points +=
      cricketPoints(resultA);

    clubB.points +=
      cricketPoints(resultB);

    /* Runs */

    clubA.runsFor += runsA;
    clubA.runsAgainst += runsB;

    clubB.runsFor += runsB;
    clubB.runsAgainst += runsA;

    /* Overs */

    const allotted =
      match.allotted_overs;

    const oversA =
      cricketOversForNRR(
        match.innings_a_overs,
        match.innings1_wickets,
        allotted
      );

    const oversB =
      cricketOversForNRR(
        match.innings_b_overs,
        match.innings2_wickets,
        allotted
      );

    if (
      oversA !== null &&
      oversA > 0
    ) {
      clubA.totalBallsFor +=
        oversToBalls(
          match.innings_a_overs
        ) || 0;

      /*
        If all out, use allotted balls.
      */
      if (
        Number(match.innings1_wickets) >=
          10 &&
        oversToBalls(allotted) !== null
      ) {
        clubA.totalBallsFor =
          clubA.totalBallsFor -
          (oversToBalls(
            match.innings_a_overs
          ) || 0) +
          oversToBalls(allotted);
      }
    }

    if (
      oversB !== null &&
      oversB > 0
    ) {
      clubB.totalBallsFor +=
        oversToBalls(
          match.innings_b_overs
        ) || 0;

      if (
        Number(match.innings2_wickets) >=
          10 &&
        oversToBalls(allotted) !== null
      ) {
        clubB.totalBallsFor =
          clubB.totalBallsFor -
          (oversToBalls(
            match.innings_b_overs
          ) || 0) +
          oversToBalls(allotted);
      }
    }

    /*
      Against = opponent's batting overs.
    */

    clubA.totalBallsAgainst +=
      oversToBalls(
        match.innings_b_overs
      ) || 0;

    clubB.totalBallsAgainst +=
      oversToBalls(
        match.innings_a_overs
      ) || 0;

    if (
      Number(match.innings2_wickets) >=
        10 &&
      oversToBalls(allotted) !== null
    ) {
      clubA.totalBallsAgainst =
        clubA.totalBallsAgainst -
        (oversToBalls(
          match.innings_b_overs
        ) || 0) +
        oversToBalls(allotted);
    }

    if (
      Number(match.innings1_wickets) >=
        10 &&
      oversToBalls(allotted) !== null
    ) {
      clubB.totalBallsAgainst =
        clubB.totalBallsAgainst -
        (oversToBalls(
          match.innings_a_overs
        ) || 0) +
        oversToBalls(allotted);
    }
  });

  Object.values(table).forEach(
    (club) => {
      const ballsFor =
        club.totalBallsFor;

      const ballsAgainst =
        club.totalBallsAgainst;

      const oversFor =
        ballsToOvers(
          ballsFor
        );

      const oversAgainst =
        ballsToOvers(
          ballsAgainst
        );

      const runRateFor =
        oversFor > 0
          ? club.runsFor /
            oversFor
          : 0;

      const runRateAgainst =
        oversAgainst > 0
          ? club.runsAgainst /
            oversAgainst
          : 0;

      club.nrr =
        runRateFor -
        runRateAgainst;
    }
  );

  const rows =
    Object.values(table).sort(
      (a, b) => {
        if (
          b.points !== a.points
        ) {
          return (
            b.points -
            a.points
          );
        }

        if (
          b.nrr !== a.nrr
        ) {
          return (
            b.nrr -
            a.nrr
          );
        }

        if (
          b.wins !== a.wins
        ) {
          return (
            b.wins -
            a.wins
          );
        }

        return a.name.localeCompare(
          b.name
        );
      }
    );

  return {
    rows,
    completedCount:
      completed.length,
  };
}

/* =========================================================
   OTHER TEAM SPORT LEADERBOARD
========================================================= */

function buildNormalLeaderboard(
  sport,
  eventId,
  matches,
  clubs
) {
  const table = {};

  clubs.forEach((club) => {
    table[club.id] = {
      id: club.id,
      name: club.name,

      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,

      pf: 0,
      pa: 0,
      pd: 0,

      points: 0,
    };
  });

  const completed =
    matches.filter(
      (match) =>
        isFinal(match.status) &&
        Number(match.event_id) ===
          Number(eventId)
    );

  completed.forEach((match) => {
    const clubA =
      table[match.club_a_id];

    const clubB =
      table[match.club_b_id];

    if (!clubA || !clubB)
      return;

    clubA.played += 1;
    clubB.played += 1;

    const resultA =
      normalResult(
        match,
        match.club_a_id
      );

    const resultB =
      normalResult(
        match,
        match.club_b_id
      );

    if (resultA === "win")
      clubA.wins += 1;

    if (resultB === "win")
      clubB.wins += 1;

    if (resultA === "draw")
      clubA.draws += 1;

    if (resultB === "draw")
      clubB.draws += 1;

    if (resultA === "loss")
      clubA.losses += 1;

    if (resultB === "loss")
      clubB.losses += 1;

    const scoreA =
      Number(match.score_a);

    const scoreB =
      Number(match.score_b);

    if (
      Number.isFinite(scoreA) &&
      Number.isFinite(scoreB)
    ) {
      clubA.pf += scoreA;
      clubA.pa += scoreB;

      clubB.pf += scoreB;
      clubB.pa += scoreA;
    }

    clubA.points +=
      getSportPoints(
        sport,
        resultA
      );

    clubB.points +=
      getSportPoints(
        sport,
        resultB
      );
  });

  Object.values(table).forEach(
    (club) => {
      club.pd =
        club.pf -
        club.pa;
    }
  );

  const rows =
    Object.values(table).sort(
      (a, b) => {
        if (
          b.points !== a.points
        ) {
          return (
            b.points -
            a.points
          );
        }

        if (
          b.pd !== a.pd
        ) {
          return (
            b.pd -
            a.pd
          );
        }

        if (
          b.wins !== a.wins
        ) {
          return (
            b.wins -
            a.wins
          );
        }

        return a.name.localeCompare(
          b.name
        );
      }
    );

  return {
    rows,
    completedCount:
      completed.length,
  };
}

/* =========================================================
   FORMAT
========================================================= */

function formatNumber(value) {
  if (!Number.isFinite(value))
    return "0";

  return Number.isInteger(value)
    ? value
    : value.toFixed(2);
}

/* =========================================================
   PAGE
========================================================= */

export default function Home() {
  const [matches, setMatches] =
    useState([]);

  const [points, setPoints] =
    useState({});

  const [events, setEvents] =
    useState([]);

  const [clubRows, setClubRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    selectedTeamSport,
    setSelectedTeamSport,
  ] = useState("");

  /* =======================================================
     LOAD
  ======================================================= */

  async function load() {
    setLoading(true);

    const [
      { data: matchData },
      { data: resultData },
      { data: eventData },
      { data: clubData },
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

          innings_a_runs,
          innings_a_overs,

          innings_b_runs,
          innings_b_overs,

          allotted_overs,

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

    setMatches(
      matchData || []
    );

    setEvents(
      eventData || []
    );

    setClubRows(
      clubData || []
    );

    /* =====================================================
       OVERALL POINTS
    ===================================================== */

    const totals = {};

    defaultClubNames.forEach(
      (club) => {
        totals[club] = 0;
      }
    );

    (clubData || []).forEach(
      (club) => {
        totals[club.name] =
          totals[club.name] || 0;
      }
    );

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

    setPoints(totals);

    /* =====================================================
       TEAM EVENTS
    ===================================================== */

    const teamEvents =
      (eventData || []).filter(
        (event) =>
          isTeamEvent(event)
      );

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

        return teamEvents.length
          ? String(
              teamEvents[0].id
            )
          : "";
      }
    );

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

  /* =======================================================
     MATCH GROUPS
  ======================================================= */

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
    matches.filter(
      (match) =>
        isFinal(match.status)
    );

  /* =======================================================
     OVERALL
  ======================================================= */

  const leaderboard =
    Object.entries(points)
      .sort(
        (a, b) =>
          b[1] - a[1]
      );

  /* =======================================================
     TEAM SPORTS
  ======================================================= */

  const teamSports =
    events.filter(
      (event) =>
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
    if (
      isCricket(selectedEvent)
    ) {
      sportLeaderboard =
        buildCricketLeaderboard(
          selectedEvent.id,
          matches,
          clubRows
        );
    } else {
      sportLeaderboard =
        buildNormalLeaderboard(
          selectedEvent.name,
          selectedEvent.id,
          matches,
          clubRows
        );
    }
  }

  const selectedIsCricket =
    isCricket(selectedEvent);

  /* =======================================================
     MATCH CARD
  ======================================================= */

  function MatchCard({
    match,
  }) {
    return (
      <div className="match">

        <div>
          <b>
            {match.club_a?.name ||
              "TBD"}
          </b>

          <strong>
            {match.score_a ||
              "—"}
          </strong>
        </div>

        <div>
          <b>
            {match.club_b?.name ||
              "TBD"}
          </b>

          <strong>
            {match.score_b ||
              "—"}
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

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main>

      <header>
        <div className="logo">
          EUPHORIA{" "}
          <span>SPORTS</span>
        </div>

        <a href="/admin">
          ADMIN
        </a>
      </header>

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
          Live scores, results
          and the race for the
          Euphoria Club
          Championship.
        </p>

      </section>

      <section className="wrap">

        {/* =================================================
            LIVE + UPCOMING
        ================================================= */}

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
                No live matches
                right now.
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

        {/* =================================================
            COMPLETED
        ================================================= */}

        <div className="card section">

          <h2>
            ✅ Completed Matches
          </h2>

          {completedMatches.length ===
          0 ? (
            <p className="muted">
              No completed matches yet.
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

        {/* =================================================
            OVERALL
        ================================================= */}

        <div className="card">

          <h2>
            🏆 Overall Club Points
          </h2>

          {leaderboard.map(
            ([club, pts], index) => (
              <div
                className="rank"
                key={club}
              >

                <span>
                  {index + 1}
                </span>

                <b>
                  {club}
                </b>

                <strong>
                  {pts}
                </strong>

              </div>
            )
          )}

        </div>

        {/* =================================================
            TEAM SPORT LEADERBOARDS
        ================================================= */}

        <div className="card section">

          <h2>
            🏆 Team Sport
            Leaderboards
          </h2>

          <p className="muted">
            Standings are calculated
            automatically from
            completed matches.
          </p>

          {teamSports.length ===
          0 ? (
            <p className="muted">
              No team sports
              have been added yet.
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
                  onChange={(e) =>
                    setSelectedTeamSport(
                      e.target.value
                    )
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth:
                      "450px",
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
                        {event.gender}
                        {" · "}
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
                      marginTop:
                        "24px",
                    }}
                  >
                    {
                      selectedEvent.name
                    }
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
                          "20px 0",
                      }}
                    >

                      <p className="muted">
                        No matches
                        played yet.
                      </p>

                      <p>
                        All clubs
                        currently have
                        <b> 0 </b>
                        matches played.
                      </p>

                    </div>
                  ) : selectedIsCricket ? (

                    /* =====================================
                       CRICKET TABLE
                    ===================================== */

                    <div
                      style={{
                        overflowX:
                          "auto",
                        marginTop:
                          "16px",
                      }}
                    >

                      <table
                        style={{
                          width: "100%",
                          borderCollapse:
                            "collapse",
                          minWidth:
                            "900px",
                        }}
                      >

                        <thead>
                          <tr>

                            <th>
                              #
                            </th>

                            <th
                              style={{
                                textAlign:
                                  "left",
                              }}
                            >
                              Club
                            </th>

                            <th>
                              P
                            </th>

                            <th>
                              W
                            </th>

                            <th>
                              L
                            </th>

                            <th>
                              NR
                            </th>

                            <th>
                              RF
                            </th>

                            <th>
                              RA
                            </th>

                            <th>
                              NRR
                            </th>

                            <th>
                              Pts
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
                              >

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
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

                                <td
                                  style={{
                                    fontWeight:
                                      "bold",
                                  }}
                                >
                                  {row.name}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.played
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {row.wins}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.losses
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.noResults
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.runsFor
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.runsAgainst
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
                                  }}
                                >
                                  {row.nrr >=
                                  0
                                    ? "+"
                                    : ""}
                                  {formatNumber(
                                    row.nrr
                                  )}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
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

                      <p
                        className="muted"
                        style={{
                          marginTop:
                            "12px",
                          fontSize:
                            "13px",
                        }}
                      >
                        <b>P</b> Played ·{" "}
                        <b>W</b> Won ·{" "}
                        <b>L</b> Lost ·{" "}
                        <b>NR</b> No Result ·{" "}
                        <b>RF</b> Runs For ·{" "}
                        <b>RA</b> Runs Against ·{" "}
                        <b>NRR</b> Net Run Rate ·{" "}
                        <b>Pts</b> Competition
                        Points
                      </p>

                    </div>

                  ) : (

                    /* =====================================
                       OTHER TEAM SPORTS
                    ===================================== */

                    <div
                      style={{
                        overflowX:
                          "auto",
                        marginTop:
                          "16px",
                      }}
                    >

                      <table
                        style={{
                          width: "100%",
                          borderCollapse:
                            "collapse",
                          minWidth:
                            "650px",
                        }}
                      >

                        <thead>
                          <tr>

                            <th>
                              #
                            </th>

                            <th
                              style={{
                                textAlign:
                                  "left",
                              }}
                            >
                              Club
                            </th>

                            <th>
                              P
                            </th>

                            <th>
                              W
                            </th>

                            <th>
                              D
                            </th>

                            <th>
                              L
                            </th>

                            <th>
                              PF
                            </th>

                            <th>
                              PA
                            </th>

                            <th>
                              PD
                            </th>

                            <th>
                              Pts
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
                              >

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
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

                                <td
                                  style={{
                                    fontWeight:
                                      "bold",
                                  }}
                                >
                                  {row.name}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.played
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {row.wins}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.draws
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {
                                    row.losses
                                  }
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {formatNumber(
                                    row.pf
                                  )}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {formatNumber(
                                    row.pa
                                  )}
                                </td>

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
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

                                <td
                                  style={{
                                    textAlign:
                                      "center",
                                    fontWeight:
                                      "bold",
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

                    </div>
                  )}

                </>
              )}

            </>
          )}

        </div>

      </section>
    </main>
  );
}
