"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================
   EUPHORIA CLUBS
============================================================ */

const defaultClubs = [
  "Falcons",
  "Eagles",
  "Thunderbirds",
  "Griffins",
  "Phoenix",
];

const clubTheme = {
  Falcons: {
    color: "#3B82F6",
    glow: "rgba(59,130,246,.28)",
    short: "FAL",
  },

  Eagles: {
    color: "#FACC15",
    glow: "rgba(250,204,21,.24)",
    short: "EAG",
  },

  Thunderbirds: {
    color: "#A855F7",
    glow: "rgba(168,85,247,.28)",
    short: "THU",
  },

  Griffins: {
    color: "#EF4444",
    glow: "rgba(239,68,68,.25)",
    short: "GRI",
  },

  Phoenix: {
    color: "#F97316",
    glow: "rgba(249,115,22,.25)",
    short: "PHX",
  },
};
const clubLogos = {
  Falcons: "/logos/falconslogo.png",
  Eagles: "/logos/eagleslogo.png",
  Thunderbirds: "/logos/thunderbirdslogo.png",
  Griffins: "/logos/griffinslogo.png",
  Phoenix: "/logos/phoenixlogo.png",
};
/* ============================================================
   HELPERS
============================================================ */

function isFinal(status) {
  return String(status || "").toLowerCase() === "final";
}

function isLive(status) {
  return String(status || "").toLowerCase() === "live";
}

function isUpcoming(status) {
  return (
    String(status || "").toLowerCase() ===
    "upcoming"
  );
}

