"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* =========================================================
HELPERS
========================================================= */

function normalize(value) {
return String(value || "").trim().toLowerCase();
}

function isCricketEvent(event) {
if (!event) return false;

const name = normalize(event.name);
const category = normalize(event.category);
const pointsType = normalize(event.points_type);

return (
name === "cricket" ||
category.includes("cricket") ||
pointsType.includes("cricket")
);
}

function isFootballEvent(event) {
if (!event) return false;

const name = normalize(event.name);
const category = normalize(event.category);
const pointsType = normalize(event.points_type);

return (
name === "football" ||
name.includes("football") ||
category.includes("football") ||
pointsType.includes("football")
);
}

function isCompleted(status) {
const s = normalize(status);

return (
s === "completed" ||
s === "complete" ||
s === "finished" ||
s === "final" ||
s === "result"
);
}

/* =========================================================
SCORE HELPERS
========================================================= */

function getCricketInnings(match, clubId) {
if (!match || !clubId) return null;

const battingFirst = Number(match.batting_first_club_id);
const targetClub = Number(clubId);

let inningsNumber;

if (battingFirst === targetClub) {
inningsNumber = 1;
} else if (battingFirst) {
inningsNumber = 2;
} else {
/*
Fallback when batting_first_club_id is unavailable.
*/
inningsNumber =
Number(match.club_a_id) === targetClub ? 1 : 2;
}

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

return {
inningsNumber,
runs:
runs !== null &&
runs !== undefined &&
runs !== ""
? Number(runs)
: null,
wickets:
wickets !== null &&
wickets !== undefined &&
wickets !== ""
? Number(wickets)
: null,
overs:
overs !== null &&
overs !== undefined &&
overs !== ""
? Number(overs)
: null,
};
}

/*
Converts an innings overs value into actual balls.

Examples:
20       -> 120 balls
19.5     -> 119 balls
19.2     -> 116 balls

Cricket overs notation is NOT decimal mathematics.
*/

function oversToBalls(value) {
if (
value === null ||
value === undefined ||
value === ""
) {
return null;
}

const number = Number(value);

if (Number.isNaN(number)) {
return null;
}

const wholeOvers = Math.floor(number);
const balls = Math.round(
(number - wholeOvers) * 10
);

return wholeOvers * 6 + balls;
}

/*
Returns the effective overs used for NRR.

If an innings has a completed all-out innings,
wickets = 10 and the actual allotted overs should
generally be used for the denominator.

If innings overs are available, use them.
*/

function getNRROvers(match, innings) {
if (!innings) return null;

const actualBalls = oversToBalls(
innings.overs
);

if (actualBalls !== null && actualBalls > 0) {
return actualBalls;
}

/*
Fallback to allotted overs if innings overs
are not stored.
*/

const allotted =
match?.allotted_overs;

const allottedBalls =
oversToBalls(allotted);

if (
allottedBalls !== null &&
allottedBalls > 0
) {
return allottedBalls;
}

return null;
}

/*
Cricket NRR:

NRR =
(total runs scored / total overs faced)

(total runs conceded / total overs bowled)

For a single match this becomes:

Team A NRR =
A runs / A overs

B runs / B overs
*/

function calculateCricketNRR(match, clubId) {
if (!match || !clubId) {
return null;
}

const targetClub = Number(clubId);

const clubA = Number(match.club_a_id);
const clubB = Number(match.club_b_id);

if (
targetClub !== clubA &&
targetClub !== clubB
) {
return null;
}

const own = getCricketInnings(
match,
targetClub
);

const opponentId =
targetClub === clubA
? clubB
: clubA;

const opponent =
getCricketInnings(
match,
opponentId
);

if (!own || !opponent) {
return null;
}

if (
own.runs === null ||
opponent.runs === null
) {
return null;
}

const ownBalls =
getNRROvers(match, own);

const opponentBalls =
getNRROvers(match, opponent);

if (
!ownBalls ||
!opponentBalls
) {
return null;
}

if (
ownBalls <= 0 ||
opponentBalls <= 0
) {
return null;
}

const ownRunRate =
own.runs / (ownBalls / 6);

const opponentRunRate =
opponent.runs /
(opponentBalls / 6);

return (
ownRunRate -
opponentRunRate
);
}

