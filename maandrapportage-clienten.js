const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("MAANDRAPPORTAGE CLIENTEN JS IS GELADEN");

const reportMonthInput = document.getElementById("reportMonth");
const printReportBtn = document.getElementById("printReportBtn");
const summaryClients = document.getElementById("summaryClients");
const summaryAppointments = document.getElementById("summaryAppointments");
const summaryHours = document.getElementById("summaryHours");
const summarySignals = document.getElementById("summarySignals");
const summaryActiveSignals = document.getElementById("summaryActiveSignals");
const summaryMonth = document.getElementById("summaryMonth");
const clientsReportList = document.getElementById("clientsReportList");
const loadReportBtn = document.getElementById("loadReportBtn");
const includeNotesCheckbox = document.getElementById("includeNotesCheckbox");
const profileNameBox = document.getElementById("profileNameBox");

async function enforceProcessorAgreement() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "./login.html";
    return false;
  }

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("processor_agreement_accepted")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Verwerkersovereenkomst check mislukt:", error);
    alert("Controle van bedrijfsprofiel mislukt.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  if (data?.processor_agreement_accepted !== true) {
    alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  return true;
}

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await enforceProcessorAgreement();
  if (!ok) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  currentUser = user;

  setDefaultMonth();
  await loadProfileName();

  loadReportBtn?.addEventListener("click", loadClientMonthReport);
  includeNotesCheckbox?.addEventListener("change", loadClientMonthReport);
  printReportBtn?.addEventListener("click", printWithFileName);

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

  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("owner_id", currentUser.id)
    .gte("appointment_date", startDate)
    .lt("appointment_date", endDate)
    .order("appointment_date", { ascending: false });

  const { data: clientsData, error: clientsError } = await supabaseClient
    .from("Clients")
    .select("id, full_name, signal_closed_at, signal_closed_note")
    .eq("owner_id", currentUser.id);

  if (clientsError) {
    console.error("Cliënten laden mislukt:", clientsError);
  }

  window.clientsDataForReport = clientsData || [];
window.reportStartDate = startDate + "T00:00:00";
window.reportEndDate = endDate + "T00:00:00";

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

    const clientRecord = (window.clientsDataForReport || []).find(
  client => client.id === clientId
);

const signalIsClosed = !!clientRecord?.signal_closed_at;

const clientRecord = (window.clientsDataForReport || []).find(
  client => client.id === clientId
);

const signalIsClosed = !!clientRecord?.signal_closed_at;

if (item.signal_status === "actief" && !signalIsClosed) {
  result[clientId].active_signals += 1;
}

    const tags = normalizeSignalTags(item.internal_signals);
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

  const summaryClosedSignals = document.getElementById("summaryClosedSignals");
  if (summaryClosedSignals) {
    summaryClosedSignals.textContent = countClosedSignalsForReport();
  }
}

