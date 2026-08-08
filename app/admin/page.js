"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const clubs = [
  { name: "Falcons", id: 1 },
  { name: "Eagles", id: 2 },
  { name: "Thunderbirds", id: 3 },
  { name: "Griffins", id: 4 },
  { name: "Phoenix", id: 5 }
];

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
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState("");

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

  async function load() {
    const [
      { data: e, error: eventsError },
      { data: m, error: matchesError },
      { data: r, error: resultsError }
    ] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("id"),

      supabase
        .from("matches")
        .select(
          "id,score_a,score_b,status,events(name),club_a:club_a_id(name),club_b:club_b_id(name)"
        )
        .order("id", { ascending: false }),

      supabase
        .from("event_results")
        .select("id,event_id,club_id,position,points")
        .order("event_id")
        .order("position")
    ]);

    if (eventsError) {
      setMsg("Events error: " + eventsError.message);
    }

    if (matchesError) {
      setMsg("Matches error: " + matchesError.message);
    }

    if (resultsError) {
      setMsg("Results error: " + resultsError.message);
    }

    setEvents(e || []);
    setMatches(m || []);

    /*
      Build event and club maps.

      We already confirmed:
      1 = Falcons
      2 = Eagles
      3 = Thunderbirds
      4 = Griffins
      5 = Phoenix
    */

    const eventMap = {};

    (e || []).forEach((event) => {
      eventMap[event.id] = event;
    });

    const clubMap = {};

    clubs.forEach((club) => {
      clubMap[club.id] = club;
    });

    /*
      Convert raw event_results rows into the format
      expected by the display below.
    */

    const formattedResults = (r || []).map((result) => ({
      ...result,
      events: eventMap[result.event_id] || null,
      clubs: clubMap[result.club_id] || null
    }));

    setResults(formattedResults);

    if (!form.event_id && e?.[0]) {
      setForm((f) => ({
        ...f,
        event_id: e[0].id
      }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMatch(e) {
    e.preventDefault();
    setMsg("");

    if (!form.event_id) {
      setMsg("Please select an event.");
      return;
    }

    if (!form.club_a_id || !form.club_b_id) {
      setMsg("Please select Club A and Club B.");
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
        score_a: form.score_a,
        score_b: form.score_b,
        status: form.status
      });

    setMsg(error ? error.message : "Match created.");

    if (!error) {
      setForm((f) => ({
        ...f,
        score_a: "",
        score_b: ""
      }));

      load();
    }
  }

  async function updateMatch(id, patch) {
    const { error } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", id);

    setMsg(error ? error.message : "Saved.");

    if (!error) {
      load();
    }
  }

  async function finalizeResult(e) {
    e.preventDefault();
    setMsg("");

    if (!resultForm.event_id) {
      setMsg("Please select an event.");
      return;
    }

    if (
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

    const eventId = Number(resultForm.event_id);
    const firstClubId = Number(resultForm.first);
    const secondClubId = Number(resultForm.second);
    const thirdClubId = Number(resultForm.third);

    if (
      !Number.isInteger(eventId) ||
      eventId <= 0 ||
      !Number.isInteger(firstClubId) ||
      firstClubId <= 0 ||
      !Number.isInteger(secondClubId) ||
      secondClubId <= 0 ||
      !Number.isInteger(thirdClubId) ||
      thirdClubId <= 0
    ) {
      setMsg(
        `Invalid selection. Event: ${resultForm.event_id}, ` +
        `1st: ${resultForm.first}, ` +
        `2nd: ${resultForm.second}, ` +
        `3rd: ${resultForm.third}`
      );
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
        event_id: eventId,
        club_id: firstClubId,
        position: 1,
        points: getPoints(event.category, 1)
      },
      {
        event_id: eventId,
        club_id: secondClubId,
        position: 2,
        points: getPoints(event.category, 2)
      },
      {
        event_id: eventId,
        club_id: thirdClubId,
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
      setMsg("Finalize error: " + error.message);
      return;
    }

    setMsg("🏆 Result finalized and points awarded!");

    setResultForm({
      event_id: "",
      first: "",
      second: "",
      third: ""
    });

    load();
  }

  return (
    <main>
      <header>
        <div className="logo">
          EUPHORIA <span>ADMIN</span>
        </div>

        <a href="/">PUBLIC SITE</a>
      </header>

      <section className="wrap admin">

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
                    event_id: e.target.value
                  })
                }
              >
                {events.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.gender} · {x.name} · {x.category}
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
                <option value="">Select</option>

                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
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
                <option value="">Select</option>

                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
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
                <option>Upcoming</option>
                <option>Live</option>
                <option>Final</option>
              </select>
            </label>

            <button type="submit">
              Create Match
            </button>

          </form>
        </div>


        {/* FINALIZE EVENT */}

        <div className="card">

          <h2>🏆 Finalize Event Result</h2>

          <p className="muted">
            Select the final 1st, 2nd and 3rd place clubs.
            Points are automatically calculated.
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

                {events.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.gender} · {x.name} · {x.category}
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
                  <option key={club.id} value={club.id}>
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
                  <option key={club.id} value={club.id}>
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
                  <option key={club.id} value={club.id}>
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


        {msg && (
          <div className="card">
            <p>{msg}</p>
          </div>
        )}


        {/* EXISTING MATCHES */}

        <div className="card">

          <h2>Existing Matches</h2>

          {matches.length === 0 && (
            <p className="muted">
              No matches yet.
            </p>
          )}

          {matches.map((m) => (

            <div className="adminMatch" key={m.id}>

              <b>
                {m.club_a?.name} vs {m.club_b?.name}
              </b>

              <small>
                {m.events?.name}
              </small>

              <div className="two">

                <input
                  defaultValue={m.score_a || ""}
                  id={"a" + m.id}
                />

                <input
                  defaultValue={m.score_b || ""}
                  id={"b" + m.id}
                />

              </div>

              <select
                defaultValue={m.status}
                onChange={(e) =>
                  updateMatch(
                    m.id,
                    {
                      status: e.target.value
                    }
                  )
                }
              >
                <option>Upcoming</option>
                <option>Live</option>
                <option>Final</option>
              </select>

              <button
                onClick={() =>
                  updateMatch(
                    m.id,
                    {
                      score_a:
                        document.getElementById(
                          "a" + m.id
                        ).value,

                      score_b:
                        document.getElementById(
                          "b" + m.id
                        ).value
                    }
                  )
                }
              >
                Save Score
              </button>

            </div>

          ))}

        </div>


        {/* FINALIZED RESULTS */}

        <div className="card">

          <h2>🏆 Finalized Results</h2>

          {results.length === 0 && (
            <p className="muted">
              No finalized results yet.
            </p>
          )}

          {results.map((r) => (

            <div className="adminMatch" key={r.id}>

              <b>
                {r.position === 1
                  ? "🥇"
                  : r.position === 2
                  ? "🥈"
                  : "🥉"}{" "}
                {r.clubs?.name || "Unknown Club"}
              </b>

              <small>
                {r.events?.name || "Unknown Event"} —{" "}
                {r.points} points
              </small>

            </div>

          ))}

        </div>

      </section>
    </main>
  );
          }
