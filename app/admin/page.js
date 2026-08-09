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

function isCricketEvent(event) {
  return String(event?.name || "").toLowerCase() === "cricket";
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
    runs_a: "",
    wickets_a: "",
    overs_a: "",
    runs_b: "",
    wickets_b: "",
    overs_b: "",
    status: "Upcoming",
  });

  const [resultForm, setResultForm] = useState({
    event_id: "",
    first: "",
    second: "",
    third: "",
  });

  const [eventForm, setEventForm] = useState({
    name: "",
    gender: "Men's",
    category: "Team",
  });

  async function load() {
    setLoading(true);

    const [
      { data: e, error: eventError },
      { data: c, error: clubError },
      { data: m, error: matchError },
      { data: r, error: resultError },
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
          runs_a,
          wickets_a,
          overs_a,
          runs_b,
          wickets_b,
          overs_b,
          status,
          match_time,
          winner_club_id,
          events(id, name, gender, category, points_type),
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
        .order("position"),
    ]);

    if (eventError) console.error("Events error:", eventError);
    if (clubError) console.error("Clubs error:", clubError);
    if (matchError) console.error("Matches error:", matchError);
    if (resultError) console.error("Results error:", resultError);

    setEvents(e || []);
    setClubs(c || []);
    setMatches(m || []);
    setResults(r || []);

    if (!form.event_id && e?.length) {
      setForm((old) => ({
        ...old,
        event_id: String(e[0].id),
      }));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = events.find(
    (event) => String(event.id) === String(form.event_id)
  );

  const cricketSelected = isCricketEvent(selectedEvent);

  // =====================================================
  // ADD SPORT
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
        name,
        gender: eventForm.gender,
        category: eventForm.category,
        points_type: eventForm.category,
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(`✅ ${eventForm.gender} ${name} added successfully.`);

    setEventForm({
      name: "",
      gender: "Men's",
      category: "Team",
    });

    await load();
  }

  // =====================================================
  // ADD MATCH
  // =====================================================

  async function addMatch(e) {
    e.preventDefault();
    setMsg("");

    if (!form.event_id) {
      setMsg("Please select an event.");
      return;
    }

    if (!form.club_a_id || !form.club_b_id) {
      setMsg("Please select both clubs.");
      return;
    }

    if (form.club_a_id === form.club_b_id) {
      setMsg("Club A and Club B must be different.");
      return;
    }

    let winner = null;

    // -------------------------------
    // CRICKET
    // -------------------------------

    if (cricketSelected) {
      if (form.runs_a !== "" && form.runs_b !== "") {
        const runsA = Number(form.runs_a);
        const runsB = Number(form.runs_b);

        if (runsA > runsB) {
          winner = Number(form.club_a_id);
        } else if (runsB > runsA) {
          winner = Number(form.club_b_id);
        }
      }
    }

    // -------------------------------
    // NORMAL SPORTS
    // -------------------------------

    if (!cricketSelected) {
      const a = Number(form.score_a);
      const b = Number(form.score_b);

      if (
        form.score_a !== "" &&
        form.score_b !== "" &&
        Number.isFinite(a) &&
        Number.isFinite(b)
      ) {
        if (a > b) {
          winner = Number(form.club_a_id);
        } else if (b > a) {
          winner = Number(form.club_b_id);
        }
      }
    }

    const insertData = {
      event_id: Number(form.event_id),
      club_a_id: Number(form.club_a_id),
      club_b_id: Number(form.club_b_id),
      score_a: cricketSelected
        ? form.runs_a !== ""
          ? `${form.runs_a}/${form.wickets_a || 0}`
          : null
        : form.score_a || null,
      score_b: cricketSelected
        ? form.runs_b !== ""
          ? `${form.runs_b}/${form.wickets_b || 0}`
          : null
        : form.score_b || null,
      status: form.status,
      winner_club_id: winner,
    };

    if (cricketSelected) {
      insertData.runs_a =
        form.runs_a === "" ? null : Number(form.runs_a);

      insertData.wickets_a =
        form.wickets_a === "" ? null : Number(form.wickets_a);

      insertData.overs_a =
        form.overs_a === "" ? null : Number(form.overs_a);

      insertData.runs_b =
        form.runs_b === "" ? null : Number(form.runs_b);

      insertData.wickets_b =
        form.wickets_b === "" ? null : Number(form.wickets_b);

      insertData.overs_b =
        form.overs_b === "" ? null : Number(form.overs_b);
    }

    const { error } = await supabase
      .from("matches")
      .insert(insertData);

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
      score_b: "",
      runs_a: "",
      wickets_a: "",
      overs_a: "",
      runs_b: "",
      wickets_b: "",
      overs_b: "",
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
      setMsg("Please select 1st, 2nd and 3rd place.");
      return;
    }

    const selected = [
      resultForm.first,
      resultForm.second,
      resultForm.third,
    ];

    if (new Set(selected).size !== 3) {
      setMsg("1st, 2nd and 3rd must be different clubs.");
      return;
    }

    const event = events.find(
      (x) => String(x.id) === String(resultForm.event_id)
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
        points: getPoints(event.category, 1),
      },
      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.second),
        position: 2,
        points: getPoints(event.category, 2),
      },
      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.third),
        position: 3,
        points: getPoints(event.category, 3),
      },
    ];

    const { error } = await supabase
      .from("event_results")
      .upsert(rows, {
        onConflict: "event_id,position",
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("🏆 Result finalized and points awarded!");

    setResultForm({
      event_id: "",
      first: "",
      second: "",
      third: "",
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

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main>
      <header>
        <div className="logo">
          EUPHORIA <span>ADMIN</span>
        </div>

        <a href="/">
          PUBLIC SITE
        </a>
      </header>

      <section className="wrap admin">

        {/* ADD SPORT */}

        <div className="card">
          <h2>➕ Add Sport / Event</h2>

          <p className="muted">
            Add a new sport whenever one is missing.
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
                    name: e.target.value,
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
                    gender: e.target.value,
                  })
                }
              >
                <option value="Men's">Men's</option>
                <option value="Women's">Women's</option>
                <option value="Mixed">Mixed</option>
              </select>
            </label>

            <label>
              Category

              <select
                value={eventForm.category}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    category: e.target.value,
                  })
                }
              >
                <option value="Team">Team</option>
                <option value="Doubles">Doubles</option>
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

        {/* CREATE MATCH */}

        <div className="card">
          <h1>Admin Dashboard</h1>

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
                    event_id: e.target.value,
                    runs_a: "",
                    wickets_a: "",
                    overs_a: "",
                    runs_b: "",
                    wickets_b: "",
                    overs_b: "",
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
                    {event.gender} · {event.name} ·{" "}
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
                    club_a_id: e.target.value,
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
                    club_b_id: e.target.value,
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

            {/* CRICKET */}

            {cricketSelected ? (
              <>
                <div className="card">
                  <h3>🏏 Cricket — Club A Innings</h3>

                  <label>
                    Runs
                    <input
                      type="number"
                      min="0"
                      value={form.runs_a}
                      placeholder="Example: 185"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          runs_a: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Wickets
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={form.wickets_a}
                      placeholder="Example: 6"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          wickets_a: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Overs Faced
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.overs_a}
                      placeholder="Example: 20"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overs_a: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="card">
                  <h3>🏏 Cricket — Club B Innings</h3>

                  <label>
                    Runs
                    <input
                      type="number"
                      min="0"
                      value={form.runs_b}
                      placeholder="Example: 170"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          runs_b: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Wickets
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={form.wickets_b}
                      placeholder="Example: 8"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          wickets_b: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Overs Faced
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.overs_b}
                      placeholder="Example: 20"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overs_b: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <p className="muted">
                  ⚠️ For example, enter <b>19.3</b> for
                  19 overs and 3 balls. The public NRR
                  calculation will convert this correctly.
                </p>
              </>
            ) : (
              /* NORMAL SPORTS */

              <div className="two">
                <label>
                  Score A

                  <input
                    value={form.score_a}
                    placeholder="Score"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        score_a: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Score B

                  <input
                    value={form.score_b}
                    placeholder="Score"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        score_b: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            )}

            <label>
              Status

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
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
            <p>{msg}</p>
          </div>
        )}

        {/* FINALIZE RESULT */}

        <div className="card">
          <h2>🏆 Finalize Event Result</h2>

          <p className="muted">
            Select final 1st, 2nd and 3rd place clubs.
          </p>

          <form onSubmit={finalizeResult}>
            <label>
              Event

              <select
                value={resultForm.event_id}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    event_id: e.target.value,
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
                    {event.gender} · {event.name} ·{" "}
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
                    first: e.target.value,
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
                    second: e.target.value,
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
                    third: e.target.value,
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

        {/* EXISTING MATCHES */}

        <div className="card">
          <h2>Existing Matches</h2>

          {loading ? (
            <p className="muted">Loading...</p>
          ) : matches.length === 0 ? (
            <p className="muted">
              No matches yet.
            </p>
          ) : (
            matches.map((match) => {
              const cricket = isCricketEvent(
                match.events
              );

              return (
                <div
                  className="adminMatch"
                  key={match.id}
                >
                  <b>
                    {match.club_a?.name || "TBD"}
                    {" vs "}
                    {match.club_b?.name || "TBD"}
                  </b>

                  <small>
                    {match.events?.gender} ·{" "}
                    {match.events?.name} ·{" "}
                    {match.events?.category}
                  </small>

                  {cricket ? (
                    <div>
                      <p>
                        🏏{" "}
                        {match.club_a?.name || "Club A"}:{" "}
                        <b>
                          {match.runs_a ?? "—"}/
                          {match.wickets_a ?? "—"}
                        </b>{" "}
                        ({match.overs_a ?? "—"} overs)
                      </p>

                      <p>
                        🏏{" "}
                        {match.club_b?.name || "Club B"}:{" "}
                        <b>
                          {match.runs_b ?? "—"}/
                          {match.wickets_b ?? "—"}
                        </b>{" "}
                        ({match.overs_b ?? "—"} overs)
                      </p>

                      <div className="two">
                        <label>
                          {match.club_a?.name} Runs
                          <input
                            defaultValue={
                              match.runs_a ?? ""
                            }
                            id={`runs-a-${match.id}`}
                          />
                        </label>

                        <label>
                          Wickets
                          <input
                            defaultValue={
                              match.wickets_a ?? ""
                            }
                            id={`wickets-a-${match.id}`}
                          />
                        </label>
                      </div>

                      <label>
                        Overs
                        <input
                          defaultValue={
                            match.overs_a ?? ""
                          }
                          id={`overs-a-${match.id}`}
                        />
                      </label>

                      <div className="two">
                        <label>
                          {match.club_b?.name} Runs
                          <input
                            defaultValue={
                              match.runs_b ?? ""
                            }
                            id={`runs-b-${match.id}`}
                          />
                        </label>

                        <label>
                          Wickets
                          <input
                            defaultValue={
                              match.wickets_b ?? ""
                            }
                            id={`wickets-b-${match.id}`}
                          />
                        </label>
                      </div>

                      <label>
                        Overs
                        <input
                          defaultValue={
                            match.overs_b ?? ""
                          }
                          id={`overs-b-${match.id}`}
                        />
                      </label>
                    </div>
                  ) : (
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
                  )}

                  <select
                    defaultValue={match.status}
                    onChange={(e) =>
                      updateMatch(match.id, {
                        status: e.target.value,
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

                  <button
                    onClick={() => {
                      if (cricket) {
                        const runsA =
                          document.getElementById(
                            `runs-a-${match.id}`
                          )?.value || "";

                        const wicketsA =
                          document.getElementById(
                            `wickets-a-${match.id}`
                          )?.value || "";

                        const oversA =
                          document.getElementById(
                            `overs-a-${match.id}`
                          )?.value || "";

                        const runsB =
                          document.getElementById(
                            `runs-b-${match.id}`
                          )?.value || "";

                        const wicketsB =
                          document.getElementById(
                            `wickets-b-${match.id}`
                          )?.value || "";

                        const oversB =
                          document.getElementById(
                            `overs-b-${match.id}`
                          )?.value || "";

                        let winner = null;

                        if (
                          runsA !== "" &&
                          runsB !== ""
                        ) {
                          if (
                            Number(runsA) >
                            Number(runsB)
                          ) {
                            winner =
                              match.club_a_id;
                          } else if (
                            Number(runsB) >
                            Number(runsA)
                          ) {
                            winner =
                              match.club_b_id;
                          }
                        }

                        updateMatch(match.id, {
                          runs_a:
                            runsA === ""
                              ? null
                              : Number(runsA),

                          wickets_a:
                            wicketsA === ""
                              ? null
                              : Number(wicketsA),

                          overs_a:
                            oversA === ""
                              ? null
                              : Number(oversA),

                          runs_b:
                            runsB === ""
                              ? null
                              : Number(runsB),

                          wickets_b:
                            wicketsB === ""
                              ? null
                              : Number(wicketsB),

                          overs_b:
                            oversB === ""
                              ? null
                              : Number(oversB),

                          score_a:
                            runsA === ""
                              ? null
                              : `${runsA}/${wicketsA || 0}`,

                          score_b:
                            runsB === ""
                              ? null
                              : `${runsB}/${wicketsB || 0}`,

                          winner_club_id: winner,
                        });
                      } else {
                        const scoreA =
                          document.getElementById(
                            `score-a-${match.id}`
                          )?.value || "";

                        const scoreB =
                          document.getElementById(
                            `score-b-${match.id}`
                          )?.value || "";

                        let winner = null;

                        if (
                          scoreA !== "" &&
                          scoreB !== ""
                        ) {
                          const a = Number(scoreA);
                          const b = Number(scoreB);

                          if (
                            Number.isFinite(a) &&
                            Number.isFinite(b)
                          ) {
                            if (a > b) {
                              winner =
                                match.club_a_id;
                            } else if (b > a) {
                              winner =
                                match.club_b_id;
                            }
                          }
                        }

                        updateMatch(match.id, {
                          score_a: scoreA,
                          score_b: scoreB,
                          winner_club_id: winner,
                        });
                      }
                    }}
                  >
                    💾 Save Score
                  </button>

                  <button
                    style={{
                      background: "#b42336",
                      borderColor: "#b42336",
                    }}
                    onClick={() =>
                      deleteMatch(match.id)
                    }
                  >
                    🗑️ Delete Match
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* FINALIZED RESULTS */}

        <div className="card">
          <h2>🏆 Finalized Results</h2>

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
                    : "🥉"}{" "}
                  {result.clubs?.name ||
                    "Unknown Club"}
                </b>

                <small>
                  {result.events?.gender} ·{" "}
                  {result.events?.name} ·{" "}
                  {result.events?.category}{" "}
                  — {result.points} points
                </small>

                <button
                  style={{
                    background: "#b42336",
                    borderColor: "#b42336",
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

        {/* ALL EVENTS */}

        <div className="card">
          <h2>📋 All Events</h2>

          <p className="muted">
            These events are available for matches,
            results and public leaderboards.
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
                <b>{event.name}</b>

                <small>
                  {event.gender} ·{" "}
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
