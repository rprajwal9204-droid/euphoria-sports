"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const clubMap = {
  1: "Falcons",
  2: "Eagles",
  3: "Thunderbirds",
  4: "Griffins",
  5: "Phoenix"
};

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

  async function load() {
    setLoading(true);

    const [
      { data: m, error: matchesError },
      { data: r, error: resultsError }
    ] = await Promise.all([
      supabase
        .from("matches")
        .select(`
          id,
          club_a_id,
          club_b_id,
          score_a,
          score_b,
          status,
          match_time,
          event_id,
          events(name, gender, category)
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
        .order("position")
    ]);

    if (matchesError) {
      console.error(
        "Matches error:",
        matchesError
      );
    }

    if (resultsError) {
      console.error(
        "Event results error:",
        resultsError
      );
    }

    const formattedMatches = (m || []).map(
      (match) => ({
        ...match,

        clubAName:
          clubMap[Number(match.club_a_id)] ||
          "TBD",

        clubBName:
          clubMap[Number(match.club_b_id)] ||
          "TBD"
      })
    );

    setMatches(formattedMatches);


    /*
      CALCULATE OVERALL POINTS
    */

    const totals = {};

    clubs.forEach((club) => {
      totals[club] = 0;
    });

    (r || []).forEach((result) => {
      const clubName =
        clubMap[Number(result.club_id)];

      if (clubName) {
        totals[clubName] +=
          Number(result.points || 0);
      }
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


  /*
    SEPARATE MATCHES BY STATUS
  */

  const liveMatches = matches.filter(
    (match) =>
      String(match.status).toLowerCase() ===
      "live"
  );

  const upcomingMatches = matches.filter(
    (match) =>
      String(match.status).toLowerCase() ===
      "upcoming"
  );

  const completedMatches = matches.filter(
    (match) =>
      String(match.status).toLowerCase() ===
      "final"
  );


  /*
    LEADERBOARD
  */

  const leaderboard = [...clubs].sort(
    (a, b) =>
      (points[b] || 0) -
      (points[a] || 0)
  );


  /*
    MATCH CARD
  */

  function MatchCard({ match }) {
    return (
      <div className="match">

        <div>
          <b>
            {match.clubAName}
          </b>

          <strong>
            {match.score_a || "—"}
          </strong>
        </div>

        <div>
          <b>
            {match.clubBName}
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
          {match.events?.category}
        </small>

      </div>
    );
  }


  /*
    MATCH SECTION
  */

  function MatchSection({
    title,
    matches,
    emptyText
  }) {
    return (
      <div className="card section">

        <h2>
          {title}
        </h2>

        {matches.length === 0 ? (

          <p className="muted">
            {emptyText}
          </p>

        ) : (

          matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
            />
          ))

        )}

      </div>
    );
  }


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


      <section className="wrap">


        {/* LIVE */}

        {loading ? (

          <div className="card">

            <p>
              Loading matches...
            </p>

          </div>

        ) : (

          <MatchSection
            title="🔴 LIVE"
            matches={liveMatches}
            emptyText="No matches are live right now."
          />

        )}


        {/* UPCOMING */}

        {!loading && (

          <MatchSection
            title="🟡 UPCOMING"
            matches={upcomingMatches}
            emptyText="No upcoming matches."
          />

        )}


        {/* COMPLETED */}

        {!loading && (

          <MatchSection
            title="✅ COMPLETED"
            matches={completedMatches}
            emptyText="No completed matches yet."
          />

        )}


        {/* LEADERBOARD */}

        <div className="card section">

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

          {Object.entries(eventGroups).map(
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
