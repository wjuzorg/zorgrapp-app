const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const reportMonthInput = document.getElementById("reportMonth");
const loadReportBtn = document.getElementById("loadReportBtn");
const printReportBtn = document.getElementById("printReportBtn");

const summaryClients = document.getElementById("summaryClients");
const summaryAppointments = document.getElementById("summaryAppointments");
const summaryHours = document.getElementById("summaryHours");
const summarySignals = document.getElementById("summarySignals");
const summaryActiveSignals = document.getElementById("summaryActiveSignals");
const summaryMonth = document.getElementById("summaryMonth");
const clientsReportList = document.getElementById("clientsReportList");

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultMonth();

  if (loadReportBtn) {
    loadReportBtn.addEventListener("click", loadClientMonthReport);
  }

  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => window.print());
  }

  await loadClientMonthReport();
});

function setDefaultMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  reportMonthInput.value = `${year}-${month}`;
}

async function loadClientMonthReport() {
  clientsReportList.innerHTML = "Rapport laden...";

  const selectedMonth = reportMonthInput.value;

  if (!selectedMonth) {
    clientsReportList.innerHTML = "Kies eerst een maand.";
    return;
  }

  const startDate = `${selectedMonth}-01`;
  const endDate = getNextMonthDate(selectedMonth);

  summaryMonth.textContent = formatMonthLabel(selectedMonth);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .gte("appointment_date", startDate)
    .lt("appointment_date", endDate)
    .order("appointment_date", { ascending: false });

  if (error) {
    console.error(error);
    clientsReportList.innerHTML = "Rapport kon niet geladen worden.";
    return;
  }

  if (!data || data.length === 0) {
    resetSummary();
    clientsReportList.innerHTML = "Geen afgeronde afspraken gevonden voor deze maand.";
    return;
  }

  const grouped = groupByClient(data);
  renderSummary(grouped, data);
  renderClients(grouped);
}

function groupByClient(appointments) {
  const result = {};

  appointments.forEach((item) => {
    const clientId = item.client_id || "onbekend";
    const clientName = item.client_name || "Onbekende cliënt";

    if (!result[clientId]) {
      result[clientId] = {
        client_id: clientId,
        client_name: clientName,
        appointments: [],
        total_minutes: 0,
        total_signals: 0,
        active_signals: 0,
        signal_tags: [],
        latest_visit: null,
        latest_person_status: "",
        latest_house_status: "",
        latest_note: ""
      };
    }

    result[clientId].appointments.push(item);

    const minutes = Number(item.worked_minutes || item.duration_minutes || 0);
    result[clientId].total_minutes += minutes;

    if (item.person_status || item.house_status || item.signal_notes) {
      result[clientId].total_signals += 1;
    }

    if (item.signal_status === "actief") {
      result[clientId].active_signals += 1;
    }

    const tags = normalizeSignalTags(item.signal_tags || item.signals || item.signal_options);
    result[clientId].signal_tags.push(...tags);

    if (!result[clientId].latest_visit || item.appointment_date > result[clientId].latest_visit) {
      result[clientId].latest_visit = item.appointment_date;
      result[clientId].latest_person_status = item.person_status || "";
      result[clientId].latest_house_status = item.house_status || "";
      result[clientId].latest_note = item.signal_notes || item.work_done || "";
    }
  });

  Object.values(result).forEach((client) => {
    client.signal_tags = [...new Set(client.signal_tags)];
  });

  return result;
}

function renderSummary(grouped, allAppointments) {
  const clients = Object.values(grouped);

  const totalMinutes = clients.reduce((sum, client) => sum + client.total_minutes, 0);
  const totalSignals = clients.reduce((sum, client) => sum + client.total_signals, 0);
  const activeSignals = clients.reduce((sum, client) => sum + client.active_signals, 0);

  summaryClients.textContent = clients.length;
  summaryAppointments.textContent = allAppointments.length;
  summaryHours.textContent = formatMinutesToHours(totalMinutes);
  summarySignals.textContent = totalSignals;
  summaryActiveSignals.textContent = activeSignals;
}

