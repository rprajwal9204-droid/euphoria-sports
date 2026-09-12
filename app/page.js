"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================
   CLUBS
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
    color: "#1688ff",
    glow: "rgba(22,136,255,.30)",
    icon: "🔵",
  },
  Eagles: {
    color: "#ffd43b",
    glow: "rgba(255,212,59,.24)",
    icon: "🟡",
  },
  Thunderbirds: {
    color: "#a855f7",
    glow: "rgba(168,85,247,.28)",
    icon: "🟣",
  },
  Griffins: {
    color: "#ff4d5e",
    glow: "rgba(255,77,94,.25)",
    icon: "🔴",
  },
  Phoenix: {
    color: "#ff8a32",
    glow: "rgba(255,138,50,.25)",
    icon: "🟠",
  },
};

function getClubTheme(name) {
  return (
    clubTheme[name] || {
      color: "#ffffff",
      glow: "rgba(255,255,255,.15)",
      icon: "⚪",
    }
  );
}

/* ============================================================
   HELPERS
============================================================ */

function isFinal(status) {
  return String(status || "").toLowerCase() === "final";
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

function getMedal(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";

  return index + 1;
}

function formatMatchTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(
    undefined,
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }
  );
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

  const [now, setNow] =
    useState(Date.now());

  /* ============================================================
     COUNTDOWN CLOCK
  ============================================================ */

  useEffect(() => {
    const timer =
      setInterval(() => {
        setNow(Date.now());
      }, 1000);

    return () =>
      clearInterval(timer);
  }, []);

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

  const nextMatch =
    upcomingMatches.length > 0
      ? upcomingMatches[0]
      : null;

  /* ============================================================
     COUNTDOWN
  ============================================================ */

  function getCountdown(match) {
    if (!match?.match_time) {
      return null;
    }

    const target =
      new Date(
        match.match_time
      ).getTime();

    if (!Number.isFinite(target)) {
      return null;
    }

    const difference =
      target - now;

    if (difference <= 0) {
      return null;
    }

    const totalSeconds =
      Math.floor(
        difference / 1000
      );

    const days =
      Math.floor(
        totalSeconds / 86400
      );

    const hours =
      Math.floor(
        (totalSeconds % 86400) /
          3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
          60
      );

    const seconds =
      totalSeconds % 60;

    return {
      days,
      hours,
      minutes,
      seconds,
    };
  }

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

    const themeA =
      getClubTheme(
        match.club_a?.name
      );

    const themeB =
      getClubTheme(
        match.club_b?.name
      );

    const status =
      String(
        match.status || ""
      ).toLowerCase();

    return (
      <div
        className={`match ${
          status === "live"
            ? "matchLive"
            : ""
        }`}
      >
        <div className="matchTop">
          <span>
            {match.events?.name ||
              "SPORT"}
          </span>

          <span
            className={
              status === "live"
                ? "matchStatusLive"
                : ""
            }
          >
            {status === "live"
              ? "● LIVE"
              : match.status}
          </span>
        </div>

        <div className="matchTeam">
          <div
            className="clubDot"
            style={{
              background:
                themeA.color,
              boxShadow:
                `0 0 12px ${themeA.glow}`,
            }}
          />

          <b
            className={
              isWinnerA
                ? "winnerHighlight"
                : ""
            }
          >
            {match.club_a?.name ||
              "TBD"}
          </b>

          <strong
            className={
              isWinnerA
                ? "winnerScoreHighlight"
                : ""
            }
          >
            {match.score_a ||
              "—"}
          </strong>
        </div>

        <div className="matchTeam">
          <div
            className="clubDot"
            style={{
              background:
                themeB.color,
              boxShadow:
                `0 0 12px ${themeB.glow}`,
            }}
          />

          <b
            className={
              isWinnerB
                ? "winnerHighlight"
                : ""
            }
          >
            {match.club_b?.name ||
              "TBD"}
          </b>

          <strong
            className={
              isWinnerB
                ? "winnerScoreHighlight"
                : ""
            }
          >
            {match.score_b ||
              "—"}
          </strong>
        </div>

        <div className="matchMeta">
          <span>
            {match.events?.gender}
          </span>

          {match.match_time && (
            <span>
              {formatMatchTime(
                match.match_time
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  /* ============================================================
     RETURN
  ============================================================ */

  return (
    <main>

      <style jsx>{`

        :global(html) {
          scroll-behavior: smooth;
        }

        :global(body) {
          margin: 0;
          background: #07080d;
          color: #f5f5f7;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        main {
          min-height: 100vh;
          overflow-x: hidden;

          background:
            radial-gradient(
              circle at 15% 5%,
              rgba(92, 47, 255, .16),
              transparent 28%
            ),
            radial-gradient(
              circle at 90% 25%,
              rgba(0, 157, 255, .10),
              transparent 30%
            ),
            linear-gradient(
              180deg,
              #07080d 0%,
              #0a0a12 45%,
              #07080d 100%
            );
        }

        /* ====================================================
           AMBIENT BACKGROUND
        ==================================================== */

        main::before {
          content: "";
          position: fixed;
          inset: 0;

          pointer-events: none;
          z-index: 0;

          background:
            linear-gradient(
              115deg,
              transparent 0%,
              rgba(255,255,255,.018) 48%,
              transparent 52%
            );

          background-size: 260% 260%;

          animation:
            atmosphere 18s ease-in-out infinite;
        }

        main::after {
          content: "";
          position: fixed;

          width: 380px;
          height: 380px;

          left: -180px;
          top: 35%;

          border-radius: 50%;

          background:
            rgba(73, 42, 255, .10);

          filter: blur(90px);

          pointer-events: none;
          z-index: 0;

          animation:
            floatGlow 12s ease-in-out infinite;
        }

        @keyframes atmosphere {
          0%, 100% {
            opacity: .35;
            transform: translateX(-3%);
          }

          50% {
            opacity: .8;
            transform: translateX(3%);
          }
        }

        @keyframes floatGlow {
          0%, 100% {
            transform: translateY(-20px);
          }

          50% {
            transform: translateY(80px);
          }
        }

        header,
        .hero,
        .wrap {
          position: relative;
          z-index: 1;
        }

        /* ====================================================
           HEADER
        ==================================================== */

        header {
          width: min(
            1180px,
            calc(100% - 32px)
          );

          margin: auto;

          height: 72px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border-bottom: 1px solid
            rgba(255,255,255,.08);
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

        header a {
          color: #fff;
          text-decoration: none;

          font-size: 10px;
          font-weight: 900;

          letter-spacing: 1px;

          padding: 9px 12px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.06);

          border: 1px solid
            rgba(255,255,255,.10);

          transition:
            transform .2s ease,
            background .2s ease;
        }

        header a:hover {
          transform: translateY(-2px);
          background:
            rgba(255,255,255,.10);
        }

        /* ====================================================
           HERO
        ==================================================== */

        .hero {
          width: min(
            1180px,
            calc(100% - 32px)
          );

          margin: auto;

          min-height: 390px;

          display: flex;
          flex-direction: column;
          justify-content: center;

          padding:
            80px 0 70px;
        }

        .hero::before {
          content: "";

          position: absolute;

          width: 500px;
          height: 500px;

          left: -160px;
          top: -150px;

          background:
            radial-gradient(
              circle,
              rgba(100,58,255,.22),
              transparent 68%
            );

          filter: blur(20px);

          pointer-events: none;
        }

        .hero small {
          position: relative;

          color: #b89cff;

          font-size: 10px;
          font-weight: 950;

          letter-spacing: 3px;

          animation:
            fadeUp .7s ease both;
        }

        .hero h1 {
          position: relative;

          margin:
            16px 0 16px;

          max-width: 800px;

          font-size:
            clamp(55px, 10vw, 118px);

          line-height: .82;

          letter-spacing:
            -6px;

          font-weight: 1000;

          background:
            linear-gradient(
              120deg,
              #fff 20%,
              #b7a3ff 55%,
              #72c9ff 100%
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;

          animation:
            fadeUp .8s .08s ease both;
        }

        .hero p {
          position: relative;

          max-width: 500px;

          margin: 0;

          color:
            rgba(255,255,255,.57);

          font-size: 14px;
          line-height: 1.7;

          animation:
            fadeUp .8s .16s ease both;
        }

        .heroStats {
          position: relative;

          display: flex;
          gap: 10px;

          margin-top: 28px;

          flex-wrap: wrap;
        }

        .heroPill {
          padding: 9px 13px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.055);

          border: 1px solid
            rgba(255,255,255,.08);

          color:
            rgba(255,255,255,.72);

          font-size: 9px;
          font-weight: 850;

          letter-spacing: .7px;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ====================================================
           MAIN WRAPPER
        ==================================================== */

        .wrap {
          width: min(
            1180px,
            calc(100% - 32px)
          );

          margin: auto;

          padding-bottom: 80px;
        }

        /* ====================================================
           SECTION HEADERS
        ==================================================== */

        .sectionHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 15px;
        }

        .sectionHeader h2 {
          margin: 0;

          font-size: 20px;
          letter-spacing: -.4px;
        }

        .sectionHeader p {
          margin: 5px 0 0;

          font-size: 11px;
          opacity: .48;
        }

        .eyebrow {
          display: block;

          margin-bottom: 6px;

          color: #a994ff;

          font-size: 9px;
          font-weight: 900;

          letter-spacing: 2px;
        }

        /* ====================================================
           GLASS CARD
        ==================================================== */

        .card {
          position: relative;

          border-radius: 24px;

          padding: 22px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.075),
              rgba(255,255,255,.025)
            );

          border: 1px solid
            rgba(255,255,255,.085);

          box-shadow:
            0 20px 60px
              rgba(0,0,0,.24),
            inset 0 1px 0
              rgba(255,255,255,.055);

          backdrop-filter:
            blur(22px);

          -webkit-backdrop-filter:
            blur(22px);

          overflow: hidden;
        }

        .card::before {
          content: "";

          position: absolute;

          width: 180px;
          height: 180px;

          right: -100px;
          top: -100px;

          border-radius: 50%;

          background:
            rgba(120,80,255,.10);

          filter: blur(40px);

          pointer-events: none;
        }

        .section {
          margin-top: 20px;
        }

        .muted {
          color:
            rgba(255,255,255,.43);
        }

        /* ====================================================
           MATCH CENTER
        ==================================================== */

        .matchCenter {
          display: grid;

          grid-template-columns:
            1.1fr
            .9fr;

          gap: 18px;

          margin-bottom: 20px;
        }

        .matchCenterCard {
          min-height: 230px;
        }

        .matchCenterCard.liveCard {
          background:
            radial-gradient(
              circle at 90% 0%,
              rgba(255,50,70,.12),
              transparent 35%
            ),
            linear-gradient(
              145deg,
              rgba(255,255,255,.08),
              rgba(255,255,255,.025)
            );
        }

        .liveBadge {
          display: inline-flex;

          align-items: center;
          gap: 7px;

          color: #ff5969;

          font-size: 10px;
          font-weight: 950;

          letter-spacing: 1.4px;
        }

        .liveDot {
          width: 7px;
          height: 7px;

          border-radius: 50%;

          background: #ff4055;

          box-shadow:
            0 0 0 0
              rgba(255,64,85,.55);

          animation:
            livePulse 1.7s infinite;
        }

        @keyframes livePulse {
          0% {
            box-shadow:
              0 0 0 0
                rgba(255,64,85,.55);
          }

          70% {
            box-shadow:
              0 0 0 9px
                rgba(255,64,85,0);
          }

          100% {
            box-shadow:
              0 0 0 0
                rgba(255,64,85,0);
          }
        }

        .matchCenterCard h2 {
          margin:
            8px 0 15px;

          font-size: 23px;
        }

        .emptyState {
          min-height: 120px;

          display: flex;
          flex-direction: column;
          justify-content: center;

          color:
            rgba(255,255,255,.45);
        }

        .emptyState strong {
          color:
            rgba(255,255,255,.72);

          font-size: 14px;
        }

        .emptyState span {
          margin-top: 5px;

          font-size: 11px;
        }

        /* ====================================================
           MATCH
        ==================================================== */

        .match {
          position: relative;

          margin-top: 10px;

          padding: 14px 15px;

          border-radius: 17px;

          background:
            rgba(255,255,255,.045);

          border: 1px solid
            rgba(255,255,255,.065);

          transition:
            transform .2s ease,
            background .2s ease,
            border .2s ease;
        }

        .match:hover {
          transform: translateY(-2px);

          background:
            rgba(255,255,255,.065);

          border-color:
            rgba(255,255,255,.12);
        }

        .matchLive {
          border-color:
            rgba(255,65,85,.25);

          box-shadow:
            inset 3px 0 0 #ff4055;
        }

        .matchTop {
          display: flex;
          justify-content: space-between;

          margin-bottom: 10px;

          color:
            rgba(255,255,255,.42);

          font-size: 8px;
          font-weight: 850;

          letter-spacing: .9px;

          text-transform: uppercase;
        }

        .matchStatusLive {
          color: #ff5969;
        }

        .matchTeam {
          display: grid;

          grid-template-columns:
            9px
            minmax(0,1fr)
            auto;

          align-items: center;

          gap: 9px;

          min-height: 29px;
        }

        .clubDot {
          width: 7px;
          height: 7px;

          border-radius: 50%;
        }

        .matchTeam b {
          font-size: 14px;
        }

        .matchTeam strong {
          font-size: 17px;
          font-weight: 950;
        }

        .matchMeta {
          display: flex;
          justify-content: space-between;

          margin-top: 9px;
          padding-top: 8px;

          border-top: 1px solid
            rgba(255,255,255,.055);

          color:
            rgba(255,255,255,.38);

          font-size: 8px;
        }

        .winnerHighlight {
          color: #ffd84d !important;
          font-weight: 950 !important;
        }

        .winnerScoreHighlight {
          color: #ffd84d !important;
          font-weight: 950 !important;
        }

        /* ====================================================
           NEXT UP
        ==================================================== */

        .nextUp {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .nextUpLabel {
          color: #ffd84d;

          font-size: 9px;
          font-weight: 950;

          letter-spacing: 1.5px;
        }

        .nextUpSport {
          margin-top: 7px;

          font-size: 11px;
          opacity: .55;
        }

        .nextTeams {
          display: grid;

          grid-template-columns:
            1fr
            auto
            1fr;

          align-items: center;

          gap: 12px;

          margin-top: 18px;
        }

        .nextTeam {
          text-align: center;
        }

        .nextTeamIcon {
          width: 46px;
          height: 46px;

          margin:
            0 auto 8px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 15px;

          background:
            rgba(255,255,255,.055);

          border: 1px solid
            rgba(255,255,255,.09);

          font-size: 20px;
        }

        .nextTeamName {
          font-size: 12px;
          font-weight: 900;
        }

        .vs {
          font-size: 9px;
          font-weight: 950;
          opacity: .38;
        }

        .countdown {
          display: flex;

          justify-content: center;

          gap: 7px;

          margin-top: 18px;
        }

        .timeBox {
          min-width: 48px;

          padding:
            9px 6px;

          border-radius: 12px;

          text-align: center;

          background:
            rgba(0,0,0,.22);

          border: 1px solid
            rgba(255,255,255,.07);
        }

        .timeBox strong {
          display: block;

          font-size: 17px;
          line-height: 1;

          font-weight: 950;
        }

        .timeBox span {
          display: block;

          margin-top: 5px;

          font-size: 7px;
          letter-spacing: 1px;

          opacity: .4;
        }

        .nextDate {
          margin-top: 10px;

          text-align: center;

          font-size: 9px;
          opacity: .4;
        }

        /* ====================================================
           CHAMPIONSHIP
        ==================================================== */

        .championship {
          position: relative;

          overflow: hidden;

          padding: 25px;

          border-radius: 25px;

          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(125,77,255,.20),
              transparent 38%
            ),
            radial-gradient(
              circle at 0% 100%,
              rgba(0,170,255,.10),
              transparent 35%
            ),
            rgba(18,19,34,.82);

          border: 1px solid
            rgba(255,255,255,.10);

          box-shadow:
            0 25px 70px
              rgba(0,0,0,.25);
        }

        .championshipHeader {
          position: relative;

          display: flex;

          align-items: flex-end;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 20px;
        }

        .championshipHeader h2 {
          margin: 0;

          font-size: 25px;
        }

        .championshipHeader p {
          margin: 5px 0 0;

          max-width: 460px;

          font-size: 11px;
          line-height: 1.5;

          opacity: .45;
        }

        .championshipTag {
          padding:
            8px 11px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.06);

          border: 1px solid
            rgba(255,255,255,.09);

          font-size: 8px;
          font-weight: 900;

          letter-spacing: 1px;

          white-space: nowrap;
        }

        .overallRow {
          position: relative;

          display: grid;

          grid-template-columns:
            52px
            minmax(0,1fr)
            100px;

          align-items: center;

          gap: 12px;

          min-height: 72px;

          padding:
            9px 13px;

          margin-top: 5px;

          border-radius: 16px;

          border: 1px solid
            transparent;

          transition:
            transform .2s ease,
            background .2s ease;
        }

        .overallRow:hover {
          transform:
            translateX(4px);

          background:
            rgba(255,255,255,.045);
        }

        .overallRow.first {
          background:
            linear-gradient(
              90deg,
              rgba(255,216,77,.11),
              rgba(255,255,255,.025)
            );

          border-color:
            rgba(255,216,77,.12);
        }

        .overallRow.second {
          background:
            rgba(255,255,255,.025);
        }

        .overallRow.third {
          background:
            rgba(255,255,255,.018);
        }

        .overallPosition {
          display: flex;

          align-items: center;
          justify-content: center;

          width: 42px;
          height: 42px;

          border-radius: 13px;

          background:
            rgba(255,255,255,.055);

          font-size: 16px;
          font-weight: 950;
        }

        .overallClub {
          min-width: 0;
        }

        .clubButton {
          appearance: none;

          border: 0;
          background: transparent;

          padding: 0;

          color: inherit;

          cursor: pointer;

          display: flex;
          align-items: center;

          gap: 9px;

          font-size: 15px;
          font-weight: 950;
        }

        .clubButton:hover {
          text-decoration: underline;
        }

        .clubColor {
          width: 8px;
          height: 8px;

          flex: 0 0 auto;

          border-radius: 50%;
        }

        .rankBar {
          height: 4px;

          margin-top: 9px;

          max-width: 340px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.07);

          overflow: hidden;
        }

        .rankBarInner {
          height: 100%;

          border-radius: inherit;

          transition:
            width .8s ease;
        }

        .overallPoints {
          text-align: right;
        }

        .overallPoints strong {
          display: block;

          font-size: 25px;
          line-height: 1;

          font-weight: 1000;
        }

        .overallPoints span {
          display: block;

          margin-top: 5px;

          font-size: 7px;
          letter-spacing: 1px;

          opacity: .35;
        }

        /* ====================================================
           CLUB DETAILS
        ==================================================== */

        .clubDetails {
          margin-top: 15px;

          padding: 18px;

          border-radius: 18px;

          background:
            rgba(0,0,0,.18);

          border: 1px solid
            rgba(255,255,255,.08);

          animation:
            fadeUp .3s ease both;
        }

        .clubDetailsHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;

          gap: 10px;

          margin-bottom: 12px;
        }

        .clubDetailsHeader h3 {
          margin: 0;

          font-size: 17px;
        }

        .closeDetails {
          border: 1px solid
            rgba(255,255,255,.10);

          background:
            rgba(255,255,255,.05);

          color: inherit;

          padding:
            7px 10px;

          border-radius: 9px;

          cursor: pointer;

          font-size: 10px;
        }

        .clubEventRow {
          display: grid;

          grid-template-columns:
            minmax(0,1fr)
            80px
            70px;

          gap: 10px;

          align-items: center;

          padding:
            12px 7px;

          border-bottom: 1px solid
            rgba(255,255,255,.06);
        }

        .clubEventRow:last-child {
          border-bottom: 0;
        }

        .clubEventName {
          font-weight: 850;
          font-size: 12px;
        }

        .clubEventMeta {
          margin-top: 3px;

          font-size: 8px;

          opacity: .42;
        }

        .clubEventRank {
          text-align: center;

          font-size: 10px;
          font-weight: 800;
        }

        .clubEventPoints {
          text-align: right;

          font-size: 15px;
          font-weight: 950;
        }

        /* ====================================================
           COMPLETED MATCHES
        ==================================================== */

        .completedHeader {
          display: flex;
          align-items: center;

          gap: 9px;
        }

        .completedIcon {
          width: 32px;
          height: 32px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 10px;

          background:
            rgba(70,255,150,.09);

          font-size: 15px;
        }

        .completedSportGroup {
          margin-bottom: 9px;

          border-radius: 15px;

          border: 1px solid
            rgba(255,255,255,.065);

          overflow: hidden;

          background:
            rgba(255,255,255,.022);
        }

        .completedSportGroup summary {
          list-style: none;

          cursor: pointer;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding:
            14px 15px;

          transition:
            background .2s ease;
        }

        .completedSportGroup summary:hover {
          background:
            rgba(255,255,255,.045);
        }

        .completedSportGroup
          summary::-webkit-details-marker {
          display: none;
        }

        .completedSportGroup
          summary::after {
          content: "+";

          font-size: 18px;
          opacity: .55;
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
          font-size: 12px;
          font-weight: 900;
        }

        .completedSportMeta {
          font-size: 8px;
          opacity: .4;
        }

        .completedSportMatches {
          padding:
            0 10px 10px;
        }

        /* ====================================================
           TEAM STANDINGS
        ==================================================== */

        .leaderboardShell {
          position: relative;

          overflow: hidden;

          padding: 25px;

          border-radius: 25px;

          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(125,77,255,.20),
              transparent 34%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(0,180,255,.10),
              transparent 34%
            ),
            rgba(17,18,34,.82);

          border: 1px solid
            rgba(255,255,255,.10);

          box-shadow:
            0 25px 70px
              rgba(0,0,0,.24);
        }

        .leaderboardHeading {
          display: flex;

          align-items: flex-end;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 18px;
        }

        .leaderboardTitle {
          margin: 0;

          font-size: 25px;
        }

        .leaderboardSubtitle {
          margin: 6px 0 0;

          font-size: 10px;
          opacity: .42;
        }

        .sportBadge {
          padding:
            8px 11px;

          border-radius: 999px;

          background:
            rgba(255,255,255,.055);

          border: 1px solid
            rgba(255,255,255,.09);

          font-size: 8px;
          font-weight: 900;

          white-space: nowrap;
        }

        .leaderboardSelect {
          width: 100%;

          margin-top: 8px;

          padding:
            13px 14px;

          border-radius: 13px;

          border: 1px solid
            rgba(255,255,255,.10);

          background:
            rgba(255,255,255,.055);

          color: #fff;

          outline: none;

          font-size: 12px;
          font-weight: 700;
        }

        .leaderboardSelect option {
          background: #11121b;
          color: #fff;
        }

        .standingsFrame {
          overflow: hidden;

          border-radius: 18px;

          border: 1px solid
            rgba(255,255,255,.07);

          background:
            rgba(0,0,0,.12);
        }

        .standingsTable {
          width: 100%;

          border-collapse: collapse;

          table-layout: fixed;
        }

        .standingsTable th {
          padding:
            12px 7px;

          text-align: center;

          font-size: 8px;
          letter-spacing: 1px;

          color:
            rgba(255,255,255,.40);

          background:
            rgba(255,255,255,.035);

          border-bottom: 1px solid
            rgba(255,255,255,.07);
        }

        .standingsTable td {
          padding:
            15px 7px;

          text-align: center;

          font-size: 12px;

          border-bottom: 1px solid
            rgba(255,255,255,.055);
        }

        .standingsTable tbody tr:last-child td {
          border-bottom: 0;
        }

        .standingsTable tbody tr {
          transition:
            background .2s ease;
        }

        .standingsTable tbody tr:hover {
          background:
            rgba(255,255,255,.045);
        }

        .standingsTable
          td.clubCell {
          text-align: left;

          font-size: 13px;
          font-weight: 900;
        }

        .positionCell {
          font-size: 15px !important;
          font-weight: 950;
        }

        .pointsCell {
          font-size: 16px !important;
          font-weight: 1000;
        }

        .leaderRow {
          background:
            linear-gradient(
              90deg,
              rgba(255,216,77,.08),
              transparent
            );
        }

        .secondRow {
          background:
            rgba(255,255,255,.022);
        }

        .thirdRow {
          background:
            rgba(255,255,255,.015);
        }

        .mobileStandings {
          display: none;
        }

        .mobileStandingRow {
          display: grid;

          grid-template-columns:
            44px
            minmax(0,1fr)
            62px;

          align-items: center;

          gap: 10px;

          min-height: 76px;

          padding:
            10px 12px;

          border-bottom: 1px solid
            rgba(255,255,255,.055);
        }

        .mobileStandingRow:last-child {
          border-bottom: 0;
        }

        .mobileStandingRow.first {
          background:
            linear-gradient(
              90deg,
              rgba(255,216,77,.09),
              transparent
            );
        }

        .mobileStandingRank {
          display: flex;

          align-items: center;
          justify-content: center;

          width: 37px;
          height: 37px;

          border-radius: 11px;

          background:
            rgba(255,255,255,.055);

          font-weight: 950;
        }

        .mobileStandingClubName {
          font-size: 13px;
          font-weight: 950;
        }

        .mobileStandingStats {
          display: flex;

          gap: 7px;

          margin-top: 5px;

          flex-wrap: wrap;

          font-size: 8px;

          opacity: .43;
        }

        .mobileStandingExtra {
          margin-top: 4px;

          font-size: 8px;

          opacity: .48;
        }

        .mobileStandingPoints {
          text-align: right;
        }

        .mobileStandingPoints strong {
          display: block;

          font-size: 22px;
          line-height: 1;

          font-weight: 1000;
        }

        .mobileStandingPoints small {
          display: block;

          margin-top: 5px;

          font-size: 7px;
          letter-spacing: 1px;

          opacity: .35;
        }

        .tableLegend {
          margin-top: 12px;

          font-size: 8px;
          line-height: 1.7;

          opacity: .38;
        }

        /* ====================================================
           POINTS
        ==================================================== */

        .rules {
          display: grid;

          grid-template-columns:
            repeat(3, 1fr);

          gap: 10px;

          margin-top: 15px;
        }

        .rules > div {
          padding:
            15px;

          border-radius: 15px;

          background:
            rgba(255,255,255,.04);

          border: 1px solid
            rgba(255,255,255,.06);
        }

        .rules b {
          display: block;

          margin-bottom: 7px;

          font-size: 11px;
        }

        .rules span {
          font-size: 9px;
          opacity: .55;
        }

        /* ====================================================
           RESPONSIVE
        ==================================================== */

        @media (max-width: 760px) {

          header {
            height: 60px;
          }

          .hero {
            min-height: 355px;

            padding:
              60px 0 50px;
          }

          .hero h1 {
            font-size:
              clamp(52px, 17vw, 82px);

            letter-spacing:
              -4px;
          }

          .hero p {
            max-width: 330px;
            font-size: 11px;
          }

          .wrap {
            padding-bottom: 45px;
          }

          .matchCenter {
            grid-template-columns: 1fr;
          }

          .matchCenterCard {
            min-height: auto;
          }

          .championship,
          .leaderboardShell {
            padding: 18px;
            border-radius: 21px;
          }

          .championshipHeader,
          .leaderboardHeading {
            display: block;
          }

          .championshipHeader h2,
          .leaderboardTitle {
            font-size: 20px;
          }

          .championshipTag,
          .sportBadge {
            display: inline-block;

            margin-top: 12px;
          }

          .standingsDesktop {
            display: none;
          }

          .mobileStandings {
            display: block;
          }

          .rules {
            grid-template-columns: 1fr;
          }

          .overallRow {
            grid-template-columns:
              42px
              minmax(0,1fr)
              65px;

            min-height: 65px;

            padding:
              7px 8px;
          }

          .overallPosition {
            width: 37px;
            height: 37px;

            font-size: 14px;
          }

          .clubButton {
            font-size: 13px;
          }

          .rankBar {
            margin-top: 7px;
          }

          .overallPoints strong {
            font-size: 21px;
          }

          .clubEventRow {
            grid-template-columns:
              minmax(0,1fr)
              62px
              58px;
          }

          .clubDetailsHeader h3 {
            font-size: 14px;
          }

          .sectionHeader h2 {
            font-size: 18px;
          }
        }

        @media (max-width: 400px) {

          .hero h1 {
            font-size: 54px;
          }

          .hero {
            min-height: 325px;
          }

          .nextTeams {
            gap: 6px;
          }

          .nextTeamName {
            font-size: 10px;
          }

          .timeBox {
            min-width: 43px;
          }

          .timeBox strong {
            font-size: 15px;
          }

          .overallRow {
            grid-template-columns:
              38px
              minmax(0,1fr)
              58px;
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

        <div className="heroStats">
          <div className="heroPill">
            5 CLUBS
          </div>

          <div className="heroPill">
            LIVE RESULTS
          </div>

          <div className="heroPill">
            ONE CHAMPION
          </div>
        </div>

      </section>

      <section className="wrap">

        {/* ====================================================
            MATCH CENTER
        ==================================================== */}

        <div className="matchCenter">

          {/* LIVE */}

          <div className="card matchCenterCard liveCard">

            <div className="liveBadge">
              <span className="liveDot" />
              LIVE MATCH CENTER
            </div>

            <h2>
              The action is live.
            </h2>

            {loading ? (

              <div className="emptyState">
                <strong>
                  Loading matches...
                </strong>
              </div>

            ) : liveMatches.length === 0 ? (

              <div className="emptyState">
                <strong>
                  NO MATCHES LIVE
                </strong>

                <span>
                  The arena is quiet... for now.
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

          {/* NEXT UP */}

          <div className="card matchCenterCard nextUp">

            <div>
              <div className="nextUpLabel">
                ⚡ NEXT UP
              </div>

              {nextMatch ? (

                <>
                  <div className="nextUpSport">
                    {nextMatch.events?.name}
                    {" · "}
                    {nextMatch.events?.gender}
                  </div>

                  <div className="nextTeams">

                    <div className="nextTeam">

                      <div
                        className="nextTeamIcon"
                        style={{
                          boxShadow:
                            `0 0 28px ${
                              getClubTheme(
                                nextMatch.club_a?.name
                              ).glow
                            }`,
                        }}
                      >
                        {
                          getClubTheme(
                            nextMatch.club_a?.name
                          ).icon
                        }
                      </div>

                      <div className="nextTeamName">
                        {
                          nextMatch.club_a?.name ||
                          "TBD"
                        }
                      </div>

                    </div>

                    <div className="vs">
                      VS
                    </div>

                    <div className="nextTeam">

                      <div
                        className="nextTeamIcon"
                        style={{
                          boxShadow:
                            `0 0 28px ${
                              getClubTheme(
                                nextMatch.club_b?.name
                              ).glow
                            }`,
                        }}
                      >
                        {
                          getClubTheme(
                            nextMatch.club_b?.name
                          ).icon
                        }
                      </div>

                      <div className="nextTeamName">
                        {
                          nextMatch.club_b?.name ||
                          "TBD"
                        }
                      </div>

                    </div>

                  </div>

                  {getCountdown(
                    nextMatch
                  ) ? (

                    <div className="countdown">

                      {[
                        [
                          getCountdown(
                            nextMatch
                          ).days,
                          "DAYS",
                        ],
                        [
                          getCountdown(
                            nextMatch
                          ).hours,
                          "HRS",
                        ],
                        [
                          getCountdown(
                            nextMatch
                          ).minutes,
                          "MIN",
                        ],
                        [
                          getCountdown(
                            nextMatch
                          ).seconds,
                          "SEC",
                        ],
                      ].map(
                        ([value, label]) => (

                          <div
                            className="timeBox"
                            key={label}
                          >
                            <strong>
                              {String(
                                value
                              ).padStart(
                                2,
                                "0"
                              )}
                            </strong>

                            <span>
                              {label}
                            </span>
                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div
                      className="nextDate"
                    >
                      Starting soon
                    </div>

                  )}

                  <div className="nextDate">
                    {formatMatchTime(
                      nextMatch.match_time
                    )}
                  </div>

                </>

              ) : (

                <div className="emptyState">
                  <strong>
                    NO UPCOMING MATCHES
                  </strong>

                  <span>
                    New fixtures will appear here.
                  </span>
                </div>

              )}

            </div>

          </div>

        </div>

        {/* ====================================================
            UPCOMING MATCHES
        ==================================================== */}

        {upcomingMatches.length > 1 && (

          <div className="card section">

            <div className="sectionHeader">

              <div>
                <span className="eyebrow">
                  FIXTURES
                </span>

                <h2>
                  Upcoming Matches
                </h2>

                <p>
                  What's coming next.
                </p>
              </div>

            </div>

            {upcomingMatches
              .slice(1)
              .map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                />
              ))}

          </div>

        )}

        {/* ====================================================
            COMPLETED
        ==================================================== */}

        <div className="card section">

          <div className="sectionHeader">

            <div className="completedHeader">

              <div className="completedIcon">
                ✓
              </div>

              <div>
                <h2>
                  Completed Matches
                </h2>

                <p>
                  Results from the championship.
                </p>
              </div>

            </div>

          </div>

          {loading ? (

            <p className="muted">
              Loading results...
            </p>

          ) : completedSportGroups.length === 0 ? (

            <div className="emptyState">
              <strong>
                NO COMPLETED MATCHES
              </strong>

              <span>
                Results will appear here once matches finish.
              </span>
            </div>

          ) : (

            <div style={{ marginTop: "15px" }}>

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
            CHAMPIONSHIP RACE
        ==================================================== */}

        <div className="championship section">

          <div className="championshipHeader">

            <div>

              <span className="eyebrow">
                EUPHORIA 2026
              </span>

              <h2>
                🏆 Championship Race
              </h2>

              <p>
                Every event matters. Every point
                changes the race.
              </p>

            </div>

            <div className="championshipTag">
              LIVE TABLE
            </div>

          </div>

          {leaderboard.map(
            (club, index) => {

              const theme =
                getClubTheme(club);

              const leaderPoints =
                Math.max(
                  points[
                    leaderboard[0]
                  ] || 0,
                  1
                );

              const percentage =
                Math.max(
                  4,
                  ((points[club] || 0) /
                    leaderPoints) *
                    100
                );

              return (
                <div
                  className={`overallRow ${
                    index === 0
                      ? "first"
                      : index === 1
                      ? "second"
                      : index === 2
                      ? "third"
                      : ""
                  }`}
                  key={club}
                >

                  <div className="overallPosition">
                    {getMedal(index)}
                  </div>

                  <div className="overallClub">

                    <button
                      className="clubButton"
                      onClick={() =>
                        setSelectedClub(
                          selectedClub === club
                            ? null
                            : club
                        )
                      }
                    >

                      <span
                        className="clubColor"
                        style={{
                          background:
                            theme.color,

                          boxShadow:
                            `0 0 10px ${theme.glow}`,
                        }}
                      />

                      {club}

                    </button>

                    <div className="rankBar">

                      <div
                        className="rankBarInner"
                        style={{
                          width:
                            `${percentage}%`,
                          background:
                            theme.color,
                          boxShadow:
                            `0 0 12px ${theme.glow}`,
                        }}
                      />

                    </div>

                  </div>

                  <div className="overallPoints">

                    <strong>
                      {points[club] || 0}
                    </strong>

                    <span>
                      POINTS
                    </span>

                  </div>

                </div>
              );
            }
          )}

          {/* ==================================================
              CLUB DETAILS
          ================================================== */}

          {selectedClub && (

            <div className="clubDetails">

              <div className="clubDetailsHeader">

                <h3>
                  {getClubTheme(
                    selectedClub
                  ).icon}{" "}
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
                  CLOSE
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
                      opacity: .42,
                      fontSize: "8px",
                      fontWeight: 900,
                    }}
                  >

                    <div>
                      EVENT
                    </div>

                    <div className="clubEventRank">
                      RANK
                    </div>

                    <div className="clubEventPoints">
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
                      marginTop: "12px",
                      textAlign: "right",
                      fontWeight: 950,
                      fontSize: "12px",
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
            TEAM SPORT STANDINGS
        ==================================================== */}

        <div className="section">

          <div className="leaderboardShell">

            <div className="leaderboardHeading">

              <div>

                <span className="eyebrow">
                  SPORT BY SPORT
                </span>

                <h2 className="leaderboardTitle">
                  Team Sport Standings
                </h2>

                <p className="leaderboardSubtitle">
                  Automatically calculated from
                  completed matches.
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
                No team sports have been added yet.
              </p>

            ) : (

              <>

                <label>

                  <b
                    style={{
                      fontSize: "10px",
                      opacity: .55,
                    }}
                  >
                    SELECT SPORT
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
                            "30px 5px",
                        }}
                      >

                        <div className="emptyState">

                          <strong>
                            NO MATCHES PLAYED
                          </strong>

                          <span>
                            Standings will update automatically
                            when the first result is recorded.
                          </span>

                        </div>

                      </div>

                    ) : (

                      <>

                        {/* DESKTOP */}

                        <div
                          className="standingsFrame standingsDesktop"
                          style={{
                            marginTop:
                              "18px",
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
                                ) => {

                                  const theme =
                                    getClubTheme(
                                      row.name
                                    );

                                  return (
                                    <tr
                                      key={
                                        row.id
                                      }
                                      className={
                                        index === 0
                                          ? "leaderRow"
                                          : index === 1
                                          ? "secondRow"
                                          : index === 2
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

                                        <span
                                          style={{
                                            display:
                                              "inline-block",

                                            width:
                                              "6px",

                                            height:
                                              "6px",

                                            borderRadius:
                                              "50%",

                                            background:
                                              theme.color,

                                            marginRight:
                                              "7px",

                                            boxShadow:
                                              `0 0 8px ${theme.glow}`,
                                          }}
                                        />

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
                                  );
                                }
                              )}

                            </tbody>

                          </table>

                        </div>

                        {/* MOBILE */}

                        <div
                          className="standingsFrame mobileStandings"
                          style={{
                            marginTop:
                              "18px",
                          }}
                        >

                          {sportLeaderboard.rows.map(
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
                                  key={
                                    row.id
                                  }
                                  className={`mobileStandingRow ${
                                    index ===
                                    0
                                      ? "first"
                                      : ""
                                  }`}
                                >

                                  <div
                                    className="mobileStandingRank"
                                  >
                                    {getMedal(
                                      index
                                    )}
                                  </div>

                                  <div>

                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        gap:
                                          "7px",
                                      }}
                                    >

                                      <span
                                        style={{
                                          width:
                                            "6px",
                                          height:
                                            "6px",
                                          borderRadius:
                                            "50%",
                                          background:
                                            theme.color,
                                          boxShadow:
                                            `0 0 8px ${theme.glow}`,
                                        }}
                                      />

                                      <div className="mobileStandingClubName">
                                        {
                                          row.name
                                        }
                                      </div>

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

                                      {(isFootball ||
                                        (!isCricket &&
                                          !usesPD)) && (
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
                              );
                            }
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

          <div className="sectionHeader">

            <div>

              <span className="eyebrow">
                HOW THE RACE WORKS
              </span>

              <h2>
                Points System
              </h2>

              <p>
                Championship points awarded by finishing position.
              </p>

            </div>

          </div>

          <div className="rules">

            <div>
              <b>
                🏆 Team
              </b>

              <span>
                🥇 25 · 🥈 15
              </span>
            </div>

            <div>
              <b>
                🎾 Doubles / Mixed
              </b>

              <span>
                🥇 15 · 🥈 10 · 🥉 7
              </span>
            </div>

            <div>
              <b>
                🏃 Individual
              </b>

              <span>
                🥇 10 · 🥈 5 · 🥉 3
              </span>
            </div>

          </div>

        </div>

      </section>

    </main>
  );
}
