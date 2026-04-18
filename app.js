const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

if (btnNewClient) {
  btnNewClient.addEventListener("click", () => {
    window.location.href = "./new-client.html";
  });
}

if (btnUserProfile) {
  btnUserProfile.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle("hidden");
  });
}

document.addEventListener("click", () => {
  profileDropdown?.classList.add("hidden");
});

profileDropdown?.addEventListener("click", (e) => {
  e.stopPropagation();
});

menuProfile?.addEventListener("click", async () => {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  profileDropdown?.classList.add("hidden");

  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  alert(
    "Mijn profiel\n\n" +
    "E-mail: " + user.email + "\n\n" +
    "Hier komt straks een nette profielpagina."
  );
});

menuPassword?.addEventListener("click", () => {
  profileDropdown?.classList.add("hidden");
  alert("Hier komt straks: wachtwoord wijzigen.");
});

menuLogout?.addEventListener("click", async () => {
  profileDropdown?.classList.add("hidden");
  await supabaseClient.auth.signOut();
  window.location.href = "./login.html";
});

function formatDutchDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    `Goed begin van de week, ${name}. Vandaag zet jij de toon.`,
  ];

  const wednesdayMessages = [
    `${name}, midden in de week en alles netjes onder controle.`,
    `Woensdagkracht, ${name}. Jij houdt het overzicht scherp.`,
  ];

  const fridayMessages = [
    `Bijna weekend, ${name}. Nog even knallen en dan mooi afronden.`,
    `${name}, laatste rechte lijn van de week. Jij hebt dit.`,
  ];

  const complimentMessages = [
    `${name}, jij maakt vandaag echt verschil.`,
    `Kleine hulp bestaat niet. Jij bewijst dat elke dag.`,
    `${name}, mensen rekenen vandaag op jouw rust.`,
    `Jij helpt niet alleen praktisch, maar ook menselijk.`,
    `${name}, vandaag weer een kans om iemand blij te maken.`,
    `${name}, jouw aanwezigheid geeft vertrouwen.`,
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

async function setWelcomeText() {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  let name = "Denise";

  if (user?.email) {
    name = user.email.split("@")[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  welcomeTitleEl.textContent = `${getGreeting()} ${name}`;
  welcomeTextEl.textContent = getMotivation(name);

  if (btnUserProfile) {
  btnUserProfile.textContent = name;
}

if (profileEmail && user?.email) {
  profileEmail.textContent = user.email;
}
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
          <button class="btn btn-secondary">Invullen</button>
          <button class="btn btn-outline">Cliëntenkaart</button>
          <button class="btn btn-finish ${filled ? "enabled" : ""}">
            Afronden
          </button>
        </div>
      </article>
    `;
  }).join("");
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

    const { data, error } = await supabaseClient
      .from("Appointments")
      .select("*")
      .eq("owner_id", currentUser.id)
      .order("appointment_time", { ascending: true });

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
    const todayAppointments = appointments.filter(item => item.appointment_date === today);

    todayCountEl.textContent = todayAppointments.length;
    signalCountEl.textContent = "0";
    invoiceTotalEl.textContent = "€0";

    renderAppointments(todayAppointments);
  } catch (err) {
    console.error("Algemene fout:", err);
    appointmentsListEl.innerHTML = `
      <div class="empty-state">
        Algemene fout: ${err.message}
      </div>
    `;
  }
}

async function startApp() {
  const user = await requireLogin();
  if (!user) return;

  await setWelcomeText();
  await loadDashboard();
}

startApp();