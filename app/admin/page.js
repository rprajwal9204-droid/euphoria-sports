"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/* =========================================================
   HELPERS
========================================================= */

function isCricketEvent(event) {
  if (!event) return false;

  const name = String(event.name || "").trim().toLowerCase();
  const category = String(event.category || "").trim().toLowerCase();
  const pointsType = String(event.points_type || "").trim().toLowerCase();

  return (
    name === "cricket" &&
    (category.includes("team") || pointsType.includes("team"))
  );
}

function isDoublesEvent(event) {
  if (!event) return false;

  const category = String(event.category || "")
    .trim()
    .toLowerCase();

  return category.includes("double");
}

function isCricketMatch(match, events) {
  const event = events.find(
    (e) => Number(e.id) === Number(match.event_id)
  );

  return isCricketEvent(event);
}

function oversToBalls(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text) return null;

  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const parts = text.split(".");

  const overs = Number(parts[0]);
  const balls = parts[1] ? Number(parts[1]) : 0;

  if (!Number.isInteger(overs)) return null;
  if (!Number.isInteger(balls)) return null;
  if (balls < 0 || balls > 5) return null;

  return overs * 6 + balls;
}

function validCricketOvers(value) {
  return oversToBalls(value) !== null;
}

function displayCricketScore(runs, wickets, overs) {
  if (runs === null || runs === undefined || runs === "") {
    return "";
  }

  const r = Number(runs);

  if (!Number.isFinite(r)) return "";

  const w =
    wickets === null ||
    wickets === undefined ||
    wickets === ""
      ? ""
      : `/${wickets}`;

  const o =
    overs === null ||
    overs === undefined ||
    overs === ""
      ? ""
      : ` (${overs} ov)`;

  return `${r}${w}${o}`;
}

/* =========================================================
   MAIN
========================================================= */

