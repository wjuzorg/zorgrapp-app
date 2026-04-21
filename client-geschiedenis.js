const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const requestId = params.get("id");

const pageTitle = document.getElementById("pageTitle");
const backToClientCard = document.getElementById("backToClientCard");
const historyList = document.getElementById("historyList");
const totalAppointments = document.getElementById("totalAppointments");
const totalMinutes = document.getElementById("totalMinutes");
const totalSignals = document.getElementById("totalSignals");

if (requestId) {
  backToClientCard.href = `./clientkaart.html?id=${requestId}`;
}

function formatDateTime(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  return date.toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  if (!value) return "-";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countSignals(item) {
  let count = 0;

  if (item.risk_dropout) count += 1;
  if (item.needs_extra_support) count += 1;
  if (item.hard_to_reach) count += 1;
  if (item.observed_decline) count += 1;

  return count;
}

function getSignalText(item) {
  const signals = [];

  if (item.risk_dropout) signals.push("Risico op uitval");
  if (item.needs_extra_support) signals.push("Extra ondersteuning nodig");
  if (item.hard_to_reach) signals.push("Moeilijk bereikbaar");
  if (item.observed_decline) signals.push("Achteruitgang opgemerkt");

  return signals.length ? signals.join(", ") : "Geen signalen";
}

async function loadClientHistory() {
  if (!requestId) {
    historyList.innerHTML = `<div class="history-item">Geen cliënt of aanvraag-ID gevonden.</div>`;
    return;
  }

  const { data: firstRecord, error: firstError } = await supabaseClient
  .from("requests")
  .select("*")
  .eq("client_id", clientId)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();

  if (firstError || !firstRecord) {
    console.error("Fout bij eerste record ophalen:", firstError);
    historyList.innerHTML = `<div class="history-item">Deze cliëntgeschiedenis kon niet worden geladen.</div>`;
    return;
  }

  const clientName = firstRecord.full_name || "Cliënt";
  const clientPhone = firstRecord.phone || "";

  pageTitle.textContent = `Geschiedenis van ${clientName}`;

  let historyData = [];

  if (clientPhone) {
    const { data, error } = await supabaseClient
      .from("requests")
      .select("*")
      .eq("phone", clientPhone)
      .order("appointment_time", { ascending: false });

    if (error) {
      console.error("Fout bij geschiedenis ophalen:", error);
      historyList.innerHTML = `<div class="history-item">Fout bij laden van geschiedenis.</div>`;
      return;
    }

    historyData = data || [];
  } else {
    historyData = [firstRecord];
  }

  if (historyData.length === 0) {
    historyList.innerHTML = `<div class="history-item">Nog geen geschiedenis gevonden.</div>`;
    totalAppointments.textContent = "0";
    totalMinutes.textContent = "0";
    totalSignals.textContent = "0";
    return;
  }

  const appointmentsCount = historyData.length;
  const minutesCount = historyData.reduce((sum, item) => sum + (Number(item.duration_minutes) || 0), 0);
  const signalsCount = historyData.reduce((sum, item) => sum + countSignals(item), 0);

  totalAppointments.textContent = String(appointmentsCount);
  totalMinutes.textContent = String(minutesCount);
  totalSignals.textContent = String(signalsCount);

  historyList.innerHTML = historyData.map((item) => {
    return `
      <div class="history-item">
        <div class="history-title">${escapeHtml(item.service_type || "Afspraak")}</div>

        <div class="history-meta">
          ${formatDateTime(item.appointment_time || item.created_at)}
        </div>

        <div class="history-block">
          <strong>Status</strong><br>
          <span class="status-pill">${escapeHtml(item.status || "-")}</span>
        </div>

        <div class="history-block">
          <strong>Duur</strong><br>
          ${escapeHtml(item.duration_minutes || 0)} minuten
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
          ${escapeHtml(item.internal_signal_notes || "-")}
        </div>
      </div>
    `;
  }).join("");
}

loadClientHistory();