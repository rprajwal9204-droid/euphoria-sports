"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const clubs = ["Falcons", "Eagles", "Thunderbirds", "Griffins", "Phoenix"];

const eventGroups = {
  "Men's Team Sports": ["Cricket", "Football", "Volleyball", "Basketball", "Kho Kho"],
  "Women's Team Sports": ["Cricket", "Throwball", "Basketball", "Kho Kho"],
  "Men's Doubles": ["Tennis", "Table Tennis", "Badminton", "Carrom"],
  "Women's Doubles": ["Tennis", "Table Tennis", "Badminton", "Carrom"],
  "Mixed Doubles": ["Tennis"],
  "Men's Individual": [
    "Marathon", "100m", "200m", "400m",
    "Long Jump", "Triple Jump", "Table Tennis", "Cycling"
  ],
  "Women's Individual": [
    "Marathon", "100m", "200m", "400m",
    "Long Jump", "Triple Jump", "Table Tennis", "Cycling"
  ]
};

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [points, setPoints] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const [{ data: m }, { data: r }] = await Promise.all([
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
        .order("match_time", { ascending: true }),

      supabase
        .from("results")
        .select("club_id, points, clubs(name)")
    ]);

    setMatches(m || []);

    const totals = {};

    (r || []).forEach((x) => {
      const name = x.clubs?.name;
      if (name) {
        totals[name] = (totals[name] || 0) + Number(x.points || 0);
      }
    });

    clubs.forEach((club) => {
      totals[club] = totals[club] || 0;
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
        { event: "*", schema: "public", table: "matches" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "results" },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const leaderboard = [...clubs].sort(
    (a, b) => (points[b] || 0) - (points[a] || 0)
  );

  return (
    <main>
      <header>
        <div className="logo">
          EUPHORIA <span>SPORTS</span>
        </div>
        <a href="/admin">ADMIN</a>
      </header>

      <section className="hero">
        <small>INTER-CLUB SPORTS CHAMPIONSHIP</small>

        <h1>
          THE GAME
          <br />
          IS ON.
        </h1>

        <p>
          Live scores, results and the race for the Euphoria Club Championship.
        </p>
      </section>

      <section className="wrap">
        <div className="grid">

          <div className="card">
            <div className="live">● LIVE / UPCOMING</div>
            <h2>Matches</h2>

            {loading ? (
              <p>Loading...</p>
            ) : matches.length === 0 ? (
              <p className="muted">No matches added yet.</p>
            ) : (
              matches.map((match) => (
                <div className="match" key={match.id}>
                  <div>
                    <b>{match.club_a?.name || "TBD"}</b>
                    <strong>{match.score_a || "—"}</strong>
                  </div>

                  <div>
                    <b>{match.club_b?.name || "TBD"}</b>
                    <strong>{match.score_b || "—"}</strong>
                  </div>

                  <small>
                    {match.events?.name} · {match.events?.gender} ·{" "}
                    {match.status}
                  </small>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h2>🏆 Overall Club Points</h2>

            {leaderboard.map((club, index) => (
              <div className="rank" key={club}>
                <span>{index + 1}</span>
                <b>{club}</b>
                <strong>{points[club] || 0}</strong>
              </div>
            ))}
          </div>

        </div>

        <div className="card section">
          <h2>Points System</h2>

          <div className="rules">
            <div>
              <b>Team</b>
              <span>🥇 25 · 🥈 15 · 🥉 7</span>
            </div>

            <div>
              <b>Doubles / Mixed</b>
              <span>🥇 15 · 🥈 10 · 🥉 7</span>
            </div>

            <div>
              <b>Individual</b>
              <span>🥇 10 · 🥈 7 · 🥉 5</span>
            </div>
          </div>
        </div>

        <div className="card section">
          <h2>Events</h2>

          {Object.entries(eventGroups).map(([group, sports]) => (
            <div className="eventGroup" key={group}>
              <h3>{group}</h3>

              <div className="pills">
                {sports.map((sport) => (
                  <span key={sport}>{sport}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

      </section>
    </main>
  );
                          }
