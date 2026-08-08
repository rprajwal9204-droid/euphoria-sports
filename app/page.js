"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [points, setPoints] = useState({});
  const [loading, setLoading] = useState(true);

  // DEBUG STATE
  const [debugResults, setDebugResults] = useState([]);
  const [debugClubs, setDebugClubs] = useState([]);
  const [debugResultsError, setDebugResultsError] = useState("");
  const [debugClubsError, setDebugClubsError] = useState("");
  const [debugMatchesError, setDebugMatchesError] = useState("");

  async function load() {
    setLoading(true);

    const [
      {
        data: m,
        error: matchesError
      },
      {
        data: r,
        error: resultsError
      },
      {
        data: c,
        error: clubsError
      }
    ] = await Promise.all([
      supabase
        .from("matches")
        .select(`
          id,
          score_a,
          score_b,
          status,
          match_time,
          events(name, gender, category),
          club_a:club_a_id(name),
          club_b:club_b_id(name)
        `)
        .order("match_time", {
          ascending: true
        }),

      supabase
        .from("event_results")
        .select(
          "id,event_id,club_id,position,points"
        )
        .order("event_id")
        .order("position"),

      supabase
        .from("clubs")
        .select("id,name")
        .order("id")
    ]);

    // SAVE DEBUG DATA

    setDebugResults(r || []);
    setDebugClubs(c || []);

    setDebugResultsError(
      resultsError?.message || ""
    );

    setDebugClubsError(
      clubsError?.message || ""
    );

    setDebugMatchesError(
      matchesError?.message || ""
    );

    setMatches(m || []);

    /*
      BUILD CLUB ID → NAME MAP
    */

    const clubMap = {};

    (c || []).forEach((club) => {
      clubMap[club.id] = club.name;
    });

    /*
      CALCULATE TOTAL POINTS
    */

    const totals = {};

    (r || []).forEach((result) => {
      const clubName =
        clubMap[result.club_id];

      if (clubName) {
        totals[clubName] =
          (totals[clubName] || 0) +
          Number(result.points || 0);
      }
    });

    /*
      MAKE SURE ALL CLUBS APPEAR
    */

    clubs.forEach((club) => {
      totals[club] =
        totals[club] || 0;
    });

    setPoints(totals);

    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("euphoria-live")

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

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const leaderboard =
    [...clubs].sort(
      (a, b) =>
        (points[b] || 0) -
        (points[a] || 0)
    );

  return (
    <main>

      {/* HEADER */}

      <header>

        <div className="logo">
          EUPHORIA <span>SPORTS</span>
        </div>

        <a href="/admin">
          ADMIN
        </a>

      </header>


      {/* HERO */}

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
          Live scores, results and the race
          for the Euphoria Club Championship.
        </p>

      </section>


      {/* CONTENT */}

      <section className="wrap">

        <div className="grid">


          {/* MATCHES */}

          <div className="card">

            <div className="live">
              ● LIVE / UPCOMING
            </div>

            <h2>
              Matches
            </h2>

            {loading ? (

              <p>
                Loading...
              </p>

            ) : matches.length === 0 ? (

              <p className="muted">
                No matches added yet.
              </p>

            ) : (

              matches.map((match) => (

                <div
                  className="match"
                  key={match.id}
                >

                  <div>
                    <b>
                      {match.club_a?.name ||
                        "TBD"}
                    </b>

                    <strong>
                      {match.score_a || "—"}
                    </strong>
                  </div>

                  <div>
                    <b>
                      {match.club_b?.name ||
                        "TBD"}
                    </b>

                    <strong>
                      {match.score_b || "—"}
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

              ))

            )}

          </div>


          {/* LEADERBOARD */}

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
                    {index + 1}
                  </span>

                  <b>
                    {club}
                  </b>

                  <strong>
                    {points[club] || 0}
                  </strong>

                </div>

              )
            )}

          </div>

        </div>


        {/* DEBUG */}

        <div
          className="card section"
          style={{
            border:
              "2px solid #ff5570"
          }}
        >

          <h2>
            🔧 Debug — Supabase Data
          </h2>

          <p className="muted">
            Temporary diagnostic section.
            This shows exactly what the public
            website receives from Supabase.
          </p>


          {/* MATCH ERROR */}

          <h3>
            Matches
          </h3>

          {debugMatchesError ? (

            <p>
              ❌ {debugMatchesError}
            </p>

          ) : (

            <p>
              ✅ Matches loaded:
              {" "}
              {matches.length}
            </p>

          )}


          {/* EVENT RESULTS */}

          <h3>
            Event Results Received:
            {" "}
            {debugResults.length}
          </h3>

          {debugResultsError && (

            <p>
              ❌ Event Results Error:
              {" "}
              {debugResultsError}
            </p>

          )}

          {debugResults.length === 0 ? (

            <p className="muted">
              No event_results rows received
              by the public website.
            </p>

          ) : (

            debugResults.map(
              (result) => (

                <div
                  key={result.id}
                  style={{
                    padding: "12px",
                    marginBottom: "8px",
                    background:
                      "#1c1c27",
                    borderRadius:
                      "10px"
                  }}
                >

                  <b>
                    Result ID:
                  </b>{" "}
                  {result.id}

                  <br />

                  <b>
                    Event ID:
                  </b>{" "}
                  {result.event_id}

                  <br />

                  <b>
                    Club ID:
                  </b>{" "}
                  {result.club_id}

                  <br />

                  <b>
                    Position:
                  </b>{" "}
                  {result.position}

                  <br />

                  <b>
                    Points:
                  </b>{" "}
                  {result.points}

                </div>

              )
            )

          )}


          {/* CLUBS */}

          <h3>
            Clubs Received:
            {" "}
            {debugClubs.length}
          </h3>

          {debugClubsError && (

            <p>
              ❌ Clubs Error:
              {" "}
              {debugClubsError}
            </p>

          )}

          {debugClubs.length === 0 ? (

            <p className="muted">
              No clubs received by the
              public website.
            </p>

          ) : (

            debugClubs.map(
              (club) => (

                <div
                  key={club.id}
                  style={{
                    padding: "8px",
                    marginBottom: "5px",
                    background:
                      "#1c1c27",
                    borderRadius:
                      "8px"
                  }}
                >

                  ID:
                  {" "}
                  <b>
                    {club.id}
                  </b>

                  {" — "}

                  Name:
                  {" "}
                  <b>
                    {club.name}
                  </b>

                </div>

              )
            )

          )}


          {/* CALCULATED POINTS */}

          <h3>
            Calculated Points
          </h3>

          {clubs.map(
            (club) => (

              <div
                key={club}
                style={{
                  padding:
                    "6px 0"
                }}
              >

                {club}
                {" → "}
                <b>
                  {points[club] || 0}
                </b>

              </div>

            )
          )}

        </div>


        {/* POINTS SYSTEM */}

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


        {/* EVENTS */}

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

        </div>

      </section>

    </main>
  );
}
