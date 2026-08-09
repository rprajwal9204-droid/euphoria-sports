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

  "Mixed Doubles": [
    "Tennis",
  ],

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

    return Number.isFinite(overs)
      ? overs
      : null;
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

  if (firstRuns === null) {
    firstRuns = numericScore(
      match.innings_a_runs
    );
  }

  if (secondRuns === null) {
    secondRuns = numericScore(
      match.innings_b_runs
    );
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

  if (
    firstRuns === null &&
    battingFirst === clubA
  ) {
    firstRuns = numericScore(match.runs_a);
  }

  if (
    firstRuns === null &&
    battingFirst === clubB
  ) {
    firstRuns = numericScore(match.runs_b);
  }

  if (
    secondRuns === null &&
    battingFirst === clubA
  ) {
    secondRuns = numericScore(match.runs_b);
  }

  if (
    secondRuns === null &&
    battingFirst === clubB
  ) {
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
    return winner === club
      ? "win"
      : "loss";
  }

  const scoreA = numericScore(match.score_a);
  const scoreB = numericScore(match.score_b);

  if (
    scoreA !== null &&
    scoreB !== null
  ) {
    if (scoreA === scoreB) {
      return "draw";
    }

    if (
      club === clubA &&
      scoreA > scoreB
    ) {
      return "win";
    }

    if (
      club === clubB &&
      scoreB > scoreA
    ) {
      return "win";
    }

    return "loss";
  }

  const cricket =
    getCricketStats(match);

  if (
    cricket.firstRuns !== null &&
    cricket.secondRuns !== null &&
    cricket.battingFirst !== null
  ) {
    const firstClub =
      cricket.battingFirst;

    const secondClub =
      firstClub === clubA
        ? clubB
        : clubA;

    if (
      cricket.firstRuns ===
      cricket.secondRuns
    ) {
      return "draw";
    }

    if (
      club === firstClub &&
      cricket.firstRuns >
        cricket.secondRuns
    ) {
      return "win";
    }

    if (
      club === secondClub &&
      cricket.secondRuns >
        cricket.firstRuns
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

function getSportPoints(
  sport,
  result
) {
  const name =
    String(sport || "").toLowerCase();

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
   BUILD SPORT LEADERBOARD
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

    if (!clubA || !clubB) return;

    clubA.played += 1;
    clubB.played += 1;

    const resultA =
      getResultForClub(
        match,
        match.club_a_id
      );

    const resultB =
      getResultForClub(
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

    if (resultA === "no_result")
      clubA.noResults += 1;

    if (resultB === "no_result")
      clubB.noResults += 1;

    const scoreA =
      numericScore(match.score_a);

    const scoreB =
      numericScore(match.score_b);

    if (
      scoreA !== null &&
      scoreB !== null
    ) {
      clubA.pf += scoreA;
      clubA.pa += scoreB;

      clubB.pf += scoreB;
      clubB.pa += scoreA;
    }

    if (
      String(sport || "").toLowerCase() ===
      "cricket"
    ) {
      const cricket =
        getCricketStats(match);

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
          firstClub ===
          Number(match.club_a_id)
            ? Number(match.club_b_id)
            : Number(match.club_a_id);

        const firstRow =
          table[firstClub];

        const secondRow =
          table[secondClub];

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
        club.pf - club.pa;

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
            runRateFor -
            runRateAgainst;
        } else {
          club.nrr = 0;
        }
      }
    }
  );

  const sportName =
    String(sport || "").toLowerCase();

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
          b.wins !== a.wins
        ) {
          return (
            b.wins -
            a.wins
          );
        }

        if (
          sportName === "cricket"
        ) {
          if (
            b.nrr !== a.nrr
          ) {
            return (
              b.nrr -
              a.nrr
            );
          }

          return (
            b.cricketRunsFor -
            a.cricketRunsFor
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
          b.pf !== a.pf
        ) {
          return (
            b.pf -
            a.pf
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

function formatNumber(value) {
  if (
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "0";
  }

  if (
    Number.isInteger(
      Number(value)
    )
  ) {
    return Number(value);
  }

  return Number(value).toFixed(1);
}

function formatNRR(value) {
  const number =
    Number(value || 0);

  if (
    !Number.isFinite(number)
  ) {
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
  const [matches, setMatches] =
    useState([]);

  const [points, setPoints] =
    useState({});

  const [events, setEvents] =
    useState([]);

  const [clubRows, setClubRows] =
    useState([]);

  const [eventResults, setEventResults] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    selectedTeamSport,
    setSelectedTeamSport,
  ] = useState("");

  const [
    selectedClub,
    setSelectedClub,
  ] = useState(null);

  /* ============================================================
     LOAD DATA
  ============================================================ */

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
        .order(
          "match_time",
          {
            ascending: true,
          }
        ),

      supabase
        .from("event_results")
        .select(`
          id,
          event_id,
          club_id,
          position,
          points,
          created_at,

          clubs(
            name
          ),

          events(
            id,
            name,
            gender,
            category,
            points_type
          )
        `)
        .order(
          "event_id",
          {
            ascending: true,
          }
        )
        .order(
          "position",
          {
            ascending: true,
          }
        ),

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

    setMatches(
      matchData || []
    );

    setEvents(
      eventData || []
    );

    setClubRows(
      clubData || []
    );

    setEventResults(
      resultData || []
    );

    const totals = {};

    (
      resultData || []
    ).forEach((result) => {
      const name =
        result.clubs?.name;

      if (name) {
        totals[name] =
          (totals[name] || 0) +
          Number(
            result.points || 0
          );
      }
    });

    defaultClubs.forEach(
      (club) => {
        totals[club] =
          totals[club] || 0;
      }
    );

    (
      clubData || []
    ).forEach((club) => {
      totals[club.name] =
        totals[club.name] || 0;
    });

    setPoints(totals);

    const teamEvents =
      (
        eventData || []
      ).filter(
        (event) =>
          isTeamEvent(event)
      );

    if (
      teamEvents.length > 0
    ) {
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

  /* ============================================================
     MATCH FILTERS
  ============================================================ */

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

  /* ============================================================
     OVERALL LEADERBOARD
  ============================================================ */

  const leaderboard =
    Object.keys(points).sort(
      (a, b) =>
        (points[b] || 0) -
        (points[a] || 0)
    );

  /* ============================================================
     TEAM SPORTS
  ============================================================ */

  const teamSports =
    events.filter(
      (event) =>
        isTeamEvent(event)
    );

  const selectedEvent =
    teamSports.find(
      (event) =>
        String(event.id) ===
        String(selectedTeamSport)
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

  /* ============================================================
     COMPLETED MATCHES GROUPED BY SPORT
  ============================================================ */

  const completedBySport = {};

  completedMatches.forEach(
    (match) => {
      const sport =
        match.events?.name ||
        "Other";

      const gender =
        match.events?.gender || "";

      const key = `${sport}|||${gender}`;

      if (!completedBySport[key]) {
        completedBySport[key] = {
          sport,
          gender,
          matches: [],
        };
      }

      completedBySport[key].matches.push(
        match
      );
    }
  );

  const completedSportGroups =
    Object.values(
      completedBySport
    ).sort((a, b) =>
      a.sport.localeCompare(
        b.sport
      )
    );

  /* ============================================================
     MEDAL
  ============================================================ */

  function getMedal(index) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";

    return index + 1;
  }

  /* ============================================================
     MATCH CARD
     WINNER NAME + SCORE = YELLOW
  ============================================================ */

  function MatchCard({ match }) {
    const winnerId =
      match.winner_club_id !== null &&
      match.winner_club_id !== undefined &&
      match.winner_club_id !== ""
        ? Number(match.winner_club_id)
        : null;

    const clubAId =
      Number(match.club_a_id);

    const clubBId =
      Number(match.club_b_id);

    const isWinnerA =
      winnerId !== null &&
      winnerId === clubAId;

    const isWinnerB =
      winnerId !== null &&
      winnerId === clubBId;

    return (
      <div className="match">

        <div
          style={{
            color: isWinnerA
              ? "#FFD84D"
              : "inherit",

            fontWeight: isWinnerA
              ? 900
              : "inherit",
          }}
        >
          <b>
            {match.club_a?.name ||
              "TBD"}
          </b>

          <strong
            style={{
              color: isWinnerA
                ? "#FFD84D"
                : "inherit",

              fontWeight: isWinnerA
                ? 950
                : "inherit",
            }}
          >
            {match.score_a ||
              "—"}
          </strong>
        </div>

        <div
          style={{
            color: isWinnerB
              ? "#FFD84D"
              : "inherit",

            fontWeight: isWinnerB
              ? 900
              : "inherit",
          }}
        >
          <b>
            {match.club_b?.name ||
              "TBD"}
          </b>

          <strong
            style={{
              color: isWinnerB
                ? "#FFD84D"
                : "inherit",

              fontWeight: isWinnerB
                ? 950
                : "inherit",
            }}
          >
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

  /* ============================================================
     CLUB EVENT DETAILS
  ============================================================ */

  const selectedClubDetails =
    selectedClub
      ? eventResults
          .filter(
            (result) =>
              String(
                result.clubs?.name
              ) ===
              String(selectedClub)
          )
          .sort(
            (a, b) =>
              Number(a.event_id) -
              Number(b.event_id)
          )
      : [];

  return (
    <main>

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .leaderboardShell {
          position: relative;
          margin-top: 26px;
          padding: 28px;
          border-radius: 28px;
          overflow: hidden;

          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(140, 80, 255, 0.24),
              transparent 32%
            ),
            radial-gradient(
              circle at 90% 100%,
              rgba(0, 210, 255, 0.16),
              transparent 32%
            ),
            rgba(18, 20, 38, 0.72);

          border: 1px solid
            rgba(255, 255, 255, 0.13);

          box-shadow:
            0 25px 70px
              rgba(0, 0, 0, 0.28),
            inset 0 1px 0
              rgba(255, 255, 255, 0.08);

          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
        }

        .leaderboardGlow {
          position: absolute;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          right: -80px;
          top: -80px;

          background: rgba(
            140,
            80,
            255,
            0.18
          );

          filter: blur(45px);
          pointer-events: none;
        }

        .leaderboardHeading {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .leaderboardTitle {
          margin: 0;
          font-size: clamp(
            26px,
            4vw,
            38px
          );
          letter-spacing: -0.8px;
        }

        .leaderboardSubtitle {
          margin: 7px 0 0;
          opacity: 0.58;
          font-size: 13px;
        }

        .sportBadge {
          padding: 9px 14px;
          border-radius: 999px;

          background: rgba(
            255,
            255,
            255,
            0.07
          );

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.11
            );

          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .leaderboardSelect {
          width: 100%;
          max-width: 430px;
          padding: 13px 15px;
          margin-top: 9px;

          border-radius: 13px;

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.13
            );

          background: rgba(
            255,
            255,
            255,
            0.07
          );

          color: inherit;
          outline: none;
          font-size: 14px;
        }

        .standingsFrame {
          position: relative;
          overflow: hidden;

          border-radius: 20px;

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.10
            );

          background: rgba(
            0,
            0,
            0,
            0.13
          );
        }

        .standingsTable {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .standingsTable th {
          padding: 14px 10px;
          text-align: center;

          font-size: 10px;
          letter-spacing: 1.2px;
          font-weight: 800;

          color: rgba(
            255,
            255,
            255,
            0.55
          );

          background: rgba(
            255,
            255,
            255,
            0.045
          );

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        .standingsTable td {
          padding: 17px 10px;
          text-align: center;

          font-size: 14px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.065
            );
        }

        .standingsTable tbody tr:hover {
          background: rgba(
            255,
            255,
            255,
            0.055
          );
        }

        .standingsTable td.clubCell {
          text-align: left;
          font-weight: 850;
          font-size: 15px;
        }

        .positionCell {
          font-weight: 900;
          font-size: 17px !important;
        }

        .pointsCell {
          font-weight: 950;
          font-size: 18px !important;
        }

        .leaderRow {
          background:
            linear-gradient(
              90deg,
              rgba(
                255,
                215,
                80,
                0.10
              ),
              rgba(
                255,
                255,
                255,
                0.025
              )
            );
        }

        .secondRow {
          background: rgba(
            255,
            255,
            255,
            0.025
          );
        }

        .thirdRow {
          background: rgba(
            255,
            255,
            255,
            0.018
          );
        }

        .mobileStandings {
          display: none;
        }

        .mobileStandingRow {
          display: grid;

          grid-template-columns:
            48px
            minmax(0, 1fr)
            72px;

          align-items: center;
          gap: 10px;

          min-height: 82px;
          padding: 12px 14px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.065
            );
        }

        .mobileStandingRow:last-child {
          border-bottom: none;
        }

        .mobileStandingRow.first {
          background:
            linear-gradient(
              90deg,
              rgba(
                255,
                215,
                80,
                0.11
              ),
              transparent
            );
        }

        .mobileStandingRank {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 42px;
          height: 42px;

          border-radius: 13px;

          background: rgba(
            255,
            255,
            255,
            0.065
          );

          font-weight: 900;
          font-size: 16px;
        }

        .mobileStandingClub {
          min-width: 0;
        }

        .mobileStandingClubName {
          font-size: 16px;
          font-weight: 900;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobileStandingStats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;

          margin-top: 6px;

          font-size: 10px;
          opacity: 0.58;
        }

        .mobileStandingExtra {
          margin-top: 4px;
          font-size: 10px;
          opacity: 0.65;
        }

        .mobileStandingPoints {
          text-align: right;
        }

        .mobileStandingPoints strong {
          display: block;
          font-size: 23px;
          line-height: 1;
          font-weight: 950;
        }

        .mobileStandingPoints small {
          display: block;
          margin-top: 5px;
          font-size: 8px;
          letter-spacing: 1px;
          opacity: 0.5;
        }

        .overallChampionship {
          position: relative;
          overflow: hidden;

          margin-top: 24px;
          padding: 25px;

          border-radius: 24px;

          background:
            linear-gradient(
              145deg,
              rgba(
                124,
                76,
                255,
                0.16
              ),
              rgba(
                255,
                255,
                255,
                0.035
              )
            );

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.10
            );

          box-shadow:
            0 18px 50px
              rgba(
                0,
                0,
                0,
                0.20
              );
        }

        .overallRow {
          display: grid;

          grid-template-columns:
            45px
            minmax(0,1fr)
            80px;

          align-items: center;
          gap: 12px;

          min-height: 65px;
          padding: 9px 12px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
        }

        .overallRow:last-child {
          border-bottom: none;
        }

        .overallPosition {
          text-align: center;
          font-size: 19px;
          font-weight: 900;
        }

        .overallClubButton {
          appearance: none;
          border: none;
          background: transparent;
          color: inherit;

          padding: 0;
          margin: 0;

          text-align: left;

          font-weight: 850;
          font-size: 15px;

          cursor: pointer;
        }

        .overallClubButton:hover {
          text-decoration: underline;
        }

        .overallPoints {
          text-align: right;
          font-size: 22px;
          font-weight: 950;
        }

        .clubDetails {
          margin-top: 18px;
          padding: 20px;

          border-radius: 18px;

          background: rgba(
            255,
            255,
            255,
            0.045
          );

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
        }

        .clubDetailsHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;

          margin-bottom: 15px;
        }

        .clubDetailsHeader h3 {
          margin: 0;
          font-size: 20px;
        }

        .closeDetails {
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.12
            );

          background: rgba(
            255,
            255,
            255,
            0.06
          );

          color: inherit;

          padding: 8px 12px;

          border-radius: 10px;

          cursor: pointer;
        }

        .clubEventRow {
          display: grid;

          grid-template-columns:
            minmax(0, 1fr)
            100px
            100px;

          gap: 10px;

          align-items: center;

          padding: 14px 10px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
        }

        .clubEventRow:last-child {
          border-bottom: none;
        }

        .clubEventName {
          font-weight: 800;
        }

        .clubEventMeta {
          margin-top: 4px;
          font-size: 11px;
          opacity: 0.55;
        }

        .clubEventRank,
        .clubEventPoints {
          text-align: center;
        }

        .clubEventRank {
          font-weight: 800;
        }

        .clubEventPoints {
          font-weight: 950;
          font-size: 17px;
        }

        .completedSportGroup {
          margin-bottom: 12px;

          border-radius: 16px;

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );

          overflow: hidden;

          background: rgba(
            255,
            255,
            255,
            0.025
          );
        }

        .completedSportGroup summary {
          list-style: none;

          cursor: pointer;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          padding: 16px 18px;

          font-weight: 850;

          background: rgba(
            255,
            255,
            255,
            0.045
          );
        }

        .completedSportGroup summary::-webkit-details-marker {
          display: none;
        }

        .completedSportGroup summary::after {
          content: "＋";

          font-size: 20px;
          opacity: 0.7;
        }

        .completedSportGroup[open]
          summary::after {
          content: "−";
        }

        .completedSportTitle {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .completedSportName {
          font-size: 15px;
        }

        .completedSportMeta {
          font-size: 10px;
          opacity: 0.55;
          font-weight: 600;
        }

        .completedSportMatches {
          padding: 4px 12px 12px;
        }

        /* ====================================================
           WINNER HIGHLIGHT
        ==================================================== */

        .winnerHighlight {
          color: #FFD84D !important;
          font-weight: 950 !important;
        }

        .winnerScoreHighlight {
          color: #FFD84D !important;
          font-weight: 950 !important;
        }

        /* ====================================================
           RESPONSIVE
        ==================================================== */

        @media (max-width: 700px) {

          .leaderboardShell {
            padding: 18px;
            border-radius: 22px;
          }

          .leaderboardHeading {
            display: block;
          }

          .sportBadge {
            display: inline-block;
            margin-top: 14px;
          }

          .standingsDesktop {
            display: none;
          }

          .mobileStandings {
            display: block;
          }

          .overallChampionship {
            padding: 18px;
          }

          .overallRow {
            grid-template-columns:
              40px
              minmax(0,1fr)
              65px;
          }

          .overallPoints {
            font-size: 20px;
          }

          .clubEventRow {
            grid-template-columns:
              minmax(0,1fr)
              65px
              65px;
          }

          .clubEventRank,
          .clubEventPoints {
            font-size: 12px;
          }

          .clubEventPoints {
            font-size: 16px;
          }

          .completedSportGroup summary {
            padding: 15px;
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
          INTER-CLUB SPORTS CHAMPIONSHIP
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
            ) : liveMatches.length === 0 ? (
              <p className="muted">
                No live matches right now.
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
            ) : upcomingMatches.length === 0 ? (
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
            COMPLETED MATCHES
        ==================================================== */}

        <div className="card section">

          <h2>
            ✅ Completed Matches
          </h2>

          {loading ? (
            <p>Loading...</p>
          ) : completedSportGroups.length === 0 ? (
            <p className="muted">
              No completed matches yet.
            </p>
          ) : (

            <div style={{ marginTop: "16px" }}>

              {completedSportGroups.map(
                (group) => (

                  <details
                    className="completedSportGroup"
                    key={`${group.sport}-${group.gender}`}
                  >

                    <summary>

                      <div className="completedSportTitle">

                        <div className="completedSportName">
                          {group.sport}
                        </div>

                        <div className="completedSportMeta">
                          {group.gender}
                          {" · "}
                          {group.matches.length}
                          {" "}
                          {group.matches.length === 1
                            ? "match"
                            : "matches"}
                        </div>

                      </div>

                    </summary>

                    <div className="completedSportMatches">

                      {group.matches.map(
                        (match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                          />
                        )
                      )}

                    </div>

                  </details>

                )
              )}

            </div>

          )}

        </div>

        {/* ====================================================
            OVERALL CHAMPIONSHIP
        ==================================================== */}

        <div className="overallChampionship">

          <h2>
            🏆 Overall Club Championship
          </h2>

          <p className="muted">
            Click a club to see the
            events, rankings and points
            that make up its total.
          </p>

          <div
            style={{
              marginTop: "16px",
            }}
          >

            {leaderboard.map(
              (club, index) => (

                <div
                  className="overallRow"
                  key={club}
                >

                  <div className="overallPosition">
                    {getMedal(index)}
                  </div>

                  <div>

                    <button
                      className="overallClubButton"
                      onClick={() =>
                        setSelectedClub(
                          selectedClub === club
                            ? null
                            : club
                        )
                      }
                    >
                      {club}
                    </button>

                  </div>

                  <div className="overallPoints">
                    {points[club] || 0}
                  </div>

                </div>

              )
            )}

          </div>

          {/* ==================================================
              SELECTED CLUB DETAILS
          ================================================== */}

          {selectedClub && (

            <div className="clubDetails">

              <div className="clubDetailsHeader">

                <h3>
                  {selectedClub}
                  {" · "}
                  Event Breakdown
                </h3>

                <button
                  className="closeDetails"
                  onClick={() =>
                    setSelectedClub(null)
                  }
                >
                  Close
                </button>

              </div>

              {selectedClubDetails.length === 0 ? (

                <p className="muted">
                  No event points have been
                  awarded to this club yet.
                </p>

              ) : (

                <div>

                  <div
                    className="clubEventRow"
                    style={{
                      opacity: 0.55,
                      fontSize: "10px",
                      fontWeight: 800,
                    }}
                  >

                    <div>
                      SPORT / EVENT
                    </div>

                    <div className="clubEventRank">
                      RANK
                    </div>

                    <div className="clubEventPoints">
                      POINTS
                    </div>

                  </div>

                  {selectedClubDetails.map(
                    (result) => (

                      <div
                        className="clubEventRow"
                        key={result.id}
                      >

                        <div>

                          <div className="clubEventName">
                            {result.events?.name ||
                              "Event"}
                          </div>

                          <div className="clubEventMeta">
                            {result.events?.gender ||
                              ""}
                          </div>

                        </div>

                        <div className="clubEventRank">
                          {result.position === 1
                            ? "🥇 1st"
                            : result.position === 2
                            ? "🥈 2nd"
                            : result.position === 3
                            ? "🥉 3rd"
                            : `${result.position}th`}
                        </div>

                        <div className="clubEventPoints">
                          {Number(
                            result.points || 0
                          )}
                        </div>

                      </div>

                    )
                  )}

                  <div
                    style={{
                      marginTop: "15px",
                      textAlign: "right",
                      fontWeight: 900,
                    }}
                  >
                    Total:{" "}
                    {selectedClubDetails.reduce(
                      (sum, result) =>
                        sum +
                        Number(
                          result.points || 0
                        ),
                      0
                    )}{" "}
                    points
                  </div>

                </div>

              )}

            </div>

          )}

        </div>

        {/* ====================================================
            TEAM SPORT LEADERBOARD
        ==================================================== */}

        <div className="section">

          <div className="leaderboardShell">

            <div className="leaderboardGlow" />

            <div className="leaderboardHeading">

              <div>

                <h2 className="leaderboardTitle">
                  🏆 Team Sport Standings
                </h2>

                <p className="leaderboardSubtitle">
                  Live standings calculated
                  automatically from completed
                  matches.
                </p>

              </div>

              {selectedEvent && (
                <div className="sportBadge">
                  {selectedEvent.gender}
                  {" · "}
                  {selectedEvent.name}
                </div>
              )}

            </div>

            {teamSports.length === 0 ? (

              <p className="muted">
                No team sports have been
                added yet.
              </p>

            ) : (

              <>

                <label>
                  <b>
                    Select Sport
                  </b>

                  <select
                    className="leaderboardSelect"
                    value={
                      selectedTeamSport
                    }
                    onChange={(event) =>
                      setSelectedTeamSport(
                        event.target.value
                      )
                    }
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

                    {sportLeaderboard.completedCount ===
                    0 ? (

                      <div
                        style={{
                          padding:
                            "28px 0",
                        }}
                      >

                        <p className="muted">
                          No matches played yet.
                        </p>

                        <p>
                          All clubs currently
                          have <b>0</b> matches
                          played.
                        </p>

                      </div>

                    ) : (

                      <>

                        <div
                          className="standingsFrame standingsDesktop"
                          style={{
                            marginTop:
                              "20px",
                          }}
                        >

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

                                {isFootball && (
                                  <th>
                                    D
                                  </th>
                                )}

                                {!isCricket &&
                                  !isFootball &&
                                  !usesPD && (
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
                                      index ===
                                      0
                                        ? "leaderRow"
                                        : index ===
                                          1
                                        ? "secondRow"
                                        : index ===
                                          2
                                        ? "thirdRow"
                                        : ""
                                    }
                                  >

                                    <td className="positionCell">
                                      {getMedal(
                                        index
                                      )}
                                    </td>

                                    <td className="clubCell">
                                      {row.name}
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
                                            850,
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
                                            850,
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
                                              850,
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

                                    <td className="pointsCell">
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

                        <div
                          className="standingsFrame mobileStandings"
                          style={{
                            marginTop:
                              "20px",
                          }}
                        >

                          {sportLeaderboard.rows.map(
                            (
                              row,
                              index
                            ) => (

                              <div
                                key={row.id}
                                className={`mobileStandingRow ${
                                  index ===
                                  0
                                    ? "first"
                                    : ""
                                }`}
                              >

                                <div className="mobileStandingRank">
                                  {getMedal(
                                    index
                                  )}
                                </div>

                                <div className="mobileStandingClub">

                                  <div className="mobileStandingClubName">
                                    {
                                      row.name
                                    }
                                  </div>

                                  <div className="mobileStandingStats">

                                    <span>
                                      P{" "}
                                      {
                                        row.played
                                      }
                                    </span>

                                    <span>
                                      W{" "}
                                      {
                                        row.wins
                                      }
                                    </span>

                                    {isFootball && (
                                      <span>
                                        D{" "}
                                        {
                                          row.draws
                                        }
                                      </span>
                                    )}

                                    {!isCricket &&
                                      !isFootball &&
                                      !usesPD && (
                                        <span>
                                          D{" "}
                                          {
                                            row.draws
                                          }
                                        </span>
                                      )}

                                    <span>
                                      L{" "}
                                      {
                                        row.losses
                                      }
                                    </span>

                                    {isCricket && (
                                      <span>
                                        NR{" "}
                                        {
                                          row.noResults
                                        }
                                      </span>
                                    )}

                                  </div>

                                  {isCricket && (
                                    <div className="mobileStandingExtra">
                                      NRR{" "}
                                      <b>
                                        {formatNRR(
                                          row.nrr
                                        )}
                                      </b>
                                    </div>
                                  )}

                                  {isFootball && (
                                    <div className="mobileStandingExtra">
                                      GD{" "}
                                      <b>
                                        {row.pd >
                                        0
                                          ? "+"
                                          : ""}
                                        {
                                          row.pd
                                        }
                                      </b>
                                    </div>
                                  )}

                                  {usesPD && (
                                    <div className="mobileStandingExtra">
                                      PF{" "}
                                      {formatNumber(
                                        row.pf
                                      )}
                                      {" · "}
                                      PA{" "}
                                      {formatNumber(
                                        row.pa
                                      )}
                                      {" · "}
                                      PD{" "}
                                      {row.pd >
                                      0
                                        ? "+"
                                        : ""}
                                      {formatNumber(
                                        row.pd
                                      )}
                                    </div>
                                  )}

                                </div>

                                <div className="mobileStandingPoints">

                                  <strong>
                                    {
                                      row.points
                                    }
                                  </strong>

                                  <small>
                                    PTS
                                  </small>

                                </div>

                              </div>

                            )
                          )}

                        </div>

                        <div className="tableLegend">

                          <b>P</b>{" "}
                          Played ·{" "}

                          <b>W</b>{" "}
                          Won ·{" "}

                          {(isFootball ||
                            (!isCricket &&
                              !usesPD)) && (
                            <>
                              <b>D</b>{" "}
                              Draw ·{" "}
                            </>
                          )}

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

                      </>

                    )}

                  </>

                )}

              </>

            )}

          </div>

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
                marginTop:
                  "24px",
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
