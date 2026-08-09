"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompleted(status) {
  return [
    "completed",
    "complete",
    "finished",
    "final",
    "result",
  ].includes(normalize(status));
}

function isCricketEvent(event) {
  if (!event) return false;

  const name = normalize(event.name);
  const category = normalize(event.category);
  const pointsType = normalize(event.points_type);

  return (
    name.includes("cricket") ||
    category.includes("cricket") ||
    pointsType.includes("cricket")
  );
}

function isFootballEvent(event) {
  if (!event) return false;

  const name = normalize(event.name);
  const category = normalize(event.category);

  return (
    name.includes("football") ||
    category.includes("football")
  );
}

function cricketOversToDecimal(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const text = String(value).trim();

  if (!text.includes(".")) {
    const whole = Number(text);
    return Number.isFinite(whole) ? whole : 0;
  }

  const parts = text.split(".");

  const overs = Number(parts[0]) || 0;
  const balls = Number(parts[1]) || 0;

  if (balls < 0 || balls > 5) {
    return overs;
  }

  return overs + balls / 6;
}

function parseScoreString(score) {
  if (
    score === null ||
    score === undefined ||
    score === ""
  ) {
    return {
      value: 0,
      secondary: 0,
      overs: 0,
    };
  }

  const text = String(score).trim();

  const cricketMatch = text.match(
    /^(\d+)\s*\/\s*(\d+)?(?:\s*\(([\d.]+)\s*ov\))?/i
  );

  if (cricketMatch) {
    return {
      value: Number(cricketMatch[1]) || 0,
      secondary: Number(cricketMatch[2]) || 0,
      overs: cricketOversToDecimal(
        cricketMatch[3]
      ),
    };
  }

  const dashMatch = text.match(
    /^(\d+(?:\.\d+)?)\s*[-:]\s*(\d+(?:\.\d+)?)$/
  );

  if (dashMatch) {
    return {
      value: Number(dashMatch[1]) || 0,
      secondary: Number(dashMatch[2]) || 0,
      overs: 0,
    };
  }

  const numberMatch =
    text.match(/-?\d+(?:\.\d+)?/);

  return {
    value: numberMatch
      ? Number(numberMatch[0]) || 0
      : 0,
    secondary: 0,
    overs: 0,
  };
}

/* =========================================================
   CRICKET
========================================================= */

function getCricketInnings(match, side) {
  const runs =
    side === "a"
      ? match?.innings_a_runs
      : match?.innings_b_runs;

  const overs =
    side === "a"
      ? match?.innings_a_overs
      : match?.innings_b_overs;

  if (
    runs !== null &&
    runs !== undefined &&
    runs !== ""
  ) {
    return {
      runs: Number(runs) || 0,
      overs: cricketOversToDecimal(overs),
      rawOvers: overs,
    };
  }

  const score =
    side === "a"
      ? match?.score_a
      : match?.score_b;

  const parsed =
    parseScoreString(score);

  return {
    runs: parsed.value,
    overs: parsed.overs,
    rawOvers: overs,
  };
}

function getCricketScore(match, side) {
  if (!match) return "—";

  const original =
    side === "a"
      ? match?.score_a
      : match?.score_b;

  if (original) {
    return original;
  }

  const innings =
    getCricketInnings(
      match,
      side
    );

  if (!innings.runs) {
    return "—";
  }

  return String(innings.runs);
}

function getMatchScore(match, side) {
  if (!match) return "—";

  if (
    isCricketEvent(
      match.events
    )
  ) {
    return getCricketScore(
      match,
      side
    );
  }

  const score =
    side === "a"
      ? match.score_a
      : match.score_b;

  return score || "—";
}

/* =========================================================
   MATCH POINTS
========================================================= */

