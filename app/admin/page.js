"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function getPoints(category, position) {
  const type = String(category || "").toLowerCase();

  if (type.includes("team")) {
    return position === 1 ? 25 : position === 2 ? 15 : 7;
  }

  if (type.includes("double") || type.includes("mixed")) {
    return position === 1 ? 15 : position === 2 ? 10 : 7;
  }

  return position === 1 ? 10 : position === 2 ? 7 : 5;
}

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    event_id: "",
    club_a_id: "",
    club_b_id: "",
    score_a: "",
    score_b: "",
    status: "Upcoming"
  });

  const [resultForm, setResultForm] = useState({
    event_id: "",
    first: "",
    second: "",
    third: ""
  });

  const [eventForm, setEventForm] = useState({
    name: "",
    gender: "Men's",
    category: "Team"
  });


  async function load() {
    setLoading(true);

    const [
      { data: e, error: eventError },
      { data: c, error: clubError },
      { data: m, error: matchError },
      { data: r, error: resultError }
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
          id,
          event_id,
          club_a_id,
          club_b_id,
          score_a,
          score_b,
          status,
          match_time,
          events(name, gender, category),
          club_a:club_a_id(name),
          club_b:club_b_id(name)
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
          events(name, gender, category),
          clubs(name)
        `)
        .order("event_id")
        .order("position")
    ]);

    if (eventError) {
      console.error("Events error:", eventError);
    }

    if (clubError) {
      console.error("Clubs error:", clubError);
    }

    if (matchError) {
      console.error("Matches error:", matchError);
    }

    if (resultError) {
      console.error("Results error:", resultError);
    }

    setEvents(e || []);
    setClubs(c || []);
    setMatches(m || []);
    setResults(r || []);

    if (!form.event_id && e?.length) {
      setForm((old) => ({
        ...old,
        event_id: String(e[0].id)
      }));
    }

    setLoading(false);
  }


  useEffect(() => {
    load();
  }, []);


  // =====================================================
  // ADD SPORT / EVENT
  // =====================================================

  async function addEvent(e) {
    e.preventDefault();
    setMsg("");

    const name = eventForm.name.trim();

    if (!name) {
      setMsg("Please enter a sport/event name.");
      return;
    }

    const { error } = await supabase
      .from("events")
      .insert({
        name: name,
        gender: eventForm.gender,
        category: eventForm.category,
        points_type: eventForm.category
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      `✅ ${eventForm.gender} ${name} added successfully.`
    );

    setEventForm({
      name: "",
      gender: "Men's",
      category: "Team"
    });

    await load();
  }


  // =====================================================
  // CREATE MATCH
  // =====================================================

  async function addMatch(e) {
    e.preventDefault();
    setMsg("");

    if (!form.event_id) {
      setMsg("Please select an event.");
      return;
    }

    if (!form.club_a_id) {
      setMsg("Please select Club A.");
      return;
    }

    if (!form.club_b_id) {
      setMsg("Please select Club B.");
      return;
    }

    if (form.club_a_id === form.club_b_id) {
      setMsg("Club A and Club B must be different.");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .insert({
        event_id: Number(form.event_id),
        club_a_id: Number(form.club_a_id),
        club_b_id: Number(form.club_b_id),
        score_a: form.score_a || null,
        score_b: form.score_b || null,
        status: form.status
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("✅ Match created successfully.");

    setForm((old) => ({
      ...old,
      club_a_id: "",
      club_b_id: "",
      score_a: "",
      score_b: ""
    }));

    await load();
  }


  // =====================================================
  // UPDATE MATCH
  // =====================================================

  async function updateMatch(id, patch) {
    setMsg("");

    const { error } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("✅ Match updated.");

    await load();
  }


  // =====================================================
  // DELETE MATCH
  // =====================================================

  async function deleteMatch(id) {
    const ok = window.confirm(
      "Delete this match permanently?"
    );

    if (!ok) return;

    setMsg("");

    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("🗑️ Match deleted.");

    await load();
  }


  // =====================================================
  // FINALIZE RESULT
  // =====================================================

  async function finalizeResult(e) {
    e.preventDefault();
    setMsg("");

    if (
      !resultForm.event_id ||
      !resultForm.first ||
      !resultForm.second ||
      !resultForm.third
    ) {
      setMsg(
        "Please select 1st, 2nd and 3rd place."
      );
      return;
    }

    const selected = [
      resultForm.first,
      resultForm.second,
      resultForm.third
    ];

    if (new Set(selected).size !== 3) {
      setMsg(
        "1st, 2nd and 3rd must be different clubs."
      );
      return;
    }

    const event = events.find(
      (x) =>
        String(x.id) ===
        String(resultForm.event_id)
    );

    if (!event) {
      setMsg("Event not found.");
      return;
    }

    const rows = [
      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.first),
        position: 1,
        points: getPoints(event.category, 1)
      },
      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.second),
        position: 2,
        points: getPoints(event.category, 2)
      },
      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.third),
        position: 3,
        points: getPoints(event.category, 3)
      }
    ];

    const { error } = await supabase
      .from("event_results")
      .upsert(rows, {
        onConflict: "event_id,position"
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      "🏆 Result finalized and points awarded!"
    );

    setResultForm({
      event_id: "",
      first: "",
      second: "",
      third: ""
    });

    await load();
  }


  // =====================================================
  // DELETE RESULT
  // =====================================================

  async function deleteResult(id) {
    const ok = window.confirm(
      "Delete this finalized result?"
    );

    if (!ok) return;

    setMsg("");

    const { error } = await supabase
      .from("event_results")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("🗑️ Result deleted.");

    await load();
  }


  return (
    <main>

      {/* HEADER */}

      <header>

        <div className="logo">
          EUPHORIA <span>ADMIN</span>
        </div>

        <a href="/">
          PUBLIC SITE
        </a>

      </header>


      <section className="wrap admin">


        {/* =====================================================
            ADD SPORT / EVENT
        ===================================================== */}

        <div className="card">

          <h2>➕ Add Sport / Event</h2>

          <p className="muted">
            Add a new sport whenever you discover
            one that is missing.
          </p>

          <form onSubmit={addEvent}>

            <label>
              Sport / Event Name

              <input
                value={eventForm.name}
                placeholder="Example: Chess"
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    name: e.target.value
                  })
                }
              />

            </label>


            <label>
              Gender

              <select
                value={eventForm.gender}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    gender: e.target.value
                  })
                }
              >

                <option value="Men's">
                  Men's
                </option>

                <option value="Women's">
                  Women's
                </option>

                <option value="Mixed">
                  Mixed
                </option>

              </select>

            </label>


            <label>
              Category

              <select
                value={eventForm.category}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    category: e.target.value
                  })
                }
              >

                <option value="Team">
                  Team
                </option>

                <option value="Doubles">
                  Doubles
                </option>

                <option value="Mixed Doubles">
                  Mixed Doubles
                </option>

                <option value="Individual">
                  Individual
                </option>

              </select>

            </label>


            <button type="submit">
              Add Sport / Event
            </button>

          </form>

        </div>


        {/* =====================================================
            CREATE MATCH
        ===================================================== */}

        <div className="card">

          <h1>
            Admin Dashboard
          </h1>

          <p className="muted">
            Create matches and update live scores.
          </p>


          <form onSubmit={addMatch}>

            <label>
              Event

              <select
                value={form.event_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    event_id: e.target.value
                  })
                }
              >

                <option value="">
                  Select Event
                </option>

                {events.map((event) => (

                  <option
                    key={event.id}
                    value={event.id}
                  >

                    {event.gender} ·{" "}
                    {event.name} ·{" "}
                    {event.category}

                  </option>

                ))}

              </select>

            </label>


            <label>
              Club A

              <select
                value={form.club_a_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    club_a_id: e.target.value
                  })
                }
              >

                <option value="">
                  Select Club
                </option>

                {clubs.map((club) => (

                  <option
                    key={club.id}
                    value={club.id}
                  >

                    {club.name}

                  </option>

                ))}

              </select>

            </label>


            <label>
              Club B

              <select
                value={form.club_b_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    club_b_id: e.target.value
                  })
                }
              >

                <option value="">
                  Select Club
                </option>

                {clubs.map((club) => (

                  <option
                    key={club.id}
                    value={club.id}
                  >

                    {club.name}

                  </option>

                ))}

              </select>

            </label>


            <div className="two">

              <label>
                Score A

                <input
                  value={form.score_a}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      score_a: e.target.value
                    })
                  }
                />

              </label>


              <label>
                Score B

                <input
                  value={form.score_b}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      score_b: e.target.value
                    })
                  }
                />

              </label>

            </div>


            <label>
              Status

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value
                  })
                }
              >

                <option value="Upcoming">
                  Upcoming
                </option>

                <option value="Live">
                  Live
                </option>

                <option value="Final">
                  Final
                </option>

              </select>

            </label>


            <button type="submit">
              Create Match
            </button>

          </form>

        </div>


        {/* MESSAGE */}

        {msg && (

          <div className="card">

            <p>
              {msg}
            </p>

          </div>

        )}


        {/* =====================================================
            FINALIZE RESULT
        ===================================================== */}

        <div className="card">

          <h2>
            🏆 Finalize Event Result
          </h2>

          <p className="muted">
            Select the final 1st, 2nd and 3rd
            place clubs. Points are calculated
            automatically.
          </p>


          <form onSubmit={finalizeResult}>

            <label>
              Event

              <select
                value={resultForm.event_id}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    event_id: e.target.value
                  })
                }
              >

                <option value="">
                  Select Event
                </option>

                {events.map((event) => (

                  <option
                    key={event.id}
                    value={event.id}
                  >

                    {event.gender} ·{" "}
                    {event.name} ·{" "}
                    {event.category}

                  </option>

                ))}

              </select>

            </label>


            <label>
              🥇 1st Place

              <select
                value={resultForm.first}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    first: e.target.value
                  })
                }
              >

                <option value="">
                  Select Club
                </option>

                {clubs.map((club) => (

                  <option
                    key={club.id}
                    value={club.id}
                  >

                    {club.name}

                  </option>

                ))}

              </select>

            </label>


            <label>
              🥈 2nd Place

              <select
                value={resultForm.second}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    second: e.target.value
                  })
                }
              >

                <option value="">
                  Select Club
                </option>

                {clubs.map((club) => (

                  <option
                    key={club.id}
                    value={club.id}
                  >

                    {club.name}

                  </option>

                ))}

              </select>

            </label>


            <label>
              🥉 3rd Place

              <select
                value={resultForm.third}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    third: e.target.value
                  })
                }
              >

                <option value="">
                  Select Club
                </option>

                {clubs.map((club) => (

                  <option
                    key={club.id}
                    value={club.id}
                  >

                    {club.name}

                  </option>

                ))}

              </select>

            </label>


            <button type="submit">
              Finalize Result & Award Points
            </button>

          </form>

        </div>


        {/* =====================================================
            EXISTING MATCHES
        ===================================================== */}

        <div className="card">

          <h2>
            Existing Matches
          </h2>


          {loading ? (

            <p className="muted">
              Loading...
            </p>

          ) : matches.length === 0 ? (

            <p className="muted">
              No matches yet.
            </p>

          ) : (

            matches.map((match) => (

              <div
                className="adminMatch"
                key={match.id}
              >

                <b>

                  {match.club_a?.name ||
                    "TBD"}

                  {" vs "}

                  {match.club_b?.name ||
                    "TBD"}

                </b>


                <small>

                  {match.events?.gender}
                  {" · "}
                  {match.events?.name}
                  {" · "}
                  {match.events?.category}

                </small>


                <div className="two">

                  <input
                    defaultValue={
                      match.score_a || ""
                    }
                    id={`score-a-${match.id}`}
                  />

                  <input
                    defaultValue={
                      match.score_b || ""
                    }
                    id={`score-b-${match.id}`}
                  />

                </div>


                <select
                  defaultValue={
                    match.status
                  }
                  onChange={(e) =>
                    updateMatch(
                      match.id,
                      {
                        status:
                          e.target.value
                      }
                    )
                  }
                >

                  <option value="Upcoming">
                    Upcoming
                  </option>

                  <option value="Live">
                    Live
                  </option>

                  <option value="Final">
                    Final
                  </option>

                </select>


                <button
                  onClick={() => {

                    const scoreA =
                      document.getElementById(
                        `score-a-${match.id}`
                      )?.value || "";

                    const scoreB =
                      document.getElementById(
                        `score-b-${match.id}`
                      )?.value || "";

                    updateMatch(
                      match.id,
                      {
                        score_a: scoreA,
                        score_b: scoreB
                      }
                    );

                  }}
                >

                  Save Score

                </button>


                <button
                  style={{
                    background: "#b42336",
                    borderColor: "#b42336"
                  }}
                  onClick={() =>
                    deleteMatch(match.id)
                  }
                >

                  🗑️ Delete Match

                </button>

              </div>

            ))

          )}

        </div>


        {/* =====================================================
            FINALIZED RESULTS
        ===================================================== */}

        <div className="card">

          <h2>
            🏆 Finalized Results
          </h2>


          {results.length === 0 ? (

            <p className="muted">
              No finalized results yet.
            </p>

          ) : (

            results.map((result) => (

              <div
                className="adminMatch"
                key={result.id}
              >

                <b>

                  {result.position === 1
                    ? "🥇"
                    : result.position === 2
                    ? "🥈"
                    : "🥉"}

                  {" "}

                  {result.clubs?.name ||
                    "Unknown Club"}

                </b>


                <small>

                  {result.events?.gender}
                  {" · "}
                  {result.events?.name}
                  {" · "}
                  {result.events?.category}

                  {" — "}

                  {result.points} points

                </small>


                <button
                  style={{
                    background: "#b42336",
                    borderColor: "#b42336"
                  }}
                  onClick={() =>
                    deleteResult(result.id)
                  }
                >

                  🗑️ Delete Result

                </button>

              </div>

            ))

          )}

        </div>


        {/* =====================================================
            ALL EVENTS
        ===================================================== */}

        <div className="card">

          <h2>
            📋 All Events
          </h2>

          <p className="muted">
            These events are available for
            matches, results and public
            leaderboards.
          </p>


          {events.length === 0 ? (

            <p className="muted">
              No events found.
            </p>

          ) : (

            events.map((event) => (

              <div
                className="adminMatch"
                key={event.id}
              >

                <b>
                  {event.name}
                </b>

                <small>
                  {event.gender}
                  {" · "}
                  {event.category}
                </small>

              </div>

            ))

          )}

        </div>


      </section>

    </main>
  );
                  }
