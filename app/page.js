"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const clubs = [
  "Falcons",
  "Eagles",
  "Thunderbirds",
  "Griffins",
  "Phoenix"
];

const eventGroups = {
  "Men's Team Sports": [
    "Cricket",
    "Football",
    "Volleyball",
    "Basketball",
    "Kho Kho"
  ],

  "Women's Team Sports": [
    "Cricket",
    "Throwball",
    "Basketball",
    "Kho Kho"
  ],

  "Men's Doubles": [
    "Tennis",
    "Table Tennis",
    "Badminton",
    "Carrom"
  ],

  "Women's Doubles": [
    "Tennis",
    "Table Tennis",
    "Badminton",
    "Carrom"
  ],

  "Mixed Doubles": [
    "Tennis"
  ],

  "Men's Individual": [
    "Marathon",
    "100m",
    "200m",
    "400m",
    "Long Jump",
    "Triple Jump",
    "Table Tennis",
    "Cycling"
  ],

  "Women's Individual": [
    "Marathon",
    "100m",
    "200m",
    "400m",
    "Long Jump",
    "Triple Jump",
    "Table Tennis",
    "Cycling"
  ]
};


// ============================================================
// HELPERS
// ============================================================

function numericScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  // Only treat simple numeric scores as PF/PA.
  // Examples: 2, 75, 102.5
  // Cricket scores like 185/6 are not treated as simple numbers.
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : null;
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


function getSportPoints(
  sport,
  result
) {
  const name = String(
    sport || ""
  ).toLowerCase();

  // Football:
  // Win = 3
  // Draw = 1
  // Loss = 0
  if (name === "football") {
    if (result === "win") return 3;
    if (result === "draw") return 1;
    return 0;
  }

  // Cricket:
  // Win = 2
  // No Result = 1
  // Loss = 0
  if (name === "cricket") {
    if (result === "win") return 2;
    if (result === "no_result") return 1;
    return 0;
  }

  // Volleyball:
  // Win = 3
  // Draws are normally not used.
  if (name === "volleyball") {
    if (result === "win") return 3;
    return 0;
  }

  // Basketball:
  // Win = 2
  // Loss = 1
  if (name === "basketball") {
    if (result === "win") return 2;
    if (result === "loss") return 1;
    return 0;
  }

  // Throwball:
  // Win = 2
  // Loss = 0
  if (name === "throwball") {
    if (result === "win") return 2;
    return 0;
  }

  // Kho Kho:
  // Win = 2
  // Draw = 1
  // Loss = 0
  if (name === "kho kho") {
    if (result === "win") return 2;
    if (result === "draw") return 1;
    return 0;
  }

  // Default team-sport system:
  // Win = 3, Draw = 1, Loss = 0
  if (result === "win") return 3;
  if (result === "draw") return 1;

  return 0;
}


function getResultForClub(
  match,
  clubId
) {
  const club = Number(clubId);

  const winner =
    match.winner_club_id === null ||
    match.winner_club_id === undefined ||
    match.winner_club_id === ""
      ? null
      : Number(match.winner_club_id);

  const clubA = Number(match.club_a_id);
  const clubB = Number(match.club_b_id);

  // Explicit winner exists
  if (winner !== null) {
    if (winner === club) {
      return "win";
    }

    return "loss";
  }

  // If there is no winner, check numeric scores.
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

  // Cricket/no-result style match.
  return "no_result";
}


function buildLeaderboard(
  sport,
  event,
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

      points: 0
    };
  });

  const completed = matches.filter(
    (match) => {
      if (
        String(match.status || "")
          .toLowerCase() !== "final"
      ) {
        return false;
      }

      return (
        Number(match.event_id) ===
        Number(event.id)
      );
    }
  );


  completed.forEach((match) => {
    const clubA = table[match.club_a_id];
    const clubB = table[match.club_b_id];

    if (!clubA || !clubB) {
      return;
    }

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


    if (resultA === "win") {
      clubA.wins += 1;
    }

    if (resultB === "win") {
      clubB.wins += 1;
    }


    if (resultA === "draw") {
      clubA.draws += 1;
    }

    if (resultB === "draw") {
      clubB.draws += 1;
    }


    if (resultA === "loss") {
      clubA.losses += 1;
    }

    if (resultB === "loss") {
      clubB.losses += 1;
    }


    if (resultA === "no_result") {
      clubA.noResults += 1;
    }

    if (resultB === "no_result") {
      clubB.noResults += 1;
    }


    // Numeric PF / PA
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
    }
  );


  const sorted =
    Object.values(table).sort(
      (a, b) => {

        // 1. Points
        if (
          b.points !==
          a.points
        ) {
          return (
            b.points -
            a.points
          );
        }

        // 2. Wins
        if (
          b.wins !==
          a.wins
        ) {
          return (
            b.wins -
            a.wins
          );
        }

        // 3. Point difference
        if (
          b.pd !==
          a.pd
        ) {
          return (
            b.pd -
            a.pd
          );
        }

        // 4. Points for
        if (
          b.pf !==
          a.pf
        ) {
          return (
            b.pf -
            a.pf
          );
        }

        // 5. Alphabetical
        return a.name.localeCompare(
          b.name
        );
      }
    );


  return {
    rows: sorted,
    completedCount:
      completed.length
  };
}