function renderClients(grouped) {
  const clients = Object.values(grouped);

  clients.sort((a, b) => {
    return (b.active_signals || 0) - (a.active_signals || 0);
  });

  clientsReportList.innerHTML = clients.map((client) => {
    const status = getClientStatus(client);
    const statusClass = getStatusClass(status);

    return `
      <article class="client-report-card">
        <div class="client-report-top">
          <div>
            <h4 class="client-report-name">${escapeHtml(client.client_name)}</h4>
            <div class="client-report-sub">
              Laatste bezoek: ${formatDate(client.latest_visit)}<br>
              Persoon: ${formatValue(client.latest_person_status)} · Huis: ${formatValue(client.latest_house_status)}
            </div>
          </div>

          <span class="status-badge ${statusClass}">
            ${status}
          </span>
        </div>

        <div class="client-report-grid">
          <div class="small-stat">
            <span>Afspraken</span>
            <strong>${client.appointments.length}</strong>
          </div>

          <div class="small-stat">
            <span>Uren</span>
            <strong>${formatMinutesToHours(client.total_minutes)}</strong>
          </div>

          <div class="small-stat">
            <span>Signalen</span>
            <strong>${client.total_signals}</strong>
          </div>

          <div class="small-stat">
            <span>Actieve signalen</span>
            <strong>${client.active_signals}</strong>
          </div>
        </div>

        ${renderSignalTags(client.signal_tags)}

        ${client.latest_note ? `
          <div class="client-report-note">
            <strong>Laatste notitie:</strong><br>
            ${escapeHtml(client.latest_note)}
          </div>
        ` : ""}

        <div class="client-report-actions no-print">
          <a class="btn btn-secondary" href="./client-geschiedenis.html?id=${client.client_id}">
            Bekijk cliëntgeschiedenis
          </a>
        </div>
      </article>
    `;
  }).join("");
}

function renderSignalTags(tags) {
  if (!tags || tags.length === 0) {
    return `
      <div class="signal-tags">
        <span class="signal-tag">Geen specifieke signalen</span>
      </div>
    `;
  }

  return `
    <div class="signal-tags">
      ${tags.map(tag => `
        <span class="signal-tag">${formatSignalTag(tag)}</span>
      `).join("")}
    </div>
  `;
}

function getClientStatus(client) {
  const latestPerson = client.latest_person_status;
  const latestHouse = client.latest_house_status;

  if (
    client.active_signals > 0 ||
    latestPerson === "zorgelijk" ||
    latestHouse === "zorgelijk"
  ) {
    return "Actie nodig";
  }

  if (
    client.total_signals > 0 ||
    latestPerson === "redelijk" ||
    latestHouse === "rommelig"
  ) {
    return "Let op";
  }

  return "Gaat goed";
}

function getStatusClass(status) {
  if (status === "Actie nodig") return "status-alert";
  if (status === "Let op") return "status-watch";
  return "status-good";
}

function normalizeSignalTags(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {
      return value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function getNextMonthDate(selectedMonth) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const date = new Date(year, month, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}-01`;
}

function formatMinutesToHours(minutes) {
  const total = Number(minutes || 0);

  if (total === 0) return "0 uur";

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} u ${mins} min`;
  }

  if (hours > 0) {
    return `${hours} uur`;
  }

  return `${mins} min`;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatMonthLabel(value) {
  if (!value) return "-";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric"
  });
}

function formatValue(value) {
  if (!value) return "-";

  return String(value)
    .replaceAll("_", " ")
    .replace(/^./, letter => letter.toUpperCase());
}

function formatSignalTag(tag) {
  const labels = {
    vergeetachtig: "Vergeetachtig",
    somber: "Somber",
    eenzaam: "Eenzaam",
    slechter_ter_been: "Slechter ter been",
    huis_vervuilt: "Huis vervuilt",
    mantelzorger_belast: "Mantelzorger belast",
    niet_open_gedaan: "Niet open gedaan"
  };

  return labels[tag] || formatValue(tag);
}

function resetSummary() {
  summaryClients.textContent = "0";
  summaryAppointments.textContent = "0";
  summaryHours.textContent = "0 uur";
  summarySignals.textContent = "0";
  summaryActiveSignals.textContent = "0";
}

function escapeHtml(value) {
  if (!value) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}