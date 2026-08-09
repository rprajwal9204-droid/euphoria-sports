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

function isCricket(event) {
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
    overs_a: "",
    overs_b: "",
    allotted_overs: "20",
    batting_first_club_id: "",
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
          overs_a,
          overs_b,
          allotted_overs,
          batting_first_club_id,
          status,
          match_time,
          winner_club_id,
          events(id,name,gender,category,points_type),
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
          events(name,gender,category),
          clubs(name)
        `)
        .order("event_id")
        .order("position")
    ]);

    if (eventError) console.error("Events:", eventError);
    if (clubError) console.error("Clubs:", clubError);
    if (matchError) console.error("Matches:", matchError);
    if (resultError) console.error("Results:", resultError);

    if (eventError || clubError || matchError || resultError) {
      setMsg(
        eventError?.message ||
        clubError?.message ||
        matchError?.message ||
        resultError?.message ||
        ""
      );
    }

    setEvents(e || []);
    setClubs(c || []);
    setMatches(m || []);
    setResults(r || []);

    setForm((old) => {
      if (old.event_id) return old;

      const firstEvent = e?.[0];

      return {
        ...old,
        event_id: firstEvent ? String(firstEvent.id) : ""
      };
    });

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
        points_type: eventForm.category
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(`✅ ${eventForm.gender} ${name} added successfully.`);

    setEventForm({
      name: "",
      gender: "Men's",
      category: "Team"
    });

    await load();
  }

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

    const event = events.find(
      (x) => String(x.id) === String(form.event_id)
    );

    const cricket = isCricket(event);

    if (cricket) {
      if (!form.overs_a || !form.overs_b) {
        setMsg("For cricket, enter overs for both innings.");
        return;
      }

      if (!form.allotted_overs) {
        setMsg("Please enter allotted overs.");
        return;
      }

      if (!form.batting_first_club_id) {
        setMsg("Please select which club batted first.");
        return;
      }

      if (
        String(form.batting_first_club_id) !==
          String(form.club_a_id) &&
        String(form.batting_first_club_id) !==
          String(form.club_b_id)
      ) {
        setMsg("Batting first must be Club A or Club B.");
        return;
      }
    }

    const payload = {
      event_id: Number(form.event_id),
      club_a_id: Number(form.club_a_id),
      club_b_id: Number(form.club_b_id),
      score_a: form.score_a || null,
      score_b: form.score_b || null,
      status: form.status
    };

    if (cricket) {
      payload.overs_a = form.overs_a || null;
      payload.overs_b = form.overs_b || null;
      payload.allotted_overs = form.allotted_overs || null;
      payload.batting_first_club_id =
        Number(form.batting_first_club_id);
    }

    const { error } = await supabase
      .from("matches")
      .insert(payload);

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
      overs_a: "",
      overs_b: "",
      allotted_overs: "20",
      batting_first_club_id: ""
    }));

    await load();
  }

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

  async function deleteMatch(id) {
    if (!window.confirm("Delete this match permanently?")) {
      return;
    }

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
      resultForm.third
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

    setMsg("🏆 Result finalized and points awarded!");

    setResultForm({
      event_id: "",
      first: "",
      second: "",
      third: ""
    });

    await load();
  }

  async function deleteResult(id) {
    if (!window.confirm("Delete this finalized result?")) {
      return;
    }

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

  const selectedEvent = events.find(
    (x) => String(x.id) === String(form.event_id)
  );

  const cricketSelected = isCricket(selectedEvent);

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

        {/* ADD EVENT */}

        <div className="card">
          <h2>➕ Add Sport / Event</h2>

          <p className="muted">
            Add a new sport whenever you discover one that is missing.
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
                    category: e.target.value
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
                    club_a_id: "",
                    club_b_id: "",
                    batting_first_club_id: ""
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
                    batting_first_club_id:
                      form.batting_first_club_id ===
                      form.club_b_id
                        ? form.batting_first_club_id
                        : ""
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
                    batting_first_club_id:
                      form.batting_first_club_id ===
                      form.club_a_id
                        ? form.batting_first_club_id
                        : ""
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

            {cricketSelected ? (
              <>
                <div className="two">

                  <label>
                    🏏 Score A

                    <input
                      value={form.score_a}
                      placeholder="185/6"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          score_a: e.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    🏏 Score B

                    <input
                      value={form.score_b}
                      placeholder="172/8"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          score_b: e.target.value
                        })
                      }
                    />
                  </label>

                </div>

                <div className="two">

                  <label>
                    Overs A

                    <input
                      value={form.overs_a}
                      placeholder="20"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overs_a: e.target.value
                        })
                      }
                    />

                    <small>
                      Example: 19.4 = 19 overs + 4 balls
                    </small>
                  </label>

                  <label>
                    Overs B

                    <input
                      value={form.overs_b}
                      placeholder="19.4"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overs_b: e.target.value
                        })
                      }
                    />

                    <small>
                      Example: 19.4 = 19 overs + 4 balls
                    </small>
                  </label>

                </div>

                <label>
                  Allotted Overs

                  <input
                    value={form.allotted_overs}
                    placeholder="20"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allotted_overs: e.target.value
                      })
                    }
                  />

                  <small>
                    Example: 20 for a T20 match
                  </small>
                </label>

                <label>
                  🪙 Batted First

                  <select
                    value={form.batting_first_club_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        batting_first_club_id:
                          e.target.value
                      })
                    }
                  >
                    <option value="">
                      Select batting-first club
                    </option>

                    {form.club_a_id && (
                      <option value={form.club_a_id}>
                        {clubs.find(
                          (c) =>
                            String(c.id) ===
                            String(form.club_a_id)
                        )?.name || "Club A"}
                      </option>
                    )}

                    {form.club_b_id && (
                      <option value={form.club_b_id}>
                        {clubs.find(
                          (c) =>
                            String(c.id) ===
                            String(form.club_b_id)
                        )?.name || "Club B"}
                      </option>
                    )}
                  </select>
                </label>

                <p className="muted">
                  💡 Enter overs exactly as shown on a
                  cricket scorecard. For example,
                  <b> 19.4 </b>
                  means 19 overs and 4 balls.
                </p>
              </>
            ) : (
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
            )}

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
            <p>{msg}</p>
          </div>
        )}

        {/* FINALIZE RESULT */}

        <div className="card">
          <h2>🏆 Finalize Event Result</h2>

          <p className="muted">
            Select the final 1st, 2nd and 3rd place clubs.
            Points are calculated automatically.
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
                    {event.gender} · {event.name} ·{" "}
                    {event.category}
                  </option>
                ))}
              </select>
            </label>

            {[
              ["first", "🥇 1st Place"],
              ["second", "🥈 2nd Place"],
              ["third", "🥉 3rd Place"]
            ].map(([field, label]) => (
              <label key={field}>
                {label}

                <select
                  value={resultForm[field]}
                  onChange={(e) =>
                    setResultForm({
                      ...resultForm,
                      [field]: e.target.value
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
            ))}

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

              const cricket =
                String(
                  match.events?.name || ""
                ).toLowerCase() === "cricket";

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
                    {match.events?.gender}
                    {" · "}
                    {match.events?.name}
                    {" · "}
                    {match.events?.category}
                  </small>

                  {cricket ? (
                    <>
                      <div className="two">

                        <label>
                          Score A

                          <input
                            defaultValue={
                              match.score_a || ""
                            }
                            id={`score-a-${match.id}`}
                          />
                        </label>

                        <label>
                          Overs A

                          <input
                            defaultValue={
                              match.overs_a || ""
                            }
                            id={`overs-a-${match.id}`}
                          />
                        </label>

                      </div>

                      <div className="two">

                        <label>
                          Score B

                          <input
                            defaultValue={
                              match.score_b || ""
                            }
                            id={`score-b-${match.id}`}
                          />
                        </label>

                        <label>
                          Overs B

                          <input
                            defaultValue={
                              match.overs_b || ""
                            }
                            id={`overs-b-${match.id}`}
                          />
                        </label>

                      </div>

                      <label>
                        Allotted Overs

                        <input
                          defaultValue={
                            match.allotted_overs || ""
                          }
                          id={`allotted-${match.id}`}
                        />
                      </label>

                      <label>
                        Batted First

                        <select
                          defaultValue={
                            match.batting_first_club_id ||
                            ""
                          }
                          id={`batting-first-${match.id}`}
                        >
                          <option value="">
                            Select Club
                          </option>

                          <option value={match.club_a_id}>
                            {match.club_a?.name}
                          </option>

                          <option value={match.club_b_id}>
                            {match.club_b?.name}
                          </option>
                        </select>
                      </label>
                    </>
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
                      updateMatch(
                        match.id,
                        {
                          status: e.target.value
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

                      const patch = {
                        score_a: scoreA,
                        score_b: scoreB
                      };

                      if (cricket) {
                        patch.overs_a =
                          document.getElementById(
                            `overs-a-${match.id}`
                          )?.value || "";

                        patch.overs_b =
                          document.getElementById(
                            `overs-b-${match.id}`
                          )?.value || "";

                        patch.allotted_overs =
                          document.getElementById(
                            `allotted-${match.id}`
                          )?.value || "";

                        const battingFirst =
                          document.getElementById(
                            `batting-first-${match.id}`
                          )?.value || "";

                        patch.batting_first_club_id =
                          battingFirst
                            ? Number(battingFirst)
                            : null;
                      }

                      updateMatch(
                        match.id,
                        patch
                      );
                    }}
                  >
                    💾 Save Score
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

        {/* ALL EVENTS */}

        <div className="card">
          <h2>📋 All Events</h2>

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
