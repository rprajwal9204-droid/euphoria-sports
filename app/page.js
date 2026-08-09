"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

function isCricketEvent(event) {
  if (!event) return false;

  const name = String(event.name || "").trim().toLowerCase();
  const category = String(event.category || "").trim().toLowerCase();
  const pointsType = String(event.points_type || "").trim().toLowerCase();

  return (
    name === "cricket" &&
    (
      category.includes("team") ||
      pointsType.includes("team")
    )
  );
}

/*
  Cricket score helper.

  IMPORTANT:
  Do NOT use innings_a_wickets / innings_b_wickets.
  Those columns do not exist in the database.

  We use:
    innings1_runs
    innings1_wickets
    innings1_overs

    innings2_runs
    innings2_wickets
    innings2_overs

  and map innings to clubs using batting_first_club_id.
*/

function cricketInningsScore(match, inningsNumber) {
  const runs =
    inningsNumber === 1
      ? match.innings1_runs
      : match.innings2_runs;

  const wickets =
    inningsNumber === 1
      ? match.innings1_wickets
      : match.innings2_wickets;

  const overs =
    inningsNumber === 1
      ? match.innings1_overs
      : match.innings2_overs;

  if (
    runs === null ||
    runs === undefined ||
    runs === ""
  ) {
    return null;
  }

  let score = String(runs);

  if (
    wickets !== null &&
    wickets !== undefined &&
    wickets !== ""
  ) {
    score += `/${wickets}`;
  }

  if (
    overs !== null &&
    overs !== undefined &&
    overs !== ""
  ) {
    score += ` (${overs} ov)`;
  }

  return score;
}

function formatScore(match, side) {
  /*
    First preference:
    Explicit score_a / score_b.

    This is useful for non-cricket games and also
    for cricket if the admin has entered those fields.
  */

  const explicitScore =
    side === "a"
      ? match.score_a
      : match.score_b;

  if (
    explicitScore !== null &&
    explicitScore !== undefined &&
    String(explicitScore).trim() !== ""
  ) {
    return String(explicitScore);
  }

  /*
    Cricket fallback.

    innings1 belongs to batting_first_club_id.
    innings2 belongs to the other club.
  */

  if (isCricketEvent(match.events)) {
    const innings1Score =
      cricketInningsScore(match, 1);

    const innings2Score =
      cricketInningsScore(match, 2);

    const battingFirst =
      Number(match.batting_first_club_id);

    const clubA =
      Number(match.club_a_id);

    const clubB =
      Number(match.club_b_id);

    if (battingFirst === clubA) {
      return side === "a"
        ? innings1Score || "—"
        : innings2Score || "—";
    }

    if (battingFirst === clubB) {
      return side === "a"
        ? innings2Score || "—"
        : innings1Score || "—";
    }

    /*
      If batting_first_club_id is not available,
      fall back to innings order.
    */

    return side === "a"
      ? innings1Score || "—"
      : innings2Score || "—";
  }

  return "—";
}

function statusClass(status) {
  const value = String(status || "upcoming")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  if (value.includes("live")) return "live";
  if (
    value.includes("complete") ||
    value.includes("final") ||
    value.includes("finished")
  ) {
    return "final";
  }

  return "upcoming";
}

function positionEmoji(position) {
  const p = Number(position);

  if (p === 1) return "🥇";
  if (p === 2) return "🥈";
  if (p === 3) return "🥉";

  return `#${p}`;
}

/* =========================================================
   PUBLIC PAGE
========================================================= */