/*
Gets cricket score for display.
*/

function getCricketScore(
match,
clubSide
) {
if (!match) return "—";

const clubId =
clubSide === "a"
? match.club_a_id
: match.club_b_id;

const innings =
getCricketInnings(
match,
clubId
);

if (!innings) {
return "—";
}

if (innings.runs === null) {
return (
clubSide === "a"
? match.score_a
: match.score_b
) || "—";
}

let score =
String(innings.runs);

if (
innings.wickets !== null &&
innings.wickets !== undefined
) {
score += "/${innings.wickets}";
}

if (
innings.overs !== null &&
innings.overs !== undefined
) {
score += " (${innings.overs} ov)";
}

return score;
}

function getMatchScore(
match,
side
) {
const event =
match?.events;

if (
isCricketEvent(event)
) {
return getCricketScore(
match,
side
);
}

return (
side === "a"
? match?.score_a
: match?.score_b
) ?? "—";
}

/* =========================================================
NORMAL SPORT SCORE / POINT DIFFERENCE
========================================================= */

function numericScore(value) {
if (
value === null ||
value === undefined ||
value === ""
) {
return null;
}

const n = Number(value);

return Number.isNaN(n)
? null
: n;
}

function getNormalSportScore(
match,
side
) {
return numericScore(
side === "a"
? match?.score_a
: match?.score_b
);
}

/*
Point difference:

Team score - opponent score

Used for football and all non-cricket sports.
*/

function getPointDifference(
match,
side
) {
const own =
getNormalSportScore(
match,
side
);

const opponent =
getNormalSportScore(
match,
side === "a"
? "b"
: "a"
);

if (
own === null ||
opponent === null
) {
return null;
}

return own - opponent;
}

/* =========================================================
MATCH POINT SYSTEM
========================================================= */

function getSportWinPoints(event) {
/*
Football:
Win = 3

Everything else:
  Win = 2

Cricket is also 2.

*/

if (
isFootballEvent(event)
) {
return 3;
}

return 2;
}

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
const value =
match?.[key];

if (
  value !== null &&
  value !== undefined &&
  value !== "" &&
  !Number.isNaN(
    Number(value)
  )
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

/*
Explicit database points have priority.
*/

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

const winPoints =
getSportWinPoints(event);

const winnerId =
Number(
match?.winner_club_id
);

const clubId =
side === "a"
? Number(
match?.club_a_id
)
: Number(
match?.club_b_id
);

/*
Winner.
*/

if (
winnerId &&
clubId &&
winnerId === clubId
) {
return winPoints;
}

/*
If no winner is recorded,
completed match is treated as a tie.
*/

if (!winnerId) {
return 1;
}

return 0;
}

/* =========================================================
STATUS
========================================================= */

function statusClass(status) {
return normalize(status)
.replace(/\s+/g, "-");
}

/* =========================================================
FORMATTERS
========================================================= */

function formatNumber(
value,
decimals = 0
) {
if (
value === null ||
value === undefined ||
Number.isNaN(Number(value))
) {
return "—";
}

return Number(value).toFixed(
decimals
);
}

function formatSigned(
value,
decimals = 0
) {
if (
value === null ||
value === undefined ||
Number.isNaN(Number(value))
) {
return "—";
}

const n =
Number(value);

if (n > 0) {
return "+${n.toFixed( decimals )}";
}

return n.toFixed(
decimals
);
}

/* =========================================================
PUBLIC PAGE
========================================================= */

