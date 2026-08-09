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
    status: "Upcoming",

    batting_first_club_id: "",
    innings1_runs: "",
    innings1_wickets: "",
    innings1_overs: "",
    innings2_runs: "",
    innings2_wickets: "",
    innings2_overs: ""
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
          winner_club_id,
          batting_first_club_id,
          innings1_runs,
          innings1_wickets,
          innings1_overs,
          innings2_runs,
          innings2_wickets,
          innings2_overs,
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
        event_id: String(e[0].id)
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

    if (cricketSelected) {
      if (!form.batting_first_club_id) {
        setMsg("Please select which club batted first.");
        return;
      }

      if (
        form.batting_first_club_id !== form.club_a_id &&
        form.batting_first_club_id !== form.club_b_id
      ) {
        setMsg("Batting first club must be Club A or Club B
