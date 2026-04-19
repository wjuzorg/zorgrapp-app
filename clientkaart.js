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

function getClientIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(dateString));
}

function getCurrentMonthPrefix() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function countSignalPoints(appointments) {
  let total = 0;

  appointments.forEach(item => {
    if (item.person_status === "zorgelijk") total += 1;
    if (item.house_status === "zorgelijk") total += 1;

    if (item.internal_signals && String(item.internal_signals).trim() !== "") {
      const arr = String(item.internal_signals)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      total += arr.length;
    }

    if (item.signal_notes && String(item.signal_notes).trim() !== "") {
      total += 1;
    }
  });

  return total;
}

async function loadClientCard() {
  const user = await requireLogin();
  if (!user) return;

  const clientId = getClientIdFromUrl();
  if (!clientId) {
    alert("Geen cliënt-ID gevonden.");
    return;
  }

  const { data: client, error: clientError } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", clientId)
    .eq("owner_id", user.id)
    .single();

  if (clientError || !client) {
    alert(`Cliënt niet gevonden: ${clientError?.message || "onbekend"}`);
    return;
  }

  const { data: appointments, error: appointmentError } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("client_id", clientId)
    .eq("owner_id", user.id)
    .neq("status", "verwijderd")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (appointmentError) {
    alert(`Afspraken laden mislukt: ${appointmentError.message}`);
    return;
  }

  const appointmentList = appointments || [];

  const clientNameEl = document.getElementById("clientName");
  const clientPhoneEl = document.getElementById("clientPhone");
  const clientAddressEl = document.getElementById("clientAddress");
  const clientPaymentEl = document.getElementById("clientPayment");
  const clientEmergencyContactEl = document.getElementById("clientEmergencyContact");
  const clientEmailEl = document.getElementById("clientEmail");
  const clientIbanEl = document.getElementById("clientIban");

  const totalAppointmentsEl = document.getElementById("totalAppointments");
  const lastVisitEl = document.getElementById("lastVisit");
  const minutesThisMonthEl = document.getElementById("minutesThisMonth");

  const signalTotalEl = document.getElementById("signalTotal");
  const lastSignalEl = document.getElementById("lastSignal");
  const alertStatusEl = document.getElementById("alertStatus");
  const alertBoxEl = document.getElementById("alertBox");

  const callClientBtn = document.getElementById("callClientBtn");

  clientNameEl.textContent = client.full_name || "Onbekende cliënt";
  clientPhoneEl.textContent = client.phone || "-";
  clientAddressEl.textContent = [client.address, client.postal_code, client.city].filter(Boolean).join(", ") || "-";
  clientPaymentEl.textContent = client.funding_type || "-";
  clientEmergencyContactEl.textContent = client.emergency_contact || "-";
  clientEmailEl.textContent = client.client_email || "-";
  clientIbanEl.textContent = client.iban || "-";

  if (client.phone) {
    callClientBtn.href = `tel:${client.phone}`;
  } else {
    callClientBtn.href = "#";
  }

  totalAppointmentsEl.textContent = String(appointmentList.length);

  const lastAppointment = appointmentList[0];
  lastVisitEl.textContent = lastAppointment?.appointment_date ? formatDate(lastAppointment.appointment_date) : "-";

  const monthPrefix = getCurrentMonthPrefix();
  const minutesThisMonth = appointmentList
    .filter(item => item.appointment_date && item.appointment_date.startsWith(monthPrefix))
    .reduce((sum, item) => sum + (Number(item.worked_minutes || item.duration_minutes || 0)), 0);

  minutesThisMonthEl.textContent = String(minutesThisMonth);

  const signalTotal = countSignalPoints(appointmentList);
  signalTotalEl.textContent = String(signalTotal);

  const latestSignalAppointment = appointmentList.find(item =>
    (item.signal_notes && String(item.signal_notes).trim() !== "") ||
    (item.internal_signals && String(item.internal_signals).trim() !== "") ||
    item.person_status === "zorgelijk" ||
    item.house_status === "zorgelijk"
  );

  lastSignalEl.textContent = latestSignalAppointment?.signal_notes || latestSignalAppointment?.internal_signals || "-";

  if (signalTotal >= 3) {
    alertStatusEl.textContent = "Actiesignaal actief";
    alertBoxEl.style.background = "#fef2f2";
    alertBoxEl.style.borderColor = "#fecaca";
  } else {
    alertStatusEl.textContent = "Normaal";
  }
}

loadClientCard();