export default function Home() {
const [
events,
setEvents,
] = useState([]);

const [
clubs,
setClubs,
] = useState([]);

const [
matches,
setMatches,
] = useState([]);

const [
results,
setResults,
] = useState([]);

const [
loading,
setLoading,
] = useState(true);

const [
activeEvent,
setActiveEvent,
] = useState("all");

const [
activeTab,
setActiveTab,
] = useState("matches");

const [
msg,
setMsg,
] = useState("");

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
] =
  await Promise.all([
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
  setMsg(
    eventError.message
  );
}

if (clubError) {
  console.error(
    "Clubs error:",
    clubError
  );
  setMsg(
    clubError.message
  );
}

if (matchError) {
  console.error(
    "Matches error:",
    matchError
  );
  setMsg(
    matchError.message
  );
}

if (resultError) {
  console.error(
    "Results error:",
    resultError
  );
  setMsg(
    resultError.message
  );
}

setEvents(
  eventData || []
);

setClubs(
  clubData || []
);

setMatches(
  matchData || []
);

/*
  event_results are ONLY used for:
    - Champions
    - Finalized Results
    - Overall Club Points

  They are NOT used for event leaderboards.
*/

const finalizedResults =
  (resultData || []).filter(
    (result) =>
      result.events
        ?.result_finalized ===
      true
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
    () => {
      loadData();
    },
    15000
  );

return () =>
  clearInterval(
    interval
  );

}, []);

/* =======================================================
FILTERED MATCHES
======================================================= */

const visibleMatches =
useMemo(() => {
if (
activeEvent ===
"all"
) {
return matches;
}

  return matches.filter(
    (match) =>
      String(
        match.event_id
      ) ===
      String(
        activeEvent
      )
  );
}, [
  matches,
  activeEvent,
]);

/* =======================================================
FINALIZED RESULTS
======================================================= */

const visibleResults =
useMemo(() => {
if (
activeEvent ===
"all"
) {
return results;
}

  return results.filter(
    (result) =>
      String(
        result.event_id
      ) ===
      String(
        activeEvent
      )
  );
}, [
  results,
  activeEvent,
]);

/* =======================================================
INDIVIDUAL EVENT LEADERBOARDS

 IMPORTANT:

 ONLY COMPLETED MATCHES COUNT.

 No result_finalized dependency.

 Cricket:
   W 2
   T 1
   L 0
   NRR

 Football:
   W 3
   T 1
   L 0
   PD

 Other sports:
   W 2
   T 1
   L 0
   PD

======================================================= */