function getStoredMatchPoints(
  match,
  side
) {
  const keys =
    side === "a"
      ? [
          "points_a",
          "club_a_points",
          "match_points_a",
          "points_club_a",
        ]
      : [
          "points_b",
          "club_b_points",
          "match_points_b",
          "points_club_b",
        ];

  for (const key of keys) {
    const value = match?.[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
}

function getMatchPoints(
  match,
  side
) {
  if (
    !isCompleted(
      match?.status
    )
  ) {
    return 0;
  }

  const stored =
    getStoredMatchPoints(
      match,
      side
    );

  if (stored !== null) {
    return stored;
  }

  const event =
    match?.events;

  const football =
    isFootballEvent(event);

  const winnerId =
    Number(
      match?.winner_club_id
    );

  const clubId =
    side === "a"
      ? Number(match?.club_a_id)
      : Number(match?.club_b_id);

  if (
    winnerId &&
    clubId &&
    winnerId === clubId
  ) {
    return football ? 3 : 2;
  }

  if (!winnerId) {
    return 1;
  }

  return 0;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Home() {
  const [events, setEvents] =
    useState([]);

  const [clubs, setClubs] =
    useState([]);

  const [matches, setMatches] =
    useState([]);

  const [results, setResults] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [activeEvent, setActiveEvent] =
    useState("all");

  const [activeTab, setActiveTab] =
    useState("matches");

  const [msg, setMsg] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {
    setMsg("");

    const [
      eventResponse,
      clubResponse,
      matchResponse,
      resultResponse,
    ] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("id"),

      supabase
        .from("clubs")
        .select("*")
        .order("id"),

      supabase
        .from("matches")
        .select(`
          *,
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

    if (eventResponse.error) {
      console.error(
        eventResponse.error
      );
      setMsg(
        eventResponse.error.message
      );
    }

    if (clubResponse.error) {
      console.error(
        clubResponse.error
      );
      setMsg(
        clubResponse.error.message
      );
    }

    if (matchResponse.error) {
      console.error(
        matchResponse.error
      );
      setMsg(
        matchResponse.error.message
      );
    }

    if (resultResponse.error) {
      console.error(
        resultResponse.error
      );
      setMsg(
        resultResponse.error.message
      );
    }

    setEvents(
      eventResponse.data || []
    );

    setClubs(
      clubResponse.data || []
    );

    setMatches(
      matchResponse.data || []
    );

    /*
      IMPORTANT:

      Only finalized event_results
      are loaded into `results`.

      This means unfinished/deleted/non-finalized
      events cannot contribute to Overall Points.
    */

    const finalizedResults =
      (resultResponse.data || []).filter(
        (result) =>
          result.events?.result_finalized === true
      );

    setResults(
      finalizedResults
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const interval =
      setInterval(
        loadData,
        15000
      );

    return () =>
      clearInterval(interval);
  }, []);

  /* =======================================================
     FILTERED MATCHES
  ======================================================= */

  const visibleMatches =
    useMemo(() => {
      if (
        activeEvent === "all"
      ) {
        return matches;
      }

      return matches.filter(
        (match) =>
          String(match.event_id) ===
          String(activeEvent)
      );
    }, [
      matches,
      activeEvent,
    ]);

  /* =======================================================
     FILTERED RESULTS
  ======================================================= */

  const visibleResults =
    useMemo(() => {
      if (
        activeEvent === "all"
      ) {
        return results;
      }

      return results.filter(
        (result) =>
          String(result.event_id) ===
          String(activeEvent)
      );
    }, [
      results,
      activeEvent,
    ]);

  /* =======================================================
     EVENT LEADERBOARDS
  ======================================================= */

  const eventLeaderboards =
    useMemo(() => {
      const groups = {};

      events.forEach(
        (event) => {
          groups[event.id] = {
            event,
            clubs: {},
            completedMatches: 0,
          };

          clubs.forEach(
            (club) => {
              groups[event.id].clubs[
                club.id
              ] = {
                id: club.id,
                name: club.name,

                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,

                points: 0,

                pointsFor: 0,
                pointsAgainst: 0,
                pointsDifference: 0,

                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,

                runsFor: 0,
                runsAgainst: 0,
                oversFor: 0,
                oversAgainst: 0,
                nrr: 0,
              };
            }
          );
        }
      );

      matches.forEach(
        (match) => {
          if (
            !isCompleted(
              match.status
            )
          ) {
            return;
          }

          const eventId =
            match.event_id;

          if (
            !groups[eventId]
          ) {
            return;
          }

          const group =
            groups[eventId];

          const clubA =
            Number(
              match.club_a_id
            );

          const clubB =
            Number(
              match.club_b_id
            );

          const winner =
            Number(
              match.winner_club_id
            );

          const A =
            group.clubs[clubA];

          const B =
            group.clubs[clubB];

          if (!A || !B) {
            return;
          }

          group.completedMatches +=
            1;

          A.played += 1;
          B.played += 1;

          if (
            winner &&
            winner === clubA
          ) {
            A.won += 1;
            B.lost += 1;
          } else if (
            winner &&
            winner === clubB
          ) {
            B.won += 1;
            A.lost += 1;
          } else {
            A.drawn += 1;
            B.drawn += 1;
          }

          A.points +=
            getMatchPoints(
              match,
              "a"
            );

          B.points +=
            getMatchPoints(
              match,
              "b"
            );

          if (
            isCricketEvent(
              match.events
            )
          ) {
            const inningsA =
              getCricketInnings(
                match,
                "a"
              );

            const inningsB =
              getCricketInnings(
                match,
                "b"
              );

            A.runsFor +=
              inningsA.runs;

            A.runsAgainst +=
              inningsB.runs;

            A.oversFor +=
              inningsA.overs;

            A.oversAgainst +=
              inningsB.overs;

            B.runsFor +=
              inningsB.runs;

            B.runsAgainst +=
              inningsA.runs;

            B.oversFor +=
              inningsB.overs;

            B.oversAgainst +=
              inningsA.overs;
          } else {
            const parsedA =
              parseScoreString(
                match.score_a
              );

            const parsedB =
              parseScoreString(
                match.score_b
              );

            A.pointsFor +=
              parsedA.value;

            A.pointsAgainst +=
              parsedB.value;

            B.pointsFor +=
              parsedB.value;

            B.pointsAgainst +=
              parsedA.value;
          }
        }
      );

      Object.values(groups)
        .forEach(
          (group) => {
            Object.values(
              group.clubs
            ).forEach(
              (club) => {
                club.goalDifference =
                  club.goalsFor -
                  club.goalsAgainst;

                club.pointsDifference =
                  club.pointsFor -
                  club.pointsAgainst;

                if (
                  club.oversFor > 0 &&
                  club.oversAgainst > 0
                ) {
                  club.nrr =
                    club.runsFor /
                      club.oversFor -
                    club.runsAgainst /
                      club.oversAgainst;
                } else {
                  club.nrr = 0;
                }

                if (
                  Math.abs(
                    club.nrr
                  ) < 0.000001
                ) {
                  club.nrr = 0;
                }
              }
            );
          }
        );

      return Object.values(groups)
        .map(
          (group) => {
            const cricket =
              isCricketEvent(
                group.event
              );

            const football =
              isFootballEvent(
                group.event
              );

            const leaderboard =
              Object.values(
                group.clubs
              )
                .filter(
                  (club) =>
                    club.played > 0
                )
                .sort(
                  (a, b) => {
                    if (
                      b.points !==
                      a.points
                    ) {
                      return (
                        b.points -
                        a.points
                      );
                    }

                    if (
                      cricket &&
                      Math.abs(
                        b.nrr -
                        a.nrr
                      ) > 0.000001
                    ) {
                      return (
                        b.nrr -
                        a.nrr
                      );
                    }

                    if (
                      football &&
                      b.goalDifference !==
                      a.goalDifference
                    ) {
                      return (
                        b.goalDifference -
                        a.goalDifference
                      );
                    }

                    if (
                      !cricket &&
                      !football &&
                      b.pointsDifference !==
                      a.pointsDifference
                    ) {
                      return (
                        b.pointsDifference -
                        a.pointsDifference
                      );
                    }

                    if (
                      b.won !==
                      a.won
                    ) {
                      return (
                        b.won -
                        a.won
                      );
                    }

                    return (
                      b.played -
                      a.played
                    );
                  }
                );

            return {
              ...group,
              cricket,
              football,
              leaderboard,
            };
          }
        )
        .filter(
          (group) =>
            activeEvent ===
              "all" ||
            String(
              group.event.id
            ) ===
              String(
                activeEvent
              )
        );
    }, [
      events,
      clubs,
      matches,
      activeEvent,
    ]);

  /* =======================================================
     CHAMPIONS
  ======================================================= */

  const champions =
    useMemo(() => {
      const list = [];

      for (
        const event of events
      ) {
        if (
          event.result_finalized !==
          true
        ) {
          continue;
        }

        const result =
          results.find(
            (r) =>
              Number(r.event_id) ===
                Number(event.id) &&
              Number(r.position) ===
                1
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

      if (
        activeEvent !==
        "all"
      ) {
        return list.filter(
          (item) =>
            String(
              item.event.id
            ) ===
            String(
              activeEvent
            )
        );
      }

      return list;
    }, [
      events,
      results,
      activeEvent,
    ]);

  /* =======================================================
     ⭐ FIXED OVERALL STANDINGS
     
     THIS IS THE ONLY PART THAT SHOULD DETERMINE
     THE OVERALL CLUB POINTS TABLE.
     
     It uses ONLY:
     
       event_results
       
     where:
     
       event.result_finalized === true
     
     Nothing else contributes.
  ======================================================= */

  const standings =
    useMemo(() => {
      const table = {};

      /*
        Start every existing club at ZERO.
      */

      clubs.forEach(
        (club) => {
          table[
            Number(club.id)
          ] = {
            id: Number(club.id),
            name: club.name,
            points: 0,
            gold: 0,
            silver: 0,
            bronze: 0,
          };
        }
      );

      /*
        Add ONLY finalized event results.
      */

      results.forEach(
        (result) => {
          /*
            Extra safety check.

            Even though `results` is already filtered,
            check again here so an accidentally stale
            result cannot enter the table.
          */

          if (
            result.events?.result_finalized !==
            true
          ) {
            return;
          }

          const clubId =
            Number(
              result.club_id
            );

          if (!clubId) {
            return;
          }

          /*
            If club somehow isn't in the clubs table,
            create it using the joined name.
          */

          if (
            !table[clubId]
          ) {
            table[clubId] = {
              id: clubId,
              name:
                result.clubs?.name ||
                "Unknown Club",
              points: 0,
              gold: 0,
              silver: 0,
              bronze: 0,
            };
          }

          /*
            IMPORTANT:

            Convert points explicitly to Number.
          */

          const points =
            Number(
              result.points
            );

          if (
            Number.isFinite(points)
          ) {
            table[clubId].points +=
              points;
          }

          const position =
            Number(
              result.position
            );

          if (
            position === 1
          ) {
            table[clubId].gold += 1;
          }

          if (
            position === 2
          ) {
            table[clubId].silver += 1;
          }

          if (
            position === 3
          ) {
            table[clubId].bronze += 1;
          }
        }
      );

      /*
        Sort:
        1. Points
        2. Gold
        3. Silver
        4. Bronze
      */

      return Object.values(
        table
      ).sort(
        (a, b) => {
          if (
            b.points !==
            a.points
          ) {
            return (
              b.points -
              a.points
            );
          }

          if (
            b.gold !==
            a.gold
          ) {
            return (
              b.gold -
              a.gold
            );
          }

          if (
            b.silver !==
            a.silver
          ) {
            return (
              b.silver -
              a.silver
            );
          }

          return (
            b.bronze -
            a.bronze
          );
        }
      );
    }, [
      clubs,
      results,
    ]);

  /* =======================================================
     GROUPED RESULTS
  ======================================================= */

  const groupedResults =
    useMemo(() => {
      const groups = {};

      visibleResults.forEach(
        (result) => {
          if (
            result.events
              ?.result_finalized !==
            true
          ) {
            return;
          }

          if (
            !groups[
              result.event_id
            ]
          ) {
            groups[
              result.event_id
            ] = {
              event:
                result.events,
              results: [],
            };
          }

          groups[
            result.event_id
          ].results.push(
            result
          );
        }
      );

      return Object.values(
        groups
      );
    }, [
      visibleResults,
    ]);

  /* =======================================================
     RENDER
     
     UI BELOW IS KEPT THE SAME.
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

        header {
          position: sticky;
          top: 0;
          z-index: 50;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 18px 6%;

          background:
            rgba(7,4,14,0.88);

          backdrop-filter: blur(18px);

          border-bottom:
            1px solid
            rgba(255,255,255,0.09);
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
            rgba(255,255,255,0.15);

          color: #ddd;

          font-size: 13px;
          font-weight: 700;
        }

        .adminLink:hover {
          background:
            rgba(255,255,255,0.08);
        }

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
            rgba(190,105,255,0.13);

          border:
            1px solid
            rgba(207,145,255,0.28);

          color: #e8caff;

          font-size: 12px;
          font-weight: 800;

          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .hero h1 {
          margin:
            20px 0 10px;

          font-size:
            clamp(42px,9vw,88px);

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

        .container {
          width:
            min(1200px,92%);

          margin: 0 auto;
          padding-bottom: 80px;
        }

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

          padding:
            11px 17px;

          border-radius: 999px;

          border:
            1px solid
            rgba(255,255,255,0.12);

          background:
            rgba(255,255,255,0.045);

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
            rgba(255,255,255,0.2);

          box-shadow:
            0 8px 30px
            rgba(130,50,230,0.25);
        }

        .tabs {
          display: grid;

          grid-template-columns:
            repeat(5,1fr);

          gap: 8px;

          margin:
            15px 0
            30px;

          padding: 6px;

          border-radius: 14px;

          background:
            rgba(255,255,255,0.045);

          border:
            1px solid
            rgba(255,255,255,0.07);
        }

        .tab {
          border: 0;

          padding:
            13px 8px;

          border-radius: 10px;

          background: transparent;

          color: #999;

          cursor: pointer;

          font-weight: 800;
          font-size: 13px;
        }

        .tab.active {
          background:
            rgba(255,255,255,0.1);

          color: white;
        }

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

        .card {
          padding: 22px;
          margin-bottom: 15px;

          border-radius: 18px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.065),
              rgba(255,255,255,0.025)
            );

          border:
            1px solid
            rgba(255,255,255,0.09);

          box-shadow:
            0 15px 50px
            rgba(0,0,0,0.18);
        }

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

        .status-final,
        .status-completed,
        .status-complete,
        .status-finished {
          background:
            rgba(100,220,130,0.12);

          color: #7af59b;
        }

        .status-live {
          background:
            rgba(255,65,95,0.13);

          color: #ff7188;

          animation:
            pulse 1.6s infinite;
        }

        .status-upcoming {
          background:
            rgba(255,190,80,0.12);

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
            1fr auto 1fr;

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
            rgba(255,255,255,0.06);

          color: #777;

          font-size: 11px;
          text-align: center;
        }

        .leaderboardCard {
          margin-bottom: 25px;
          overflow: hidden;

          border-radius: 20px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.065),
              rgba(255,255,255,0.025)
            );

          border:
            1px solid
            rgba(255,255,255,0.09);
        }

        .leaderboardHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          padding: 22px;

          background:
            rgba(255,255,255,0.035);

          border-bottom:
            1px solid
            rgba(255,255,255,0.07);
        }

        .leaderboardTitle {
          font-size: 19px;
          font-weight: 900;
        }

        .leaderboardSubtitle {
          margin-top: 5px;
          color: #777;
          font-size: 11px;
        }

        .matchCount {
          flex-shrink: 0;

          padding: 7px 11px;

          border-radius: 999px;

          background:
            rgba(170,80,255,0.12);

          color: #d3a7ff;

          font-size: 10px;
          font-weight: 900;
        }

        .leaderboardTable {
          overflow-x: auto;
        }

        .leaderboardTable table {
          min-width: 900px;
        }

        .leaderboardTable tr:first-child td {
          background:
            rgba(255,211,100,0.035);
        }

        .leaderRank {
          font-weight: 950;
          color: #777;
        }

        .leaderClub {
          font-weight: 850;
        }

        .leaderPoints {
          color: #d3a7ff;
          font-weight: 950;
          font-size: 17px;
        }

        .metric {
          font-weight: 750;
        }

        .positive {
          color: #78e69a;
        }

        .negative {
          color: #ff778d;
        }

        .neutral {
          color: #aaa;
        }

        .goldRank {
          color: #ffd66b;
        }

        .silverRank {
          color: #c9c9d0;
        }

        .bronzeRank {
          color: #d59b6a;
        }

        .championGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(260px,1fr)
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
              rgba(255,194,72,0.16),
              transparent 45%
            ),
            linear-gradient(
              145deg,
              rgba(255,255,255,0.08),
              rgba(255,255,255,0.025)
            );

          border:
            1px solid
            rgba(255,210,100,0.2);
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
            rgba(80,210,120,0.1);

          color: #77e69a;

          font-size: 10px;
          font-weight: 900;
        }

        .podiumGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(250px,1fr)
            );

          gap: 15px;
        }

        .podiumCard {
          padding: 22px;

          border-radius: 18px;

          background:
            rgba(255,255,255,0.04);

          border:
            1px solid
            rgba(255,255,255,0.07);
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

        .tableWrap {
          overflow-x: auto;

          border-radius: 18px;

          border:
            1px solid
            rgba(255,255,255,0.08);
        }

        table {
          width: 100%;

          border-collapse: collapse;

          min-width: 620px;
        }

        th {
          padding: 14px;

          background:
            rgba(255,255,255,0.045);

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
            rgba(255,255,255,0.055);

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

        .empty {
          padding: 55px 20px;
          text-align: center;
          color: #777;
        }

        .emptyIcon {
          font-size: 38px;
          margin-bottom: 10px;
        }

        footer {
          padding: 40px 6%;

          border-top:
            1px solid
            rgba(255,255,255,0.06);

          text-align: center;

          color: #555;
          font-size: 12px;
        }

        @media (max-width:800px) {
          .tabs {
            grid-template-columns:
              repeat(2,1fr);
          }
        }

        @media (max-width:650px) {
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

          .leaderboardHeader {
            padding: 17px;
          }

          .sectionTitle {
            align-items: flex-start;
            flex-direction: column;
          }
        }

      `}</style>

      <div className="page">

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

        <section className="hero">

          <div className="heroBadge">
            🏆 Inter-Club Sports Fest
          </div>

          <h1>
            EUPHORIA
          </h1>

          <p>
            Follow every match,
            live score, event
            leaderboard, official
            result and championship
            across EUPHORIA.
          </p>

        </section>

        <main className="container">

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

            {events.map(
              (event) => (
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
              )
            )}

          </div>

          <div className="tabs">

            {[
              [
                "matches",
                "🏟️ Matches",
              ],
              [
                "leaderboard",
                "📈 Leaderboard",
              ],
              [
                "champions",
                "🏆 Champions",
              ],
              [
                "results",
                "🥇 Results",
              ],
              [
                "standings",
                "📊 Overall Points",
              ],
            ].map(
              ([key, label]) => (
                <button
                  key={key}
                  className={
                    activeTab === key
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() =>
                    setActiveTab(key)
                  }
                >
                  {label}
                </button>
              )
            )}

          </div>

          {msg && (
            <div className="card">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="empty">
              <div className="emptyIcon">
                ⏳
              </div>

              Loading EUPHORIA...
            </div>
          ) : (
            <>

              {/* MATCHES */}

              {activeTab ===
                "matches" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🏟️ Matches
                    </h2>

                    <span>
                      {
                        visibleMatches.length
                      }{" "}
                      match
                      {visibleMatches.length !== 1
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

                      No matches
                      available yet.
                    </div>
                  ) : (
                    visibleMatches.map(
                      (match) => {
                        const scoreA =
                          getMatchScore(
                            match,
                            "a"
                          );

                        const scoreB =
                          getMatchScore(
                            match,
                            "b"
                          );

                        const winnerId =
                          Number(
                            match.winner_club_id
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
                                {
                                  match.events
                                    ?.gender
                                }
                                {" · "}
                                {
                                  match.events
                                    ?.name
                                }
                                {" · "}
                                {
                                  match.events
                                    ?.category
                                }
                              </div>

                              <div
                                className={`status status-${normalize(
                                  match.status
                                ).replace(
                                  /\s+/g,
                                  "-"
                                )}`}
                              >
                                {match.status}
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
                                  {
                                    match.club_a
                                      ?.name
                                  }
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
                                  {
                                    match.club_b
                                      ?.name
                                  }
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

              {/* LEADERBOARD */}

              {activeTab ===
                "leaderboard" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      📈 Event Leaderboard
                    </h2>

                    <span>
                      Based on completed
                      matches
                    </span>

                  </div>

                  {eventLeaderboards.length ===
                  0 ? (
                    <div className="empty card">
                      No events
                      available.
                    </div>
                  ) : (
                    eventLeaderboards.map(
                      (group) => (
                        <div
                          className="leaderboardCard"
                          key={
                            group.event.id
                          }
                        >

                          <div className="leaderboardHeader">

                            <div>

                              <div className="leaderboardTitle">
                                {
                                  group.event
                                    .gender
                                }
                                {" · "}
                                {
                                  group.event
                                    .name
                                }
                              </div>

                              <div className="leaderboardSubtitle">
                                {
                                  group.event
                                    .category
                                }
                                {" · "}
                                {group.cricket
                                  ? "Cricket points + NRR"
                                  : group.football
                                  ? "Football points + Goal Difference"
                                  : "Match points + Points Difference"}
                              </div>

                            </div>

                            <div className="matchCount">
                              {
                                group.completedMatches
                              }{" "}
                              completed
                            </div>

                          </div>

                          {group.leaderboard.length ===
                          0 ? (
                            <div className="empty">
                              No completed
                              matches yet.
                            </div>
                          ) : (
                            <div className="leaderboardTable">

                              <table>

                                <thead>
                                  <tr>
                                    <th>Rank</th>
                                    <th>Club</th>
                                    <th>P</th>
                                    <th>W</th>
                                    <th>T</th>
                                    <th>L</th>

                                    {group.cricket ? (
                                      <>
                                        <th>Runs For</th>
                                        <th>Runs Against</th>
                                        <th>NRR</th>
                                      </>
                                    ) : group.football ? (
                                      <>
                                        <th>Goals For</th>
                                        <th>Goals Against</th>
                                        <th>GD</th>
                                      </>
                                    ) : (
                                      <>
                                        <th>PF</th>
                                        <th>PA</th>
                                        <th>PD</th>
                                      </>
                                    )}

                                    <th>Points</th>
                                  </tr>
                                </thead>

                                <tbody>

                                  {group.leaderboard.map(
                                    (
                                      club,
                                      index
                                    ) => {

                                      const difference =
                                        group.cricket
                                          ? club.nrr
                                          : group.football
                                          ? club.goalDifference
                                          : club.pointsDifference;

                                      return (
                                        <tr
                                          key={
                                            club.id
                                          }
                                        >

                                          <td
                                            className={
                                              index === 0
                                                ? "leaderRank goldRank"
                                                : index === 1
                                                ? "leaderRank silverRank"
                                                : index === 2
                                                ? "leaderRank bronzeRank"
                                                : "leaderRank"
                                            }
                                          >
                                            {index === 0
                                              ? "🥇"
                                              : index === 1
                                              ? "🥈"
                                              : index === 2
                                              ? "🥉"
                                              : index + 1}
                                          </td>

                                          <td className="leaderClub">
                                            {club.name}
                                          </td>

                                          <td>
                                            {club.played}
                                          </td>

                                          <td>
                                            {club.won}
                                          </td>

                                          <td>
                                            {club.drawn}
                                          </td>

                                          <td>
                                            {club.lost}
                                          </td>

                                          {group.cricket ? (
                                            <>
                                              <td className="metric">
                                                {club.runsFor}
                                              </td>

                                              <td className="metric">
                                                {club.runsAgainst}
                                              </td>

                                              <td
                                                className={`metric ${
                                                  club.nrr > 0
                                                    ? "positive"
                                                    : club.nrr < 0
                                                    ? "negative"
                                                    : "neutral"
                                                }`}
                                              >
                                                {club.nrr.toFixed(
                                                  2
                                                )}
                                              </td>
                                            </>
                                          ) : group.football ? (
                                            <>
                                              <td className="metric">
                                                {club.goalsFor}
                                              </td>

                                              <td className="metric">
                                                {club.goalsAgainst}
                                              </td>

                                              <td
                                                className={`metric ${
                                                  difference > 0
                                                    ? "positive"
                                                    : difference < 0
                                                    ? "negative"
                                                    : "neutral"
                                                }`}
                                              >
                                                {difference > 0
                                                  ? "+"
                                                  : ""}
                                                {difference}
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="metric">
                                                {club.pointsFor}
                                              </td>

                                              <td className="metric">
                                                {club.pointsAgainst}
                                              </td>

                                              <td
                                                className={`metric ${
                                                  difference > 0
                                                    ? "positive"
                                                    : difference < 0
                                                    ? "negative"
                                                    : "neutral"
                                                }`}
                                              >
                                                {difference > 0
                                                  ? "+"
                                                  : ""}
                                                {difference}
                                              </td>
                                            </>
                                          )}

                                          <td className="leaderPoints">
                                            {club.points}
                                          </td>

                                        </tr>
                                      );
                                    }
                                  )}

                                </tbody>

                              </table>

                            </div>
                          )}

                        </div>
                      )
                    )
                  )}

                </section>
              )}

              {/* CHAMPIONS */}

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
                        The champion will
                        appear here after
                        the event result is
                        officially finalized
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
                              EUPHORIA
                              CHAMPION
                            </div>

                            <div className="championName">
                              {
                                item.club
                                  ?.name
                              }
                            </div>

                            <div className="championEvent">
                              {
                                item.event
                                  .gender
                              }
                              {" · "}
                              {
                                item.event
                                  .name
                              }
                              {" · "}
                              {
                                item.event
                                  .category
                              }
                            </div>

                            <div className="finalizedBadge">
                              ✓ RESULT
                              FINALIZED
                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </section>
              )}

              {/* RESULTS */}

              {activeTab ===
                "results" && (
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

                      No event results
                      have been finalized
                      yet.

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
                              }
                              {" · "}
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

                            {[
                              ...group.results,
                            ]
                              .sort(
                                (a,b) =>
                                  Number(
                                    a.position
                                  ) -
                                  Number(
                                    b.position
                                  )
                              )
                              .map(
                                (
                                  result
                                ) => (
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
                                        result.clubs
                                          ?.name
                                      }
                                    </div>

                                    <div className="podiumEvent">
                                      {
                                        group.event
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

              {/* ⭐ OVERALL POINTS */}

              {activeTab ===
                "standings" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      📊 Overall Club Points
                    </h2>

                    <span>
                      Finalized results only
                    </span>

                  </div>

                  <div className="tableWrap">

                    <table>

                      <thead>

                        <tr>
                          <th>Rank</th>
                          <th>Club</th>
                          <th>🥇</th>
                          <th>🥈</th>
                          <th>🥉</th>
                          <th>Points</th>
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
                                {index + 1}
                              </td>

                              <td>
                                <strong>
                                  {club.name}
                                </strong>
                              </td>

                              <td>
                                {club.gold}
                              </td>

                              <td>
                                {club.silver}
                              </td>

                              <td>
                                {club.bronze}
                              </td>

                              <td className="points">
                                {club.points}
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
                      Overall club points
                      will appear after
                      event results are
                      finalized.
                    </div>
                  )}

                </section>
              )}

            </>
          )}

        </main>

        <footer>

          EUPHORIA 2026 ·
          Sports Fest

          <br />

          <span>
            Scores and leaderboards
            update automatically.
          </span>

        </footer>

      </div>
    </>
  );
}