export default function Home() {
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);

  const [loading, setLoading] = useState(true);

  const [activeEvent, setActiveEvent] =
    useState("all");

  const [activeTab, setActiveTab] =
    useState("matches");

  const [msg, setMsg] = useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {
    setLoading(true);
    setMsg("");

    const [
      { data: eventData, error: eventError },
      { data: clubData, error: clubError },
      { data: matchData, error: matchError },
      { data: resultData, error: resultError },
    ] = await Promise.all([
      /* EVENTS */
      supabase
        .from("events")
        .select("*")
        .order("id"),

      /* CLUBS */
      supabase
        .from("clubs")
        .select("*")
        .order("id"),

      /*
        MATCHES

        IMPORTANT:
        There is NO innings_a_wickets or innings_b_wickets
        here because those columns do not exist.
      */
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

          allotted_overs,

          events(
            id,
            name,
            gender,
            category,
            points_type,
            result_finalized
          ),

          club_a:club_a_id(
            id,
            name
          ),

          club_b:club_b_id(
            id,
            name
          ),

          winner:winner_club_id(
            id,
            name
          )
        `)
        .order("id", {
          ascending: false,
        }),

      /* EVENT RESULTS */
      supabase
        .from("event_results")
        .select(`
          id,
          event_id,
          club_id,
          position,
          points,

          events(
            id,
            name,
            gender,
            category,
            points_type,
            result_finalized
          ),

          clubs(
            id,
            name
          )
        `)
        .order("event_id")
        .order("position"),
    ]);

    if (eventError) {
      console.error(
        "Events error:",
        eventError
      );
      setMsg(eventError.message);
    }

    if (clubError) {
      console.error(
        "Clubs error:",
        clubError
      );
      setMsg(clubError.message);
    }

    if (matchError) {
      console.error(
        "Matches error:",
        matchError
      );
      setMsg(matchError.message);
    }

    if (resultError) {
      console.error(
        "Results error:",
        resultError
      );
      setMsg(resultError.message);
    }

    setEvents(eventData || []);
    setClubs(clubData || []);
    setMatches(matchData || []);

    /*
      Only finalized results are considered official.

      This protects the public page from showing
      incomplete / old result rows.
    */

    const finalizedResults =
      (resultData || []).filter(
        (result) =>
          result.events?.result_finalized === true
      );

    setResults(finalizedResults);

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  /* =======================================================
     FILTERED MATCHES
  ======================================================= */

  const visibleMatches = useMemo(() => {
    if (activeEvent === "all") {
      return matches;
    }

    return matches.filter(
      (match) =>
        String(match.event_id) ===
        String(activeEvent)
    );
  }, [matches, activeEvent]);

  /* =======================================================
     FILTERED RESULTS
  ======================================================= */

  const visibleResults = useMemo(() => {
    if (activeEvent === "all") {
      return results;
    }

    return results.filter(
      (result) =>
        String(result.event_id) ===
        String(activeEvent)
    );
  }, [results, activeEvent]);

  /* =======================================================
     CHAMPIONS
  ======================================================= */

  const champions = useMemo(() => {
    const list = [];

    for (const event of events) {
      if (!event.result_finalized) {
        continue;
      }

      const result = results.find(
        (r) =>
          Number(r.event_id) ===
            Number(event.id) &&
          Number(r.position) === 1
      );

      if (!result) {
        continue;
      }

      list.push({
        event,
        result,
        club: result.clubs,
      });
    }

    if (activeEvent !== "all") {
      return list.filter(
        (item) =>
          String(item.event.id) ===
          String(activeEvent)
      );
    }

    return list;
  }, [
    events,
    results,
    activeEvent,
  ]);

  /* =======================================================
     OVERALL POINT TABLE
     
     This is the TOTAL leaderboard across
     all finalized events.
  ======================================================= */

  const standings = useMemo(() => {
    const table = {};

    clubs.forEach((club) => {
      table[club.id] = {
        id: club.id,
        name: club.name,
        points: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
      };
    });

    results.forEach((result) => {
      if (
        !result.events?.result_finalized
      ) {
        return;
      }

      if (!table[result.club_id]) {
        table[result.club_id] = {
          id: result.club_id,
          name:
            result.clubs?.name ||
            "Unknown Club",
          points: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
        };
      }

      table[result.club_id].points +=
        Number(result.points || 0);

      if (
        Number(result.position) === 1
      ) {
        table[result.club_id].gold++;
      }

      if (
        Number(result.position) === 2
      ) {
        table[result.club_id].silver++;
      }

      if (
        Number(result.position) === 3
      ) {
        table[result.club_id].bronze++;
      }
    });

    return Object.values(table).sort(
      (a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.gold !== a.gold) {
          return b.gold - a.gold;
        }

        if (b.silver !== a.silver) {
          return b.silver - a.silver;
        }

        return b.bronze - a.bronze;
      }
    );
  }, [clubs, results]);

  /* =======================================================
     INDIVIDUAL EVENT LEADERBOARD
     
     THIS IS THE NEW PART.

     Instead of combining everything into one
     sports-wise table, every individual event gets
     its own leaderboard.

     Example:

     CRICKET
     1. Club A — 25 pts
     2. Club B — 15 pts
     3. Club C — 7 pts

     FOOTBALL
     1. Club D — 25 pts
     ...
  ======================================================= */

  const individualLeaderboards =
    useMemo(() => {
      const groups = {};

      visibleResults.forEach((result) => {
        if (
          !result.events?.result_finalized
        ) {
          return;
        }

        const eventId =
          result.event_id;

        if (!groups[eventId]) {
          groups[eventId] = {
            event:
              result.events,
            results: [],
          };
        }

        groups[eventId].results.push(
          result
        );
      });

      return Object.values(groups)
        .map((group) => ({
          ...group,

          results:
            [...group.results].sort(
              (a, b) =>
                Number(a.position) -
                Number(b.position)
            ),
        }))
        .sort(
          (a, b) =>
            Number(a.event.id) -
            Number(b.event.id)
        );
    }, [visibleResults]);

  /* =======================================================
     EVENT RESULTS GROUPING
  ======================================================= */

  const groupedResults = useMemo(() => {
    const groups = {};

    visibleResults.forEach((result) => {
      if (
        !result.events?.result_finalized
      ) {
        return;
      }

      if (!groups[result.event_id]) {
        groups[result.event_id] = {
          event: result.events,
          results: [],
        };
      }

      groups[result.event_id].results.push(
        result
      );
    });

    return Object.values(groups);
  }, [visibleResults]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          background:
            radial-gradient(
              circle at top,
              #251445 0%,
              #0b0714 42%,
              #05030a 100%
            );

          color: #ffffff;
          min-height: 100vh;
        }

        button,
        select {
          font: inherit;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .page {
          min-height: 100vh;
        }

        /* ================= HEADER ================= */

        header {
          position: sticky;
          top: 0;
          z-index: 50;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 18px 6%;

          background:
            rgba(7, 4, 14, 0.88);

          backdrop-filter: blur(18px);

          border-bottom:
            1px solid
            rgba(255, 255, 255, 0.09);
        }

        .logo {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .logo span {
          color: #d7a7ff;
        }

        .adminLink {
          padding: 10px 16px;
          border-radius: 999px;

          border:
            1px solid
            rgba(255, 255, 255, 0.15);

          color: #ddd;

          font-size: 13px;
          font-weight: 700;
        }

        .adminLink:hover {
          background:
            rgba(255, 255, 255, 0.08);
        }

        /* ================= HERO ================= */

        .hero {
          padding:
            80px 6%
            55px;

          text-align: center;
        }

        .heroBadge {
          display: inline-flex;
          align-items: center;

          padding: 8px 14px;

          border-radius: 999px;

          background:
            rgba(190, 105, 255, 0.13);

          border:
            1px solid
            rgba(207, 145, 255, 0.28);

          color: #e8caff;

          font-size: 12px;
          font-weight: 800;

          letter-spacing: 1px;

          text-transform: uppercase;
        }

        .hero h1 {
          margin: 20px 0 10px;

          font-size:
            clamp(42px, 9vw, 88px);

          line-height: 0.95;

          letter-spacing: -3px;

          background:
            linear-gradient(
              100deg,
              #ffffff,
              #d7a4ff,
              #ffffff
            );

          -webkit-background-clip: text;

          color: transparent;
        }

        .hero p {
          max-width: 650px;

          margin: 20px auto 0;

          color: #aaa2b6;

          font-size: 17px;
          line-height: 1.7;
        }

        /* ================= CONTENT ================= */

        .container {
          width: min(1200px, 92%);
          margin: 0 auto;
          padding-bottom: 80px;
        }

        /* ================= EVENT FILTER ================= */

        .eventBar {
          display: flex;
          gap: 10px;

          overflow-x: auto;

          padding:
            6px 2px
            20px;

          scrollbar-width: none;
        }

        .eventBar::-webkit-scrollbar {
          display: none;
        }

        .eventButton {
          flex-shrink: 0;

          padding: 11px 17px;

          border-radius: 999px;

          border:
            1px solid
            rgba(255, 255, 255, 0.12);

          background:
            rgba(255, 255, 255, 0.045);

          color: #aaa;

          cursor: pointer;

          font-size: 13px;
          font-weight: 800;
        }

        .eventButton.active {
          background:
            linear-gradient(
              135deg,
              #a84dff,
              #6d27d9
            );

          color: white;

          border-color:
            rgba(255, 255, 255, 0.2);

          box-shadow:
            0 8px 30px
            rgba(130, 50, 230, 0.25);
        }

        /* ================= TABS ================= */

        .tabs {
          display: grid;

          grid-template-columns:
            repeat(5, 1fr);

          gap: 8px;

          margin:
            15px 0
            30px;

          padding: 6px;

          border-radius: 14px;

          background:
            rgba(255, 255, 255, 0.045);

          border:
            1px solid
            rgba(255, 255, 255, 0.07);
        }

        .tab {
          border: 0;

          padding: 13px 8px;

          border-radius: 10px;

          background: transparent;

          color: #999;

          cursor: pointer;

          font-weight: 800;
          font-size: 12px;
        }

        .tab.active {
          background:
            rgba(255, 255, 255, 0.1);

          color: white;
        }

        /* ================= SECTION ================= */

        .sectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin:
            35px 0
            18px;
        }

        .sectionTitle h2 {
          margin: 0;
          font-size: 24px;
        }

        .sectionTitle span {
          color: #777;
          font-size: 13px;
        }

        /* ================= CARDS ================= */

        .card {
          padding: 22px;

          margin-bottom: 15px;

          border-radius: 18px;

          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.065),
              rgba(255, 255, 255, 0.025)
            );

          border:
            1px solid
            rgba(255, 255, 255, 0.09);

          box-shadow:
            0 15px 50px
            rgba(0, 0, 0, 0.18);
        }

        /* ================= MATCH ================= */

        .matchCard {
          position: relative;
        }

        .matchTop {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 12px;

          margin-bottom: 20px;
        }

        .eventName {
          color: #aaa;
          font-size: 12px;
          font-weight: 700;
        }

        .status {
          padding: 5px 10px;

          border-radius: 999px;

          font-size: 10px;
          font-weight: 900;

          letter-spacing: 0.7px;

          text-transform: uppercase;
        }

        .status-final {
          background:
            rgba(100, 220, 130, 0.12);

          color: #7af59b;
        }

        .status-live {
          background:
            rgba(255, 65, 95, 0.13);

          color: #ff7188;

          animation:
            pulse 1.6s infinite;
        }

        .status-upcoming {
          background:
            rgba(255, 190, 80, 0.12);

          color: #ffc75c;
        }

        @keyframes pulse {
          50% {
            opacity: 0.45;
          }
        }

        .teams {
          display: grid;

          grid-template-columns:
            1fr
            auto
            1fr;

          align-items: center;

          gap: 15px;
        }

        .team {
          display: flex;

          flex-direction: column;

          gap: 7px;
        }

        .team.right {
          text-align: right;
          align-items: flex-end;
        }

        .teamName {
          font-size: 17px;
          font-weight: 850;
        }

        .score {
          color: #d5b5ff;

          font-size: 22px;
          font-weight: 900;
        }

        .winner {
          color: #ffd66b;
        }

        .vs {
          color: #5f5867;

          font-size: 12px;
          font-weight: 900;
        }

        .matchMeta {
          margin-top: 18px;

          padding-top: 14px;

          border-top:
            1px solid
            rgba(255, 255, 255, 0.06);

          color: #777;

          font-size: 11px;
          text-align: center;
        }

        /* ================= INDIVIDUAL LEADERBOARD ================= */

        .leaderboardGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(300px, 1fr)
            );

          gap: 18px;
        }

        .leaderboardCard {
          overflow: hidden;

          border-radius: 20px;

          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.07),
              rgba(255, 255, 255, 0.025)
            );

          border:
            1px solid
            rgba(255, 255, 255, 0.09);
        }

        .leaderboardHeader {
          padding: 20px;

          background:
            linear-gradient(
              135deg,
              rgba(168, 77, 255, 0.22),
              rgba(109, 39, 217, 0.08)
            );

          border-bottom:
            1px solid
            rgba(255, 255, 255, 0.07);
        }

        .leaderboardHeader h3 {
          margin: 0;

          font-size: 20px;
        }

        .leaderboardHeader p {
          margin:
            6px 0 0;

          color: #918998;

          font-size: 12px;
        }

        .leaderboardRow {
          display: grid;

          grid-template-columns:
            48px
            1fr
            auto;

          align-items: center;

          gap: 10px;

          padding: 15px 18px;

          border-bottom:
            1px solid
            rgba(255, 255, 255, 0.055);
        }

        .leaderboardRow:last-child {
          border-bottom: 0;
        }

        .leaderboardRank {
          font-size: 19px;
          font-weight: 900;
        }

        .leaderboardClub {
          font-size: 14px;
          font-weight: 800;
        }

        .leaderboardPosition {
          color: #777;

          margin-top: 3px;

          font-size: 10px;
        }

        .leaderboardPoints {
          color: #d4a8ff;

          font-size: 15px;
          font-weight: 950;

          text-align: right;
        }

        /* ================= CHAMPION ================= */

        .championGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(260px, 1fr)
            );

          gap: 16px;
        }

        .championCard {
          position: relative;

          overflow: hidden;

          padding: 28px;

          border-radius: 22px;

          background:
            radial-gradient(
              circle at top right,
              rgba(255, 194, 72, 0.16),
              transparent 45%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.08),
              rgba(255, 255, 255, 0.025)
            );

          border:
            1px solid
            rgba(255, 210, 100, 0.2);
        }

        .trophy {
          font-size: 48px;
        }

        .championLabel {
          margin-top: 12px;

          color: #d2a5ff;

          font-size: 11px;
          font-weight: 900;

          letter-spacing: 2px;

          text-transform: uppercase;
        }

        .championName {
          margin-top: 8px;

          font-size: 26px;
          font-weight: 950;
        }

        .championEvent {
          margin-top: 7px;

          color: #89818f;

          font-size: 13px;
        }

        .finalizedBadge {
          display: inline-block;

          margin-top: 16px;

          padding: 6px 10px;

          border-radius: 999px;

          background:
            rgba(80, 210, 120, 0.1);

          color: #77e69a;

          font-size: 10px;
          font-weight: 900;
        }

        /* ================= PODIUM ================= */

        .podiumGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(250px, 1fr)
            );

          gap: 15px;
        }

        .podiumCard {
          padding: 22px;

          border-radius: 18px;

          background:
            rgba(255, 255, 255, 0.04);

          border:
            1px solid
            rgba(255, 255, 255, 0.07);
        }

        .podiumPosition {
          font-size: 30px;
        }

        .podiumClub {
          margin-top: 10px;

          font-size: 19px;
          font-weight: 850;
        }

        .podiumEvent {
          margin-top: 5px;

          color: #888;

          font-size: 12px;
        }

        .podiumPoints {
          margin-top: 13px;

          color: #d2a5ff;

          font-size: 13px;
          font-weight: 850;
        }

        /* ================= TABLE ================= */

        .tableWrap {
          overflow-x: auto;

          border-radius: 18px;

          border:
            1px solid
            rgba(255, 255, 255, 0.08);
        }

        table {
          width: 100%;

          border-collapse: collapse;

          min-width: 620px;
        }

        th {
          padding: 14px;

          background:
            rgba(255, 255, 255, 0.045);

          color: #777;

          font-size: 10px;

          text-transform: uppercase;

          letter-spacing: 1px;

          text-align: left;
        }

        td {
          padding: 17px 14px;

          border-top:
            1px solid
            rgba(255, 255, 255, 0.055);

          font-size: 14px;
        }

        .rank {
          color: #777;
          font-weight: 900;
        }

        .points {
          color: #d3a7ff;
          font-weight: 950;
        }

        /* ================= EMPTY ================= */

        .empty {
          padding: 55px 20px;

          text-align: center;

          color: #777;
        }

        .emptyIcon {
          font-size: 38px;

          margin-bottom: 10px;
        }

        /* ================= FOOTER ================= */

        footer {
          padding:
            40px 6%;

          border-top:
            1px solid
            rgba(255, 255, 255, 0.06);

          text-align: center;

          color: #555;

          font-size: 12px;
        }

        /* ================= MOBILE ================= */

        @media (max-width: 700px) {
          header {
            padding: 15px 5%;
          }

          .logo {
            font-size: 19px;
            letter-spacing: 2px;
          }

          .adminLink {
            padding: 8px 12px;
            font-size: 10px;
          }

          .hero {
            padding:
              55px 5%
              40px;
          }

          .hero h1 {
            font-size: 54px;
          }

          .hero p {
            font-size: 14px;
          }

          .container {
            width: 92%;
          }

          .tabs {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .teams {
            gap: 8px;
          }

          .teamName {
            font-size: 14px;
          }

          .score {
            font-size: 18px;
          }

          .card {
            padding: 17px;
          }

          .leaderboardGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">

        {/* =================================================
            HEADER
        ================================================= */}

        <header>
          <div className="logo">
            EUPHORIA{" "}
            <span>2026</span>
          </div>

          <a
            href="/admin"
            className="adminLink"
          >
            ADMIN
          </a>
        </header>

        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero">

          <div className="heroBadge">
            🏆 Inter-Club Sports Fest
          </div>

          <h1>EUPHORIA</h1>

          <p>
            Follow every match, live score,
            individual event leaderboard,
            official results and championship
            across EUPHORIA.
          </p>

        </section>

        {/* =================================================
            MAIN
        ================================================= */}

        <main className="container">

          {/* =================================================
              EVENT FILTER
          ================================================= */}

          <div className="eventBar">

            <button
              className={
                activeEvent === "all"
                  ? "eventButton active"
                  : "eventButton"
              }
              onClick={() =>
                setActiveEvent("all")
              }
            >
              All Events
            </button>

            {events.map((event) => (
              <button
                key={event.id}
                className={
                  String(activeEvent) ===
                  String(event.id)
                    ? "eventButton active"
                    : "eventButton"
                }
                onClick={() =>
                  setActiveEvent(
                    String(event.id)
                  )
                }
              >
                {event.gender}
                {" · "}
                {event.name}
              </button>
            ))}

          </div>

          {/* =================================================
              TABS
          ================================================= */}

          <div className="tabs">

            <button
              className={
                activeTab === "matches"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("matches")
              }
            >
              🏟️ Matches
            </button>

            <button
              className={
                activeTab === "leaderboard"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("leaderboard")
              }
            >
              🏅 Leaderboard
            </button>

            <button
              className={
                activeTab === "champions"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("champions")
              }
            >
              🏆 Champions
            </button>

            <button
              className={
                activeTab === "results"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("results")
              }
            >
              🥇 Results
            </button>

            <button
              className={
                activeTab === "standings"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab("standings")
              }
            >
              📊 Overall Points
            </button>

          </div>

          {/* =================================================
              ERROR MESSAGE
          ================================================= */}

          {msg && (
            <div className="card">
              ⚠️ {msg}
            </div>
          )}

          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (
            <div className="empty">
              <div className="emptyIcon">
                ⏳
              </div>

              Loading EUPHORIA...
            </div>
          ) : (
            <>

              {/* =============================================
                  MATCHES
              ============================================= */}

              {activeTab === "matches" && (
                <section>

                  <div className="sectionTitle">
                    <h2>
                      🏟️ Matches
                    </h2>

                    <span>
                      {visibleMatches.length}{" "}
                      match
                      {visibleMatches.length !==
                      1
                        ? "es"
                        : ""}
                    </span>
                  </div>

                  {visibleMatches.length ===
                  0 ? (
                    <div className="empty card">

                      <div className="emptyIcon">
                        🏟️
                      </div>

                      No matches available
                      yet.

                    </div>
                  ) : (
                    visibleMatches.map(
                      (match) => {

                        const scoreA =
                          formatScore(
                            match,
                            "a"
                          );

                        const scoreB =
                          formatScore(
                            match,
                            "b"
                          );

                        const winnerId =
                          Number(
                            match.winner_club_id
                          );

                        const status =
                          statusClass(
                            match.status
                          );

                        const cricket =
                          isCricketEvent(
                            match.events
                          );

                        return (
                          <div
                            className="card matchCard"
                            key={match.id}
                          >

                            <div className="matchTop">

                              <div className="eventName">

                                {match.events?.gender}

                                {" · "}

                                {match.events?.name}

                                {" · "}

                                {match.events?.category}

                              </div>

                              <div
                                className={`status status-${status}`}
                              >
                                {match.status ||
                                  "Upcoming"}
                              </div>

                            </div>

                            <div className="teams">

                              {/* CLUB A */}

                              <div className="team">

                                <div
                                  className={
                                    winnerId ===
                                    Number(
                                      match.club_a_id
                                    )
                                      ? "teamName winner"
                                      : "teamName"
                                  }
                                >
                                  {match.club_a
                                    ?.name ||
                                    "TBD"}
                                </div>

                                <div
                                  className={
                                    winnerId ===
                                    Number(
                                      match.club_a_id
                                    )
                                      ? "score winner"
                                      : "score"
                                  }
                                >
                                  {scoreA}
                                </div>

                              </div>

                              <div className="vs">
                                VS
                              </div>

                              {/* CLUB B */}

                              <div className="team right">

                                <div
                                  className={
                                    winnerId ===
                                    Number(
                                      match.club_b_id
                                    )
                                      ? "teamName winner"
                                      : "teamName"
                                  }
                                >
                                  {match.club_b
                                    ?.name ||
                                    "TBD"}
                                </div>

                                <div
                                  className={
                                    winnerId ===
                                    Number(
                                      match.club_b_id
                                    )
                                      ? "score winner"
                                      : "score"
                                  }
                                >
                                  {scoreB}
                                </div>

                              </div>

                            </div>

                            {match.match_time && (
                              <div className="matchMeta">
                                🕒{" "}
                                {new Date(
                                  match.match_time
                                ).toLocaleString()}
                              </div>
                            )}

                            {cricket &&
                              match.allotted_overs && (
                                <div className="matchMeta">
                                  🏏{" "}
                                  {
                                    match.allotted_overs
                                  }{" "}
                                  overs
                                </div>
                              )}

                          </div>
                        );
                      }
                    )
                  )}

                </section>
              )}

              {/* =============================================
                  INDIVIDUAL EVENT LEADERBOARD
              ============================================= */}

              {activeTab ===
                "leaderboard" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🏅 Event Leaderboards
                    </h2>

                    <span>
                      Points from each
                      individual event
                    </span>

                  </div>

                  {individualLeaderboards.length ===
                  0 ? (
                    <div className="empty card">

                      <div className="emptyIcon">
                        🏅
                      </div>

                      <strong>
                        No individual
                        leaderboards yet.
                      </strong>

                      <p>
                        Leaderboards will appear
                        after event results are
                        officially finalized.
                      </p>

                    </div>
                  ) : (
                    <div className="leaderboardGrid">

                      {individualLeaderboards.map(
                        (group) => (
                          <div
                            className="leaderboardCard"
                            key={
                              group.event.id
                            }
                          >

                            <div className="leaderboardHeader">

                              <h3>
                                {group.event
                                  .gender}{" "}
                                ·{" "}
                                {
                                  group.event
                                    .name
                                }
                              </h3>

                              <p>
                                {
                                  group.event
                                    .category
                                }{" "}
                                · Finalized
                              </p>

                            </div>

                            {group.results.map(
                              (result) => (
                                <div
                                  className="leaderboardRow"
                                  key={
                                    result.id
                                  }
                                >

                                  <div className="leaderboardRank">
                                    {positionEmoji(
                                      result.position
                                    )}
                                  </div>

                                  <div>

                                    <div className="leaderboardClub">
                                      {
                                        result
                                          .clubs
                                          ?.name
                                      }
                                    </div>

                                    <div className="leaderboardPosition">
                                      Position{" "}
                                      {
                                        result.position
                                      }
                                    </div>

                                  </div>

                                  <div className="leaderboardPoints">
                                    +
                                    {
                                      result.points
                                    }{" "}
                                    pts
                                  </div>

                                </div>
                              )
                            )}

                          </div>
                        )
                      )}

                    </div>
                  )}

                </section>
              )}

              {/* =============================================
                  CHAMPIONS
              ============================================= */}

              {activeTab ===
                "champions" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🏆 Champions
                    </h2>

                    <span>
                      Finalized events only
                    </span>

                  </div>

                  {champions.length ===
                  0 ? (
                    <div className="empty card">

                      <div className="emptyIcon">
                        🏆
                      </div>

                      <strong>
                        No champions
                        finalized yet.
                      </strong>

                      <p>
                        The champion will appear
                        here only after the event
                        result is officially
                        finalized by the admin.
                      </p>

                    </div>
                  ) : (
                    <div className="championGrid">

                      {champions.map(
                        (item) => (
                          <div
                            className="championCard"
                            key={
                              item.event.id
                            }
                          >

                            <div className="trophy">
                              🏆
                            </div>

                            <div className="championLabel">
                              EUPHORIA CHAMPION
                            </div>

                            <div className="championName">
                              {item.club?.name ||
                                "Unknown Club"}
                            </div>

                            <div className="championEvent">
                              {item.event.gender}
                              {" · "}
                              {item.event.name}
                              {" · "}
                              {item.event.category}
                            </div>

                            <div className="finalizedBadge">
                              ✓ RESULT FINALIZED
                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </section>
              )}

              {/* =============================================
                  RESULTS
              ============================================= */}

              {activeTab === "results" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🥇 Finalized Results
                    </h2>

                    <span>
                      Official results only
                    </span>

                  </div>

                  {groupedResults.length ===
                  0 ? (
                    <div className="empty card">

                      <div className="emptyIcon">
                        📋
                      </div>

                      No event results have
                      been finalized yet.

                    </div>
                  ) : (
                    groupedResults.map(
                      (group) => (
                        <div
                          key={
                            group.event.id
                          }
                          style={{
                            marginBottom:
                              "30px",
                          }}
                        >

                          <div className="sectionTitle">

                            <h2>
                              {
                                group.event
                                  .gender
                              }{" "}
                              ·{" "}
                              {
                                group.event
                                  .name
                              }
                            </h2>

                            <span>
                              ✓ Finalized
                            </span>

                          </div>

                          <div className="podiumGrid">

                            {group.results
                              .sort(
                                (a, b) =>
                                  Number(
                                    a.position
                                  ) -
                                  Number(
                                    b.position
                                  )
                              )
                              .map(
                                (result) => (
                                  <div
                                    className="podiumCard"
                                    key={
                                      result.id
                                    }
                                  >

                                    <div className="podiumPosition">

                                      {positionEmoji(
                                        result.position
                                      )}

                                    </div>

                                    <div className="podiumClub">

                                      {
                                        result
                                          .clubs
                                          ?.name
                                      }

                                    </div>

                                    <div className="podiumEvent">

                                      {
                                        group
                                          .event
                                          .category
                                      }

                                    </div>

                                    <div className="podiumPoints">

                                      +
                                      {
                                        result.points
                                      }{" "}
                                      points

                                    </div>

                                  </div>
                                )
                              )}

                          </div>

                        </div>
                      )
                    )
                  )}

                </section>
              )}

              {/* =============================================
                  OVERALL POINT TABLE
              ============================================= */}

              {activeTab ===
                "standings" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      📊 Overall Points
                    </h2>

                    <span>
                      Combined finalized
                      events
                    </span>

                  </div>

                  <div className="tableWrap">

                    <table>

                      <thead>

                        <tr>

                          <th>
                            Rank
                          </th>

                          <th>
                            Club
                          </th>

                          <th>
                            🥇
                          </th>

                          <th>
                            🥈
                          </th>

                          <th>
                            🥉
                          </th>

                          <th>
                            Points
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {standings.map(
                          (
                            club,
                            index
                          ) => (
                            <tr
                              key={
                                club.id
                              }
                            >

                              <td className="rank">
                                {
                                  index +
                                  1
                                }
                              </td>

                              <td>
                                <strong>
                                  {
                                    club.name
                                  }
                                </strong>
                              </td>

                              <td>
                                {
                                  club.gold
                                }
                              </td>

                              <td>
                                {
                                  club.silver
                                }
                              </td>

                              <td>
                                {
                                  club.bronze
                                }
                              </td>

                              <td className="points">
                                {
                                  club.points
                                }
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                  {standings.every(
                    (club) =>
                      club.points === 0
                  ) && (
                    <div className="empty">
                      Points will appear
                      after event results
                      are finalized.
                    </div>
                  )}

                </section>
              )}

            </>
          )}

        </main>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer>

          EUPHORIA 2026 · Sports Fest

          <br />

          <span>
            Scores and results update
            automatically.
          </span>

        </footer>

      </div>
    </>
  );
}
