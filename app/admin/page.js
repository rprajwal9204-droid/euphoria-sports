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
  return String(event?.name || "")
    .trim()
    .toLowerCase() === "cricket";
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

  // ============================================================
  // LOAD DATA
  // ============================================================

  async function load() {
    setLoading(true);

    try {
      const [
        { data: eventData, error: eventError },
        { data: clubData, error: clubError },
        { data: matchData, error: matchError },
        { data: resultData, error: resultError },
      ] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .order("id", { ascending: true }),

        supabase
          .from("clubs")
          .select("id, name")
          .order("id", { ascending: true }),

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
          .order("event_id", { ascending: true })
          .order("position", { ascending: true }),
      ]);

      if (eventError) {
        console.error("EVENTS ERROR:", eventError);
      }

      if (clubError) {
        console.error("CLUBS ERROR:", clubError);

        setMsg(
          "⚠️ Clubs could not be loaded: " +
            clubError.message
        );
      }

      if (matchError) {
        console.error("MATCHES ERROR:", matchError);

        setMsg(
          "⚠️ Matches could not be loaded: " +
            matchError.message
        );
      }

      if (resultError) {
        console.error("RESULTS ERROR:", resultError);
      }

      setEvents(eventData || []);
      setClubs(clubData || []);
      setMatches(matchData || []);
      setResults(resultData || []);

      if (!form.event_id && eventData?.length) {
        setForm((old) => ({
          ...old,
          event_id: String(eventData[0].id),
        }));
      }
    } catch (error) {
      console.error("ADMIN LOAD ERROR:", error);

      setMsg(
        "⚠️ Unable to load admin data: " +
          (error?.message || "Unknown error")
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ============================================================
  // CURRENT EVENT
  // ============================================================

  const selectedEvent = events.find(
    (event) =>
      String(event.id) ===
      String(form.event_id)
  );

  const cricketSelected =
    isCricketEvent(selectedEvent);

  // ============================================================
  // FORM HELPERS
  // ============================================================

  function updateForm(field, value) {
    setForm((old) => ({
      ...old,
      [field]: value,
    }));
  }

  function clearCricketFields() {
    setForm((old) => ({
      ...old,

      runs_a: "",
      wickets_a: "",
      overs_a: "",

      runs_b: "",
      wickets_b: "",
      overs_b: "",
    }));
  }

  // ============================================================
  // ADD SPORT / EVENT
  // ============================================================

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
      console.error("ADD EVENT ERROR:", error);
      setMsg(error.message);
      return;
    }

    setMsg(
      `✅ ${eventForm.gender} ${name} added successfully.`
    );

    setEventForm({
      name: "",
      gender: "Men's",
      category: "Team",
    });

    await load();
  }

  // ============================================================
  // CREATE MATCH
  // ============================================================

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

    if (
      form.club_a_id ===
      form.club_b_id
    ) {
      setMsg(
        "Club A and Club B must be different."
      );
      return;
    }

    // ----------------------------------------------------------
    // CRICKET VALIDATION
    // ----------------------------------------------------------

    if (cricketSelected) {
      if (
        form.runs_a === "" ||
        form.wickets_a === "" ||
        form.overs_a === ""
      ) {
        setMsg(
          "Please enter Club A cricket runs, wickets and overs."
        );
        return;
      }

      if (
        form.runs_b === "" ||
        form.wickets_b === "" ||
        form.overs_b === ""
      ) {
        setMsg(
          "Please enter Club B cricket runs, wickets and overs."
        );
        return;
      }

      const runsA = Number(form.runs_a);
      const wicketsA = Number(form.wickets_a);
      const oversA = Number(form.overs_a);

      const runsB = Number(form.runs_b);
      const wicketsB = Number(form.wickets_b);
      const oversB = Number(form.overs_b);

      if (
        !Number.isFinite(runsA) ||
        !Number.isFinite(wicketsA) ||
        !Number.isFinite(oversA) ||
        !Number.isFinite(runsB) ||
        !Number.isFinite(wicketsB) ||
        !Number.isFinite(oversB)
      ) {
        setMsg(
          "Cricket runs, wickets and overs must be numbers."
        );
        return;
      }

      if (
        runsA < 0 ||
        runsB < 0 ||
        wicketsA < 0 ||
        wicketsB < 0 ||
        oversA <= 0 ||
        oversB <= 0
      ) {
        setMsg(
          "Please enter valid cricket values."
        );
        return;
      }

      if (wicketsA > 10 || wicketsB > 10) {
        setMsg(
          "Cricket wickets cannot be more than 10."
        );
        return;
      }
    }

    // ----------------------------------------------------------
    // INSERT
    // ----------------------------------------------------------

    const payload = {
      event_id: Number(form.event_id),

      club_a_id: Number(form.club_a_id),
      club_b_id: Number(form.club_b_id),

      score_a: cricketSelected
        ? `${form.runs_a}/${form.wickets_a}`
        : form.score_a || null,

      score_b: cricketSelected
        ? `${form.runs_b}/${form.wickets_b}`
        : form.score_b || null,

      status: form.status,

      runs_a: cricketSelected
        ? Number(form.runs_a)
        : null,

      wickets_a: cricketSelected
        ? Number(form.wickets_a)
        : null,

      overs_a: cricketSelected
        ? Number(form.overs_a)
        : null,

      runs_b: cricketSelected
        ? Number(form.runs_b)
        : null,

      wickets_b: cricketSelected
        ? Number(form.wickets_b)
        : null,

      overs_b: cricketSelected
        ? Number(form.overs_b)
        : null,
    };

    const { error } = await supabase
      .from("matches")
      .insert(payload);

    if (error) {
      console.error("ADD MATCH ERROR:", error);
      setMsg(error.message);
      return;
    }

    setMsg(
      cricketSelected
        ? "🏏 Cricket match created successfully."
        : "✅ Match created successfully."
    );

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

  // ============================================================
  // UPDATE MATCH
  // ============================================================

  async function updateMatch(id, patch) {
    setMsg("");

    const { error } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", id);

    if (error) {
      console.error("UPDATE MATCH ERROR:", error);
      setMsg(error.message);
      return;
    }

    setMsg("✅ Match updated.");

    await load();
  }

  // ============================================================
  // UPDATE CRICKET MATCH
  // ============================================================

  async function updateCricketMatch(
    match,
    runsA,
    wicketsA,
    oversA,
    runsB,
    wicketsB,
    oversB
  ) {
    setMsg("");

    const rA = Number(runsA);
    const wA = Number(wicketsA);
    const oA = Number(oversA);

    const rB = Number(runsB);
    const wB = Number(wicketsB);
    const oB = Number(oversB);

    if (
      !Number.isFinite(rA) ||
      !Number.isFinite(wA) ||
      !Number.isFinite(oA) ||
      !Number.isFinite(rB) ||
      !Number.isFinite(wB) ||
      !Number.isFinite(oB)
    ) {
      setMsg(
        "Please enter valid cricket values."
      );
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        runs_a: rA,
        wickets_a: wA,
        overs_a: oA,

        runs_b: rB,
        wickets_b: wB,
        overs_b: oB,

        score_a: `${rA}/${wA}`,
        score_b: `${rB}/${wB}`,
      })
      .eq("id", match.id);

    if (error) {
      console.error(
        "UPDATE CRICKET ERROR:",
        error
      );

      setMsg(error.message);
      return;
    }

    setMsg(
      "🏏 Cricket score updated."
    );

    await load();
  }

  // ============================================================
  // DELETE MATCH
  // ============================================================

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
      console.error("DELETE MATCH ERROR:", error);
      setMsg(error.message);
      return;
    }

    setMsg("🗑️ Match deleted.");

    await load();
  }

  // ============================================================
  // FINALIZE RESULT
  // ============================================================

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
      resultForm.third,
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
        points: getPoints(
          event.category,
          1
        ),
      },

      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.second),
        position: 2,
        points: getPoints(
          event.category,
          2
        ),
      },

      {
        event_id: Number(resultForm.event_id),
        club_id: Number(resultForm.third),
        position: 3,
        points: getPoints(
          event.category,
          3
        ),
      },
    ];

    const { error } = await supabase
      .from("event_results")
      .upsert(rows, {
        onConflict:
          "event_id,position",
      });

    if (error) {
      console.error(
        "FINALIZE RESULT ERROR:",
        error
      );

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
      third: "",
    });

    await load();
  }

  // ============================================================
  // DELETE RESULT
  // ============================================================

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
      console.error(
        "DELETE RESULT ERROR:",
        error
      );

      setMsg(error.message);
      return;
    }

    setMsg("🗑️ Result deleted.");

    await load();
  }

  // ============================================================
  // CLUB DROPDOWN
  // ============================================================

  function ClubOptions() {
    if (clubs.length === 0) {
      return (
        <option value="">
          No clubs available
        </option>
      );
    }

    return (
      <>
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
      </>
    );
  }

  // ============================================================
  // EVENT DROPDOWN
  // ============================================================

  function EventOptions() {
    return (
      <>
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
      </>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

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

        {/* ====================================================
            ADD SPORT
        ==================================================== */}

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
                    category: e.target.value,
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

        {/* ====================================================
            CLUBS
        ==================================================== */}

        <div className="card">
          <h2>🏟️ Clubs</h2>

          {loading ? (
            <p className="muted">
              Loading clubs...
            </p>
          ) : clubs.length === 0 ? (
            <p>
              ⚠️ No clubs were received from
              Supabase.
            </p>
          ) : (
            <>
              <p className="muted">
                {clubs.length} clubs loaded
                successfully.
              </p>

              <div className="pills">
                {clubs.map((club) => (
                  <span key={club.id}>
                    {club.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ====================================================
            CREATE MATCH
        ==================================================== */}

        <div className="card">
          <h1>Admin Dashboard</h1>

          <p className="muted">
            Create matches and update live scores.
          </p>

          <form onSubmit={addMatch}>

            {/* EVENT */}

            <label>
              Event

              <select
                value={form.event_id}
                onChange={(e) => {
                  const value =
                    e.target.value;

                  const event =
                    events.find(
                      (item) =>
                        String(item.id) ===
                        String(value)
                    );

                  setForm((old) => ({
                    ...old,
                    event_id: value,

                    // Clear cricket values
                    // whenever event changes.
                    runs_a: "",
                    wickets_a: "",
                    overs_a: "",

                    runs_b: "",
                    wickets_b: "",
                    overs_b: "",

                    score_a: "",
                    score_b: "",
                  }));

                  console.log(
                    "Selected event:",
                    event
                  );
                }}
              >
                <EventOptions />
              </select>
            </label>

            {/* CLUB A */}

            <label>
              Club A

              <select
                value={form.club_a_id}
                onChange={(e) =>
                  updateForm(
                    "club_a_id",
                    e.target.value
                  )
                }
              >
                <ClubOptions />
              </select>
            </label>

            {/* CLUB B */}

            <label>
              Club B

              <select
                value={form.club_b_id}
                onChange={(e) =>
                  updateForm(
                    "club_b_id",
                    e.target.value
                  )
                }
              >
                <ClubOptions />
              </select>
            </label>

            {/* =================================================
                CRICKET INPUT
            ================================================= */}

            {cricketSelected ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  border:
                    "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                }}
              >
                <h3>
                  🏏 Cricket Score
                </h3>

                <p className="muted">
                  Enter the actual runs and overs
                  faced by each team. These values
                  are used later for NRR.
                </p>

                {/* CLUB A */}

                <div
                  style={{
                    marginTop: "16px",
                  }}
                >
                  <h4>
                    {clubs.find(
                      (club) =>
                        String(club.id) ===
                        String(form.club_a_id)
                    )?.name ||
                      "Club A"}
                  </h4>

                  <div className="two">

                    <label>
                      Runs

                      <input
                        type="number"
                        min="0"
                        value={form.runs_a}
                        placeholder="185"
                        onChange={(e) =>
                          updateForm(
                            "runs_a",
                            e.target.value
                          )
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
                        placeholder="6"
                        onChange={(e) =>
                          updateForm(
                            "wickets_a",
                            e.target.value
                          )
                        }
                      />
                    </label>

                  </div>

                  <label>
                    Overs Faced

                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.overs_a}
                      placeholder="20"
                      onChange={(e) =>
                        updateForm(
                          "overs_a",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                {/* CLUB B */}

                <div
                  style={{
                    marginTop: "20px",
                  }}
                >
                  <h4>
                    {clubs.find(
                      (club) =>
                        String(club.id) ===
                        String(form.club_b_id)
                    )?.name ||
                      "Club B"}
                  </h4>

                  <div className="two">

                    <label>
                      Runs

                      <input
                        type="number"
                        min="0"
                        value={form.runs_b}
                        placeholder="172"
                        onChange={(e) =>
                          updateForm(
                            "runs_b",
                            e.target.value
                          )
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
                        placeholder="8"
                        onChange={(e) =>
                          updateForm(
                            "wickets_b",
                            e.target.value
                          )
                        }
                      />
                    </label>

                  </div>

                  <label>
                    Overs Faced

                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.overs_b}
                      placeholder="20"
                      onChange={(e) =>
                        updateForm(
                          "overs_b",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* =================================================
                 NORMAL SPORT SCORE
              ================================================= */

              <div className="two">

                <label>
                  Score A

                  <input
                    value={form.score_a}
                    placeholder="Score"
                    onChange={(e) =>
                      updateForm(
                        "score_a",
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Score B

                  <input
                    value={form.score_b}
                    placeholder="Score"
                    onChange={(e) =>
                      updateForm(
                        "score_b",
                        e.target.value
                      )
                    }
                  />
                </label>

              </div>
            )}

            {/* STATUS */}

            <label>
              Status

              <select
                value={form.status}
                onChange={(e) =>
                  updateForm(
                    "status",
                    e.target.value
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
            </label>

            <button type="submit">
              {cricketSelected
                ? "🏏 Create Cricket Match"
                : "Create Match"}
            </button>
          </form>
        </div>

        {/* ====================================================
            MESSAGE
        ==================================================== */}

        {msg && (
          <div className="card">
            <p>{msg}</p>
          </div>
        )}

        {/* ====================================================
            FINALIZE RESULT
        ==================================================== */}

        <div className="card">
          <h2>
            🏆 Finalize Event Result
          </h2>

          <p className="muted">
            Select the final 1st, 2nd and 3rd
            place clubs.
          </p>

          <form onSubmit={finalizeResult}>

            <label>
              Event

              <select
                value={resultForm.event_id}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    event_id:
                      e.target.value,
                  })
                }
              >
                <EventOptions />
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
                <ClubOptions />
              </select>
            </label>

            <label>
              🥈 2nd Place

              <select
                value={resultForm.second}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    second:
                      e.target.value,
                  })
                }
              >
                <ClubOptions />
              </select>
            </label>

            <label>
              🥉 3rd Place

              <select
                value={resultForm.third}
                onChange={(e) =>
                  setResultForm({
                    ...resultForm,
                    third:
                      e.target.value,
                  })
                }
              >
                <ClubOptions />
              </select>
            </label>

            <button type="submit">
              Finalize Result & Award Points
            </button>
          </form>
        </div>

        {/* ====================================================
            EXISTING MATCHES
        ==================================================== */}

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
            matches.map((match) => {

              const matchIsCricket =
                isCricketEvent(
                  match.events
                );

              return (
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

                  {/* CRICKET EDITOR */}

                  {matchIsCricket ? (
                    <>
                      <div
                        style={{
                          marginTop: "12px",
                        }}
                      >
                        <b>
                          🏏 Cricket Score
                        </b>
                      </div>

                      <div className="two">

                        <label>
                          {match.club_a?.name ||
                            "Club A"}

                          <input
                            type="number"
                            defaultValue={
                              match.runs_a ??
                              ""
                            }
                            id={`runs-a-${match.id}`}
                          />

                          <small>
                            Runs
                          </small>
                        </label>

                        <label>
                          Wickets

                          <input
                            type="number"
                            min="0"
                            max="10"
                            defaultValue={
                              match.wickets_a ??
                              ""
                            }
                            id={`wickets-a-${match.id}`}
                          />
                        </label>

                      </div>

                      <label>
                        Overs

                        <input
                          type="number"
                          step="0.1"
                          defaultValue={
                            match.overs_a ??
                            ""
                          }
                          id={`overs-a-${match.id}`}
                        />
                      </label>

                      <div className="two">

                        <label>
                          {match.club_b?.name ||
                            "Club B"}

                          <input
                            type="number"
                            defaultValue={
                              match.runs_b ??
                              ""
                            }
                            id={`runs-b-${match.id}`}
                          />

                          <small>
                            Runs
                          </small>
                        </label>

                        <label>
                          Wickets

                          <input
                            type="number"
                            min="0"
                            max="10"
                            defaultValue={
                              match.wickets_b ??
                              ""
                            }
                            id={`wickets-b-${match.id}`}
                          />
                        </label>

                      </div>

                      <label>
                        Overs

                        <input
                          type="number"
                          step="0.1"
                          defaultValue={
                            match.overs_b ??
                            ""
                          }
                          id={`overs-b-${match.id}`}
                        />
                      </label>

                      <button
                        onClick={() => {

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

                          updateCricketMatch(
                            match,
                            runsA,
                            wicketsA,
                            oversA,
                            runsB,
                            wicketsB,
                            oversB
                          );
                        }}
                      >
                        🏏 Save Cricket Score
                      </button>
                    </>
                  ) : (
                    <>
                      {/* NORMAL SPORT */}

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
                              score_a:
                                scoreA,
                              score_b:
                                scoreB,
                            }
                          );
                        }}
                      >
                        Save Score
                      </button>
                    </>
                  )}

                  {/* STATUS */}

                  <select
                    defaultValue={
                      match.status
                    }
                    onChange={(e) =>
                      updateMatch(
                        match.id,
                        {
                          status:
                            e.target.value,
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

                  {/* DELETE */}

                  <button
                    style={{
                      background: "#b42336",
                      borderColor: "#b42336",
                    }}
                    onClick={() =>
                      deleteMatch(
                        match.id
                      )
                    }
                  >
                    🗑️ Delete Match
                  </button>

                </div>
              );
            })
          )}
        </div>

        {/* ====================================================
            FINALIZED RESULTS
        ==================================================== */}

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
                    borderColor: "#b42336",
                  }}
                  onClick={() =>
                    deleteResult(
                      result.id
                    )
                  }
                >
                  🗑️ Delete Result
                </button>

              </div>
            ))
          )}
        </div>

        {/* ====================================================
            ALL EVENTS
        ==================================================== */}

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