function countClosedSignalsForReport() {
  const clients = window.clientsDataForReport || [];
  const start = new Date(window.reportStartDate);
  const end = new Date(window.reportEndDate);

  return clients.filter((client) => {
    if (!client.signal_closed_at) return false;

    const closedDate = new Date(client.signal_closed_at);

    return !isNaN(closedDate) && closedDate >= start && closedDate < end;
  }).length;
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
              Laatste indruk: ${getLastImpression(client)}
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

        ${isClientSignalClosed(client.client_id)
  ? renderClosedSignalText(client.client_id)
  : renderSignalTags(client.signal_tags, client)}

        ${includeNotesCheckbox && includeNotesCheckbox.checked && client.latest_note ? `
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

function getClosedSignalBadge(clientId) {
  const clientRecord = (window.clientsDataForReport || []).find(
    client => client.id === clientId
  );

  if (!clientRecord?.signal_closed_at) return "";

  const date = new Date(clientRecord.signal_closed_at).toLocaleDateString("nl-NL");

  return `
    <span class="status-badge">
      Signaal afgesloten ${date}
    </span>
  `;
}

function isClientSignalClosed(clientId) {
  return (window.clientsDataForReport || []).some(
    client => client.id === clientId && client.signal_closed_at
  );
}

function renderClosedSignalText(clientId) {
  const clientRecord = (window.clientsDataForReport || []).find(
    client => client.id === clientId
  );

  if (!clientRecord?.signal_closed_at) return "";

  const date = new Date(clientRecord.signal_closed_at).toLocaleDateString("nl-NL");

  return `
    <div class="client-report-note">
      <strong>Signaal afgesloten:</strong><br>
      ${date}<br>
      ${escapeHtml(clientRecord.signal_closed_note || "Geen toelichting")}
    </div>
  `;
}

function renderSignalTags(tags, client = {}) {
  if (!tags || tags.length === 0) {
    const fallbackSignals = [
      client.latest_person_status,
      client.latest_house_status
    ].filter(Boolean);

    return `
      <div class="signal-tags">
        <span class="signal-tag">
          ${
            fallbackSignals.length
              ? escapeHtml(fallbackSignals.join(", "))
              : "Geen specifieke signalen"
          }
        </span>
      </div>
    `;
  }

  return `
    <div class="signal-tags">
      ${tags
        .map(tag => `<span class="signal-tag">${escapeHtml(tag)}</span>`)
        .join("")}
    </div>
  `;
}



function getClientStatus(client) {
  const signalClosed = isClientSignalClosed(client.client_id);

  if (signalClosed) {
    return "Signaal afgesloten";
  }

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
  if (status === "Signaal afgesloten") return "status-good";
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

function slugify(value) {
  return String(value || "maand")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("á", "a")
    .replaceAll("é", "e")
    .replaceAll("ë", "e")
    .replaceAll("í", "i")
    .replaceAll("ó", "o")
    .replaceAll("ú", "u")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9-]/g, "");
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

function getLastImpression(client) {
  if (
    client.latest_person_status === "zorgelijk" ||
    client.latest_house_status === "zorgelijk"
  ) {
    return "zorgelijk";
  }

  if (
    client.latest_person_status === "redelijk" ||
    client.latest_house_status === "rommelig"
  ) {
    return "let op";
  }

  if (
    client.latest_person_status === "goed" ||
    client.latest_house_status === "netjes"
  ) {
    return "goed";
  }

  return "niet ingevuld";
}

async function loadProfileName() {
  try {
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData?.user;

    if (!user) {
      if (profileNameBox) {
        profileNameBox.textContent = "Cliëntenrapportage";
      }
      return;
    }

    const { data, error } = await supabaseClient
      .from("business_profiles")
      .select("*")
      .eq("owner_id", user.id)
      .limit(1);

    if (error) {
      console.error("business_profiles fout:", error);
    }

    const profile = data && data.length ? data[0] : null;

    if (!profile) {
      if (profileNameBox) {
        profileNameBox.textContent = "Mijn bedrijf";
      }
      return;
    }

    const profileName =
      profile.company_name ||
      profile.business_name ||
      profile.bedrijfsnaam ||
      profile.name ||
      profile.display_name ||
      "Mijn bedrijf";

    if (profileNameBox) {
      profileNameBox.textContent = profileName;
    }
  } catch (err) {
    console.error("Fout bij laden profielnaam:", err);
    if (profileNameBox) {
      profileNameBox.textContent = "Mijn bedrijf";
    }
  }
}

function printWithFileName() {
  const selectedMonth = reportMonthInput.value || "";
  const monthLabel = formatMonthLabel(selectedMonth); // bijvoorbeeld "mei 2026"

  const fileName =
    "maandrapportage-clienten-" +
    slugify(monthLabel).replace("-", "") + ".pdf";

  const oldTitle = document.title;
  document.title = fileName.replace(".pdf", "");

  window.print();

  setTimeout(() => {
    document.title = oldTitle;
  }, 1000);
}