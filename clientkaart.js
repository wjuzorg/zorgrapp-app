const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentClient = null;
let matchingClients = [];

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

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function getTodayNoteDate() {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function showContactNoteMessage(text, isError = false) {
  const el = document.getElementById("contactNoteMessage");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#b91c1c" : "#6b7280";
}

function renderContactNotes(noteString) {
  const listEl = document.getElementById("contactNotesList");
  if (!listEl) return;

  if (!noteString || String(noteString).trim() === "") {
    listEl.innerHTML = "Nog geen notities opgeslagen.";
    return;
  }

  const notes = String(noteString)
    .split("\n---\n")
    .map(item => item.trim())
    .filter(Boolean);

  listEl.innerHTML = notes.map(note => {
    const lines = note.split("\n");
    const dateLine = lines[0] || "";
    const textLines = lines.slice(1).join("\n") || "";

    return `
      <div class="saved-note-card">
        <span class="saved-note-date">${dateLine}</span>
        <div class="saved-note-text">${textLines}</div>
      </div>
    `;
  }).join("");
}

function buildNewContactNote(existingNotes, newNoteText) {
  const datedNote = `${getTodayNoteDate()}\n${newNoteText}`;

  if (!existingNotes || String(existingNotes).trim() === "") {
    return datedNote;
  }

  return `${datedNote}\n---\n${existingNotes}`;
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

function getLatestSignalText(appointments) {
  const latestSignalAppointment = appointments.find(item =>
    (item.signal_notes && String(item.signal_notes).trim() !== "") ||
    (item.internal_signals && String(item.internal_signals).trim() !== "") ||
    item.person_status === "zorgelijk" ||
    item.house_status === "zorgelijk"
  );

  if (!latestSignalAppointment) return "-";

  if (latestSignalAppointment.signal_notes && String(latestSignalAppointment.signal_notes).trim() !== "") {
    return latestSignalAppointment.signal_notes;
  }

  if (latestSignalAppointment.internal_signals && String(latestSignalAppointment.internal_signals).trim() !== "") {
    return latestSignalAppointment.internal_signals;
  }

  if (latestSignalAppointment.person_status === "zorgelijk") {
    return "Persoon is zorgelijk";
  }

  if (latestSignalAppointment.house_status === "zorgelijk") {
    return "Huis is zorgelijk";
  }

  return "-";
}

function setAlertStatus(signalTotal, alertBoxEl, alertStatusEl) {
  alertBoxEl.style.background = "#f9fafb";
  alertBoxEl.style.borderColor = "#e5e7eb";

  if (signalTotal >= 3) {
    alertStatusEl.textContent = "Actiesignaal actief";
    alertBoxEl.style.background = "#fef2f2";
    alertBoxEl.style.borderColor = "#fecaca";
    return;
  }

  if (signalTotal >= 2) {
    alertStatusEl.textContent = "Let op";
    alertBoxEl.style.background = "#fff7ed";
    alertBoxEl.style.borderColor = "#fed7aa";
    return;
  }

  alertStatusEl.textContent = "Normaal";
}

async function saveContactNote() {
  if (!currentUser || !matchingClients.length || !currentClient) return;

  const contactNoteEl = document.getElementById("contactNote");
  const note = contactNoteEl?.value.trim() || "";

  if (!note) {
    showContactNoteMessage("Vul eerst een notitie in.", true);
    return;
  }

  if (note.includes("\n---\n")) {
    showContactNoteMessage("Typ hier alleen een nieuwe notitie.", true);
    return;
  }

  showContactNoteMessage("Opslaan...");

  const updatedNoteValue = buildNewContactNote(currentClient.contact_note || "", note);
  const clientIds = matchingClients.map(client => client.id);

  const { error } = await supabaseClient
    .from("Clients")
    .update({ contact_note: updatedNoteValue })
    .in("id", clientIds)
    .eq("owner_id", currentUser.id);

  if (error) {
    showContactNoteMessage(`Opslaan mislukt: ${error.message}`, true);
    return;
  }

  currentClient.contact_note = updatedNoteValue;
  matchingClients = matchingClients.map(client => ({
    ...client,
    contact_note: updatedNoteValue
  }));

  if (contactNoteEl) {
    contactNoteEl.value = "";
  }

  renderContactNotes(updatedNoteValue);
  showContactNoteMessage("Notitie opgeslagen.");
}

async function loadClientCard() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  const clientId = getClientIdFromUrl();
  if (!clientId) {
    alert("Geen cliënt-ID gevonden.");
    return;
  }

  const { data: selectedClient, error: clientError } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", clientId)
    .eq("owner_id", currentUser.id)
    .single();

  if (clientError || !selectedClient) {
    alert(`Cliënt niet gevonden: ${clientError?.message || "onbekend"}`);
    return;
  }

  const normalizedClientName = normalizeName(selectedClient.full_name);

  const { data: allClients, error: allClientsError } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("owner_id", currentUser.id);

  if (allClientsError) {
    alert(`Cliënten laden mislukt: ${allClientsError.message}`);
    return;
  }

  matchingClients = (allClients || []).filter(client =>
    normalizeName(client.full_name) === normalizedClientName
  );

  currentClient = matchingClients[0] || selectedClient;
  const matchingClientIds = matchingClients.map(client => client.id);

  const { data: allAppointments, error: appointmentError } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("owner_id", currentUser.id)
    .neq("status", "verwijderd")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (appointmentError) {
    alert(`Afspraken laden mislukt: ${appointmentError.message}`);
    return;
  }

  const appointmentList = (allAppointments || []).filter(item => {
    const sameClientId = item.client_id && matchingClientIds.includes(item.client_id);
    const sameClientName = normalizeName(item.client_name) === normalizedClientName;
    return sameClientId || sameClientName;
  });

  const clientNameEl = document.getElementById("clientName");
  const clientPhoneEl = document.getElementById("clientPhone");
  const clientAddressEl = document.getElementById("clientAddress");
  const clientPaymentEl = document.getElementById("clientPayment");

  const clientEmergencyContactEl = document.getElementById("clientEmergencyContact");
  const clientEmergencyContactEmailEl = document.getElementById("clientEmergencyContactEmail");
  const clientEmergencyContactPhoneEl = document.getElementById("clientEmergencyContactPhone");

  const contactNoteEl = document.getElementById("contactNote");

  const totalAppointmentsEl = document.getElementById("totalAppointments");
  const lastVisitEl = document.getElementById("lastVisit");
  const minutesThisMonthEl = document.getElementById("minutesThisMonth");

  const signalTotalEl = document.getElementById("signalTotal");
  const lastSignalEl = document.getElementById("lastSignal");
  const alertStatusEl = document.getElementById("alertStatus");
  const alertBoxEl = document.getElementById("alertBox");

  const callClientBtn = document.getElementById("callClientBtn");
  const newAppointmentBtn = document.getElementById("newAppointmentBtn");
  const saveContactNoteBtn = document.getElementById("saveContactNoteBtn");

  clientNameEl.textContent = currentClient.full_name || "Onbekende cliënt";

  clientPhoneEl.textContent = currentClient.phone || "-";
  clientAddressEl.textContent =
    [currentClient.address, currentClient.postal_code, currentClient.city]
      .filter(Boolean)
      .join(", ") || "-";

  const paymentText = [
    currentClient.funding_type || "",
    currentClient.iban ? `IBAN: ${currentClient.iban}` : ""
  ].filter(Boolean).join(" • ");

  clientPaymentEl.textContent = paymentText || "-";

  clientEmergencyContactEl.textContent = currentClient.emergency_contact || "-";
  clientEmergencyContactEmailEl.textContent = currentClient.emergency_contact_email || "-";
  clientEmergencyContactPhoneEl.textContent = currentClient.emergency_contact_phone || "-";

  if (contactNoteEl) {
    contactNoteEl.value = "";
  }

  renderContactNotes(currentClient.contact_note || "");

  if (currentClient.phone) {
    callClientBtn.href = `tel:${currentClient.phone}`;
  } else {
    callClientBtn.href = "#";
  }

  if (newAppointmentBtn) {
    newAppointmentBtn.href = `./new-client.html?client_id=${currentClient.id}`;
  }

  totalAppointmentsEl.textContent = String(appointmentList.length);

  const lastAppointment = appointmentList[0];
  lastVisitEl.textContent = lastAppointment?.appointment_date
    ? formatDate(lastAppointment.appointment_date)
    : "-";

  const monthPrefix = getCurrentMonthPrefix();
  const minutesThisMonth = appointmentList
    .filter(item => item.appointment_date && item.appointment_date.startsWith(monthPrefix))
    .reduce((sum, item) => sum + Number(item.worked_minutes || item.duration_minutes || 0), 0);

  minutesThisMonthEl.textContent = String(minutesThisMonth);

  const signalTotal = countSignalPoints(appointmentList);
  signalTotalEl.textContent = String(signalTotal);

  lastSignalEl.textContent = getLatestSignalText(appointmentList);
  setAlertStatus(signalTotal, alertBoxEl, alertStatusEl);

  saveContactNoteBtn?.addEventListener("click", saveContactNote);
}

loadClientCard();