const SUPABASE_URL = "https://bqqoxawgjjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const todayCountEl = document.getElementById("todayCount");
const signalCountEl = document.getElementById("signalCount");
const invoiceTotalEl = document.getElementById("invoiceTotal");
const appointmentsListEl = document.getElementById("appointmentsList");
const welcomeTitleEl = document.getElementById("welcomeTitle");
const welcomeTextEl = document.getElementById("welcomeText");
const todayDateLabelEl = document.getElementById("todayDateLabel");
const btnNewClient = document.getElementById("btnNewClient");

btnNewClient?.addEventListener("click", () => {
  alert("Hier komt straks: nieuwe cliënt of afspraak toevoegen.");
});

function formatDutchDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatEuro(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(amount || 0);
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDynamicMessage(appointmentsCount, invoiceTotal, signalCount) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  let title = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
  let text = `${appointmentsCount} afspraken vandaag. ${formatEuro(invoiceTotal)} klaar voor factuur.`;

  if (day === 1) {
    text = `Nieuwe week. ${appointmentsCount} afspraken staan klaar. Jij brengt vandaag weer rust en overzicht.`;
  } else if (day === 5 && hour >= 12) {
    text = `Bijna weekend. Nog ${appointmentsCount} afspraken op de planning en ${formatEuro(invoiceTotal)} richting facturen.`;
  } else if (signalCount >= 3) {
    text = `Er zijn ${signalCount} actiesignalen die aandacht vragen. Goed dat jij het overzicht houdt.`;
  } else {
    const randomMessages = [
      `Door jouw inzet voelt iemand zich vandaag minder alleen.`,
      `Praktische hulp lijkt klein, maar de impact is groot.`,
      `${appointmentsCount} afspraken vandaag. Alles netjes op één plek.`,
      `Overzicht geeft rust. Jij hebt vandaag alles in de hand.`,
      `${formatEuro(invoiceTotal)} staat klaar. Lekker gewerkt.`
    ];
    text = randomMessages[Math.floor(Math.random() * randomMessages.length)];
  }

  return { title, text };
}

function isAppointmentFilled(item) {
  return Boolean(
    item.work_done &&
    item.worked_minutes &&
    String(item.work_done).trim() !== ""
  );
}

function getStatusLabel(item) {
  if (isAppointmentFilled(item)) {
    return `<span class="status-chip status-filled">Ingevuld</span>`;
  }
  return `<span class="status-chip status-open">Nog invullen</span>`;
}

function renderAppointments(items) {
  if (!items.length) {
    appointmentsListEl.innerHTML = `
      <div class="empty-state">
        Nog geen afspraken voor vandaag.
      </div>
    `;
    return;
  }

  appointmentsListEl.innerHTML = items.map(item => {
    const filled = isAppointmentFilled(item);

    return `
      <article class="appointment-card">
        <div class="appointment-top">
          <div>
            <div class="appointment-time">${item.appointment_time || "-"}</div>
            <h4 class="appointment-name">${item.client_name || "Onbekende cliënt"}</h4>
            <div class="appointment-service">${item.service_type || "Geen diensttype"}</div>
          </div>
          ${getStatusLabel(item)}
        </div>

        <div class="card-note">
          ${item.signal_notes ? `Signaal: ${item.signal_notes}` : "Nog geen signalering toegevoegd."}
        </div>

        <div class="card-actions">
          <button class="btn btn-secondary" onclick="handleFill('${item.id}')">
            Invullen
          </button>

          <button class="btn btn-outline" onclick="handleClientCard('${item.client_name || ""}')">
            Cliëntenkaart
          </button>

          <button class="btn btn-finish ${filled ? "enabled" : ""}" ${filled ? `onclick="handleFinish('${item.id}')"` : "disabled"}>
            Afronden
          </button>
        </div>
      </article>
    `;
  }).join("");
}

window.handleFill = function (id) {
  alert(`Hier komt straks het invulscherm voor afspraak ${id}.`);
};

window.handleClientCard = function (clientName) {
  alert(`Hier komt straks de cliëntenkaart van ${clientName}.`);
};

window.handleFinish = function (id) {
  alert(`Afspraak ${id} kan nu afgerond worden omdat hij is ingevuld.`);
};

async function loadDashboard() {
  const today = getTodayString();
  todayDateLabelEl.textContent = formatDutchDate(new Date());

  welcomeTextEl.textContent = "Bezig met laden...";
  appointmentsListEl.innerHTML = `<div class="empty-state">Bezig met ophalen van afspraken...</div>`;

  try {
    const { data, error } = await supabaseClient
      .from("Appointments")
      .select("*")
      .order("appointment_time", { ascending: true });

    if (error) {
      console.error("Supabase fout:", error);
      welcomeTextEl.textContent = "Er ging iets mis bij het ophalen.";
      appointmentsListEl.innerHTML = `
        <div class="empty-state">
          Fout uit Supabase: ${error.message}
        </div>
      `;
      return;
    }

    const appointments = data || [];

    const todayAppointments = appointments.filter(item => item.appointment_date === today);

    const todayCount = todayAppointments.length;

    const signalCount = todayAppointments.filter(item =>
      item.signal_level && item.signal_level !== "geen"
    ).length;

    const invoiceTotal = todayAppointments
      .filter(item => item.ready_for_invoice === true)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    todayCountEl.textContent = todayCount;
    signalCountEl.textContent = signalCount;
    invoiceTotalEl.textContent = formatEuro(invoiceTotal);

    const message = getDynamicMessage(todayCount, invoiceTotal, signalCount);
    welcomeTitleEl.textContent = message.title;
    welcomeTextEl.textContent = message.text;

    renderAppointments(todayAppointments);
  } catch (err) {
    console.error("Algemene fout:", err);
    welcomeTextEl.textContent = "Er ging iets fout in de app.";
    appointmentsListEl.innerHTML = `
      <div class="empty-state">
        Algemene fout: ${err.message}
      </div>
    `;
  }
}

loadDashboard();