const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";


const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentClient = null;

function getClientIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("client_id");
}

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = el(id);
  if (element) element.textContent = value || "";
}

async function loadClient() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  currentUser = sessionData.session?.user;

  if (!currentUser) {
    alert("U bent niet ingelogd.");
    window.location.href = "./login.html";
    return;
  }

  const clientId = getClientIdFromUrl();

  if (!clientId) {
    alert("Geen cliënt gekozen.");
    window.location.href = "./new-client.html";
    return;
  }

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", clientId)
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error || !data) {
    alert("Cliënt laden mislukt.");
    window.location.href = "./new-client.html";
    return;
  }

  currentClient = data;

  setText("clientName", data.full_name || "Naam onbekend");
  setText("clientAddress", data.address || "");
  setText("clientPhone", data.phone || "");
}

async function saveAppointment(event) {
  event.preventDefault();

  if (!currentUser || !currentClient) {
    alert("Cliënt of gebruiker ontbreekt.");
    return;
  }

  const appointmentDate = el("appointment_date").value;
  const appointmentTime = el("appointment_time").value;
  const serviceType = el("service_type").value;
  const durationMinutes = Number(el("duration_minutes").value) || null;
  const notes = el("notes").value || "";

  if (!appointmentDate || !appointmentTime || !serviceType || !durationMinutes) {
    alert("Vul datum, tijd, dienst en duur in.");
    return;
  }

  const saveMessage = el("saveMessage");
  if (saveMessage) saveMessage.textContent = "Afspraak opslaan...";

  const { data: existingAppointments, error: checkError } = await supabaseClient
    .from("Appointments")
    .select("id")
    .eq("owner_id", currentUser.id)
    .eq("appointment_date", appointmentDate)
    .eq("appointment_time", appointmentTime)
    .neq("status", "verwijderd");

  if (checkError) {
    if (saveMessage) saveMessage.textContent = "Controle mislukt: " + checkError.message;
    return;
  }

  if (existingAppointments && existingAppointments.length > 0) {
    const proceed = confirm(
      "Er staat al een afspraak op deze datum en tijd.\n\nWilt u deze afspraak toch opslaan?"
    );

    if (!proceed) {
      if (saveMessage) saveMessage.textContent = "";
      return;
    }
  }

  const appointment = {
    owner_id: currentUser.id,
    client_id: currentClient.id,
    client_name: currentClient.full_name || "",
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    service_type: serviceType,
    duration_minutes: durationMinutes,
    notes: notes,
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("Appointments")
    .insert([appointment]);

  if (error) {
    if (saveMessage) saveMessage.textContent = "Opslaan mislukt: " + error.message;
    return;
  }

  alert("Afspraak opgeslagen.");
  window.location.href = "./index.html";
}

function confirmLeave(url) {
  const hasData =
    el("appointment_date")?.value ||
    el("appointment_time")?.value ||
    el("service_type")?.value ||
    el("duration_minutes")?.value ||
    el("notes")?.value;

  if (hasData) {
    const ok = confirm(
      "U heeft gegevens ingevuld maar nog niet opgeslagen.\n\nWilt u deze pagina toch verlaten?"
    );

    if (!ok) return;
  }

  window.location.href = url;
}

window.confirmLeave = confirmLeave;

document.addEventListener("DOMContentLoaded", async () => {
  await loadClient();

  const form = el("appointmentForm");
  if (form) {
    form.addEventListener("submit", saveAppointment);
  }
});