// ============================================================
// MAIN PAGE
// ============================================================

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
    setSelectedTeamSport
  ] = useState("");


  async function load() {

    setLoading(true);


    const [
      { data: m, error: matchError },
      { data: r, error: resultError },
      { data: e, error: eventError },
      { data: c, error: clubError }
    ] =
      await Promise.all([

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
              ascending: true
            }
          ),


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
          .order("id")
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


    setMatches(m || []);
    setEvents(e || []);
    setClubRows(c || []);


    // ========================================================
    // OVERALL CLUB POINTS
    // ========================================================

    const totals = {};


    (r || []).forEach(
      (x) => {

        const name =
          x.clubs?.name;

        if (name) {
          totals[name] =
            (
              totals[name] ||
              0
            ) +
            Number(
              x.points || 0
            );
        }
      }
    );


    clubs.forEach(
      (club) => {
        totals[club] =
          totals[club] || 0;
      }
    );


    setPoints(totals);


    // Automatically select first team event
    const teamEvents =
      (e || []).filter(
        (event) =>
          isTeamEvent(event)
      );


    if (
      !selectedTeamSport &&
      teamEvents.length
    ) {
      setSelectedTeamSport(
        String(
          teamEvents[0].id
        )
      );
    }


    setLoading(false);
  }


  useEffect(() => {
    load();


    const channel =
      supabase
        .channel(
          "euphoria-live"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "matches"
          },
          load
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_results"
          },
          load
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "events"
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


  // ==========================================================
  // MATCH GROUPS
  // ==========================================================

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
        String(
          match.status || ""
        ).toLowerCase() ===
        "final"
    );


  // ==========================================================
  // OVERALL LEADERBOARD
  // ==========================================================

  const leaderboard =
    [...clubs].sort(
      (a, b) =>
        (
          points[b] || 0
        ) -
        (
          points[a] || 0
        )
    );


  // ==========================================================
  // TEAM SPORTS
  // ==========================================================

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
    completedCount: 0
  };


  if (selectedEvent) {

    sportLeaderboard =
      buildLeaderboard(
        selectedEvent.name,
        selectedEvent,
        matches,
        clubRows
      );
  }


  const usesNumericScores =
    selectedEvent &&
    [
      "football",
      "basketball"
    ].includes(
      String(
        selectedEvent.name || ""
      ).toLowerCase()
    );


  // ==========================================================
  // MATCH CARD
  // ==========================================================

  function MatchCard({
    match
  }) {

    return (

      <div
        className="match"
        key={match.id}
      >

        <div>
          <b>
            {
              match.club_a?.name ||
              "TBD"
            }
          </b>

          <strong>
            {
              match.score_a ||
              "—"
            }
          </strong>
        </div>


        <div>
          <b>
            {
              match.club_b?.name ||
              "TBD"
            }
          </b>

          <strong>
            {
              match.score_b ||
              "—"
            }
          </strong>
        </div>


        <small>

          {
            match.events?.name
          }

          {" · "}

          {
            match.events?.gender
          }

          {" · "}

          {
            match.status
          }

        </small>

      </div>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <main>

      {/* HEADER */}

      <header>

        <div className="logo">
          EUPHORIA{" "}
          <span>
            SPORTS
          </span>
        </div>

        <a href="/admin">
          ADMIN
        </a>

      </header>


      {/* HERO */}

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
            LIVE / UPCOMING
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

              <p>
                Loading...
              </p>

            ) : liveMatches.length ===
              0 ? (

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

              <p>
                Loading...
              </p>

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

            <p>
              Loading...
            </p>

          ) : completedMatches.length ===
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


        {/* ====================================================
            OVERALL CLUB POINTS
        ==================================================== */}

        <div className="card">

          <h2>
            🏆 Overall Club Points
          </h2>


          {leaderboard.map(
            (club, index) => (

              <div
                className="rank"
                key={club}
              >

                <span>
                  {
                    index + 1
                  }
                </span>

                <b>
                  {club}
                </b>

                <strong>
                  {
                    points[club] ||
                    0
                  }
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
            🏆 Team Sport Leaderboards
          </h2>


          <p className="muted">
            Live standings calculated
            automatically from completed
            matches.
          </p>


          {teamSports.length === 0 ? (

            <p className="muted">
              No team sports have been
              added yet.
            </p>

          ) : (

            <>

              <label>

                Select Sport

                <select
                  value={
                    selectedTeamSport
                  }
                  onChange={(e) =>
                    setSelectedTeamSport(
                      e.target.value
                    )
                  }
                >

                  {teamSports.map(
                    (event) => (

                      <option
                        key={event.id}
                        value={event.id}
                      >

                        {
                          event.gender
                        }

                        {" · "}

                        {
                          event.name
                        }

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
                        "24px"
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

                    <div className="card">

                      <p
                        className="muted"
                      >
                        No matches played
                        yet.
                      </p>

                      <div
                        className="rank"
                      >

                        <b>
                          All clubs
                        </b>

                        <strong>
                          0 matches
                        </strong>

                      </div>

                    </div>

                  ) : (

                    <>

                      <div
                        style={{
                          overflowX:
                            "auto",
                          marginTop:
                            "16px"
                        }}
                      >

                        <table
                          style={{
                            width:
                              "100%",
                            borderCollapse:
                              "collapse",
                            minWidth:
                              usesNumericScores
                                ? "700px"
                                : "600px"
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
                                    "left"
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

                              {selectedEvent.name
                                .toLowerCase() !==
                                "cricket" && (

                                <th>
                                  D
                                </th>

                              )}

                              <th>
                                L
                              </th>

                              {selectedEvent.name
                                .toLowerCase() ===
                                "cricket" && (

                                <th>
                                  NR
                                </th>

                              )}

                              {usesNumericScores && (

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
                                        "bold"
                                    }}
                                  >

                                    {
                                      index ===
                                      0
                                        ? "🥇"
                                        : index ===
                                          1
                                        ? "🥈"
                                        : index ===
                                          2
                                        ? "🥉"
                                        : index +
                                          1
                                    }

                                  </td>


                                  <td
                                    style={{
                                      fontWeight:
                                        "bold"
                                    }}
                                  >
                                    {
                                      row.name
                                    }
                                  </td>


                                  <td
                                    style={{
                                      textAlign:
                                        "center"
                                    }}
                                  >
                                    {
                                      row.played
                                    }
                                  </td>


                                  <td
                                    style={{
                                      textAlign:
                                        "center"
                                    }}
                                  >
                                    {
                                      row.wins
                                    }
                                  </td>


                                  {selectedEvent.name
                                    .toLowerCase() !==
                                    "cricket" && (

                                    <td
                                      style={{
                                        textAlign:
                                          "center"
                                      }}
                                    >
                                      {
                                        row.draws
                                      }
                                    </td>

                                  )}


                                  <td
                                    style={{
                                      textAlign:
                                        "center"
                                    }}
                                  >
                                    {
                                      row.losses
                                    }
                                  </td>


                                  {selectedEvent.name
                                    .toLowerCase() ===
                                    "cricket" && (

                                    <td
                                      style={{
                                        textAlign:
                                          "center"
                                      }}
                                    >
                                      {
                                        row.noResults
                                      }
                                    </td>

                                  )}


                                  {usesNumericScores && (

                                    <>

                                      <td
                                        style={{
                                          textAlign:
                                            "center"
                                        }}
                                      >
                                        {
                                          Number.isInteger(
                                            row.pf
                                          )
                                            ? row.pf
                                            : row.pf.toFixed(
                                                1
                                              )
                                        }
                                      </td>


                                      <td
                                        style={{
                                          textAlign:
                                            "center"
                                        }}
                                      >
                                        {
                                          Number.isInteger(
                                            row.pa
                                          )
                                            ? row.pa
                                            : row.pa.toFixed(
                                                1
                                              )
                                        }
                                      </td>


                                      <td
                                        style={{
                                          textAlign:
                                            "center",
                                          fontWeight:
                                            "bold"
                                        }}
                                      >
                                        {
                                          row.pd >
                                          0
                                            ? "+"
                                            : ""
                                        }

                                        {
                                          Number.isInteger(
                                            row.pd
                                          )
                                            ? row.pd
                                            : row.pd.toFixed(
                                                1
                                              )
                                        }
                                      </td>

                                    </>

                                  )}


                                  <td
                                    style={{
                                      textAlign:
                                        "center",
                                      fontWeight:
                                        "bold"
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


                      <p
                        className="muted"
                        style={{
                          marginTop:
                            "12px",
                          fontSize:
                            "13px"
                        }}
                      >

                        <b>
                          P
                        </b>{" "}
                        Played ·{" "}

                        <b>
                          W
                        </b>{" "}
                        Won ·{" "}

                        {selectedEvent.name
                          .toLowerCase() !==
                          "cricket" && (
                          <>
                            <b>
                              D
                            </b>{" "}
                            Draw ·{" "}
                          </>
                        )}

                        <b>
                          L
                        </b>{" "}
                        Lost ·{" "}

                        {selectedEvent.name
                          .toLowerCase() ===
                          "cricket" && (
                          <>
                            <b>
                              NR
                            </b>{" "}
                            No Result ·{" "}
                          </>
                        )}

                        {usesNumericScores && (
                          <>
                            <b>
                              PF
                            </b>{" "}
                            Points For ·{" "}

                            <b>
                              PA
                            </b>{" "}
                            Points Against ·{" "}

                            <b>
                              PD
                            </b>{" "}
                            Point Difference ·{" "}
                          </>
                        )}

                        <b>
                          Pts
                        </b>{" "}
                        Competition Points

                      </p>

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


          {/* Dynamically added events */}

          {events.length >
            0 && (

            <div
              className="eventGroup"
              style={{
                marginTop:
                  "24px"
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

                      {
                        event.name
                      }

                      {" · "}

                      {
                        event.gender
                      }

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
