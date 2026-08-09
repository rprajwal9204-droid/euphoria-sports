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
name.includes("cricket") ||
(category.includes("team") && pointsType.includes("team"))
);
}

function formatScore(match, side) {
let runs;
let wickets;
let overs;

if (side === "a") {
runs = match.innings1_runs;
wickets = match.innings1_wickets;
overs = match.innings1_overs;
} else {
runs = match.innings2_runs;
wickets = match.innings2_wickets;
overs = match.innings2_overs;
}

if (
runs === null ||
runs === undefined ||
runs === ""
) {
return match["score_${side}"] || "—";
}

let score = String(runs);

if (
wickets !== null &&
wickets !== undefined &&
wickets !== ""
) {
score += "/${wickets}";
}

if (
overs !== null &&
overs !== undefined &&
overs !== ""
) {
score += " (${overs} ov)";
}

return score;
}

function statusClass(status) {
const value = String(status || "")
.toLowerCase()
.replace(/\s+/g, "-");

if (value.includes("live")) return "live";
if (
value.includes("final") ||
value.includes("complete") ||
value.includes("completed")
) {
return "final";
}

return "upcoming";
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
const [activeEvent, setActiveEvent] = useState("all");
const [activeTab, setActiveTab] = useState("matches");

const [leaderboardMode, setLeaderboardMode] =
useState("overall");

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
  supabase
    .from("events")
    .select("*")
    .order("id"),

  supabase
    .from("clubs")
    .select("*")
    .order("id"),

  /*
    IMPORTANT:
    Do NOT request innings_a_wickets /
    innings_b_wickets because those columns
    do not exist in the database.

    Cricket uses innings1_* and innings2_*.
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
    .order("id", { ascending: false }),

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
  console.error("Events error:", eventError);
  setMsg(eventError.message);
}

if (clubError) {
  console.error("Clubs error:", clubError);
  setMsg(clubError.message);
}

if (matchError) {
  console.error("Matches error:", matchError);
  setMsg(matchError.message);
}

if (resultError) {
  console.error("Results error:", resultError);
  setMsg(resultError.message);
}

setEvents(eventData || []);
setClubs(clubData || []);
setMatches(matchData || []);

/*
  Only finalized event results are public.
*/

const finalizedResults = (resultData || []).filter(
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
      Number(r.event_id) === Number(event.id) &&
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

}, [events, results, activeEvent]);

/* =======================================================
OVERALL LEADERBOARD
======================================================= */

