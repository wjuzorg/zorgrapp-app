const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const infoClientName = document.getElementById("infoClientName");
const infoTime = document.getElementById("infoTime");
const infoServiceType = document.getElementById("infoServiceType");

const workDoneEl = document.getElementById("work_done");
const workedMinutesEl = document.getElementById("worked_minutes");
const personStatusEl = document.getElementById("person_status");
const houseStatusEl = document.getElementById("house_status");
const signalNotesEl = document.getElementById("signal_notes");
const paymentTypeEl = document.getElementById("payment_type");

const fillForm = document.getElementById("fillForm");
const deleteAppointmentBtn = document.getElementById("deleteAppointmentBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const saveMessage = document.getElementById("saveMessage");

let AppointmentId = null;
let currentUser = null;

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }

  return data.session.user;
}

function getSelectedSignals() {
  return Array.from(document.querySelectorAll('.checkbox-list input[type="checkbox"]:checked'))
    .map(input => input.value)
    .join(", ");
}

function setSelectedSignals(signalString) {
  if (!signalString) return;

  const selected = signalString.split(",").map(s => s.trim());
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(input => {
    input.checked = selected.includes(input.value);
  });
}

function showMessage(text, isError = false) {
  saveMessage.textContent = text;
  saveMessage.style.color = isError ? "#b91c1c" : "#6b7280";
}

function getAppointmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadAppointment() {
  AppointmentId = getAppointmentIdFromUrl();

  if (!AppointmentId) {
    showMessage("Geen afspraak gevonden.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("id", AppointmentId)
    .eq("owner_id", currentUser.id)
    .single();

  if (error || !data) {
    showMessage(`Afspraak niet gevonden: ${error?.message || "onbekend"}`, true);
    return;
  }

  infoClientName.textContent = data.Client_name || "-";
  infoTime.textContent = data.Appointment_time || "-";
  infoServiceType.textContent = data.service_type || "-";

  workDoneEl.value = data.work_done || "";
  workedMinutesEl.value = data.worked_minutes || "";
  personStatusEl.value = data.person_status || "";
  houseStatusEl.value = data.house_status || "";
  signalNotesEl.value = data.signal_notes || "";
  paymentTypeEl.value = data.payment_type || "";
  setSelectedSignals(data.internal_signals || "");
}

async function saveAppointment(statusValue = "open") {
  if (!AppointmentId) {
    showMessage("Geen afspraak-ID gevonden.", true);
    return false;
  }

  const payload = {
    work_done: workDoneEl.value.trim(),
    worked_minutes: workedMinutesEl.value ? Number(workedMinutesEl.value) : null,
    person_status: personStatusEl.value || null,
    house_status: houseStatusEl.value || null,
    internal_signals: getSelectedSignals(),
    signal_notes: signalNotesEl.value.trim(),
    payment_type: paymentTypeEl.value || null,
    ready_for_invoice: statusValue === "voltooid",
    status: statusValue,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("Appointments")
    .update(payload)
    .eq("id", AppointmentId)
    .eq("owner_id", currentUser.id);

  if (error) {
    showMessage(`Opslaan mislukt: ${error.message}`, true);
    return false;
  }

  return true;
}

fillForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  showMessage("Afronden...");

  const ok = await saveAppointment("voltooid");

  if (!ok) return;

  showMessage("Afspraak afgerond.");
  setTimeout(() => {
    window.location.href = "./index.html";
  }, 800);
});

saveDraftBtn.addEventListener("click", async () => {
  showMessage("Concept opslaan...");

  const ok = await saveAppointment("ingevuld");

  if (!ok) return;

  showMessage("Concept opgeslagen.");
});

deleteAppointmentBtn.addEventListener("click", async () => {
  const confirmed = window.confirm("Weet je zeker dat je deze afspraak wilt verwijderen?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("Appointments")
    .update({
      status: "verwijderd",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", AppointmentId)
    .eq("owner_id", currentUser.id);

  if (error) {
    showMessage(`Verwijderen mislukt: ${error.message}`, true);
    return;
  }

  showMessage("Afspraak verwijderd.");
  setTimeout(() => {
    window.location.href = "./index.html";
  }, 800);
});

async function startPage() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  await loadAppointment();
}

startPage();