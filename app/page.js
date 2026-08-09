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
  const s = normalize(status);

  return [
    "completed",
    "complete",
    "finished",
    "final",
    "result",
  ].includes(s);
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
    category.includes("football") ||
    name.includes("soccer") ||
    category.includes("soccer")
  );
}

/* =========================================================
   CRICKET SCORE
========================================================= */

function getCricketInnings(match, clubSide) {
  if (!match) {
    return null;
  }

  const clubId =
    clubSide === "a"
      ? Number(match.club_a_id)
      : Number(match.club_b_id);

  const battingFirst = Number(
    match.batting_first_club_id
  );

  let inningsNumber;

  if (battingFirst && battingFirst === clubId) {
    inningsNumber = 1;
  } else if (battingFirst) {
    inningsNumber = 2;
  } else {
    inningsNumber = clubSide === "a" ? 1 : 2;
  }

  return {
    runs:
      inningsNumber === 1
        ? match.innings1_runs
        : match.innings2_runs,

    wickets:
      inningsNumber === 1
        ? match.innings1_wickets
        : match.innings2_wickets,

    overs:
      inningsNumber === 1
        ? match.innings1_overs
        : match.innings2_overs,

    inningsNumber,
  };
}

function getCricketScore(match, clubSide) {
  const innings = getCricketInnings(
    match,
    clubSide
  );

  if (!innings) {
    return "—";
  }

  if (
    innings.runs === null ||
    innings.runs === undefined ||
    innings.runs === ""
  ) {
    return (
      clubSide === "a"
        ? match.score_a
        : match.score_b
    ) || "—";
  }

  let score = String(innings.runs);

  if (
    innings.wickets !== null &&
    innings.wickets !== undefined &&
    innings.wickets !== ""
  ) {
    score += `/${innings.wickets}`;
  }

  if (
    innings.overs !== null &&
    innings.overs !== undefined &&
    innings.overs !== ""
  ) {
    score += ` (${innings.overs} ov)`;
  }

  return score;
}

/* =========================================================
   GENERAL SCORE
========================================================= */

function getMatchScore(match, side) {
  if (isCricketEvent(match?.events)) {
    return getCricketScore(match, side);
  }

  return (
    side === "a"
      ? match?.score_a
      : match?.score_b
  ) || "—";
}

/* =========================================================
   NUMERIC SCORE
========================================================= */

function numericScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

/* =========================================================
   CRICKET OVERS
========================================================= */

/*
  Converts cricket overs such as:

  10
  10.3
  19.5

  into actual balls.

  IMPORTANT:
  10.3 cricket overs means 10 overs + 3 balls,
  NOT 10.3 mathematical overs.
*/

function oversToBalls(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const text = String(value);

  if (!text.includes(".")) {
    return Math.round(
      Number(value) * 6
    );
  }

  const parts = text.split(".");

  const overs = Number(parts[0]) || 0;
  const balls = Number(parts[1]) || 0;

  return overs * 6 + balls;
}

function ballsToOvers(balls) {
  if (!balls) {
    return 0;
  }

  const completedOvers =
    Math.floor(balls / 6);

  const remainingBalls =
    balls % 6;

  return (
    completedOvers +
    remainingBalls / 10
  );
}

/* =========================================================
   CRICKET NRR
========================================================= */

/*
  Standard NRR:

  NRR =
  (total runs scored / total overs faced)
  -
  (total runs conceded / total overs bowled)

  If a team is all out before its allotted overs,
  the innings is treated as having used the
  full allotted overs for NRR purposes.

  If allotted_overs is unavailable,
  actual recorded overs are used.

  This prevents the previous "NRR = 0" problem.
*/

function getAllottedOvers(match) {
  const possibleValues = [
    match?.allotted_overs,
    match?.overs_limit,
    match?.total_overs,
    match?.max_overs,
  ];

  for (const value of possibleValues) {
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number(value) > 0
    ) {
      return Number(value);
    }
  }

  return null;
}