const overallStandings = useMemo(() => {
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
  if (!result.events?.result_finalized) {
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

  if (Number(result.position) === 1) {
    table[result.club_id].gold += 1;
  }

  if (Number(result.position) === 2) {
    table[result.club_id].silver += 1;
  }

  if (Number(result.position) === 3) {
    table[result.club_id].bronze += 1;
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
INDIVIDUAL EVENT / SPORT LEADERBOARD

 This is the important new section.

 When an event is selected:
   Cricket -> Cricket leaderboard
   Football -> Football leaderboard
   etc.

 If "All Events" is selected, the user can still
 choose an individual event from the leaderboard
 selector.

======================================================= */

const eventStandings = useMemo(() => {
let eventId = activeEvent;

/*
  If All Events is selected, use the first event
  that has finalized results.
*/
if (eventId === "all") {
  const firstResult = results[0];

  if (!firstResult) {
    return [];
  }

  eventId = firstResult.event_id;
}

const eventResults = results.filter(
  (result) =>
    String(result.event_id) ===
      String(eventId) &&
    result.events?.result_finalized === true
);

const table = {};

/*
  Start every club at zero so even clubs without
  a medal/result remain visible.
*/
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

eventResults.forEach((result) => {
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

  if (Number(result.position) === 1) {
    table[result.club_id].gold += 1;
  }

  if (Number(result.position) === 2) {
    table[result.club_id].silver += 1;
  }

  if (Number(result.position) === 3) {
    table[result.club_id].bronze += 1;
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

}, [clubs, results, activeEvent]);

/* =======================================================
EVENT USED FOR INDIVIDUAL LEADERBOARD
======================================================= */

const leaderboardEvent = useMemo(() => {
if (activeEvent !== "all") {
return events.find(
(event) =>
String(event.id) ===
String(activeEvent)
);
}

if (results.length > 0) {
  return results[0].events;
}

return null;

}, [events, results, activeEvent]);

/* =======================================================
GROUPED RESULTS
======================================================= */

const groupedResults = useMemo(() => {
const groups = {};

visibleResults.forEach((result) => {
  if (!result.events?.result_finalized) {
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
        repeat(4, 1fr);

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

      font-size: 13px;
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

      gap: 15px;

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

    /* ================= LEADERBOARD ================= */

    .leaderboardHeader {
      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 15px;

      margin-bottom: 15px;
    }

    .leaderboardSelector {
      display: flex;

      gap: 8px;

      flex-wrap: wrap;
    }

    .leaderboardMode {
      border: 1px solid
        rgba(255, 255, 255, 0.1);

      background:
        rgba(255, 255, 255, 0.04);

      color: #aaa;

      padding: 9px 13px;

      border-radius: 999px;

      cursor: pointer;

      font-size: 11px;

      font-weight: 800;
    }

    .leaderboardMode.active {
      background:
        linear-gradient(
          135deg,
          #a84dff,
          #6d27d9
        );

      color: white;

      border-color:
        rgba(255, 255, 255, 0.2);
    }

    .leaderboardBanner {
      padding: 20px;

      margin-bottom: 15px;

      border-radius: 18px;

      background:
        radial-gradient(
          circle at top right,
          rgba(168, 77, 255, 0.18),
          transparent 55%
        ),
        rgba(255, 255, 255, 0.035);

      border:
        1px solid
        rgba(255, 255, 255, 0.08);
    }

    .leaderboardBannerSmall {
      color: #a69baa;

      font-size: 11px;

      text-transform: uppercase;

      letter-spacing: 1.5px;

      font-weight: 800;
    }

    .leaderboardBannerTitle {
      margin-top: 7px;

      font-size: 23px;

      font-weight: 900;
    }

    .leaderboardBannerSub {
      margin-top: 5px;

      color: #777;

      font-size: 12px;
    }

    .leaderboardRows {
      display: flex;

      flex-direction: column;

      gap: 10px;
    }

    .leaderboardRow {
      display: grid;

      grid-template-columns:
        50px
        1fr
        repeat(3, 55px)
        90px;

      align-items: center;

      gap: 10px;

      padding: 17px;

      border-radius: 16px;

      background:
        rgba(255, 255, 255, 0.035);

      border:
        1px solid
        rgba(255, 255, 255, 0.065);
    }

    .leaderboardRow.top {
      background:
        linear-gradient(
          110deg,
          rgba(255, 205, 80, 0.09),
          rgba(255, 255, 255, 0.035)
        );

      border-color:
        rgba(255, 210, 100, 0.16);
    }

    .leaderboardRank {
      font-size: 20px;

      font-weight: 950;

      color: #777;
    }

    .leaderboardRow.top
      .leaderboardRank {
      color: #ffd66b;
    }

    .leaderboardClub {
      font-size: 15px;

      font-weight: 850;
    }

    .medalCount {
      text-align: center;

      color: #aaa;

      font-size: 13px;

      font-weight: 800;
    }

    .leaderboardPoints {
      text-align: right;

      color: #d3a7ff;

      font-size: 18px;

      font-weight: 950;
    }

    .leaderboardLabel {
      display: block;

      margin-top: 3px;

      color: #666;

      font-size: 9px;

      font-weight: 700;
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

    @media (max-width: 650px) {
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

      .leaderboardRow {
        grid-template-columns:
          35px
          1fr
          35px
          35px
          35px
          65px;

        padding: 13px 10px;

        gap: 5px;
      }

      .leaderboardClub {
        font-size: 13px;
      }

      .leaderboardPoints {
        font-size: 15px;
      }

      .medalCount {
        font-size: 11px;
      }

      .leaderboardHeader {
        align-items: flex-start;

        flex-direction: column;
      }
    }
  `}</style>

  <div className="page">

    {/* =================================================
        HEADER
    ================================================= */}

    <header>
      <div className="logo">
        EUPHORIA <span>2026</span>
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
        event result and championship
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
          onClick={() => {
            setActiveEvent("all");
          }}
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
            onClick={() => {
              setActiveEvent(
                String(event.id)
              );
            }}
          >
            {event.gender} ·{" "}
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
          📊 Points
        </button>

      </div>

      {/* =================================================
          MESSAGE
      ================================================= */}

      {msg && (
        <div className="card">
          {msg}
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
                  {visibleMatches.length !== 1
                    ? "es"
                    : ""}
                </span>

              </div>

              {visibleMatches.length === 0 ? (
                <div className="empty card">

                  <div className="emptyIcon">
                    🏟️
                  </div>

                  No matches available yet.

                </div>
              ) : (
                visibleMatches.map(
                  (match) => {

                    const cricket =
                      isCricketEvent(
                        match.events
                      );

                    const scoreA =
                      cricket
                        ? formatScore(
                            match,
                            "a"
                          )
                        : match.score_a ||
                          "—";

                    const scoreB =
                      cricket
                        ? formatScore(
                            match,
                            "b"
                          )
                        : match.score_b ||
                          "—";

                    const winnerId =
                      Number(
                        match.winner_club_id
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
                            className={`status status-${statusClass(
                              match.status
                            )}`}
                          >
                            {match.status ||
                              "Upcoming"}
                          </div>

                        </div>

                        <div className="teams">

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
                              {match.club_a?.name ||
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
                              {match.club_b?.name ||
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
                              {match.allotted_overs}{" "}
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
              CHAMPIONS
          ============================================= */}

          {activeTab === "champions" && (
            <section>

              <div className="sectionTitle">

                <h2>
                  🏆 Champions
                </h2>

                <span>
                  Finalized events only
                </span>

              </div>

              {champions.length === 0 ? (
                <div className="empty card">

                  <div className="emptyIcon">
                    🏆
                  </div>

                  <strong>
                    No champions finalized yet.
                  </strong>

                  <p>
                    The champion will appear
                    here only after the event
                    result is officially finalized
                    by the admin.
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

              {groupedResults.length === 0 ? (
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

                      <div
                        className="sectionTitle"
                      >

                        <h2>
                          {group.event.gender}
                          {" · "}
                          {group.event.name}
                        </h2>

                        <span>
                          ✓ Finalized
                        </span>

                      </div>

                      <div className="podiumGrid">

                        {[...group.results]
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
                                  {Number(
                                    result.position
                                  ) === 1
                                    ? "🥇"
                                    : Number(
                                        result.position
                                      ) === 2
                                    ? "🥈"
                                    : "🥉"}
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
              POINTS / LEADERBOARD
          ============================================= */}

          {activeTab === "standings" && (
            <section>

              <div className="sectionTitle">

                <h2>
                  📊 Points & Leaderboards
                </h2>

                <span>
                  Finalized results only
                </span>

              </div>

              {/* LEADERBOARD TYPE */}

              <div className="leaderboardHeader">

                <div className="leaderboardSelector">

                  <button
                    className={
                      leaderboardMode ===
                      "overall"
                        ? "leaderboardMode active"
                        : "leaderboardMode"
                    }
                    onClick={() =>
                      setLeaderboardMode(
                        "overall"
                      )
                    }
                  >
                    🌐 Overall
                  </button>

                  <button
                    className={
                      leaderboardMode ===
                      "event"
                        ? "leaderboardMode active"
                        : "leaderboardMode"
                    }
                    onClick={() =>
                      setLeaderboardMode(
                        "event"
                      )
                    }
                  >
                    🏅 This Sport
                  </button>

                </div>

              </div>

              {/* =========================================
                  OVERALL LEADERBOARD
              ========================================= */}

              {leaderboardMode === "overall" && (
                <>

                  <div className="leaderboardBanner">

                    <div className="leaderboardBannerSmall">
                      EUPHORIA 2026
                    </div>

                    <div className="leaderboardBannerTitle">
                      Overall Club Leaderboard
                    </div>

                    <div className="leaderboardBannerSub">
                      Points accumulated from
                      all finalized events.
                    </div>

                  </div>

                  <div className="leaderboardRows">

                    {overallStandings.map(
                      (club, index) => (
                        <div
                          key={club.id}
                          className={
                            index < 3
                              ? "leaderboardRow top"
                              : "leaderboardRow"
                          }
                        >

                          <div className="leaderboardRank">
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : index === 2
                              ? "🥉"
                              : index + 1}
                          </div>

                          <div className="leaderboardClub">
                            {club.name}
                          </div>

                          <div className="medalCount">
                            {club.gold}
                            <span className="leaderboardLabel">
                              GOLD
                            </span>
                          </div>

                          <div className="medalCount">
                            {club.silver}
                            <span className="leaderboardLabel">
                              SILVER
                            </span>
                          </div>

                          <div className="medalCount">
                            {club.bronze}
                            <span className="leaderboardLabel">
                              BRONZE
                            </span>
                          </div>

                          <div className="leaderboardPoints">
                            {club.points}
                            <span className="leaderboardLabel">
                              POINTS
                            </span>
                          </div>

                        </div>
                      )
                    )}

                  </div>

                  {overallStandings.every(
                    (club) =>
                      club.points === 0
                  ) && (
                    <div className="empty">
                      Points will appear after
                      event results are finalized.
                    </div>
                  )}

                </>
              )}

              {/* =========================================
                  INDIVIDUAL SPORT LEADERBOARD
              ========================================= */}

              {leaderboardMode === "event" && (
                <>

                  <div className="leaderboardBanner">

                    <div className="leaderboardBannerSmall">
                      INDIVIDUAL SPORT LEADERBOARD
                    </div>

                    <div className="leaderboardBannerTitle">
                      {leaderboardEvent
                        ? `${leaderboardEvent.gender || ""} · ${
                            leaderboardEvent.name || ""
                          }`
                        : "Select a sport"}
                    </div>

                    <div className="leaderboardBannerSub">
                      Rankings for this sport
                      only. Only finalized results
                      contribute points.
                    </div>

                  </div>

                  {/* SPORT SELECTOR */}

                  <div
                    className="eventBar"
                    style={{
                      marginBottom:
                        "20px",
                    }}
                  >

                    {events.map((event) => (
                      <button
                        key={event.id}
                        className={
                          String(
                            activeEvent
                          ) ===
                          String(event.id)
                            ? "eventButton active"
                            : "eventButton"
                        }
                        onClick={() => {
                          setActiveEvent(
                            String(event.id)
                          );
                        }}
                      >
                        {event.gender} ·{" "}
                        {event.name}
                      </button>
                    ))}

                  </div>

                  {eventStandings.length ===
                  0 ? (
                    <div className="empty card">

                      <div className="emptyIcon">
                        📊
                      </div>

                      <strong>
                        No finalized results
                        for this sport yet.
                      </strong>

                      <p>
                        Once the admin finalizes
                        the event results, the
                        sport leaderboard will
                        appear here.
                      </p>

                    </div>
                  ) : (
                    <div className="leaderboardRows">

                      {eventStandings.map(
                        (club, index) => (
                          <div
                            key={club.id}
                            className={
                              index < 3
                                ? "leaderboardRow top"
                                : "leaderboardRow"
                            }
                          >

                            <div className="leaderboardRank">
                              {index === 0
                                ? "🥇"
                                : index === 1
                                ? "🥈"
                                : index === 2
                                ? "🥉"
                                : index + 1}
                            </div>

                            <div className="leaderboardClub">
                              {club.name}
                            </div>

                            <div className="medalCount">
                              {club.gold}
                              <span className="leaderboardLabel">
                                GOLD
                              </span>
                            </div>

                            <div className="medalCount">
                              {club.silver}
                              <span className="leaderboardLabel">
                                SILVER
                              </span>
                            </div>

                            <div className="medalCount">
                              {club.bronze}
                              <span className="leaderboardLabel">
                                BRONZE
                              </span>
                            </div>

                            <div className="leaderboardPoints">
                              {club.points}
                              <span className="leaderboardLabel">
                                POINTS
                              </span>
                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </>
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
        Scores update automatically.
      </span>
    </footer>

  </div>
</>

);
}