export default function Admin() {
  /* =======================================================
     AUTH
  ======================================================= */

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  /* =======================================================
     ADMIN USERS
  ======================================================= */

  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  /* =======================================================
     DATA
  ======================================================= */

  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  /* =======================================================
     MATCH FORM
  ======================================================= */

  const [form, setForm] = useState({
    event_id: "",
    club_a_id: "",
    club_b_id: "",

    score_a: "",
    score_b: "",

    player_a1: "",
    player_a2: "",
    player_b1: "",
    player_b2: "",

    status: "Upcoming",

    batting_first_club_id: "",

    innings_a_runs: "",
    innings_a_wickets: "",
    innings_a_overs: "",

    innings_b_runs: "",
    innings_b_wickets: "",
    innings_b_overs: "",

    allotted_overs: "",
  });

  /* =======================================================
     RESULT FORM
  ======================================================= */

  const [resultForm, setResultForm] = useState({
    event_id: "",
    first: "",
    second: "",
    third: "",
  });

  /* =======================================================
     EVENT FORM
  ======================================================= */

  const [eventForm, setEventForm] = useState({
    name: "",
    gender: "Men's",
    category: "Team",
  });

  /* =======================================================
     CHECK AUTH
  ======================================================= */

  async function checkAdmin() {
    setAuthChecking(true);

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      setUser(null);
      setIsAdmin(false);
      setAdminUsers([]);
      setAuthChecking(false);
      return;
    }

    setUser(currentUser);

    const { data, error } = await supabase
      .from("admin_users")
      .select("id,email,created_at")
      .ilike("email", currentUser.email);

    if (error || !data || data.length === 0) {
      setUser(null);
      setIsAdmin(false);
      setAdminUsers([]);
      setAuthChecking(false);
      return;
    }

    setIsAdmin(true);
    setAdminUsers(data);
    setAuthChecking(false);
  }

  /* =======================================================
     AUTH LISTENER
  ======================================================= */

  useEffect(() => {
    checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await checkAdmin();
        } else {
          setUser(null);
          setIsAdmin(false);
          setAdminUsers([]);
          setAuthChecking(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function load() {
    setLoading(true);

    const [
      { data: eventData, error: eventError },
      { data: clubData, error: clubError },
      { data: matchData, error: matchError },
      { data: resultData, error: resultError },
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
          winner_club_id,

          batting_first_club_id,

          innings1_runs,
          innings1_wickets,
          innings1_overs,

          innings2_runs,
          innings2_wickets,
          innings2_overs,

          runs_a,
          wickets_a,
          overs_a,

          runs_b,
          wickets_b,
          overs_b,

          allotted_overs,

          innings_a_runs,
          innings_a_overs,

          innings_b_runs,
          innings_b_overs,

          events(
            id,
            name,
            gender,
            category,
            points_type
          ),

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

          events(
            name,
            gender,
            category
          ),

          clubs(name)
        `)
        .order("event_id")
        .order("position"),
    ]);

    if (eventError) {
      console.error("Events error:", eventError);
      setMsg(`Events error: ${eventError.message}`);
    }

    if (clubError) {
      console.error("Clubs error:", clubError);
      setMsg(`Clubs error: ${clubError.message}`);
    }

    if (matchError) {
      console.error("Matches error:", matchError);
      setMsg(`Matches error: ${matchError.message}`);
    }

    if (resultError) {
      console.error("Results error:", resultError);
      setMsg(`Results error: ${resultError.message}`);
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

    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

  /* =======================================================
     CURRENT EVENT
  ======================================================= */

  const selectedEvent = events.find(
    (event) =>
      String(event.id) === String(form.event_id)
  );

  const cricketSelected =
    isCricketEvent(selectedEvent);

  const doublesSelected =
    isDoublesEvent(selectedEvent);

  /* =======================================================
     LOGIN
  ======================================================= */

  async function login(e) {
    e.preventDefault();

    setLoginLoading(true);
    setLoginMsg("");
    setMsg("");

    const email = loginEmail.trim().toLowerCase();

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });

    if (error) {
      setLoginMsg(error.message);
      setLoginLoading(false);
      return;
    }

    setLoginEmail("");
    setLoginPassword("");
    setLoginLoading(false);

    await checkAdmin();
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setIsAdmin(false);
    setAdminUsers([]);
  }

  /* =======================================================
     ADMIN USERS
  ======================================================= */

  async function loadAdminUsers() {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id,email,created_at")
      .order("created_at");

    if (error) {
      setMsg(error.message);
      return;
    }

    setAdminUsers(data || []);
  }

  async function addAdminUser(e) {
    e.preventDefault();

    setMsg("");

    const email = newAdminEmail.trim().toLowerCase();

    if (!email) {
      setMsg("Please enter an email address.");
      return;
    }

    if (!email.includes("@")) {
      setMsg("Please enter a valid email address.");
      return;
    }

    const { error } = await supabase
      .from("admin_users")
      .insert({ email });

    if (error) {
      if (error.code === "23505") {
        setMsg("That email already has admin access.");
      } else {
        setMsg(error.message);
      }

      return;
    }

    setNewAdminEmail("");
    setMsg(`✅ Admin access granted to ${email}`);

    await loadAdminUsers();
  }

  async function removeAdminUser(id, email) {
    if (
      email.toLowerCase() ===
      user?.email?.toLowerCase()
    ) {
      setMsg("You cannot remove your own admin access.");
      return;
    }

    const ok = window.confirm(
      `Remove admin access from ${email}?`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(`🗑️ Admin access removed from ${email}`);

    await loadAdminUsers();
  }

  /* =======================================================
     ADD EVENT
  ======================================================= */

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

  /* =======================================================
     CREATE MATCH
  ======================================================= */

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

    /* =====================================================
       CRICKET
    ===================================================== */

    if (cricketSelected) {
      if (!form.batting_first_club_id) {
        setMsg("Please select which club batted first.");
        return;
      }

      if (
        form.batting_first_club_id !== form.club_a_id &&
        form.batting_first_club_id !== form.club_b_id
      ) {
        setMsg("Invalid batting-first club.");
        return;
      }

      if (
        form.innings_a_runs === "" ||
        form.innings_b_runs === ""
      ) {
        setMsg("Please enter runs for both innings.");
        return;
      }

      if (
        form.innings_a_overs === "" ||
        form.innings_b_overs === ""
      ) {
        setMsg("Please enter overs for both innings.");
        return;
      }

      if (!validCricketOvers(form.innings_a_overs)) {
        setMsg("Invalid Club A overs. Example: 20 or 19.3");
        return;
      }

      if (!validCricketOvers(form.innings_b_overs)) {
        setMsg("Invalid Club B overs. Example: 20 or 19.3");
        return;
      }

      if (
        form.allotted_overs !== "" &&
        !validCricketOvers(form.allotted_overs)
      ) {
        setMsg("Invalid allotted overs. Example: 20");
        return;
      }

      const runsA = Number(form.innings_a_runs);
      const runsB = Number(form.innings_b_runs);

      let winner = null;

      if (form.status === "Final") {
        if (runsA > runsB) {
          winner = Number(form.club_a_id);
        } else if (runsB > runsA) {
          winner = Number(form.club_b_id);
        }
      }

      const scoreA = displayCricketScore(
        form.innings_a_runs,
        form.innings_a_wickets,
        form.innings_a_overs
      );

      const scoreB = displayCricketScore(
        form.innings_b_runs,
        form.innings_b_wickets,
        form.innings_b_overs
      );

      const { error } = await supabase
        .from("matches")
        .insert({
          event_id: Number(form.event_id),
          club_a_id: Number(form.club_a_id),
          club_b_id: Number(form.club_b_id),

          score_a: scoreA,
          score_b: scoreB,

          status: form.status,

          winner_club_id: winner,

          batting_first_club_id:
            Number(form.batting_first_club_id),

          innings_a_runs:
            Number(form.innings_a_runs),

          innings_a_overs:
            form.innings_a_overs,

          innings_b_runs:
            Number(form.innings_b_runs),

          innings_b_overs:
            form.innings_b_overs,

          allotted_overs:
            form.allotted_overs || null,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("🏏 Cricket match created successfully.");
    }

    /* =====================================================
       DOUBLES / MIXED DOUBLES
    ===================================================== */

    else if (doublesSelected) {
      if (
        !form.player_a1.trim() ||
        !form.player_a2.trim() ||
        !form.player_b1.trim() ||
        !form.player_b2.trim()
      ) {
        setMsg("Please enter all 4 player names.");
        return;
      }

      const playersA =
        `${form.player_a1.trim()} + ${form.player_a2.trim()}`;

      const playersB =
        `${form.player_b1.trim()} + ${form.player_b2.trim()}`;

      const { error } = await supabase
        .from("matches")
        .insert({
          event_id: Number(form.event_id),

          club_a_id: Number(form.club_a_id),

          club_b_id: Number(form.club_b_id),

          score_a: playersA,

          score_b: playersB,

          status: form.status,

          winner_club_id: null,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("👥 Doubles match created successfully.");
    }

    /* =====================================================
       NORMAL EVENT
    ===================================================== */

    else {
      let winner = null;

      if (
        form.status === "Final" &&
        form.score_a !== "" &&
        form.score_b !== ""
      ) {
        const a = Number(form.score_a);
        const b = Number(form.score_b);

        if (
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

      const { error } = await supabase
        .from("matches")
        .insert({
          event_id: Number(form.event_id),

          club_a_id: Number(form.club_a_id),

          club_b_id: Number(form.club_b_id),

          score_a: form.score_a || null,

          score_b: form.score_b || null,

          status: form.status,

          winner_club_id: winner,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("✅ Match created successfully.");
    }

    setForm((old) => ({
      ...old,

      club_a_id: "",
      club_b_id: "",

      score_a: "",
      score_b: "",

      player_a1: "",
      player_a2: "",
      player_b1: "",
      player_b2: "",

      batting_first_club_id: "",

      innings_a_runs: "",
      innings_a_wickets: "",
      innings_a_overs: "",

      innings_b_runs: "",
      innings_b_wickets: "",
      innings_b_overs: "",

      allotted_overs: "",
    }));

    await load();
  }

  /* =======================================================
     UPDATE MATCH
  ======================================================= */

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

  /* =======================================================
     SAVE CRICKET MATCH
  ======================================================= */

  async function saveCricketMatch(match) {
    setMsg("");

    const runsA =
      document.getElementById(
        `cricket-runs-a-${match.id}`
      )?.value;

    const wicketsA =
      document.getElementById(
        `cricket-wickets-a-${match.id}`
      )?.value;

    const oversA =
      document.getElementById(
        `cricket-overs-a-${match.id}`
      )?.value;

    const runsB =
      document.getElementById(
        `cricket-runs-b-${match.id}`
      )?.value;

    const wicketsB =
      document.getElementById(
        `cricket-wickets-b-${match.id}`
      )?.value;

    const oversB =
      document.getElementById(
        `cricket-overs-b-${match.id}`
      )?.value;

    const allotted =
      document.getElementById(
        `cricket-allotted-${match.id}`
      )?.value;

    const battingFirst =
      document.getElementById(
        `cricket-batting-first-${match.id}`
      )?.value;

    const status =
      document.getElementById(
        `status-${match.id}`
      )?.value;

    if (!battingFirst) {
      setMsg("Please select who batted first.");
      return;
    }

    if (
      runsA === "" ||
      runsB === "" ||
      oversA === "" ||
      oversB === ""
    ) {
      setMsg(
        "Please enter runs and overs for both clubs."
      );
      return;
    }

    if (!validCricketOvers(oversA)) {
      setMsg("Invalid Club A overs.");
      return;
    }

    if (!validCricketOvers(oversB)) {
      setMsg("Invalid Club B overs.");
      return;
    }

    let winner = null;

    if (status === "Final") {
      if (Number(runsA) > Number(runsB)) {
        winner = Number(match.club_a_id);
      } else if (Number(runsB) > Number(runsA)) {
        winner = Number(match.club_b_id);
      }
    }

    const scoreA = displayCricketScore(
      runsA,
      wicketsA,
      oversA
    );

    const scoreB = displayCricketScore(
      runsB,
      wicketsB,
      oversB
    );

    const { error } = await supabase
      .from("matches")
      .update({
        score_a: scoreA,
        score_b: scoreB,

        status,

        winner_club_id: winner,

        batting_first_club_id:
          Number(battingFirst),

        innings_a_runs:
          Number(runsA),

        innings_a_overs:
          oversA,

        innings_b_runs:
          Number(runsB),

        innings_b_overs:
          oversB,

        allotted_overs:
          allotted || null,
      })
      .eq("id", match.id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("🏏 Cricket match updated.");

    await load();
  }

  /* =======================================================
     SAVE DOUBLES MATCH
  ======================================================= */

  async function saveDoublesMatch(match) {
    setMsg("");

    const playerA1 =
      document.getElementById(
        `doubles-a1-${match.id}`
      )?.value.trim() || "";

    const playerA2 =
      document.getElementById(
        `doubles-a2-${match.id}`
      )?.value.trim() || "";

    const playerB1 =
      document.getElementById(
        `doubles-b1-${match.id}`
      )?.value.trim() || "";

    const playerB2 =
      document.getElementById(
        `doubles-b2-${match.id}`
      )?.value.trim() || "";

    const status =
      document.getElementById(
        `status-${match.id}`
      )?.value || "Upcoming";

    if (
      !playerA1 ||
      !playerA2 ||
      !playerB1 ||
      !playerB2
    ) {
      setMsg("Please enter all 4 player names.");
      return;
    }

    const playersA =
      `${playerA1} + ${playerA2}`;

    const playersB =
      `${playerB1} + ${playerB2}`;

    const { error } = await supabase
      .from("matches")
      .update({
        score_a: playersA,
        score_b: playersB,
        status,
        winner_club_id: null,
      })
      .eq("id", match.id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("👥 Doubles match updated.");

    await load();
  }

  /* =======================================================
     SAVE NORMAL MATCH
  ======================================================= */

  async function saveNormalMatch(match) {
    const scoreA =
      document.getElementById(
        `normal-score-a-${match.id}`
      )?.value || "";

    const scoreB =
      document.getElementById(
        `normal-score-b-${match.id}`
      )?.value || "";

    const status =
      document.getElementById(
        `status-${match.id}`
      )?.value;

    let winner = null;

    if (
      status === "Final" &&
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
          winner = Number(match.club_a_id);
        } else if (b > a) {
          winner = Number(match.club_b_id);
        }
      }
    }

    await updateMatch(match.id, {
      score_a: scoreA,
      score_b: scoreB,
      status,
      winner_club_id: winner,
    });
  }

  /* =======================================================
     DELETE MATCH
  ======================================================= */

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

  /* =======================================================
     POINTS
  ======================================================= */

  function getPoints(category, position) {
    const type = String(category || "").toLowerCase();

    if (type.includes("team")) {
      return position === 1
        ? 25
        : position === 2
        ? 15
        : 7;
    }

    if (
      type.includes("double") ||
      type.includes("mixed")
    ) {
      return position === 1
        ? 15
        : position === 2
        ? 10
        : 7;
    }

    return position === 1
      ? 10
      : position === 2
      ? 7
      : 5;
  }

  /* =======================================================
     FINALIZE RESULT
  ======================================================= */

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

  /* =======================================================
     DELETE RESULT
  ======================================================= */

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

  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (authChecking) {
    return (
      <main>
        <section className="wrap admin">
          <div className="card">
            <h2>🔐 Checking admin access...</h2>
            <p className="muted">
              Please wait.
            </p>
          </div>
        </section>
      </main>
    );
  }

  /* =======================================================
     LOGIN SCREEN
  ======================================================= */

  if (!user || !isAdmin) {
    return (
      <main>
        <section className="wrap admin">
          <div className="card">
            <h1>🔐 EUPHORIA ADMIN</h1>

            <p className="muted">
              Sign in with an authorized
              administrator account.
            </p>

            <form onSubmit={login}>
              <label>
                Email

                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) =>
                    setLoginEmail(e.target.value)
                  }
                  placeholder="Enter your email"
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) =>
                    setLoginPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  required
                />
              </label>

              {loginMsg && (
                <p
                  style={{
                    color: "#ff6b6b",
                    marginTop: "10px",
                  }}
                >
                  ❌ {loginMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={loginLoading}
              >
                {loginLoading
                  ? "Signing in..."
                  : "🔐 Sign In"}
              </button>
            </form>

            <br />

            <a href="/">
              ← Back to Public Site
            </a>
          </div>
        </section>
      </main>
    );
  }

  /* =======================================================
     ADMIN DASHBOARD
  ======================================================= */

  return (
    <main>
      <header>
        <div className="logo">
          EUPHORIA <span>ADMIN</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <a href="/">PUBLIC SITE</a>

          <button onClick={logout}>
            🚪 Logout
          </button>
        </div>
      </header>

      <section className="wrap admin">

        {/* =================================================
            ADMIN ACCESS
        ================================================= */}

        <div className="card">
          <h2>🔐 Admin Access</h2>

          <p className="muted">
            Logged in as:
            <br />
            <b>{user.email}</b>
          </p>

          <p className="muted">
            Give trusted people access to
            the Euphoria admin dashboard
            using their email address.
          </p>

          <form onSubmit={addAdminUser}>
            <label>
              Email Address

              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) =>
                  setNewAdminEmail(e.target.value)
                }
                placeholder="person@example.com"
                required
              />
            </label>

            <button type="submit">
              ➕ Grant Admin Access
            </button>
          </form>

          <h3>Current Admins</h3>

          {adminUsers.length === 0 ? (
            <p className="muted">
              No administrators found.
            </p>
          ) : (
            adminUsers.map((admin) => (
              <div
                className="adminMatch"
                key={admin.id}
              >
                <b>{admin.email}</b>

                <small>
                  {admin.email.toLowerCase() ===
                  user?.email?.toLowerCase()
                    ? "You"
                    : "Administrator"}
                </small>

                {admin.email.toLowerCase() !==
                  user?.email?.toLowerCase() && (
                  <button
                    style={{
                      background: "#b42336",
                      borderColor: "#b42336",
                    }}
                    onClick={() =>
                      removeAdminUser(
                        admin.id,
                        admin.email
                      )
                    }
                  >
                    🗑️ Remove Access
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* =================================================
            ADD EVENT
        ================================================= */}

        <div className="card">
          <h2>➕ Add Sport / Event</h2>

          <p className="muted">
            Add a new sport whenever required.
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

        {/* =================================================
            CREATE MATCH
        ================================================= */}

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
                    batting_first_club_id: "",
                    player_a1: "",
                    player_a2: "",
                    player_b1: "",
                    player_b2: "",
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

            {/* =============================================
                CRICKET
            ============================================= */}

            {cricketSelected ? (
              <div
                style={{
                  marginTop: "20px",
                  padding: "18px",
                  border:
                    "1px solid rgba(255,255,255,.15)",
                  borderRadius: "12px",
                }}
              >
                <h3>🏏 Cricket Match Details</h3>

                <label>
                  Who batted first?

                  <select
                    value={form.batting_first_club_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        batting_first_club_id:
                          e.target.value,
                      })
                    }
                  >
                    <option value="">
                      Select batting-first club
                    </option>

                    {form.club_a_id && (
                      <option
                        value={form.club_a_id}
                      >
                        {clubs.find(
                          (c) =>
                            String(c.id) ===
                            String(form.club_a_id)
                        )?.name || "Club A"}
                      </option>
                    )}

                    {form.club_b_id && (
                      <option
                        value={form.club_b_id}
                      >
                        {clubs.find(
                          (c) =>
                            String(c.id) ===
                            String(form.club_b_id)
                        )?.name || "Club B"}
                      </option>
                    )}
                  </select>
                </label>

                <label>
                  Allotted Overs

                  <input
                    type="text"
                    placeholder="Example: 20"
                    value={form.allotted_overs}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allotted_overs:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <h4>Club A Innings</h4>

                <label>
                  Runs

                  <input
                    type="number"
                    min="0"
                    value={form.innings_a_runs}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_a_runs:
                          e.target.value,
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
                    value={form.innings_a_wickets}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_a_wickets:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Overs

                  <input
                    type="text"
                    placeholder="20 or 19.3"
                    value={form.innings_a_overs}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_a_overs:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <h4>Club B Innings</h4>

                <label>
                  Runs

                  <input
                    type="number"
                    min="0"
                    value={form.innings_b_runs}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_b_runs:
                          e.target.value,
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
                    value={form.innings_b_wickets}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_b_wickets:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Overs

                  <input
                    type="text"
                    placeholder="20 or 19.3"
                    value={form.innings_b_overs}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        innings_b_overs:
                          e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : doublesSelected ? (
              /* =============================================
                 DOUBLES / MIXED DOUBLES
              ============================================= */

              <div
                style={{
                  marginTop: "20px",
                  padding: "18px",
                  border:
                    "1px solid rgba(255,255,255,.15)",
                  borderRadius: "12px",
                }}
              >
                <h3>👥 Doubles Match</h3>

                <h4>
                  {clubs.find(
                    (c) =>
                      String(c.id) ===
                      String(form.club_a_id)
                  )?.name || "Club A"}
                </h4>

                <label>
                  Player 1

                  <input
                    value={form.player_a1}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        player_a1: e.target.value,
                      })
                    }
                    placeholder="Enter Player 1"
                    required
                  />
                </label>

                <label>
                  Player 2

                  <input
                    value={form.player_a2}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        player_a2: e.target.value,
                      })
                    }
                    placeholder="Enter Player 2"
                    required
                  />
                </label>

                <h4>
                  {clubs.find(
                    (c) =>
                      String(c.id) ===
                      String(form.club_b_id)
                  )?.name || "Club B"}
                </h4>

                <label>
                  Player 1

                  <input
                    value={form.player_b1}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        player_b1: e.target.value,
                      })
                    }
                    placeholder="Enter Player 1"
                    required
                  />
                </label>

                <label>
                  Player 2

                  <input
                    value={form.player_b2}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        player_b2: e.target.value,
                      })
                    }
                    placeholder="Enter Player 2"
                    required
                  />
                </label>
              </div>
            ) : (
              /* =============================================
                 NORMAL EVENT
              ============================================= */

              <div className="two">
                <label>
                  Score A

                  <input
                    value={form.score_a}
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
              {cricketSelected
                ? "🏏 Create Cricket Match"
                : doublesSelected
                ? "👥 Create Doubles Match"
                : "Create Match"}
            </button>
          </form>
        </div>

        {/* =================================================
            MESSAGE
        ================================================= */}

        {msg && (
          <div className="card">
            <p>{msg}</p>
          </div>
        )}

        {/* =================================================
            FINALIZE RESULT
        ================================================= */}

        <div className="card">
          <h2>🏆 Finalize Event Result</h2>

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

        {/* =================================================
            EXISTING MATCHES
        ================================================= */}

        <div className="card">
          <h2>Existing Matches</h2>

          {loading ? (
            <p>Loading...</p>
          ) : matches.length === 0 ? (
            <p className="muted">
              No matches yet.
            </p>
          ) : (
            matches.map((match) => {
              const cricket =
                isCricketMatch(match, events);

              const doubles =
                isDoublesEvent(match.events);

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

                  {/* =======================================
                      EXISTING CRICKET
                  ======================================= */}

                  {cricket ? (
                    <>
                      <h4>🏏 Cricket</h4>

                      <label>
                        Batting First

                        <select
                          id={`cricket-batting-first-${match.id}`}
                          defaultValue={
                            match.batting_first_club_id ||
                            ""
                          }
                        >
                          <option value="">
                            Select
                          </option>

                          <option
                            value={match.club_a_id}
                          >
                            {match.club_a?.name}
                          </option>

                          <option
                            value={match.club_b_id}
                          >
                            {match.club_b?.name}
                          </option>
                        </select>
                      </label>

                      <label>
                        Allotted Overs

                        <input
                          id={`cricket-allotted-${match.id}`}
                          defaultValue={
                            match.allotted_overs || ""
                          }
                          placeholder="20"
                        />
                      </label>

                      <h4>
                        {match.club_a?.name}
                      </h4>

                      <label>
                        Runs

                        <input
                          id={`cricket-runs-a-${match.id}`}
                          type="number"
                          min="0"
                          defaultValue={
                            match.innings_a_runs ?? ""
                          }
                        />
                      </label>

                      <label>
                        Wickets

                        <input
                          id={`cricket-wickets-a-${match.id}`}
                          type="number"
                          min="0"
                          max="10"
                          defaultValue={
                            match.innings1_wickets ?? ""
                          }
                        />
                      </label>

                      <label>
                        Overs

                        <input
                          id={`cricket-overs-a-${match.id}`}
                          defaultValue={
                            match.innings_a_overs ?? ""
                          }
                          placeholder="20 or 19.3"
                        />
                      </label>

                      <h4>
                        {match.club_b?.name}
                      </h4>

                      <label>
                        Runs

                        <input
                          id={`cricket-runs-b-${match.id}`}
                          type="number"
                          min="0"
                          defaultValue={
                            match.innings_b_runs ?? ""
                          }
                        />
                      </label>

                      <label>
                        Wickets

                        <input
                          id={`cricket-wickets-b-${match.id}`}
                          type="number"
                          min="0"
                          max="10"
                          defaultValue={
                            match.innings2_wickets ?? ""
                          }
                        />
                      </label>

                      <label>
                        Overs

                        <input
                          id={`cricket-overs-b-${match.id}`}
                          defaultValue={
                            match.innings_b_overs ?? ""
                          }
                          placeholder="20 or 19.3"
                        />
                      </label>
                    </>

                  /* =======================================
                     EXISTING DOUBLES
                  ======================================= */

                  ) : doubles ? (
                    <>
                      <h4>👥 Doubles Players</h4>

                      <h4>
                        {match.club_a?.name}
                      </h4>

                      <label>
                        Player 1

                        <input
                          id={`doubles-a1-${match.id}`}
                          defaultValue={
                            match.score_a
                              ?.split(" + ")[0] || ""
                          }
                          placeholder="Player 1"
                        />
                      </label>

                      <label>
                        Player 2

                        <input
                          id={`doubles-a2-${match.id}`}
                          defaultValue={
                            match.score_a
                              ?.split(" + ")[1] || ""
                          }
                          placeholder="Player 2"
                        />
                      </label>

                      <h4>
                        {match.club_b?.name}
                      </h4>

                      <label>
                        Player 1

                        <input
                          id={`doubles-b1-${match.id}`}
                          defaultValue={
                            match.score_b
                              ?.split(" + ")[0] || ""
                          }
                          placeholder="Player 1"
                        />
                      </label>

                      <label>
                        Player 2

                        <input
                          id={`doubles-b2-${match.id}`}
                          defaultValue={
                            match.score_b
                              ?.split(" + ")[1] || ""
                          }
                          placeholder="Player 2"
                        />
                      </label>
                    </>

                  /* =======================================
                     EXISTING NORMAL MATCH
                  ======================================= */

                  ) : (
                    <div className="two">
                      <input
                        id={`normal-score-a-${match.id}`}
                        defaultValue={
                          match.score_a || ""
                        }
                        placeholder="Score A"
                      />

                      <input
                        id={`normal-score-b-${match.id}`}
                        defaultValue={
                          match.score_b || ""
                        }
                        placeholder="Score B"
                      />
                    </div>
                  )}

                  <select
                    id={`status-${match.id}`}
                    defaultValue={
                      match.status || "Upcoming"
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
                    onClick={() =>
                      cricket
                        ? saveCricketMatch(match)
                        : doubles
                        ? saveDoublesMatch(match)
                        : saveNormalMatch(match)
                    }
                  >
                    💾 Save Match
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

        {/* =================================================
            RESULTS
        ================================================= */}

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

        {/* =================================================
            EVENTS
        ================================================= */}

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