function isTeamEvent(event) {
  if (!event) return false;

  const category =
    String(event.category || "").toLowerCase();

  const pointsType =
    String(event.points_type || "").toLowerCase();

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

  return Number.isFinite(number)
    ? number
    : null;
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

function getSportPoints(sport, result) {
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

/* ============================================================
   FORMATTING
============================================================ */

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

function formatMatchTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMedal(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";

  return String(index + 1);
}

function getClubTheme(name) {
  return (
    clubTheme[name] || {
      color: "#8B8B9A",
      glow: "rgba(139,139,154,.2)",
      short: name
        ? name.slice(0, 3).toUpperCase()
        : "CLB",
    }
  );
}

/* ============================================================
   MAIN
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
     LOAD
  ============================================================ */

  async function load() {
    const firstLoad =
      matches.length === 0 &&
      events.length === 0;

    if (firstLoad) {
      setLoading(true);
    }

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

    if (matchError)
      console.error(
        "Matches error:",
        matchError
      );

    if (resultError)
      console.error(
        "Results error:",
        resultError
      );

    if (eventError)
      console.error(
        "Events error:",
        eventError
      );

    if (clubError)
      console.error(
        "Clubs error:",
        clubError
      );

    const safeMatches =
      matchData || [];

    const safeResults =
      resultData || [];

    const safeEvents =
      eventData || [];

    const safeClubs =
      clubData || [];

    setMatches(safeMatches);
    setEvents(safeEvents);
    setClubRows(safeClubs);
    setEventResults(safeResults);

    const totals = {};

    safeResults.forEach(
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

    safeClubs.forEach(
      (club) => {
        totals[club.name] =
          totals[club.name] || 0;
      }
    );

    setPoints(totals);

    const teamEvents =
      safeEvents.filter(
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

  const liveMatches =
    useMemo(
      () =>
        matches.filter(
          (match) =>
            isLive(match.status)
        ),
      [matches]
    );

  const upcomingMatches =
    useMemo(
      () =>
        matches.filter(
          (match) =>
            isUpcoming(match.status)
        ),
      [matches]
    );

  const completedMatches =
    useMemo(
      () =>
        matches.filter(
          (match) =>
            isFinal(match.status)
        ),
      [matches]
    );

  /* ============================================================
     OVERALL LEADERBOARD
  ============================================================ */

  const leaderboard =
    useMemo(
      () =>
        Object.keys(points).sort(
          (a, b) =>
            (points[b] || 0) -
            (points[a] || 0)
        ),
      [points]
    );

  const leaderPoints =
    leaderboard.length
      ? Number(
          points[leaderboard[0]] || 0
        )
      : 0;

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
     COMPLETED GROUPS
  ============================================================ */

  const completedBySport = {};

  completedMatches.forEach(
    (match) => {
      const sport =
        match.events?.name ||
        "Other";

      const gender =
        match.events?.gender || "";

      const key =
        `${sport}|||${gender}`;

      if (!completedBySport[key]) {
        completedBySport[key] = {
          sport,
          gender,
          matches: [],
        };
      }

      completedBySport[
        key
      ].matches.push(match);
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
     SELECTED CLUB
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

  /* ============================================================
     MATCH CARD
  ============================================================ */

  function MatchCard({
    match,
    compact = false,
  }) {
    const winnerId =
      match.winner_club_id !== null &&
      match.winner_club_id !== undefined &&
      match.winner_club_id !== ""
        ? Number(
            match.winner_club_id
          )
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

    const live =
      isLive(match.status);

    const upcoming =
      isUpcoming(match.status);

    const sport =
      match.events?.name ||
      "Sport";

    const gender =
      match.events?.gender ||
      "";

    const clubA =
      match.club_a?.name ||
      "TBD";

    const clubB =
      match.club_b?.name ||
      "TBD";

    const themeA =
      getClubTheme(clubA);

    const themeB =
      getClubTheme(clubB);

    return (
      <article
        className={`matchCard ${
          live
            ? "matchCardLive"
            : ""
        } ${
          compact
            ? "matchCardCompact"
            : ""
        }`}
      >
        <div className="matchTop">

          <div className="matchSportWrap">

            <span className="sportIcon">
              {sport
                .toLowerCase()
                .includes("cricket")
                ? "🏏"
                : sport
                    .toLowerCase()
                    .includes("football")
                ? "⚽"
                : sport
                    .toLowerCase()
                    .includes("basket")
                ? "🏀"
                : sport
                    .toLowerCase()
                    .includes("volley")
                ? "🏐"
                : "🏆"}
            </span>

            <div>
              <div className="matchSport">
                {sport}
              </div>

              <div className="matchGender">
                {gender}
              </div>
            </div>

          </div>

          <div
            className={`matchStatus ${
              live
                ? "liveStatus"
                : upcoming
                ? "upcomingStatus"
                : "finalStatus"
            }`}
          >
            {live && (
              <span className="liveDot" />
            )}

            {live
              ? "LIVE"
              : upcoming
              ? "UP NEXT"
              : "FINAL"}
          </div>

        </div>

        <div className="matchTeams">

          <div
            className={`matchTeam ${
              isWinnerA
                ? "winnerTeam"
                : ""
            }`}
          >

            <span
              className="teamAccent"
              style={{
                background:
                  themeA.color,
                boxShadow:
                  `0 0 14px ${themeA.glow}`,
              }}
            />

            <span className="teamName">
              {clubA}
            </span>

            <strong className="teamScore">
              {match.score_a ??
                "—"}
            </strong>

          </div>

          <div className="vs">
            VS
          </div>

          <div
            className={`matchTeam ${
              isWinnerB
                ? "winnerTeam"
                : ""
            }`}
          >

            <span
              className="teamAccent"
              style={{
                background:
                  themeB.color,
                boxShadow:
                  `0 0 14px ${themeB.glow}`,
              }}
            />

            <span className="teamName">
              {clubB}
            </span>

            <strong className="teamScore">
              {match.score_b ??
                "—"}
            </strong>

          </div>

        </div>

        <div className="matchBottom">

          <span>
            {upcoming &&
            match.match_time
              ? formatMatchTime(
                  match.match_time
                )
              : live
              ? "Playing now"
              : "Completed"}
          </span>

          {live && (
            <span className="playingNow">
              ● PLAYING NOW
            </span>
          )}

        </div>

      </article>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <main className="euphoriaPage">

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #08090f;
          color: #f5f5f7;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        select {
          font: inherit;
        }

        /* ====================================================
           PAGE BACKGROUND
        ==================================================== */

        .euphoriaPage {
          min-height: 100vh;

          position: relative;

          overflow-x: hidden;

          background:
            radial-gradient(
              circle at 50% -10%,
              rgba(104,67,255,.23),
              transparent 35%
            ),
            radial-gradient(
              circle at 0% 35%,
              rgba(30,100,255,.08),
              transparent 30%
            ),
            radial-gradient(
              circle at 100% 65%,
              rgba(180,60,255,.07),
              transparent 28%
            ),
            #08090f;
        }

        .euphoriaPage::before {
          content: "";

          position: fixed;

          inset: 0;

          pointer-events: none;

          opacity: .035;

          background-image:
            linear-gradient(
              rgba(255,255,255,.6) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.6) 1px,
              transparent 1px
            );

          background-size:
            60px 60px;

          mask-image:
            linear-gradient(
              to bottom,
              black,
              transparent 80%
            );
        }

        /* ====================================================
           HEADER
        ==================================================== */

        header {
          height: 66px;

          display: flex;

          align-items: center;

          justify-content: space-between;

          padding:
            0
            max(20px, calc((100vw - 1180px) / 2));

          position: relative;

          z-index: 10;

          border-bottom:
            1px solid
            rgba(255,255,255,.07);

          background:
            rgba(8,9,15,.72);

          backdrop-filter:
            blur(18px);

          -webkit-backdrop-filter:
            blur(18px);
        }

        .logo {
          font-size: 15px;

          font-weight: 950;

          letter-spacing: 2px;
        }

        .logo span {
          opacity: .42;

          font-weight: 700;
        }

        .adminLink {
          text-decoration: none;

          color: rgba(255,255,255,.7);

          font-size: 10px;

          font-weight: 900;

          letter-spacing: 1.3px;

          padding:
            8px
            11px;

          border:
            1px solid
            rgba(255,255,255,.10);

          border-radius: 9px;

          transition:
            .2s ease;
        }

        .adminLink:hover {
          color: white;

          border-color:
            rgba(255,255,255,.25);
        }

        /* ====================================================
           HERO
        ==================================================== */

        .hero {
          max-width: 1180px;

          margin:
            0 auto;

          padding:
            74px 24px 64px;

          position: relative;
        }

        .hero::after {
          content: "";

          position: absolute;

          width: 280px;
          height: 280px;

          right: 4%;
          top: 20px;

          border-radius: 50%;

          background:
            rgba(111,62,255,.15);

          filter:
            blur(80px);

          pointer-events: none;
        }

        .heroEyebrow {
          display: inline-flex;

          align-items: center;

          gap: 8px;

          padding:
            7px
            11px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.045);

          border:
            1px solid
            rgba(255,255,255,.08);

          color:
            rgba(255,255,255,.56);

          font-size: 9px;

          font-weight: 900;

          letter-spacing: 1.8px;

          text-transform: uppercase;
        }

        .heroEyebrowDot {
          width: 6px;
          height: 6px;

          border-radius: 50%;

          background:
            #9b6cff;

          box-shadow:
            0 0 12px
            rgba(155,108,255,.8);
        }

        .hero h1 {
          position: relative;

          z-index: 1;

          margin:
            20px 0 0;

          max-width: 850px;

          font-size:
            clamp(52px, 10vw, 108px);

          line-height:
            .82;

          letter-spacing:
            -5px;

          font-weight:
            950;
        }

        .hero h1 span {
          display: block;

          background:
            linear-gradient(
              110deg,
              #fff 10%,
              #b99cff 50%,
              #fff 90%
            );

          -webkit-background-clip:
            text;

          background-clip:
            text;

          color:
            transparent;
        }

        .heroText {
          position: relative;

          z-index: 1;

          max-width: 520px;

          margin-top: 25px;

          color:
            rgba(255,255,255,.54);

          font-size: 14px;

          line-height: 1.7;
        }

        .heroStats {
          display: flex;

          flex-wrap: wrap;

          gap: 9px;

          margin-top: 30px;
        }

        .heroStat {
          padding:
            10px 13px;

          border-radius: 11px;

          background:
            rgba(255,255,255,.045);

          border:
            1px solid
            rgba(255,255,255,.075);

          color:
            rgba(255,255,255,.72);

          font-size: 10px;

          font-weight: 800;

          letter-spacing: .5px;
        }

        /* ====================================================
           MAIN WRAPPER
        ==================================================== */

        .wrap {
          width: 100%;

          max-width: 1180px;

          margin: 0 auto;

          padding:
            0 24px 70px;
        }

        .section {
          margin-top: 28px;
        }

        .sectionHeading {
          display: flex;

          align-items: flex-end;

          justify-content: space-between;

          gap: 20px;

          margin-bottom: 14px;
        }

        .sectionHeading h2 {
          margin: 0;

          font-size:
            clamp(22px, 4vw, 32px);

          letter-spacing:
            -.8px;
        }

        .sectionHeading p {
          margin:
            5px 0 0;

          color:
            rgba(255,255,255,.42);

          font-size: 11px;
        }

        .sectionLabel {
          color:
            rgba(255,255,255,.35);

          font-size: 9px;

          font-weight: 900;

          letter-spacing: 1.6px;

          text-transform: uppercase;
        }

        /* ====================================================
           MATCH CENTER
        ==================================================== */

        .matchCenter {
          display: grid;

          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(280px, .65fr);

          gap: 15px;
        }

        .matchPanel {
          position: relative;

          overflow: hidden;

          padding: 20px;

          border-radius: 22px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.065),
              rgba(255,255,255,.025)
            );

          border:
            1px solid
            rgba(255,255,255,.085);
        }

        .matchPanelLive {
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(255,50,50,.12),
              transparent 35%
            ),
            linear-gradient(
              145deg,
              rgba(255,255,255,.065),
              rgba(255,255,255,.025)
            );
        }

        .panelHeader {
          display: flex;

          align-items: center;

          justify-content: space-between;

          margin-bottom: 13px;
        }

        .panelTitle {
          display: flex;

          align-items: center;

          gap: 9px;
        }

        .panelIcon {
          width: 31px;
          height: 31px;

          display: grid;

          place-items: center;

          border-radius: 9px;

          background:
            rgba(255,255,255,.06);

          font-size: 14px;
        }

        .panelTitle strong {
          display: block;

          font-size: 13px;

          font-weight: 900;
        }

        .panelTitle span {
          display: block;

          margin-top: 2px;

          font-size: 8px;

          color:
            rgba(255,255,255,.38);

          text-transform:
            uppercase;

          letter-spacing:
            1px;
        }

        .panelCount {
          padding:
            5px 8px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.05);

          color:
            rgba(255,255,255,.45);

          font-size: 8px;

          font-weight: 900;
        }

        .emptyState {
          padding:
            26px 8px 17px;

          text-align: center;

          color:
            rgba(255,255,255,.34);
        }

        .emptyIcon {
          font-size: 22px;

          margin-bottom: 7px;

          opacity: .55;
        }

        .emptyState strong {
          display: block;

          font-size: 12px;

          color:
            rgba(255,255,255,.55);
        }

        .emptyState span {
          display: block;

          margin-top: 4px;

          font-size: 9px;
        }

        /* ====================================================
           MATCH CARD
        ==================================================== */

        .matchCard {
          position: relative;

          overflow: hidden;

          margin-top: 9px;

          padding: 15px;

          border-radius: 16px;

          background:
            rgba(5,6,11,.36);

          border:
            1px solid
            rgba(255,255,255,.065);

          transition:
            transform .2s ease,
            border-color .2s ease,
            background .2s ease;
        }

        .matchCard:hover {
          transform:
            translateY(-2px);

          border-color:
            rgba(255,255,255,.14);

          background:
            rgba(255,255,255,.045);
        }

        .matchCardLive {
          border-color:
            rgba(255,75,75,.20);

          box-shadow:
            inset 2px 0 0
            rgba(255,75,75,.8);
        }

        .matchTop {
          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;

          margin-bottom: 12px;
        }

        .matchSportWrap {
          display: flex;

          align-items: center;

          gap: 8px;
        }

        .sportIcon {
          width: 27px;
          height: 27px;

          display: grid;

          place-items: center;

          border-radius: 8px;

          background:
            rgba(255,255,255,.05);

          font-size: 13px;
        }

        .matchSport {
          font-size: 11px;

          font-weight: 900;
        }

        .matchGender {
          margin-top: 2px;

          color:
            rgba(255,255,255,.34);

          font-size: 8px;

          font-weight: 700;

          text-transform:
            uppercase;

          letter-spacing: .7px;
        }

        .matchStatus {
          display: flex;

          align-items: center;

          gap: 5px;

          padding:
            5px 8px;

          border-radius: 999px;

          font-size: 7px;

          font-weight: 950;

          letter-spacing: 1px;
        }

        .liveStatus {
          color: #ff6666;

          background:
            rgba(255,60,60,.08);
        }

        .upcomingStatus {
          color: #ffd84d;

          background:
            rgba(255,216,77,.07);
        }

        .finalStatus {
          color:
            rgba(255,255,255,.36);

          background:
            rgba(255,255,255,.045);
        }

        .liveDot {
          width: 5px;
          height: 5px;

          border-radius: 50%;

          background:
            #ff4d4d;

          box-shadow:
            0 0 9px
            rgba(255,60,60,.9);

          animation:
            pulseLive 1.4s infinite;
        }

        @keyframes pulseLive {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: .45;
            transform: scale(.72);
          }
        }

        .matchTeams {
          display: flex;

          flex-direction: column;

          gap: 5px;
        }

        .matchTeam {
          display: grid;

          grid-template-columns:
            4px
            minmax(0,1fr)
            auto;

          align-items: center;

          gap: 9px;

          min-height: 40px;

          padding:
            6px 9px;

          border-radius: 10px;

          background:
            rgba(255,255,255,.025);
        }

        .teamAccent {
          width: 4px;
          height: 22px;

          border-radius: 999px;
        }

        .teamName {
          min-width: 0;

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;

          font-size: 12px;

          font-weight: 850;
        }

        .teamScore {
          font-size: 18px;

          line-height: 1;

          font-weight: 950;
        }

        .winnerTeam {
          background:
            rgba(255,216,77,.055);
        }

        .winnerTeam .teamName,
        .winnerTeam .teamScore {
          color:
            #ffd84d;
        }

        .vs {
          position: absolute;

          left: 50%;

          transform:
            translateX(-50%);

          margin-top: 38px;

          width: 20px;
          height: 20px;

          display: grid;

          place-items: center;

          border-radius: 50%;

          background:
            #171821;

          border:
            1px solid
            rgba(255,255,255,.07);

          color:
            rgba(255,255,255,.27);

          font-size: 6px;

          font-weight: 900;

          z-index: 2;
        }

        .matchBottom {
          display: flex;

          justify-content: space-between;

          align-items: center;

          gap: 8px;

          margin-top: 10px;

          padding-top: 9px;

          border-top:
            1px solid
            rgba(255,255,255,.045);

          color:
            rgba(255,255,255,.32);

          font-size: 8px;

          font-weight: 700;
        }

        .playingNow {
          color:
            #ff6666;

          letter-spacing:
            .5px;
        }

        /* ====================================================
           COMPLETED
        ==================================================== */

        .completedBox {
          position: relative;

          overflow: hidden;

          padding: 22px;

          border-radius: 22px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.055),
              rgba(255,255,255,.018)
            );

          border:
            1px solid
            rgba(255,255,255,.08);
        }

        .completedGroup {
          margin-top: 9px;

          overflow: hidden;

          border-radius: 14px;

          border:
            1px solid
            rgba(255,255,255,.06);

          background:
            rgba(255,255,255,.018);
        }

        .completedGroup summary {
          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 12px;

          padding:
            13px 14px;

          cursor: pointer;

          list-style: none;
        }

        .completedGroup summary::-webkit-details-marker {
          display: none;
        }

        .completedGroup summary::after {
          content:
            "+";

          width: 23px;
          height: 23px;

          display: grid;

          place-items: center;

          flex-shrink: 0;

          border-radius: 7px;

          background:
            rgba(255,255,255,.05);

          color:
            rgba(255,255,255,.45);

          font-size: 15px;
        }

        .completedGroup[open]
          summary::after {
          content:
            "−";
        }

        .completedTitle {
          min-width: 0;
        }

        .completedTitle strong {
          display: block;

          font-size: 11px;

          font-weight: 900;
        }

        .completedTitle span {
          display: block;

          margin-top: 3px;

          color:
            rgba(255,255,255,.35);

          font-size: 8px;
        }

        .completedMatches {
          padding:
            0 9px 9px;
        }

        .matchCardCompact {
          margin-top: 7px;

          padding: 12px;

          border-radius: 12px;

          background:
            rgba(0,0,0,.16);
        }

        .matchCardCompact .sportIcon {
          display: none;
        }

        .matchCardCompact .matchTop {
          margin-bottom: 8px;
        }

        .matchCardCompact .matchTeam {
          min-height: 34px;

          padding:
            5px 8px;
        }

        .matchCardCompact .teamName {
          font-size: 11px;
        }

        .matchCardCompact .teamScore {
          font-size: 15px;
        }

        .matchCardCompact .matchBottom {
          margin-top: 7px;

          padding-top: 7px;
        }

        /* ====================================================
           CHAMPIONSHIP
        ==================================================== */

        .championship {
          position: relative;

          overflow: hidden;

          padding: 25px;

          border-radius: 24px;

          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(118,67,255,.18),
              transparent 36%
            ),
            radial-gradient(
              circle at 0% 100%,
              rgba(30,120,255,.08),
              transparent 35%
            ),
            rgba(15,16,26,.86);

          border:
            1px solid
            rgba(255,255,255,.09);

          box-shadow:
            0 25px 70px
            rgba(0,0,0,.2);
        }

        .championshipHeader {
          display: flex;

          align-items: flex-start;

          justify-content: space-between;

          gap: 15px;

          margin-bottom: 18px;
        }

        .championshipTitle {
          display: flex;

          gap: 11px;
        }

        .trophyBox {
          width: 40px;
          height: 40px;

          display: grid;

          place-items: center;

          flex-shrink: 0;

          border-radius: 12px;

          background:
            rgba(255,216,77,.08);

          border:
            1px solid
            rgba(255,216,77,.13);

          font-size: 19px;
        }

        .championship h2 {
          margin: 0;

          font-size:
            clamp(20px,4vw,29px);

          letter-spacing:
            -.7px;
        }

        .championshipSubtitle {
          margin:
            4px 0 0;

          color:
            rgba(255,255,255,.38);

          font-size: 9px;

          line-height: 1.5;
        }

        .leaderBadge {
          padding:
            6px 9px;

          border-radius: 999px;

          background:
            rgba(255,216,77,.08);

          color:
            #ffd84d;

          font-size: 7px;

          font-weight: 900;

          letter-spacing: .8px;

          white-space: nowrap;
        }

        .championLeader {
          position: relative;

          display: grid;

          grid-template-columns:
            42px
            minmax(0,1fr)
            auto;

          align-items: center;

          gap: 11px;

          padding:
            13px;

          margin-bottom: 8px;

          border-radius: 15px;

          background:
            linear-gradient(
              90deg,
              rgba(255,216,77,.10),
              rgba(255,255,255,.025)
            );

          border:
            1px solid
            rgba(255,216,77,.14);
        }

        .championMedal {
          width: 42px;
          height: 42px;

          display: grid;

          place-items: center;

          border-radius: 12px;

          background:
            rgba(255,216,77,.08);

          font-size: 21px;
        }

        .clubName {
          font-size: 14px;

          font-weight: 950;
        }

        .clubProgress {
          height: 4px;

          margin-top: 8px;

          overflow: hidden;

          border-radius: 99px;

          background:
            rgba(255,255,255,.07);
        }

        .clubProgress span {
          display: block;

          height: 100%;

          border-radius: inherit;

          background:
            linear-gradient(
              90deg,
              #ffd84d,
              #fff2a3
            );
        }

        .clubPoints {
          text-align: right;
        }

        .clubPoints strong {
          display: block;

          font-size: 23px;

          line-height: 1;

          font-weight: 950;
        }

        .clubPoints small {
          display: block;

          margin-top: 4px;

          color:
            rgba(255,255,255,.3);

          font-size: 7px;

          letter-spacing: 1px;
        }

        .overallRows {
          display: flex;

          flex-direction: column;

          gap: 5px;
        }

        .overallRowNew {
          display: grid;

          grid-template-columns:
            31px
            31px
            minmax(0,1fr)
            auto;

          align-items: center;

          gap: 8px;

          min-height: 49px;

          padding:
            5px 10px;

          border-radius: 12px;

          background:
            rgba(255,255,255,.025);

          border:
            1px solid
            transparent;

          transition:
            .2s ease;
        }

        .overallRowNew:hover {
          background:
            rgba(255,255,255,.05);

          border-color:
            rgba(255,255,255,.07);
        }

        .overallRank {
          color:
            rgba(255,255,255,.38);

          text-align: center;

          font-size: 10px;

          font-weight: 900;
        }

        .clubLogoMini {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.clubLogoMini img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

        .overallClubName {
          font-size: 11px;

          font-weight: 850;
        }

        .overallPointsNew {
          font-size: 14px;

          font-weight: 950;
        }

        .viewBreakdown {
          margin-top: 13px;

          text-align: center;
        }

        .viewBreakdown span {
          color:
            rgba(255,255,255,.3);

          font-size: 8px;

          letter-spacing: .5px;
        }

        /* ====================================================
           CLUB DETAILS
        ==================================================== */

        .clubDetails {
          margin-top: 14px;

          padding: 16px;

          border-radius: 16px;

          background:
            rgba(0,0,0,.20);

          border:
            1px solid
            rgba(255,255,255,.08);
        }

        .clubDetailsHeader {
          display: flex;

          justify-content: space-between;

          align-items: center;

          gap: 10px;

          margin-bottom: 9px;
        }

        .clubDetailsHeader h3 {
          margin: 0;

          font-size: 14px;
        }

        .closeDetails {
          border:
            1px solid
            rgba(255,255,255,.08);

          background:
            rgba(255,255,255,.045);

          color:
            rgba(255,255,255,.65);

          padding:
            6px 9px;

          border-radius: 7px;

          cursor: pointer;

          font-size: 8px;
        }

        .clubEventRow {
          display: grid;

          grid-template-columns:
            minmax(0,1fr)
            58px
            58px;

          gap: 7px;

          align-items: center;

          padding:
            10px 4px;

          border-bottom:
            1px solid
            rgba(255,255,255,.055);
        }

        .clubEventRow:last-child {
          border-bottom: none;
        }

        .clubEventName {
          font-size: 10px;

          font-weight: 850;
        }

        .clubEventMeta {
          margin-top: 2px;

          color:
            rgba(255,255,255,.32);

          font-size: 7px;
        }

        .clubEventRank {
          text-align: center;

          font-size: 8px;

          font-weight: 800;
        }

        .clubEventPoints {
          text-align: right;

          font-size: 12px;

          font-weight: 950;
        }

        /* ====================================================
           TEAM STANDINGS
        ==================================================== */

        .standingsSection {
          position: relative;

          overflow: hidden;

          padding: 23px;

          border-radius: 23px;

          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(83,52,190,.16),
              transparent 32%
            ),
            rgba(14,15,24,.88);

          border:
            1px solid
            rgba(255,255,255,.085);
        }

        .standingsTop {
          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          gap: 15px;
        }

        .standingsTop h2 {
          margin: 0;

          font-size:
            clamp(20px,4vw,29px);

          letter-spacing:
            -.7px;
        }

        .standingsTop p {
          margin:
            5px 0 0;

          max-width: 500px;

          color:
            rgba(255,255,255,.38);

          font-size: 9px;

          line-height: 1.5;
        }

        .sportSelect {
          width: 100%;

          max-width: 300px;

          margin-top: 16px;

          padding:
            11px 12px;

          border-radius: 10px;

          outline: none;

          border:
            1px solid
            rgba(255,255,255,.09);

          background:
            #171821;

          color: white;

          font-size: 10px;

          font-weight: 750;
        }

        .standingsDesktop {
          margin-top: 14px;

          overflow-x: auto;

          border-radius: 14px;

          border:
            1px solid
            rgba(255,255,255,.06);
        }

        .standingsTable {
          width: 100%;

          border-collapse:
            collapse;

          min-width: 620px;
        }

        .standingsTable th {
          padding:
            10px 8px;

          background:
            rgba(255,255,255,.035);

          color:
            rgba(255,255,255,.35);

          font-size: 7px;

          letter-spacing:
            1px;

          text-align: center;

          font-weight: 900;
        }

        .standingsTable th:nth-child(2) {
          text-align: left;
        }

        .standingsTable td {
          padding:
            12px 8px;

          border-top:
            1px solid
            rgba(255,255,255,.045);

          text-align: center;

          font-size: 10px;
        }

        .standingsTable td.clubCell {
          text-align: left;

          font-weight: 900;
        }

        .standingsTable tr:first-child {
          background:
            rgba(255,216,77,.055);
        }

        .standingsTable tr:first-child
          td.clubCell {
          color:
            #ffd84d;
        }

        .tablePoints {
          font-size: 13px !important;

          font-weight: 950;
        }

        .mobileStandings {
          display: none;
        }

        .mobileStanding {
          display: grid;

          grid-template-columns:
            31px
            31px
            minmax(0,1fr)
            48px;

          align-items: center;

          gap: 7px;

          min-height: 59px;

          padding:
            7px 8px;

          border-bottom:
            1px solid
            rgba(255,255,255,.05);
        }

        .mobileStanding:last-child {
          border-bottom: none;
        }

        .mobileStanding:first-child {
          background:
            rgba(255,216,77,.045);
        }

        .mobileRank {
          text-align: center;

          font-size: 12px;

          font-weight: 900;
        }

        .mobileClubBadge {
          width: 27px;
          height: 27px;

          display: grid;

          place-items: center;

          border-radius: 8px;

          font-size: 6px;

          font-weight: 950;
        }

        .mobileClubName {
          font-size: 10px;

          font-weight: 900;
        }

        .mobileStats {
          display: flex;

          gap: 7px;

          margin-top: 3px;

          color:
            rgba(255,255,255,.32);

          font-size: 7px;

          font-weight: 700;
        }

        .mobilePoints {
          text-align: right;

          font-size: 16px;

          font-weight: 950;
        }

        .mobilePoints small {
          display: block;

          margin-top: 2px;

          color:
            rgba(255,255,255,.25);

          font-size: 6px;

          letter-spacing:
            1px;
        }

        .tableLegend {
          margin-top: 11px;

          color:
            rgba(255,255,255,.27);

          font-size: 7px;

          line-height: 1.6;
        }

        .tableLegend b {
          color:
            rgba(255,255,255,.55);
        }

        /* ====================================================
           POINTS SYSTEM
        ==================================================== */

        .pointsSection {
          padding:
            20px;

          border-radius: 20px;

          background:
            rgba(255,255,255,.035);

          border:
            1px solid
            rgba(255,255,255,.07);
        }

        .pointsSection h2 {
          margin: 0;

          font-size: 18px;
        }

        .pointsGrid {
          display: grid;

          grid-template-columns:
            repeat(3,1fr);

          gap: 8px;

          margin-top: 14px;
        }

        .pointRule {
          padding:
            14px;

          border-radius: 13px;

          background:
            rgba(0,0,0,.17);

          border:
            1px solid
            rgba(255,255,255,.045);
        }

        .pointRule strong {
          display: block;

          font-size: 9px;

          font-weight: 900;

          color:
            rgba(255,255,255,.55);
        }

        .pointRule span {
          display: block;

          margin-top: 8px;

          font-size: 10px;

          font-weight: 800;

          line-height: 1.5;
        }

        /* ====================================================
           FOOTER
        ==================================================== */

        .footer {
          padding:
            35px 0 10px;

          text-align: center;

          color:
            rgba(255,255,255,.2);

          font-size: 8px;

          letter-spacing: 1px;
        }

        .footer strong {
          color:
            rgba(255,255,255,.42);
        }

        /* ====================================================
           MOBILE
        ==================================================== */

        @media (max-width: 700px) {

          header {
            height: 58px;

            padding:
              0 14px;
          }

          .logo {
            font-size: 12px;

            letter-spacing:
              1.5px;
          }

          .adminLink {
            font-size: 8px;

            padding:
              7px 9px;
          }

          .hero {
            padding:
              48px 14px 38px;
          }

          .hero h1 {
            font-size:
              clamp(54px, 17vw, 78px);

            letter-spacing:
              -4px;
          }

          .heroText {
            max-width: 330px;

            font-size: 11px;
          }

          .heroStats {
            margin-top: 20px;
          }

          .heroStat {
            font-size: 8px;

            padding:
              8px 10px;
          }

          .wrap {
            padding:
              0 12px 45px;
          }

          .section {
            margin-top: 20px;
          }

          .matchCenter {
            grid-template-columns:
              1fr;

            gap: 10px;
          }

          .matchPanel {
            padding: 14px;

            border-radius: 17px;
          }

          .matchPanel:nth-child(2) {
            margin-top: 0;
          }

          .matchCard {
            padding: 12px;

            border-radius: 13px;
          }

          .completedBox,
          .championship,
          .standingsSection {
            padding: 15px;

            border-radius: 18px;
          }

          .championshipHeader {
            margin-bottom: 13px;
          }

          .trophyBox {
            width: 34px;
            height: 34px;

            border-radius: 9px;

            font-size: 16px;
          }

          .championshipSubtitle {
            font-size: 8px;
          }

          .leaderBadge {
            display: none;
          }

          .championLeader {
            grid-template-columns:
              37px
              minmax(0,1fr)
              auto;

            padding: 9px;
          }

          .championMedal {
            width: 37px;
            height: 37px;

            font-size: 18px;
          }

          .clubPoints strong {
            font-size: 19px;
          }

          .overallRowNew {
            grid-template-columns:
              25px
              28px
              minmax(0,1fr)
              auto;

            min-height: 45px;

            padding:
              4px 7px;
          }

          .clubLogoMini {
            width: 25px;
            height: 25px;
          }

          .standingsTop {
            display: block;
          }

          .standingsTop p {
            max-width: 320px;
          }

          .sportSelect {
            max-width: none;
          }

          .standingsDesktop {
            display: none;
          }

          .mobileStandings {
            display: block;

            margin-top: 10px;

            overflow: hidden;

            border-radius: 13px;

            border:
              1px solid
              rgba(255,255,255,.055);
          }

          .tableLegend {
            font-size: 6px;
          }

          .pointsGrid {
            grid-template-columns:
              1fr;
          }

          .pointRule {
            padding:
              11px 12px;
          }

        }

        @media (min-width: 701px) {

          .mobileStandings {
            display: none;
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

        <a
          href="/admin"
          className="adminLink"
        >
          ADMIN
        </a>

      </header>

      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="hero">

        <div className="heroEyebrow">
          <span className="heroEyebrowDot" />
          EUPHORIA 2026
          <span>
            · INTER-CLUB CHAMPIONSHIP
          </span>
        </div>

        <h1>
          THE GAME
          <span>
            IS ON.
          </span>
        </h1>

        <p className="heroText">
          Five clubs. One championship.
          Follow live scores, results
          and the race for the Euphoria
          Club Championship.
        </p>

        <div className="heroStats">

          <div className="heroStat">
            🏆 {leaderboard.length} CLUBS
          </div>

          <div className="heroStat">
            🔴 {liveMatches.length} LIVE
          </div>

          <div className="heroStat">
            📊 {completedMatches.length} RESULTS
          </div>

        </div>

      </section>

      <section className="wrap">

        {/* ====================================================
            MATCH CENTER
        ==================================================== */}

        <div className="section">

          <div className="sectionHeading">

            <div>
              <div className="sectionLabel">
                THE ACTION
              </div>

              <h2>
                Match Center
              </h2>
            </div>

          </div>

          <div className="matchCenter">

            {/* LIVE */}

            <div
              className={`matchPanel ${
                liveMatches.length
                  ? "matchPanelLive"
                  : ""
              }`}
            >

              <div className="panelHeader">

                <div className="panelTitle">

                  <div className="panelIcon">
                    🔴
                  </div>

                  <div>
                    <strong>
                      Live Now
                    </strong>

                    <span>
                      Matches in progress
                    </span>
                  </div>

                </div>

                <div className="panelCount">
                  {liveMatches.length}
                </div>

              </div>

              {loading ? (
                <div className="emptyState">
                  Loading...
                </div>
              ) : liveMatches.length === 0 ? (
                <div className="emptyState">

                  <div className="emptyIcon">
                    🏟️
                  </div>

                  <strong>
                    No live matches
                  </strong>

                  <span>
                    The arena is quiet for now.
                  </span>

                </div>
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

            {/* UPCOMING */}

            <div className="matchPanel">

              <div className="panelHeader">

                <div className="panelTitle">

                  <div className="panelIcon">
                    ⏱️
                  </div>

                  <div>
                    <strong>
                      Up Next
                    </strong>

                    <span>
                      Upcoming fixtures
                    </span>
                  </div>

                </div>

                <div className="panelCount">
                  {upcomingMatches.length}
                </div>

              </div>

              {loading ? (
                <div className="emptyState">
                  Loading...
                </div>
              ) : upcomingMatches.length === 0 ? (
                <div className="emptyState">

                  <div className="emptyIcon">
                    📅
                  </div>

                  <strong>
                    No upcoming matches
                  </strong>

                  <span>
                    New fixtures will appear here.
                  </span>

                </div>
              ) : (
                upcomingMatches
                  .slice(0, 3)
                  .map(
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

        </div>

        {/* ====================================================
            COMPLETED
        ==================================================== */}

        <div className="section">

          <div className="completedBox">

            <div className="sectionHeading">

              <div>

                <div className="sectionLabel">
                  THE RESULTS
                </div>

                <h2>
                  Completed Matches
                </h2>

                <p>
                  Results from the championship.
                </p>

              </div>

              <div className="panelCount">
                {completedMatches.length}
              </div>

            </div>

            {loading ? (
              <div className="emptyState">
                Loading results...
              </div>
            ) : completedSportGroups.length === 0 ? (
              <div className="emptyState">

                <div className="emptyIcon">
                  📋
                </div>

                <strong>
                  No results yet
                </strong>

                <span>
                  Completed matches will appear here.
                </span>

              </div>
            ) : (

              completedSportGroups.map(
                (group, index) => (

                  <details
                    className="completedGroup"
                    key={
                      `${group.sport}-${group.gender}`
                    }
                    open={index === 0}
                  >

                    <summary>

                      <div className="completedTitle">

                        <strong>
                          {group.sport}
                        </strong>

                        <span>
                          {group.gender}
                          {" · "}
                          {group.matches.length}
                          {" "}
                          {group.matches.length === 1
                            ? "match"
                            : "matches"}
                        </span>

                      </div>

                    </summary>

                    <div className="completedMatches">

                      {group.matches.map(
                        (match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            compact
                          />
                        )
                      )}

                    </div>

                  </details>

                )
              )

            )}

          </div>

        </div>

        {/* ====================================================
            CHAMPIONSHIP
        ==================================================== */}

        <div className="section">

          <div className="championship">

            <div className="championshipHeader">

              <div className="championshipTitle">

                <div className="trophyBox">
                  🏆
                </div>

                <div>

                  <h2>
                    Club Championship
                  </h2>

                  <p className="championshipSubtitle">
                    Every medal counts.
                    Every point moves the table.
                  </p>

                </div>

              </div>

              <div className="leaderBadge">
                CURRENT LEADER
              </div>

            </div>

            {leaderboard.length > 0 && (

              <div className="championLeader">

                <div className="championMedal">
                  🥇
                </div>

                <div>

                  <div className="clubName">
                    {leaderboard[0]}
                  </div>

                  <div className="clubProgress">

                    <span
                      style={{
                        width:
                          leaderPoints > 0
                            ? "100%"
                            : "0%",
                      }}
                    />

                  </div>

                </div>

                <div className="clubPoints">

                  <strong>
                    {leaderPoints}
                  </strong>

                  <small>
                    POINTS
                  </small>

                </div>

              </div>

            )}

            <div className="overallRows">

              {leaderboard
                .slice(1)
                .map(
                  (
                    club,
                    index
                  ) => {

                    const actualIndex =
                      index + 1;

                    const theme =
                      getClubTheme(
                        club
                      );

                    const clubPointsValue =
                      Number(
                        points[club] || 0
                      );

                    const percentage =
                      leaderPoints > 0
                        ? Math.min(
                            100,
                            (clubPointsValue /
                              leaderPoints) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        className="overallRowNew"
                        key={club}
                      >

                        <div className="overallRank">
                          {getMedal(
                            actualIndex
                          )}
                        </div>

                        <div className="clubLogoMini">
  <img
    src={clubLogos[club]}
    alt={`${club} logo`}
  />
</div>

                        <button
                          onClick={() =>
                            setSelectedClub(
                              selectedClub ===
                                club
                                ? null
                                : club
                            )
                          }
                          style={{
                            border: "none",
                            background:
                              "transparent",
                            color:
                              "inherit",
                            padding: 0,
                            textAlign:
                              "left",
                            cursor:
                              "pointer",
                          }}
                        >

                          <div className="overallClubName">
                            {club}
                          </div>

                        </button>

                        <div className="overallPointsNew">
                          {clubPointsValue}
                        </div>

                      </div>
                    );
                  }
                )}

            </div>

            <div className="viewBreakdown">
              <span>
                Tap a club to view its event breakdown
              </span>
            </div>

            {/* CLUB DETAILS */}

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
                      setSelectedClub(
                        null
                      )
                    }
                  >
                    CLOSE
                  </button>

                </div>

                {selectedClubDetails.length ===
                0 ? (

                  <div className="emptyState">

                    <strong>
                      No event points yet
                    </strong>

                  </div>

                ) : (

                  <>

                    <div
                      className="clubEventRow"
                      style={{
                        color:
                          "rgba(255,255,255,.25)",
                        fontSize:
                          "7px",
                        fontWeight:
                          900,
                      }}
                    >

                      <div>
                        EVENT
                      </div>

                      <div
                        style={{
                          textAlign:
                            "center",
                        }}
                      >
                        RANK
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        PTS
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

                            {result.position ===
                            1
                              ? "🥇 1st"
                              : result.position ===
                                2
                              ? "🥈 2nd"
                              : result.position ===
                                3
                              ? "🥉 3rd"
                              : `${result.position}th`}

                          </div>

                          <div className="clubEventPoints">

                            {Number(
                              result.points ||
                                0
                            )}

                          </div>

                        </div>

                      )
                    )}

                  </>

                )}

              </div>

            )}

          </div>

        </div>

        {/* ====================================================
            TEAM STANDINGS
        ==================================================== */}

        <div className="section">

          <div className="standingsSection">

            <div className="standingsTop">

              <div>

                <div className="sectionLabel">
                  HEAD TO HEAD
                </div>

                <h2>
                  Team Standings
                </h2>

                <p>
                  Competition points calculated
                  automatically from completed matches.
                </p>

              </div>

            </div>

            {teamSports.length === 0 ? (

              <div className="emptyState">
                <strong>
                  No team sports yet
                </strong>
              </div>

            ) : (

              <>

                <select
                  className="sportSelect"
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

                {selectedEvent && (

                  <>

                    <div
                      className="standingsDesktop"
                    >

                      {sportLeaderboard.completedCount ===
                      0 ? (

                        <div className="emptyState">

                          <strong>
                            No matches played yet
                          </strong>

                          <span>
                            Standings will update
                            automatically.
                          </span>

                        </div>

                      ) : (

                        <table className="standingsTable">

                          <thead>

                            <tr>

                              <th>
                                POS
                              </th>

                              <th>
                                CLUB
                              </th>

                              <th>
                                P
                              </th>

                              <th>
                                W
                              </th>

                              {(isFootball ||
                                (!isCricket &&
                                  !usesPD)) && (
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
                                >

                                  <td
                                    style={{
                                      fontSize:
                                        "13px",
                                      fontWeight:
                                        900,
                                    }}
                                  >
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
                                    <td>
                                      {formatNRR(
                                        row.nrr
                                      )}
                                    </td>
                                  )}

                                  {isFootball && (
                                    <td>
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

                                      <td>
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

                                  <td className="tablePoints">
                                    {
                                      row.points
                                    }
                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      )}

                    </div>

                    <div className="mobileStandings">

                      {sportLeaderboard.completedCount ===
                      0 ? (

                        <div className="emptyState">

                          <strong>
                            No matches played yet
                          </strong>

                          <span>
                            Standings will update automatically.
                          </span>

                        </div>

                      ) : (

                        sportLeaderboard.rows.map(
                          (
                            row,
                            index
                          ) => {

                            const theme =
                              getClubTheme(
                                row.name
                              );

                            return (
                              <div
                                className="mobileStanding"
                                key={
                                  row.id
                                }
                              >

                                <div className="mobileRank">
                                  {getMedal(
                                    index
                                  )}
                                </div>

                                <div
                                  className="mobileClubBadge"
                                  style={{
                                    background:
                                      `${theme.color}18`,
                                    color:
                                      theme.color,
                                  }}
                                >
                                  {theme.short}
                                </div>

                                <div>

                                  <div className="mobileClubName">
                                    {
                                      row.name
                                    }
                                  </div>

                                  <div className="mobileStats">

                                    <span>
                                      P
                                      {" "}
                                      {
                                        row.played
                                      }
                                    </span>

                                    <span>
                                      W
                                      {" "}
                                      {
                                        row.wins
                                      }
                                    </span>

                                    {(isFootball ||
                                      (!isCricket &&
                                        !usesPD)) && (
                                      <span>
                                        D
                                        {" "}
                                        {
                                          row.draws
                                        }
                                      </span>
                                    )}

                                    <span>
                                      L
                                      {" "}
                                      {
                                        row.losses
                                      }
                                    </span>

                                    {isCricket && (
                                      <span>
                                        NR
                                        {" "}
                                        {
                                          row.noResults
                                        }
                                      </span>
                                    )}

                                  </div>

                                </div>

                                <div className="mobilePoints">

                                  {
                                    row.points
                                  }

                                  <small>
                                    PTS
                                  </small>

                                </div>

                              </div>
                            );
                          }
                        )

                      )}

                    </div>

                    {sportLeaderboard.completedCount >
                      0 && (

                      <div className="tableLegend">

                        <b>P</b> Played ·{" "}

                        <b>W</b> Won ·{" "}

                        {(isFootball ||
                          (!isCricket &&
                            !usesPD)) && (
                          <>
                            <b>D</b> Draw ·{" "}
                          </>
                        )}

                        <b>L</b> Lost ·{" "}

                        {isCricket && (
                          <>
                            <b>NR</b> No Result ·{" "}
                            <b>NRR</b> Net Run Rate ·{" "}
                          </>
                        )}

                        {isFootball && (
                          <>
                            <b>GD</b> Goal Difference ·{" "}
                          </>
                        )}

                        {usesPD && (
                          <>
                            <b>PF</b> Points For ·{" "}
                            <b>PA</b> Points Against ·{" "}
                            <b>PD</b> Point Difference ·{" "}
                          </>
                        )}

                        <b>PTS</b> Competition Points

                      </div>

                    )}

                  </>

                )}

              </>

            )}

          </div>

        </div>

 

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="footer">

          <strong>
            EUPHORIA 2026
          </strong>

          {" · "}

          THE GAME IS ON.

        </div>

      </section>

    </main>
  );
}