function getCricketNRRContribution(
  match,
  clubSide
) {
  const own = getCricketInnings(
    match,
    clubSide
  );

  const opponent = getCricketInnings(
    match,
    clubSide === "a" ? "b" : "a"
  );

  if (!own || !opponent) {
    return {
      scored: 0,
      conceded: 0,
      facedBalls: 0,
      bowledBalls: 0,
    };
  }

  const scored = numericScore(
    own.runs
  );

  const conceded = numericScore(
    opponent.runs
  );

  let facedBalls =
    oversToBalls(own.overs);

  let bowledBalls =
    oversToBalls(opponent.overs);

  const allottedOvers =
    getAllottedOvers(match);

  const allottedBalls = allottedOvers
    ? Math.round(allottedOvers * 6)
    : 0;

  /*
    If the innings ended because all wickets
    were lost before the allotted overs,
    use the allotted overs for NRR.
  */

  const allOut =
    own.wickets !== null &&
    own.wickets !== undefined &&
    own.wickets !== "" &&
    Number(own.wickets) >= 10;

  if (
    allOut &&
    allottedBalls > 0 &&
    facedBalls < allottedBalls
  ) {
    facedBalls = allottedBalls;
  }

  /*
    For the opponent's innings, the same
    principle applies when calculating overs
    bowled.
  */

  const opponentAllOut =
    opponent.wickets !== null &&
    opponent.wickets !== undefined &&
    opponent.wickets !== "" &&
    Number(opponent.wickets) >= 10;

  if (
    opponentAllOut &&
    allottedBalls > 0 &&
    bowledBalls < allottedBalls
  ) {
    bowledBalls = allottedBalls;
  }

  return {
    scored,
    conceded,
    facedBalls,
    bowledBalls,
  };
}

function calculateCricketNRR(
  matches,
  clubId
) {
  let totalScored = 0;
  let totalConceded = 0;
  let totalFacedBalls = 0;
  let totalBowledBalls = 0;

  matches.forEach((match) => {
    if (!isCompleted(match.status)) {
      return;
    }

    if (
      !isCricketEvent(match.events)
    ) {
      return;
    }

    const side =
      Number(match.club_a_id) ===
      Number(clubId)
        ? "a"
        : Number(match.club_b_id) ===
          Number(clubId)
        ? "b"
        : null;

    if (!side) {
      return;
    }

    const contribution =
      getCricketNRRContribution(
        match,
        side
      );

    totalScored +=
      contribution.scored;

    totalConceded +=
      contribution.conceded;

    totalFacedBalls +=
      contribution.facedBalls;

    totalBowledBalls +=
      contribution.bowledBalls;
  });

  if (
    totalFacedBalls <= 0 ||
    totalBowledBalls <= 0
  ) {
    return 0;
  }

  const runRateFor =
    totalScored /
    (totalFacedBalls / 6);

  const runRateAgainst =
    totalConceded /
    (totalBowledBalls / 6);

  return (
    runRateFor -
    runRateAgainst
  );
}

/* =========================================================
   MATCH POINT SYSTEM
========================================================= */

function getMatchPoints(
  match,
  side
) {
  if (!isCompleted(match?.status)) {
    return 0;
  }

  const event = match?.events;

  const winnerId = Number(
    match?.winner_club_id
  );

  const clubId =
    side === "a"
      ? Number(match?.club_a_id)
      : Number(match?.club_b_id);

  /*
    Football:
    Win = 3
    Draw = 1
    Loss = 0
  */

  if (isFootballEvent(event)) {
    if (
      winnerId &&
      winnerId === clubId
    ) {
      return 3;
    }

    if (!winnerId) {
      return 1;
    }

    return 0;
  }

  /*
    Cricket + all other sports:
    Win = 2
    Draw/Tie = 1
    Loss = 0
  */

  if (
    winnerId &&
    winnerId === clubId
  ) {
    return 2;
  }

  if (!winnerId) {
    return 1;
  }

  return 0;
}

/* =========================================================
   PUBLIC PAGE
========================================================= */

