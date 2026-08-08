 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const clubs = ["Falcons","Eagles","Thunderbirds","Griffins","Phoenix"];

const eventGroups = {
  "Men's Team Sports": ["Cricket","Football","Volleyball","Basketball","Kho Kho"],
  "Women's Team Sports": ["Cricket","Throwball","Basketball","Kho Kho"],
  "Men's Doubles": ["Tennis","Table Tennis","Badminton","Carrom"],
  "Women's Doubles": ["Tennis","Table Tennis","Badminton","Carrom"],
  "Mixed Doubles": ["Tennis"],
  "Men's Individual": ["Marathon","100m","200m","400m","Long Jump","Triple Jump","Table Tennis","Cycling"],
  "Women's Individual": ["Marathon","100m","200m","400m","Long Jump","Triple Jump","Table Tennis","Cycling"]
};

export default function Home() {
  const [matches,setMatches] = useState([]);
  const [events,setEvents] = useState([]);
  const [points,setPoints] = useState({});
  const [loading,setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{data:m},{data:e},{data:r}] = await Promise.all([
      supabase.from("matches").select("id,score_a,score_b,status,match_time,winner_club_id,events(name,gender,category),club_a:club_a_id(name),club_b:club_b_id(name)").order("match_time",{ascending:true}),
      supabase.from("events").select("id,name,gender,category,points_type").order("id"),
      supabase.from("results").select("club_id,points,clubs(name)")
    ]);
    setMatches(m || []);
    setEvents(e || []);
    const totals = {};
    (r || []).forEach(x => {
      const n = x.clubs?.name;
      if(n) totals[n] = (totals[n] || 0) + Number(x.points || 0);
    });
    clubs.forEach(c => totals[c] = totals[c] || 0);
    setPoints(totals);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("euphoria-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"matches"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"results"},load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const leaderboard = [...clubs].sort((a,b)=>(points[b]||0)-(points[a]||0));

  return (
    <main>
      <header><div className="logo">EUPHORIA <span>SPORTS</span></div><a href="/admin">ADMIN</a></header>
      <section className="hero">
        <small>INTER-CLUB SPORTS CHAMPIONSHIP</small>
        <h1>THE GAME<br/>IS ON.</h1>
        <p>Live scores, results and the race for the Euphoria Club Championship.</p>
      </section>

      <section className="wrap">
        <div className="grid">
          <div className="card">
            <div className="live">● LIVE / UPCOMING</div><h2>Matches</h2>
            {loading ? <p>Loading…</p> : matches.length === 0 ? <p className="muted">No matches added yet.</p> :
              matches.map(m => <div className="match" key={m.id}>
                <div><b>{m.club_a?.name || "TBD"}</b><strong>{m.score_a || "—"}</strong></div>
                <div><b>{m.club_b?.name || "TBD"}</b><strong>{m.score_b || "—"}</strong></div>
                <small>{m.events?.name} · {m.events?.gender} · {m.status}</small>
              </div>)}
          </div>

          <div className="card">
            <h2>🏆 Overall Club Points</h2>
            {leaderboard.map((c,i)=><div className="rank" key={c}><span>{i+1}</span><b>{c}</b><strong>{points[c]||0}</strong></div>)}
          </div>
        </div>

        <div className="card section">
          <h2>Points System</h2>
          <div className="rules">
            <div><b>Team</b><span>🥇 25 · 🥈 15 · 🥉 7</span></div>
            <div><b>Doubles / Mixed</b><span>🥇 15 · 🥈 10 · 🥉 7</span></div>
            <div><b>Individual</b><span>🥇 10 · 🥈 7 · 🥉 5</span></div>
          </div>
        </div>

        <div className="card section">
          <h2>Events</h2>
          {Object.entries(eventGroups).map(([group, list]) =>
            <div className="eventGroup" key={group}><h3>{group}</h3><div className="pills">{list.map(x=><span key={x}>{x}</span>)}</div></div>
          )}
        </div>
      </section>
    </main>
  );
}
