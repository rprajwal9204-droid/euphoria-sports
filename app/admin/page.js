 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const clubs = ["Falcons","Eagles","Thunderbirds","Griffins","Phoenix"];

export default function Admin() {
  const [events,setEvents]=useState([]);
  const [matches,setMatches]=useState([]);
  const [msg,setMsg]=useState("");
  const [form,setForm]=useState({event_id:"",club_a_id:"",club_b_id:"",score_a:"",score_b:"",status:"Upcoming"});
  const [clubIds,setClubIds]=useState({});

  async function load(){
    const [{data:e},{data:c},{data:m}] = await Promise.all([
      supabase.from("events").select("*").order("id"),
      supabase.from("clubs").select("*").order("id"),
      supabase.from("matches").select("id,score_a,score_b,status,events(name),club_a:club_a_id(name),club_b:club_b_id(name)").order("id",{ascending:false})
    ]);
    setEvents(e||[]); setMatches(m||[]);
    const map={}; (c||[]).forEach(x=>map[x.name]=x.id); setClubIds(map);
    if(!form.event_id && e?.[0]) setForm(f=>({...f,event_id:e[0].id}));
  }
  useEffect(()=>{load()},[]);

  async function addMatch(e){
    e.preventDefault(); setMsg("");
    const {error}=await supabase.from("matches").insert({
      event_id:Number(form.event_id),
      club_a_id:Number(form.club_a_id),
      club_b_id:Number(form.club_b_id),
      score_a:form.score_a, score_b:form.score_b, status:form.status
    });
    setMsg(error ? error.message : "Match created."); if(!error){setForm(f=>({...f,score_a:"",score_b:""}));load();}
  }

  async function updateMatch(id, patch){
    const {error}=await supabase.from("matches").update(patch).eq("id",id);
    setMsg(error ? error.message : "Saved."); if(!error) load();
  }

  return <main><header><div className="logo">EUPHORIA <span>ADMIN</span></div><a href="/">PUBLIC SITE</a></header>
  <section className="wrap admin">
    <div className="card"><h1>Admin Dashboard</h1><p className="muted">Create matches and update live scores. Results/points finalization will be added next.</p>
      <form onSubmit={addMatch}>
        <label>Event<select value={form.event_id} onChange={e=>setForm({...form,event_id:e.target.value})}>{events.map(x=><option key={x.id} value={x.id}>{x.gender} · {x.name} · {x.category}</option>)}</select></label>
        <label>Club A<select value={form.club_a_id} onChange={e=>setForm({...form,club_a_id:e.target.value})}><option value="">Select</option>{clubs.map(c=><option key={c} value={clubIds[c]}>{c}</option>)}</select></label>
        <label>Club B<select value={form.club_b_id} onChange={e=>setForm({...form,club_b_id:e.target.value})}><option value="">Select</option>{clubs.map(c=><option key={c} value={clubIds[c]}>{c}</option>)}</select></label>
        <div className="two"><label>Score A<input value={form.score_a} onChange={e=>setForm({...form,score_a:e.target.value})}/></label><label>Score B<input value={form.score_b} onChange={e=>setForm({...form,score_b:e.target.value})}/></label></div>
        <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Upcoming</option><option>Live</option><option>Final</option></select></label>
        <button>Create Match</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
    <div className="card"><h2>Existing Matches</h2>{matches.map(m=><div className="adminMatch" key={m.id}>
      <b>{m.club_a?.name} vs {m.club_b?.name}</b><small>{m.events?.name}</small>
      <div className="two"><input defaultValue={m.score_a||""} id={"a"+m.id}/><input defaultValue={m.score_b||""} id={"b"+m.id}/></div>
      <select defaultValue={m.status} onChange={e=>updateMatch(m.id,{status:e.target.value})}><option>Upcoming</option><option>Live</option><option>Final</option></select>
      <button onClick={()=>updateMatch(m.id,{score_a:document.getElementById("a"+m.id).value,score_b:document.getElementById("b"+m.id).value})}>Save Score</button>
    </div>)}</div>
  </section></main>
}