export default function Home() {
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);

  const [loading, setLoading] =
    useState(true);

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
      {
        data: eventData,
        error: eventError,
      },
      {
        data: clubData,
        error: clubError,
      },
      {
        data: matchData,
        error: matchError,
      },
      {
        data: resultData,
        error: resultError,
      },
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
      IMPORTANT:

      We initially load ALL event_results.

      Finalization is determined from the
      CURRENT events table below.
    */

    setResults(resultData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(
      () => {
        loadData();
      },
      15000
    );

    return () =>
      clearInterval(interval);
  }, []);

  /* =======================================================
     FINALIZED EVENTS

     IMPORTANT:
     Uses current events table.
  ======================================================= */

  const finalizedEventIds = useMemo(() => {
    return new Set(
      events
        .filter(
          (event) =>
            event.result_finalized === true
        )
        .map((event) =>
          Number(event.id)
        )
    );
  }, [events]);

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
  }, [
    matches,
    activeEvent,
  ]);

  /* =======================================================
     FINALIZED RESULTS
  ======================================================= */

  const finalizedResults =
    useMemo(() => {
      return results.filter(
        (result) =>
          finalizedEventIds.has(
            Number(result.event_id)
          )
      );
    }, [
      results,
      finalizedEventIds,
    ]);

  /* =======================================================
     INDIVIDUAL EVENT LEADERBOARDS
  ======================================================= */

  const eventLeaderboards =
    useMemo(() => {
      const groups = {};

      events.forEach((event) => {
        groups[event.id] = {
          event,
          clubs: {},
          completedMatches: 0,
        };

        clubs.forEach((club) => {
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

            scored: 0,
            conceded: 0,

            nrr: 0,
            difference: 0,
          };
        });
      });

      matches.forEach((match) => {
        if (
          !isCompleted(
            match.status
          )
        ) {
          return;
        }

        const eventId =
          Number(match.event_id);

        if (!groups[eventId]) {
          return;
        }

        const event =
          groups[eventId].event;

        const clubA =
          Number(match.club_a_id);

        const clubB =
          Number(match.club_b_id);

        if (
          !groups[eventId].clubs[
            clubA
          ] ||
          !groups[eventId].clubs[
            clubB
          ]
        ) {
          return;
        }

        groups[
          eventId
        ].completedMatches += 1;

        const winner =
          Number(
            match.winner_club_id
          );

        const scoreA =
          isCricketEvent(event)
            ? numericScore(
                getCricketInnings(
                  match,
                  "a"
                )?.runs
              )
            : numericScore(
                match.score_a
              );

        const scoreB =
          isCricketEvent(event)
            ? numericScore(
                getCricketInnings(
                  match,
                  "b"
                )?.runs
              )
            : numericScore(
                match.score_b
              );

        /* =========================
           PLAYED
        ========================= */

        groups[eventId].clubs[
          clubA
        ].played += 1;

        groups[eventId].clubs[
          clubB
        ].played += 1;

        /* =========================
           W/D/L
        ========================= */

        if (
          winner &&
          winner === clubA
        ) {
          groups[eventId].clubs[
            clubA
          ].won += 1;

          groups[eventId].clubs[
            clubB
          ].lost += 1;
        } else if (
          winner &&
          winner === clubB
        ) {
          groups[eventId].clubs[
            clubB
          ].won += 1;

          groups[eventId].clubs[
            clubA
          ].lost += 1;
        } else {
          groups[eventId].clubs[
            clubA
          ].drawn += 1;

          groups[eventId].clubs[
            clubB
          ].drawn += 1;
        }

        /* =========================
           POINTS
        ========================= */

        groups[eventId].clubs[
          clubA
        ].points += getMatchPoints(
          match,
          "a"
        );

        groups[eventId].clubs[
          clubB
        ].points += getMatchPoints(
          match,
          "b"
        );

        /* =========================
           SCORED / CONCEDED
        ========================= */

        groups[eventId].clubs[
          clubA
        ].scored += scoreA;

        groups[eventId].clubs[
          clubA
        ].conceded += scoreB;

        groups[eventId].clubs[
          clubB
        ].scored += scoreB;

        groups[eventId].clubs[
          clubB
        ].conceded += scoreA;

        /* =========================
           DIFFERENCE
        ========================= */

        groups[eventId].clubs[
          clubA
        ].difference =
          groups[eventId].clubs[
            clubA
          ].scored -
          groups[eventId].clubs[
            clubA
          ].conceded;

        groups[eventId].clubs[
          clubB
        ].difference =
          groups[eventId].clubs[
            clubB
          ].scored -
          groups[eventId].clubs[
            clubB
          ].conceded;
      });

      /*
        Calculate cricket NRR AFTER
        all matches have been processed.
      */

      Object.values(groups).forEach(
        (group) => {
          if (
            !isCricketEvent(
              group.event
            )
          ) {
            return;
          }

          Object.values(
            group.clubs
          ).forEach((club) => {
            if (club.played === 0) {
              return;
            }

            club.nrr =
              calculateCricketNRR(
                matches.filter(
                  (match) =>
                    Number(
                      match.event_id
                    ) ===
                    Number(
                      group.event.id
                    )
                ),
                club.id
              );
          });
        }
      );

      return Object.values(groups)
        .map((group) => ({
          ...group,

          leaderboard:
            Object.values(
              group.clubs
            )
              .filter(
                (club) =>
                  club.played > 0
              )
              .sort((a, b) => {
                /*
                  Primary:
                  points
                */

                if (
                  b.points !==
                  a.points
                ) {
                  return (
                    b.points -
                    a.points
                  );
                }

                /*
                  Cricket:
                  NRR
                */

                if (
                  isCricketEvent(
                    group.event
                  )
                ) {
                  if (
                    Math.abs(
                      b.nrr -
                        a.nrr
                    ) >
                    0.000001
                  ) {
                    return (
                      b.nrr -
                      a.nrr
                    );
                  }
                }

                /*
                  Football / other:
                  Difference
                */

                if (
                  b.difference !==
                  a.difference
                ) {
                  return (
                    b.difference -
                    a.difference
                  );
                }

                /*
                  Wins
                */

                if (
                  b.won !==
                  a.won
                ) {
                  return (
                    b.won -
                    a.won
                  );
                }

                /*
                  Played
                */

                return (
                  b.played -
                  a.played
                );
              }),
        }))
        .filter((group) => {
          if (
            activeEvent === "all"
          ) {
            return true;
          }

          return (
            String(
              group.event.id
            ) ===
            String(activeEvent)
          );
        });
    }, [
      events,
      clubs,
      matches,
      activeEvent,
    ]);

  /* =======================================================
     CHAMPIONS

     ONLY finalized events.
  ======================================================= */

  const champions = useMemo(() => {
    const list = [];

    for (const event of events) {
      if (
        event.result_finalized !==
        true
      ) {
        continue;
      }

      const eventResults =
        results.filter(
          (result) =>
            Number(
              result.event_id
            ) ===
            Number(event.id)
        );

      const winner =
        eventResults.find(
          (result) =>
            Number(
              result.position
            ) === 1
        );

      if (!winner) {
        continue;
      }

      const club =
        clubs.find(
          (item) =>
            Number(item.id) ===
            Number(
              winner.club_id
            )
        ) ||
        winner.clubs;

      list.push({
        event,
        result: winner,
        club,
      });
    }

    if (
      activeEvent !== "all"
    ) {
      return list.filter(
        (item) =>
          String(
            item.event.id
          ) ===
          String(activeEvent)
      );
    }

    return list;
  }, [
    events,
    results,
    clubs,
    activeEvent,
  ]);

  /* =======================================================
     OVERALL CHAMPIONSHIPS
     
     ONLY finalized event_results.
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

    finalizedResults.forEach(
      (result) => {
        const clubId =
          Number(result.club_id);

        if (!table[clubId]) {
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

        table[clubId].points +=
          numericScore(
            result.points
          );

        const position =
          Number(
            result.position
          );

        if (position === 1) {
          table[clubId].gold += 1;
        }

        if (position === 2) {
          table[clubId].silver += 1;
        }

        if (position === 3) {
          table[clubId].bronze += 1;
        }
      }
    );

    return Object.values(table).sort(
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
    finalizedResults,
  ]);

  /* =======================================================
     GROUPED FINALIZED RESULTS
  ======================================================= */

  const groupedResults =
    useMemo(() => {
      const groups = {};

      finalizedResults.forEach(
        (result) => {
          if (
            !groups[
              result.event_id
            ]
          ) {
            const event =
              events.find(
                (item) =>
                  Number(
                    item.id
                  ) ===
                  Number(
                    result.event_id
                  )
              );

            groups[
              result.event_id
            ] = {
              event:
                event ||
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

      const list =
        Object.values(groups);

      if (
        activeEvent === "all"
      ) {
        return list;
      }

      return list.filter(
        (group) =>
          String(
            group.event?.id
          ) ===
          String(activeEvent)
      );
    }, [
      finalizedResults,
      events,
      activeEvent,
    ]);

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

        /* HEADER */

        header {
          position: sticky;
          top: 0;
          z-index: 50;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 18px 6%;

          background:
            rgba(
              7,
              4,
              14,
              0.88
            );

          backdrop-filter: blur(18px);

          border-bottom:
            1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
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
            rgba(
              255,
              255,
              255,
              0.15
            );

          color: #ddd;

          font-size: 13px;
          font-weight: 700;
        }

        .adminLink:hover {
          background:
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        /* HERO */

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
            rgba(
              190,
              105,
              255,
              0.13
            );

          border:
            1px solid
            rgba(
              207,
              145,
              255,
              0.28
            );

          color: #e8caff;

          font-size: 12px;
          font-weight: 800;

          letter-spacing: 1px;

          text-transform:
            uppercase;
        }

        .hero h1 {
          margin:
            20px 0 10px;

          font-size:
            clamp(
              42px,
              9vw,
              88px
            );

          line-height: 0.95;

          letter-spacing: -3px;

          background:
            linear-gradient(
              100deg,
              #ffffff,
              #d7a4ff,
              #ffffff
            );

          -webkit-background-clip:
            text;

          color: transparent;
        }

        .hero p {
          max-width: 650px;

          margin:
            20px auto 0;

          color: #aaa2b6;

          font-size: 17px;

          line-height: 1.7;
        }

        /* CONTENT */

        .container {
          width:
            min(
              1200px,
              92%
            );

          margin: 0 auto;

          padding-bottom:
            80px;
        }

        /* EVENT FILTER */

        .eventBar {
          display: flex;

          gap: 10px;

          overflow-x: auto;

          padding:
            6px 2px
            20px;

          scrollbar-width:
            none;
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
            rgba(
              255,
              255,
              255,
              0.12
            );

          background:
            rgba(
              255,
              255,
              255,
              0.045
            );

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
            rgba(
              255,
              255,
              255,
              0.2
            );

          box-shadow:
            0 8px 30px
            rgba(
              130,
              50,
              230,
              0.25
            );
        }

        /* TABS */

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
            rgba(
              255,
              255,
              255,
              0.045
            );

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
        }

        .tab {
          border: 0;

          padding:
            13px 8px;

          border-radius: 10px;

          background:
            transparent;

          color: #999;

          cursor: pointer;

          font-weight: 800;

          font-size: 13px;
        }

        .tab.active {
          background:
            rgba(
              255,
              255,
              255,
              0.1
            );

          color: white;
        }

        /* SECTION */

        .sectionTitle {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

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

        /* CARD */

        .card {
          padding: 22px;

          margin-bottom:
            15px;

          border-radius: 18px;

          background:
            linear-gradient(
              145deg,
              rgba(
                255,
                255,
                255,
                0.065
              ),
              rgba(
                255,
                255,
                255,
                0.025
              )
            );

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );

          box-shadow:
            0 15px 50px
            rgba(
              0,
              0,
              0,
              0.18
            );
        }

        /* MATCH */

        .matchTop {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 12px;

          margin-bottom:
            20px;
        }

        .eventName {
          color: #aaa;

          font-size: 12px;

          font-weight: 700;
        }

        .status {
          padding:
            5px 10px;

          border-radius:
            999px;

          font-size: 10px;

          font-weight: 900;

          letter-spacing:
            0.7px;

          text-transform:
            uppercase;
        }

        .status-final,
        .status-completed,
        .status-complete,
        .status-finished {
          background:
            rgba(
              100,
              220,
              130,
              0.12
            );

          color: #7af59b;
        }

        .status-live {
          background:
            rgba(
              255,
              65,
              95,
              0.13
            );

          color: #ff7188;

          animation:
            pulse
            1.6s infinite;
        }

        .status-upcoming {
          background:
            rgba(
              255,
              190,
              80,
              0.12
            );

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

          flex-direction:
            column;

          gap: 7px;
        }

        .team.right {
          text-align: right;

          align-items:
            flex-end;
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
            rgba(
              255,
              255,
              255,
              0.06
            );

          color: #777;

          font-size: 11px;

          text-align: center;
        }

        /* LEADERBOARD */

        .leaderboardCard {
          margin-bottom:
            25px;

          overflow: hidden;

          border-radius:
            20px;

          background:
            linear-gradient(
              145deg,
              rgba(
                255,
                255,
                255,
                0.065
              ),
              rgba(
                255,
                255,
                255,
                0.025
              )
            );

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
        }

        .leaderboardHeader {
          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 15px;

          padding: 22px;

          background:
            rgba(
              255,
              255,
              255,
              0.035
            );

          border-bottom:
            1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
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

          padding:
            7px 11px;

          border-radius:
            999px;

          background:
            rgba(
              170,
              80,
              255,
              0.12
            );

          color: #d3a7ff;

          font-size: 10px;

          font-weight: 900;
        }

        .leaderboardTable {
          overflow-x: auto;
        }

        .leaderboardTable table {
          min-width: 780px;
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

        .goldRank {
          color: #ffd66b;
        }

        .silverRank {
          color: #c9c9d0;
        }

        .bronzeRank {
          color: #d59b6a;
        }

        .nrrPositive {
          color: #75e89a;

          font-weight: 900;
        }

        .nrrNegative {
          color: #ff7c91;

          font-weight: 900;
        }

        .differencePositive {
          color: #75e89a;

          font-weight: 900;
        }

        .differenceNegative {
          color: #ff7c91;

          font-weight: 900;
        }

        /* CHAMPIONS */

        .championGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(
                260px,
                1fr
              )
            );

          gap: 16px;
        }

        .championCard {
          position: relative;

          overflow: hidden;

          padding: 28px;

          border-radius:
            22px;

          background:
            radial-gradient(
              circle at
              top right,
              rgba(
                255,
                194,
                72,
                0.16
              ),
              transparent
                45%
            ),
            linear-gradient(
              145deg,
              rgba(
                255,
                255,
                255,
                0.08
              ),
              rgba(
                255,
                255,
                255,
                0.025
              )
            );

          border:
            1px solid
            rgba(
              255,
              210,
              100,
              0.2
            );
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

          text-transform:
            uppercase;
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

          padding:
            6px 10px;

          border-radius:
            999px;

          background:
            rgba(
              80,
              210,
              120,
              0.1
            );

          color: #77e69a;

          font-size: 10px;

          font-weight: 900;
        }

        /* PODIUM */

        .podiumGrid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(
                250px,
                1fr
              )
            );

          gap: 15px;
        }

        .podiumCard {
          padding: 22px;

          border-radius:
            18px;

          background:
            rgba(
              255,
              255,
              255,
              0.04
            );

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
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

        /* TABLE */

        .tableWrap {
          overflow-x: auto;

          border-radius:
            18px;

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        table {
          width: 100%;

          border-collapse:
            collapse;

          min-width: 620px;
        }

        th {
          padding: 14px;

          background:
            rgba(
              255,
              255,
              255,
              0.045
            );

          color: #777;

          font-size: 10px;

          text-transform:
            uppercase;

          letter-spacing: 1px;

          text-align: left;
        }

        td {
          padding:
            17px 14px;

          border-top:
            1px solid
            rgba(
              255,
              255,
              255,
              0.055
            );

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

        /* EMPTY */

        .empty {
          padding:
            55px 20px;

          text-align: center;

          color: #777;
        }

        .emptyIcon {
          font-size: 38px;

          margin-bottom: 10px;
        }

        /* FOOTER */

        footer {
          padding:
            40px 6%;

          border-top:
            1px solid
            rgba(
              255,
              255,
              255,
              0.06
            );

          text-align: center;

          color: #555;

          font-size: 12px;
        }

        /* MOBILE */

        @media (
          max-width: 800px
        ) {
          .tabs {
            grid-template-columns:
              repeat(
                2,
                1fr
              );
          }
        }

        @media (
          max-width: 650px
        ) {
          header {
            padding:
              15px 5%;
          }

          .logo {
            font-size: 19px;

            letter-spacing:
              2px;
          }

          .adminLink {
            padding:
              8px 12px;

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
            align-items:
              flex-start;

            flex-direction:
              column;
          }
        }

      `}</style>

      <div className="page">

        {/* HEADER */}

        <header>
          <div className="logo">
            EUPHORIA{" "}
            <span>
              2026
            </span>
          </div>

          <a
            href="/admin"
            className="adminLink"
          >
            ADMIN
          </a>
        </header>

        {/* HERO */}

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

          {/* EVENT FILTER */}

          <div className="eventBar">

            <button
              className={
                activeEvent ===
                "all"
                  ? "eventButton active"
                  : "eventButton"
              }
              onClick={() =>
                setActiveEvent(
                  "all"
                )
              }
            >
              All Events
            </button>

            {events.map(
              (event) => (
                <button
                  key={
                    event.id
                  }
                  className={
                    String(
                      activeEvent
                    ) ===
                    String(
                      event.id
                    )
                      ? "eventButton active"
                      : "eventButton"
                  }
                  onClick={() =>
                    setActiveEvent(
                      String(
                        event.id
                      )
                    )
                  }
                >
                  {event.gender} ·{" "}
                  {
                    event.name
                  }
                </button>
              )
            )}

          </div>

          {/* TABS */}

          <div className="tabs">

            <button
              className={
                activeTab ===
                "matches"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(
                  "matches"
                )
              }
            >
              🏟️ Matches
            </button>

            <button
              className={
                activeTab ===
                "leaderboard"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(
                  "leaderboard"
                )
              }
            >
              📈 Leaderboard
            </button>

            <button
              className={
                activeTab ===
                "champions"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(
                  "champions"
                )
              }
            >
              🏆 Champions
            </button>

            <button
              className={
                activeTab ===
                "results"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(
                  "results"
                )
              }
            >
              🥇 Results
            </button>

            <button
              className={
                activeTab ===
                "standings"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(
                  "standings"
                )
              }
            >
              📊 Overall
              Championships
            </button>

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

              Loading
              EUPHORIA...
            </div>
          ) : (
            <>

              {/* =========================================
                  MATCHES
              ========================================= */}

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
                            className="card"
                            key={
                              match.id
                            }
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
                                {
                                  match.status
                                }
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
                                    match
                                      .club_a
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
                                  {
                                    scoreA
                                  }
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
                                    match
                                      .club_b
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
                                  {
                                    scoreB
                                  }
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

              {/* =========================================
                  EVENT LEADERBOARD
              ========================================= */}

              {activeTab ===
                "leaderboard" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      📈 Event
                      Leaderboard
                    </h2>

                    <span>
                      Based on
                      completed
                      matches
                    </span>

                  </div>

                  {eventLeaderboards.map(
                    (group) => {

                      const cricket =
                        isCricketEvent(
                          group.event
                        );

                      const football =
                        isFootballEvent(
                          group.event
                        );

                      return (
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
                                  group
                                    .event
                                    .gender
                                }{" "}
                                ·{" "}
                                {
                                  group
                                    .event
                                    .name
                                }
                              </div>

                              <div className="leaderboardSubtitle">
                                {
                                  group
                                    .event
                                    .category
                                }{" "}
                                · Match-based
                                leaderboard
                              </div>

                            </div>

                            <div className="matchCount">
                              {
                                group.completedMatches
                              }{" "}
                              completed
                            </div>

                          </div>

                          {group
                            .leaderboard
                            .length ===
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

                                    <th>
                                      Rank
                                    </th>

                                    <th>
                                      Club
                                    </th>

                                    <th>
                                      P
                                    </th>

                                    <th>
                                      W
                                    </th>

                                    <th>
                                      T
                                    </th>

                                    <th>
                                      L
                                    </th>

                                    <th>
                                      {cricket
                                        ? "Runs Scored"
                                        : football
                                        ? "Goals Scored"
                                        : "Points Scored"}
                                    </th>

                                    <th>
                                      {cricket
                                        ? "Runs Conceded"
                                        : football
                                        ? "Goals Conceded"
                                        : "Points Conceded"}
                                    </th>

                                    {!cricket && (
                                      <th>
                                        {football
                                          ? "GD"
                                          : "PD"}
                                      </th>
                                    )}

                                    {cricket && (
                                      <th>
                                        NRR
                                      </th>
                                    )}

                                    <th>
                                      Points
                                    </th>

                                  </tr>

                                </thead>

                                <tbody>

                                  {group
                                    .leaderboard
                                    .map(
                                      (
                                        club,
                                        index
                                      ) => (
                                        <tr
                                          key={
                                            club.id
                                          }
                                        >

                                          <td
                                            className={
                                              index ===
                                              0
                                                ? "leaderRank goldRank"
                                                : index ===
                                                  1
                                                ? "leaderRank silverRank"
                                                : index ===
                                                  2
                                                ? "leaderRank bronzeRank"
                                                : "leaderRank"
                                            }
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

                                          <td className="leaderClub">
                                            {
                                              club.name
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.played
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.won
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.drawn
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.lost
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.scored
                                            }
                                          </td>

                                          <td>
                                            {
                                              club.conceded
                                            }
                                          </td>

                                          {!cricket && (
                                            <td
                                              className={
                                                club.difference >=
                                                0
                                                  ? "differencePositive"
                                                  : "differenceNegative"
                                              }
                                            >
                                              {club.difference >
                                              0
                                                ? "+"
                                                : ""}
                                              {
                                                club.difference
                                              }
                                            </td>
                                          )}

                                          {cricket && (
                                            <td
                                              className={
                                                club.nrr >=
                                                0
                                                  ? "nrrPositive"
                                                  : "nrrNegative"
                                              }
                                            >
                                              {club.nrr >=
                                              0
                                                ? "+"
                                                : ""}
                                              {club.nrr.toFixed(
                                                3
                                              )}
                                            </td>
                                          )}

                                          <td className="leaderPoints">
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
                          )}

                        </div>
                      );
                    }
                  )}

                </section>
              )}

              {/* =========================================
                  CHAMPIONS
              ========================================= */}

              {activeTab ===
                "champions" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🏆 Champions
                    </h2>

                    <span>
                      Finalized events
                      only
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
                        Finalize an event
                        from the admin
                        panel and its
                        champion will
                        appear here.
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
                                item
                                  .club
                                  ?.name
                              }
                            </div>

                            <div className="championEvent">
                              {
                                item
                                  .event
                                  .gender
                              }
                              {" · "}
                              {
                                item
                                  .event
                                  .name
                              }
                              {" · "}
                              {
                                item
                                  .event
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

              {/* =========================================
                  RESULTS
              ========================================= */}

              {activeTab ===
                "results" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      🥇 Finalized
                      Results
                    </h2>

                    <span>
                      Official results
                      only
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
                                group
                                  .event
                                  .gender
                              }{" "}
                              ·{" "}
                              {
                                group
                                  .event
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
                                (
                                  a,
                                  b
                                ) =>
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
                                      ) ===
                                      1
                                        ? "🥇"
                                        : Number(
                                            result.position
                                          ) ===
                                          2
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

              {/* =========================================
                  OVERALL CHAMPIONSHIPS
              ========================================= */}

              {activeTab ===
                "standings" && (
                <section>

                  <div className="sectionTitle">

                    <h2>
                      📊 Overall
                      Championships
                    </h2>

                    <span>
                      Finalized event
                      results only
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
                      club.points ===
                      0
                  ) && (
                    <div className="empty">
                      Overall championship
                      points will appear
                      after event results
                      are finalized.
                    </div>
                  )}

                </section>
              )}

            </>
          )}

        </main>

        <footer>
          EUPHORIA 2026 · Sports Fest
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