const eventLeaderboards =
useMemo(() => {
const groups = {};

  /*
    Create a leaderboard for every event.
  */

  events.forEach(
    (event) => {
      groups[event.id] = {
        event,
        clubs: {},
        completedMatches: 0,
      };

      clubs.forEach(
        (club) => {
          groups[event.id]
            .clubs[club.id] = {
            id: club.id,
            name: club.name,

            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,

            points: 0,

            /*
              Normal sports.
            */
            scored: 0,
            conceded: 0,
            pointDifference: 0,

            /*
              Cricket.
            */
            cricketRunsScored: 0,
            cricketRunsConceded: 0,
            cricketBallsFaced: 0,
            cricketBallsBowled: 0,
            nrr: null,
          };
        }
      );
    }
  );

  /*
    Process ONLY completed matches.
  */

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

      const clubA =
        Number(
          match.club_a_id
        );

      const clubB =
        Number(
          match.club_b_id
        );

      if (
        !clubA ||
        !clubB
      ) {
        return;
      }

      if (
        !groups[eventId]
          .clubs[clubA] ||
        !groups[eventId]
          .clubs[clubB]
      ) {
        return;
      }

      const rowA =
        groups[eventId]
          .clubs[clubA];

      const rowB =
        groups[eventId]
          .clubs[clubB];

      groups[eventId]
        .completedMatches +=
        1;

      rowA.played += 1;
      rowB.played += 1;

      /*
        WIN / DRAW / LOSS
      */

      const winner =
        Number(
          match.winner_club_id
        );

      if (
        winner === clubA
      ) {
        rowA.won += 1;
        rowB.lost += 1;
      } else if (
        winner === clubB
      ) {
        rowB.won += 1;
        rowA.lost += 1;
      } else {
        /*
          Completed without winner
          = tie/draw.
        */

        rowA.drawn += 1;
        rowB.drawn += 1;
      }

      /*
        MATCH POINTS
      */

      rowA.points +=
        getMatchPoints(
          match,
          "a"
        );

      rowB.points +=
        getMatchPoints(
          match,
          "b"
        );

      /*
        CRICKET
      */

      if (
        isCricketEvent(
          match.events
        )
      ) {
        const inningsA =
          getCricketInnings(
            match,
            clubA
          );

        const inningsB =
          getCricketInnings(
            match,
            clubB
          );

        if (
          inningsA?.runs !==
            null &&
          inningsB?.runs !==
            null
        ) {
          rowA.cricketRunsScored +=
            inningsA.runs;

          rowA.cricketRunsConceded +=
            inningsB.runs;

          rowB.cricketRunsScored +=
            inningsB.runs;

          rowB.cricketRunsConceded +=
            inningsA.runs;
        }

        const ballsA =
          getNRROvers(
            match,
            inningsA
          );

        const ballsB =
          getNRROvers(
            match,
            inningsB
          );

        if (
          ballsA
        ) {
          rowA.cricketBallsFaced +=
            ballsA;

          rowB.cricketBallsBowled +=
            ballsA;
        }

        if (
          ballsB
        ) {
          rowB.cricketBallsFaced +=
            ballsB;

          rowA.cricketBallsBowled +=
            ballsB;
        }

        /*
          Calculate cumulative NRR.
        */

        if (
          rowA.cricketBallsFaced >
            0 &&
          rowA.cricketBallsBowled >
            0
        ) {
          rowA.nrr =
            rowA.cricketRunsScored /
              (rowA.cricketBallsFaced /
                6) -
            rowA.cricketRunsConceded /
              (rowA.cricketBallsBowled /
                6);
        }

        if (
          rowB.cricketBallsFaced >
            0 &&
          rowB.cricketBallsBowled >
            0
        ) {
          rowB.nrr =
            rowB.cricketRunsScored /
              (rowB.cricketBallsFaced /
                6) -
            rowB.cricketRunsConceded /
              (rowB.cricketBallsBowled /
                6);
        }
      } else {
        /*
          FOOTBALL + ALL OTHER SPORTS

          Point Difference =
          total scored - total conceded
        */

        const scoreA =
          getNormalSportScore(
            match,
            "a"
          );

        const scoreB =
          getNormalSportScore(
            match,
            "b"
          );

        if (
          scoreA !== null &&
          scoreB !== null
        ) {
          rowA.scored +=
            scoreA;

          rowA.conceded +=
            scoreB;

          rowB.scored +=
            scoreB;

          rowB.conceded +=
            scoreA;

          rowA.pointDifference =
            rowA.scored -
            rowA.conceded;

          rowB.pointDifference =
            rowB.scored -
            rowB.conceded;
        }
      }
    }
  );

  return Object.values(
    groups
  )
    .map(
      (group) => {
        const cricket =
          isCricketEvent(
            group.event
          );

        const leaderboard =
          Object.values(
            group.clubs
          )
            .filter(
              (club) =>
                club.played >
                0
            )
            .sort(
              (a, b) => {
                /*
                  PRIMARY:
                  Points
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
                  SECONDARY:
                  Cricket NRR
                */

                if (
                  cricket
                ) {
                  const nrrA =
                    a.nrr ??
                    -Infinity;

                  const nrrB =
                    b.nrr ??
                    -Infinity;

                  if (
                    nrrB !==
                    nrrA
                  ) {
                    return (
                      nrrB -
                      nrrA
                    );
                  }
                }

                /*
                  SECONDARY:
                  Point Difference
                */

                if (
                  !cricket
                ) {
                  if (
                    b.pointDifference !==
                    a.pointDifference
                  ) {
                    return (
                      b.pointDifference -
                      a.pointDifference
                    );
                  }
                }

                /*
                  THIRD:
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
                  FINAL:
                  Played
                */

                return (
                  b.played -
                  a.played
                );
              }
            );

        return {
          ...group,
          isCricket:
            cricket,
          isFootball:
            isFootballEvent(
              group.event
            ),
          leaderboard,
        };
      }
    )
    .filter(
      (group) => {
        if (
          activeEvent ===
          "all"
        ) {
          return true;
        }

        return (
          String(
            group.event.id
          ) ===
          String(
            activeEvent
          )
        );
      }
    );
}, [
  events,
  clubs,
  matches,
  activeEvent,
]);

/* =======================================================
CHAMPIONS

 ONLY FINALIZED EVENT RESULTS

======================================================= */

