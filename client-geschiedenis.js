const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentClient = null;
let matchingClients = [];

const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

const pageTitle = document.getElementById("pageTitle");
const backToClientCard = document.getElementById("backToClientCard");
const historyList = document.getElementById("historyList");
const totalAppointments = document.getElementById("totalAppointments");
const totalMinutes = document.getElementById("totalMinutes");
const totalSignals = document.getElementById("totalSignals");
const savePdfBtn = document.getElementById("savePdfBtn");
const backToMonthReport = document.getElementById("backToMonthReport");

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }
  return data.session.user;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(dateValue, timeValue = "") {
  if (!dateValue) return "-";

  let date;

  if (timeValue) {
    date = new Date(`${dateValue}T${timeValue}`);
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) {
    return dateValue || "-";
  }

  return date.toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: timeValue ? "2-digit" : undefined,
    minute: timeValue ? "2-digit" : undefined
  });
}

function escapeHtml(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasRealSignal(item) {
  const personStatus = String(item.person_status || "").trim();
  const houseStatus = String(item.house_status || "").trim();
  const signalNotes = String(item.signal_notes || "").trim();

  const hasPersonSignal =
    personStatus === "redelijk" || personStatus === "zorgelijk";

  const hasHouseSignal =
    houseStatus === "rommelig" || houseStatus === "zorgelijk";

  const hasNotes =
    signalNotes !== "" && signalNotes !== "-";

  const hasInternalSignals =
    (Array.isArray(item.internal_signals) && item.internal_signals.length > 0) ||
    (
      typeof item.internal_signals === "string" &&
      item.internal_signals.trim() !== "" &&
      item.internal_signals.trim() !== "[]"
    );

  return hasPersonSignal || hasHouseSignal || hasInternalSignals || hasNotes;
}

function countSignalPoints(appointments) {
  return appointments.filter(hasRealSignal).length;
}

function getSignalText(item) {
  const signals = [];

  if (item.person_status === "redelijk" || item.person_status === "zorgelijk") {
    signals.push(item.person_status);
  }

  if (item.house_status === "rommelig" || item.house_status === "zorgelijk") {
    signals.push(item.house_status);
  }

  if (Array.isArray(item.internal_signals)) {
    signals.push(...item.internal_signals.filter(Boolean));
  } else if (
    typeof item.internal_signals === "string" &&
    item.internal_signals.trim() !== "" &&
    item.internal_signals.trim() !== "[]"
  ) {
    signals.push(item.internal_signals);
  }

  if (item.signal_notes && item.signal_notes.trim() !== "" && item.signal_notes.trim() !== "-") {
    signals.push(item.signal_notes);
  }

  return signals.length ? signals.join(" • ") : "Geen signalen";
}

function renderHistoryItems(appointments) {
  if (!appointments.length) {
    historyList.innerHTML = `<div class="history-item">Nog geen geschiedenis gevonden.</div>`;
    return;
  }

  let signalClosedHtml = "";

  if (currentClient?.signal_closed_at) {
    const closedDate = new Date(
      currentClient.signal_closed_at
    ).toLocaleDateString("nl-NL");

    signalClosedHtml = `
      <div class="history-item">
        <div class="history-title">Signaal afgesloten</div>
        <div class="history-meta">${escapeHtml(closedDate)}</div>
        <div class="history-block">
          <strong>Reden</strong><br>
          ${escapeHtml(
            currentClient.signal_closed_note || "Geen toelichting"
          )}
        </div>
      </div>
    `;
  }

  const appointmentsHtml = appointments.map((item) => {
    const momentText = formatDateTime(
      item.appointment_date || item.created_at,
      item.appointment_time || ""
    );

    return `
      <div class="history-item">
        <div class="history-title">
          ${escapeHtml(item.service_type || "Afspraak")}
        </div>

        <div class="history-meta">
          ${escapeHtml(momentText)}
        </div>

        <div class="history-block">
          <strong>Status</strong><br>
          <span class="status-pill">
            ${escapeHtml(item.status || "-")}
          </span>
        </div>

        <div class="history-block">
          <strong>Duur</strong><br>
          ${escapeHtml(
            item.worked_minutes || item.duration_minutes || 0
          )} minuten
        </div>

        <div class="history-block">
          <strong>Werk gedaan</strong><br>
          ${escapeHtml(item.work_done || "-")}
        </div>

        <div class="history-block">
          <strong>Niet gelukt reden</strong><br>
          ${escapeHtml(item.not_done_reason || "-")}
        </div>

        <div class="history-block">
          <strong>Signalen</strong><br>
          ${escapeHtml(getSignalText(item))}
        </div>

        <div class="history-block">
          <strong>Interne notitie</strong><br>
          ${escapeHtml(item.signal_notes || "-")}
        </div>
      </div>
    `;
  }).join("");

  historyList.innerHTML = signalClosedHtml + appointmentsHtml;
}

async function loadClientHistory() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  if (!clientId) {
    historyList.innerHTML = `<div class="history-item">Geen cliënt-ID gevonden.</div>`;
    totalAppointments.textContent = "0";
    totalMinutes.textContent = "0";
    totalSignals.textContent = "0";
    return;
  }

  const { data: selectedClient, error: clientError } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", clientId)
    .eq("owner_id", currentUser.id)
    .single();

  if (clientError || !selectedClient) {
    console.error("Cliënt niet gevonden:", clientError);
    historyList.innerHTML = `<div class="history-item">Deze cliëntgeschiedenis kon niet worden geladen.</div>`;
    totalAppointments.textContent = "0";
    totalMinutes.textContent = "0";
    totalSignals.textContent = "0";
    return;
  }

  currentClient = selectedClient;

  if (backToClientCard) {
    backToClientCard.href = `./clientkaart.html?id=${currentClient.id}`;
  }

  if (backToMonthReport) {
  const month = params.get("month");
  backToMonthReport.href = month
    ? `./maandrapportage-clienten.html?month=${month}`
    : "./maandrapportage-clienten.html";
}

  const normalizedClientName = normalizeName(selectedClient.full_name);

  const { data: allClients, error: allClientsError } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("owner_id", currentUser.id);

  if (allClientsError) {
    console.error("Fout bij laden van cliënten:", allClientsError);
    historyList.innerHTML = `<div class="history-item">Cliëntgegevens konden niet worden geladen.</div>`;
    return;
  }

  matchingClients = (allClients || []).filter(client =>
    normalizeName(client.full_name) === normalizedClientName
  );

  const matchingClientIds = matchingClients.map(client => client.id);

  const { data: allAppointments, error: appointmentError } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("owner_id", currentUser.id)
    .neq("status", "verwijderd")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (appointmentError) {
    console.error("Fout bij laden van afspraken:", appointmentError);
    historyList.innerHTML = `<div class="history-item">Afspraken konden niet worden geladen.</div>`;
    totalAppointments.textContent = "0";
    totalMinutes.textContent = "0";
    totalSignals.textContent = "0";
    return;
  }

  const appointmentList = (allAppointments || []).filter(item => {
    const sameClientId = item.client_id && matchingClientIds.includes(item.client_id);
    const sameClientName = normalizeName(item.client_name) === normalizedClientName;
    return sameClientId || sameClientName;
  });

  pageTitle.textContent = `Geschiedenis van ${selectedClient.full_name || "Cliënt"}`;

  const appointmentsCount = appointmentList.length;
  const minutesCount = appointmentList.reduce(
    (sum, item) => sum + Number(item.worked_minutes || item.duration_minutes || 0),
    0
  );
  const signalsCount = countSignalPoints(appointmentList);

  totalAppointments.textContent = String(appointmentsCount);
  totalMinutes.textContent = String(minutesCount);
  totalSignals.textContent = String(signalsCount);

  const signalClosedStatus = document.getElementById("signalClosedStatus");

if (signalClosedStatus) {
  if (currentClient?.signal_closed_at) {
    const date = new Date(currentClient.signal_closed_at).toLocaleDateString("nl-NL");

    signalClosedStatus.innerHTML = `
      Ja<br>
      <small>${date}</small>
    `;
  } else {
    signalClosedStatus.textContent = "Nee";
  }
}

  renderHistoryItems(appointmentList);
}

if (savePdfBtn) {
  savePdfBtn.addEventListener("click", () => {
    window.print();
  });
}

loadClientHistory();