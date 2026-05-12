const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentWeekOffset = 0;
let allAppointmentsCache = [];

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }
  return data.session.user;
}

const todayCountEl = document.getElementById("todayCount");
const signalCountEl = document.getElementById("signalCount");
const invoiceTotalEl = document.getElementById("invoiceTotal");
const appointmentsListEl = document.getElementById("appointmentsList");
const welcomeTitleEl = document.getElementById("welcomeTitle");
const welcomeTextEl = document.getElementById("welcomeText");
const todayDateLabelEl = document.getElementById("todayDateLabel");

const btnNewClient = document.getElementById("btnNewClient");
const btnUserProfile = document.getElementById("btnUserProfile");

const profileDropdown = document.getElementById("profileDropdown");
const menuProfile = document.getElementById("menuProfile");
const menuPassword = document.getElementById("menuPassword");
const menuLogout = document.getElementById("menuLogout");
const profileEmail = document.getElementById("profileEmail");

const weekRangeLabelEl = document.getElementById("weekRangeLabel");
const weekdayCards = document.querySelectorAll(".weekday-card");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const agreementWarning = document.getElementById("agreementWarning");
const btnInvoices = document.getElementById("btnInvoices");

const btnMonthReports = document.getElementById("btnMonthReports");

// Profielmenu openen/sluiten
if (btnUserProfile) {
  btnUserProfile.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    profileDropdown?.classList.toggle("hidden");
  });
}

// Klik buiten menu = sluiten
document.addEventListener("click", function () {
  profileDropdown?.classList.add("hidden");
});

// Klik in menu = menu open laten
if (profileDropdown) {
  profileDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });
}

let processorAgreementAccepted = false;

function requireProcessorAgreement() {
  if (processorAgreementAccepted === true) return true;

  alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
  window.location.href = "./bedrijfsprofiel.html";
  return false;
}

btnNewClient?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireProcessorAgreement()) return;
  window.location.href = "./new-client.html";
});

btnInvoices?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireProcessorAgreement()) return;
  window.location.href = "./facturen.html";
});

btnMonthReports?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!requireProcessorAgreement()) return;
  window.location.href = "./maandrapportages.html";
});

menuProfile?.addEventListener("click", () => {
  window.location.href = "./bedrijfsprofiel.html";
});

menuLogout?.addEventListener("click", async () => {
  profileDropdown?.classList.add("hidden");
  await supabaseClient.auth.signOut();
  window.location.href = "./login.html";
});

prevWeekBtn?.addEventListener("click", () => {
  currentWeekOffset -= 1;
  renderWeekPlanning(allAppointmentsCache);
});

nextWeekBtn?.addEventListener("click", () => {
  currentWeekOffset += 1;
  renderWeekPlanning(allAppointmentsCache);
});

document.addEventListener("click", (e) => {
  if (processorAgreementAccepted === true) return;

  const blockedButton = e.target.closest(
    "#btnNewClient, #btnInvoices, #btnMonthReports"
  );

  if (blockedButton) {
    e.preventDefault();
    e.stopImmediatePropagation();
    alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
    window.location.href = "./bedrijfsprofiel.html";
  }
}, true);

function formatDutchDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function getTodayString() {
  const now = new Date();
  return toDateString(now);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildAddressLine(item) {
  return [item.address, item.postal_code, item.city]
    .filter(Boolean)
    .join(", ");
}

function buildMapsLink(address) {
  if (!address) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getStartOfWeek(date, offset = 0) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // maandag als start
  d.setDate(d.getDate() + diff + (offset * 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isAppointmentFilled(item) {
  return Boolean(
    item.work_done &&
    String(item.work_done).trim() !== "" &&
    (item.worked_minutes || item.duration_minutes)
  );
}

function getStatusLabel(item) {
  const duration = item.duration_minutes || item.worked_minutes;

  if (duration) {
    return `<span class="status-chip status-open">${duration} min</span>`;
  }

  if (isAppointmentFilled(item)) {
    return `<span class="status-chip status-filled">Ingevuld</span>`;
  }

  return `<span class="status-chip status-open">Nog invullen</span>`;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Goedemorgen";
  if (hour >= 12 && hour < 17) return "Goedemiddag";
  if (hour >= 17 && hour < 22) return "Goedenavond";
  return "Goedenacht";
}

function getMotivation(name) {
  const dayOfWeek = new Date().getDay();
  const dayOfMonth = new Date().getDate();

  const mondayMessages = [
    `${name}, nieuwe week. Jij brengt vandaag weer rust en overzicht.`,
    `Goed begin van de week, ${name}. Vandaag zet jij de toon.`
  ];

  const wednesdayMessages = [
    `${name}, midden in de week en alles netjes onder controle.`,
    `Woensdagkracht, ${name}. Jij houdt het overzicht scherp.`
  ];

  const fridayMessages = [
    `Bijna weekend, ${name}. Nog even knallen en dan mooi afronden.`,
    `${name}, laatste rechte lijn van de week. Jij hebt dit.`
  ];

  const complimentMessages = [
    `${name}, jij maakt vandaag echt verschil.`,
    `Kleine hulp bestaat niet. Jij bewijst dat elke dag.`,
    `${name}, mensen rekenen vandaag op jouw rust.`,
    `Jij helpt niet alleen praktisch, maar ook menselijk.`,
    `${name}, vandaag weer een kans om iemand blij te maken.`,
    `${name}, jouw aanwezigheid geeft vertrouwen.`
  ];

  if (dayOfWeek === 1) {
    return mondayMessages[dayOfMonth % mondayMessages.length];
  }

  if (dayOfWeek === 3) {
    return wednesdayMessages[dayOfMonth % wednesdayMessages.length];
  }

  if (dayOfWeek === 5) {
    return fridayMessages[dayOfMonth % fridayMessages.length];
  }

  return complimentMessages[dayOfMonth % complimentMessages.length];
}

async function setWelcomeText(user) {
  let name = "Gebruiker";

  if (user?.email) {
    name = user.email.split("@")[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  try {
    if (user?.id) {
      const { data: profileRows, error } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .limit(1);

      if (!error && profileRows && profileRows.length > 0) {
        const dbName = profileRows[0].full_name;
        if (dbName && dbName.trim() !== "") {
          name = dbName.trim();
        }
      }
    }
  } catch (err) {
    console.error("Profiel laden mislukt:", err);
  }

  if (welcomeTitleEl) {
    welcomeTitleEl.textContent = `${getGreeting()} ${name}`;
  }

  if (welcomeTextEl) {
    welcomeTextEl.textContent = getMotivation(name);
  }

  if (btnUserProfile) {
    btnUserProfile.textContent = name;
  }

  if (profileEmail && user?.email) {
    profileEmail.textContent = user.email;
  }
}

function renderAppointments(items, clients = []) {
  if (!items.length) {
    appointmentsListEl.innerHTML = `
      <div class="empty-state">
        Nog geen afspraken voor deze dag.
      </div>
    `;
    return;
  }

  appointmentsListEl.innerHTML = items.map(item => {
    const client = clients.find(c => c.id === item.client_id);
    const filled = isAppointmentFilled(item);

    const addressLine = client
      ? [client.address, client.postal_code, client.city].filter(Boolean).join(", ")
      : "";

    const mapsLink = buildMapsLink(addressLine);

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

        <div class="route-mini-card">
          <div class="route-mini-left">
            <div class="route-mini-label">Adres</div>
            <div class="route-mini-address">${addressLine || "Adres nog niet ingevuld"}</div>
          </div>
          ${
            addressLine
              ? `<a class="route-mini-btn" href="${mapsLink}" target="_blank" rel="noopener noreferrer" aria-label="Open route in Google Maps">🧭</a>`
              : ``
          }
        </div>

        <div class="card-note">
          ${item.signal_notes ? `Signaal: ${item.signal_notes}` : "Nog geen signalering toegevoegd."}
        </div>

        <div class="card-actions">
          <button class="btn btn-secondary" onclick="window.location.href='./invullen.html?id=${item.id}'">
            Invullen
          </button>

          <button class="btn btn-outline" onclick="window.location.href='./clientkaart.html?id=${item.client_id}'">
            Cliëntenkaart
          </button>

          <button class="btn btn-finish ${filled ? "enabled" : ""}" data-id="${item.id}">
  Afronden
</button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".btn-finish").forEach(btn => {
    btn.addEventListener("click", async () => {
      const appointmentId = btn.dataset.id;

      if (!appointmentId) return;

      if (!btn.classList.contains("enabled")) {
        alert("Vul de afspraak eerst in voordat je deze afrondt.");
        return;
      }

      await createInvoiceFromAppointment(appointmentId);
    });
  });
}

function renderWeekPlanning(appointments, clients) {
  const today = new Date();
  const startOfWeek = getStartOfWeek(today, currentWeekOffset);
  const weekDates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDates.push(d);
  }

  const endOfWeek = weekDates[6];
  if (weekRangeLabelEl) {
    weekRangeLabelEl.textContent = `${formatShortDate(startOfWeek)} – ${formatShortDate(endOfWeek)}`;
  }

  weekdayCards.forEach((card, index) => {
    const dateObj = weekDates[index];
    const dateString = toDateString(dateObj);

    const count = appointments.filter(item => item.appointment_date === dateString).length;
    const countEl = card.querySelector(".weekday-count");

    if (countEl) {
      countEl.textContent = count;
    }

    card.classList.toggle("active", dateString === getTodayString() && currentWeekOffset === 0);

    card.onclick = () => {
      const dayAppointments = appointments.filter(item => item.appointment_date === dateString);
      todayDateLabelEl.textContent = formatDutchDate(dateObj);
      renderAppointments(dayAppointments, clients);

      weekdayCards.forEach(btn => btn.classList.remove("active"));
      card.classList.add("active");
    };
  });
}

async function loadDashboard() {
  const today = getTodayString();
  todayDateLabelEl.textContent = formatDutchDate(new Date());

  appointmentsListEl.innerHTML = `
    <div class="empty-state">Afspraken laden...</div>
  `;

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const currentUser = sessionData.session?.user;

    if (currentUser) {
  await loadInvoiceDashboardTotal(currentUser.id);
}

    const { data, error } = await supabaseClient
  .from("Appointments")
  .select("*")
  .eq("owner_id", currentUser.id)
  .neq("status", "verwijderd")
  .neq("status", "afgerond")
  .order("appointment_date", { ascending: true })
  .order("appointment_time", { ascending: true });

      const { data: clientsData } = await supabaseClient
  .from("Clients")
  .select("*")
  .eq("owner_id", currentUser.id);

    if (error) {
      console.error("Supabase fout:", error);
      appointmentsListEl.innerHTML = `
        <div class="empty-state">
          Fout uit Supabase: ${error.message}
        </div>
      `;
      return;
    }

    const appointments = data || [];
    const clients = clientsData || [];
    allAppointmentsCache = appointments;

    const todayAppointments = appointments.filter(item => item.appointment_date === today);
    todayCountEl.textContent = todayAppointments.length;

   const signalCountByClient = {};

appointments.forEach(item => {
  const clientKey = item.client_id || item.client_name;
  if (!clientKey) return;

  let signalPoints = 0;

  if (item.person_status === "zorgelijk") {
    signalPoints += 1;
  }

  if (item.house_status === "zorgelijk") {
    signalPoints += 1;
  }

  if (item.internal_signals && String(item.internal_signals).trim() !== "") {
    const signalsArray = String(item.internal_signals)
      .split(",")
      .map(s => s.trim())
      .filter(s => s && s !== "[]" && s !== "null" && s !== "undefined");

    signalPoints += signalsArray.length;
  }

  if (item.signal_notes && String(item.signal_notes).trim() !== "") {
    signalPoints += 1;
  }

  if (signalPoints > 0) {
    signalCountByClient[clientKey] =
      (signalCountByClient[clientKey] || 0) + signalPoints;
  }
});

const totalSignalClients = Object.keys(signalCountByClient).length;

const signalCountEl = document.getElementById("signalCount");
if (signalCountEl) {
  signalCountEl.textContent = totalSignalClients;
}

    renderAppointments(todayAppointments, clients);
    renderWeekPlanning(appointments, clients);
  } catch (err) {
    console.error("Algemene fout:", err);
    appointmentsListEl.innerHTML = `
      <div class="empty-state">
        Algemene fout: ${err.message}
      </div>
    `;
  }
}

async function setWelcomeText() {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  let name = "Gebruiker";

  if (user?.id) {
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileError && profileData?.full_name && profileData.full_name.trim() !== "") {
      name = profileData.full_name.trim();
    } else if (user?.email) {
      name = user.email.split("@")[0];
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  if (welcomeTitleEl) {
    welcomeTitleEl.textContent = `${getGreeting()} ${name}`;
  }

  if (welcomeTextEl) {
    welcomeTextEl.textContent = getMotivation(name);
  }

  if (btnUserProfile) {
    btnUserProfile.textContent = name;
  }

  if (profileEmail && user?.email) {
    profileEmail.textContent = user.email;
  }
}

async function checkProcessorAgreement(userId) {
  const warningEl = document.getElementById("agreementWarning");
  if (!warningEl) return;

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("processor_agreement_accepted")
    .eq("owner_id", userId)
    .maybeSingle();

  console.log("Agreement check:", data, error);

  processorAgreementAccepted =
    data?.processor_agreement_accepted === true;

  console.log(
    "processorAgreementAccepted:",
    processorAgreementAccepted
  );

  if (processorAgreementAccepted === true) {
    warningEl.style.setProperty("display", "none", "important");
  } else {
    warningEl.style.setProperty("display", "block", "important");
  }
}


async function createInvoiceFromAppointment(appointmentId) {
  try {
    const { data: appointment, error } = await supabaseClient
      .from("Appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (error || !appointment) {
      alert("Afspraak niet gevonden");
      return;
    }

    const { data: existing } = await supabaseClient
      .from("invoice_drafts")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existing) {
      alert("Factuur bestaat al.");
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("business_profiles")
      .select("invoice_counter, hourly_rate")
      .eq("owner_id", appointment.owner_id)
      .maybeSingle();

    if (profileError) {
      alert("Bedrijfsprofiel laden mislukt: " + profileError.message);
      return;
    }

    const nextCounter = Number(profile?.invoice_counter || 0) + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `#${year}-${String(nextCounter).padStart(4, "0")}`;

    const minutes = appointment.worked_minutes || appointment.duration_minutes || 60;
    const hourlyRate = Number(profile?.hourly_rate || 50);
     const km = Number(appointment.km || 0);
const materialCost = Number(appointment.material_cost || 0);
const parkingCost = Number(appointment.parking_cost || 0);

const kmRate = 0.23;
const kmAmount = km * kmRate;

const laborAmount = (minutes / 60) * hourlyRate;
const amount = laborAmount + kmAmount + materialCost + parkingCost;

    const { error: insertError } = await supabaseClient
      .from("invoice_drafts")
      .insert([{
        owner_id: appointment.owner_id,
        client_id: appointment.client_id,
        client_name: appointment.client_name,
        appointment_id: appointment.id,
        invoice_number: invoiceNumber,
        minutes,
        hourly_rate: hourlyRate,
        amount,
        km,
  km_amount: kmAmount,
  material_cost: materialCost,
  parking_cost: parkingCost,
  status: "klaar"
}]);

    if (insertError) {
      alert("Fout bij maken factuur: " + insertError.message);
      return;
    }

    await supabaseClient
      .from("business_profiles")
      .update({ invoice_counter: nextCounter })
      .eq("owner_id", appointment.owner_id);

    await supabaseClient
      .from("Appointments")
      .update({
        ready_for_invoice: true,
        status: "afgerond",
        updated_at: new Date().toISOString()
      })
      .eq("id", appointmentId);

    alert("Factuur aangemaakt");
    window.location.reload();

  } catch (err) {
    console.error(err);
    alert("Algemene fout bij factuur maken.");
  }
}

async function loadInvoiceDashboardTotal(userId) {
  const invoiceTotalEl = document.getElementById("invoiceTotal");
  if (!invoiceTotalEl) return;

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("amount, status")
    .eq("owner_id", userId)
    .in("status", ["klaar", "open", "herinnering"]);

  if (error) {
    console.error("Factuurtotaal laden mislukt:", error.message);
    invoiceTotalEl.textContent = "€0";
    return;
  }

  const total = (data || []).reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);

  invoiceTotalEl.textContent = `€${total.toFixed(2).replace(".", ",")}`;
}

async function startApp() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  await checkProcessorAgreement(user.id);

  setWelcomeText();
  await loadDashboard();
}

startApp();
document.addEventListener("click", function (e) {
  const blocked = e.target.closest(
    "#btnNewClient, #btnInvoices, #btnMonthReports"
  );

  if (!blocked) return;

  if (processorAgreementAccepted !== true) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }
}, true);