const champions =
useMemo(() => {
const list = [];

  for (
    const event of events
  ) {
    if (
      !event.result_finalized
    ) {
      continue;
    }

    const result =
      results.find(
        (r) =>
          Number(
            r.event_id
          ) ===
            Number(
              event.id
            ) &&
          Number(
            r.position
          ) === 1
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
OVERALL CLUB POINTS

 ONLY FINALIZED EVENT RESULTS

======================================================= */

const standings =
useMemo(() => {
const table = {};

  clubs.forEach(
    (club) => {
      table[club.id] = {
        id: club.id,
        name: club.name,
        points: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
      };
    }
  );

  results.forEach(
    (result) => {
      if (
        !result.events
          ?.result_finalized
      ) {
        return;
      }

      if (
        !table[
          result.club_id
        ]
      ) {
        table[
          result.club_id
        ] = {
          id:
            result.club_id,
          name:
            result.clubs
              ?.name ||
            "Unknown Club",
          points: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
        };
      }

      table[
        result.club_id
      ].points +=
        Number(
          result.points ||
            0
        );

      if (
        Number(
          result.position
        ) === 1
      ) {
        table[
          result.club_id
        ].gold += 1;
      }

      if (
        Number(
          result.position
        ) === 2
      ) {
        table[
          result.club_id
        ].silver += 1;
      }

      if (
        Number(
          result.position
        ) === 3
      ) {
        table[
          result.club_id
        ].bronze += 1;
      }
    }
  );

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
FINALIZED RESULTS GROUPING
======================================================= */

const groupedResults =
useMemo(() => {
const groups = {};

  results.forEach(
    (result) => {
      if (
        !result.events
          ?.result_finalized
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

  const output =
    Object.values(
      groups
    );

  if (
    activeEvent ===
    "all"
  ) {
    return output;
  }

  return output.filter(
    (group) =>
      String(
        group.event.id
      ) ===
      String(
        activeEvent
      )
  );
}, [
  results,
  activeEvent,
]);

/* =========================================================
RENDER
========================================================= */

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

    .container {
      width: min(1200px, 92%);
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
      font-size: 13px;
    }

    .tab.active {
      background:
        rgba(255, 255, 255, 0.1);

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

    .leaderboardCard {
      margin-bottom: 25px;

      overflow: hidden;

      border-radius: 20px;

      background:
        linear-gradient(
          145deg,
          rgba(255, 255, 255, 0.065),
          rgba(255, 255, 255, 0.025)
        );

      border:
        1px solid
        rgba(255, 255, 255, 0.09);
    }

    .leaderboardHeader {
      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 15px;

      padding: 22px;

      background:
        rgba(255, 255, 255, 0.035);

      border-bottom:
        1px solid
        rgba(255, 255, 255, 0.07);
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
        rgba(170, 80, 255, 0.12);

      color: #d3a7ff;

      font-size: 10px;
      font-weight: 900;
    }

    .leaderboardTable {
      overflow-x: auto;
    }

    .leaderboardTable table {
      min-width: 650px;
    }

    .leaderboardTable tr:first-child td {
      background:
        rgba(255, 211, 100, 0.035);
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

    .statPositive {
      color: #7af59b;
      font-weight: 850;
    }

    .statNegative {
      color: #ff8c9d;
      font-weight: 850;
    }

    .statNeutral {
      color: #aaa;
      font-weight: 850;
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
      padding:
        40px 6%;

      border-top:
        1px solid
        rgba(255, 255, 255, 0.06);

      text-align: center;

      color: #555;

      font-size: 12px;
    }

    @media (max-width: 800px) {
      .tabs {
        grid-template-columns:
          repeat(2, 1fr);
      }
    }

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

    {/* HEADER */}

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

    {/* MAIN */}

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
              {event.gender}
              {" · "}
              {event.name}
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
          📊 Overall Points
        </button>

      </div>

      {/* MESSAGE */}

      {msg && (
        <div className="card">
          {msg}
        </div>
      )}

      {/* LOADING */}

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

          {/* =================================================
              MATCHES
          ================================================= */}

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
                        className="card matchCard"
                        key={
                          match.id
                        }
                      >

                        <div className="matchTop">

                          <div className="eventName">
                            {
                              match
                                .events
                                ?.gender
                            }
                            {" · "}
                            {
                              match
                                .events
                                ?.name
                            }
                            {" · "}
                            {
                              match
                                .events
                                ?.category
                            }
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

          {/* =================================================
              EVENT LEADERBOARD
          ================================================= */}

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

              {eventLeaderboards.length ===
              0 ? (
                <div className="empty card">

                  <div className="emptyIcon">
                    📈
                  </div>

                  No events
                  available.

                </div>
              ) : (
                eventLeaderboards.map(
                  (group) => (
                    <div
                      className="leaderboardCard"
                      key={
                        group
                          .event
                          .id
                      }
                    >

                      <div className="leaderboardHeader">

                        <div>

                          <div className="leaderboardTitle">
                            {
                              group
                                .event
                                .gender
                            }
                            {" · "}
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
                            }
                            {" · "}
                            {group.isCricket
                              ? "Cricket · NRR"
                              : group.isFootball
                              ? "Football · Point Difference"
                              : "Match-based · Point Difference"}
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
                                  Points
                                </th>

                                {group.isCricket ? (
                                  <th>
                                    NRR
                                  </th>
                                ) : (
                                  <th>
                                    PD
                                  </th>
                                )}

                              </tr>

                            </thead>

                            <tbody>

                              {group.leaderboard.map(
                                (
                                  club,
                                  index
                                ) => {

                                  const difference =
                                    club.pointDifference;

                                  const differenceClass =
                                    difference >
                                    0
                                      ? "statPositive"
                                      : difference <
                                        0
                                      ? "statNegative"
                                      : "statNeutral";

                                  return (
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

                                      <td className="leaderPoints">
                                        {
                                          club.points
                                        }
                                      </td>

                                      {group.isCricket ? (
                                        <td
                                          className={
                                            club.nrr !==
                                              null &&
                                            club.nrr >
                                              0
                                              ? "statPositive"
                                              : club.nrr !==
                                                  null &&
                                                club.nrr <
                                                  0
                                              ? "statNegative"
                                              : "statNeutral"
                                          }
                                        >
                                          {club.nrr ===
                                          null
                                            ? "—"
                                            : formatSigned(
                                                club.nrr,
                                                3
                                              )}
                                        </td>
                                      ) : (
                                        <td
                                          className={
                                            differenceClass
                                          }
                                        >
                                          {difference ===
                                          null
                                            ? "—"
                                            : formatSigned(
                                                difference,
                                                0
                                              )}
                                        </td>
                                      )}

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

          {/* =================================================
              CHAMPIONS
          ================================================= */}

          {activeTab ===
            "champions" && (
            <section>

              <div className="sectionTitle">

                <h2>
                  🏆 Champions
                </h2>

                <span>
                  Finalized
                  events only
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
                    finalized
                    yet.
                  </strong>

                  <p>
                    The champion
                    will appear
                    here only
                    after the
                    event result
                    is officially
                    finalized by
                    the admin.
                  </p>

                </div>
              ) : (
                <div className="championGrid">

                  {champions.map(
                    (item) => (
                      <div
                        className="championCard"
                        key={
                          item
                            .event
                            .id
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

          {/* =================================================
              FINALIZED RESULTS
          ================================================= */}

          {activeTab ===
            "results" && (
            <section>

              <div className="sectionTitle">

                <h2>
                  🥇 Finalized
                  Results
                </h2>

                <span>
                  Official
                  results only
                </span>

              </div>

              {groupedResults.length ===
              0 ? (
                <div className="empty card">

                  <div className="emptyIcon">
                    📋
                  </div>

                  No event
                  results have
                  been finalized
                  yet.

                </div>
              ) : (
                groupedResults.map(
                  (group) => (
                    <div
                      key={
                        group
                          .event
                          .id
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
                          }
                          {" · "}
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

                        {group.results
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

          {/* =================================================
              OVERALL CLUB POINTS
          ================================================= */}

          {activeTab ===
            "standings" && (
            <section>

              <div className="sectionTitle">

                <h2>
                  📊 Overall
                  Club Points
                </h2>

                <span>
                  Finalized
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
                            {index +
                              1}
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
                  Overall club
                  points will
                  appear after
                  event results
                  are finalized.
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
        Scores and
        leaderboards update
        automatically.
      </span>
    </footer>

  </div>
</>

);
  }
