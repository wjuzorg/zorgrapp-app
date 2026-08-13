const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentClient = null;
let matchingClients = [];

const toggleEditClientBtn = document.getElementById("toggleEditClientBtn");
const editClientForm = document.getElementById("editClientForm");
const saveClientEditBtn = document.getElementById("saveClientEditBtn");

const editPhone = document.getElementById("editPhone");
const editEmail = document.getElementById("editEmail");
const editAddress = document.getElementById("editAddress");
const editPostalCode = document.getElementById("editPostalCode");
const editCity = document.getElementById("editCity");
const editIban = document.getElementById("editIban");

const editEmergencyContact = document.getElementById("editEmergencyContact");
const editEmergencyContactEmail = document.getElementById("editEmergencyContactEmail");
const editEmergencyContactPhone = document.getElementById("editEmergencyContactPhone");
const editClientMessage = document.getElementById("editClientMessage");

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


function showClientSearchOnly() {
  const searchSection = document.getElementById("clientSearchSection");
  const cardSection = document.getElementById("clientCardSection");
  const backToClientSearch = document.getElementById("backToClientSearch");

  if (searchSection) searchSection.style.display = "block";
  if (cardSection) cardSection.style.display = "none";
  if (backToClientSearch) backToClientSearch.style.display = "none";
}

function showClientCardOnly() {
  const searchSection = document.getElementById("clientSearchSection");
  const cardSection = document.getElementById("clientCardSection");
  const backToClientSearch = document.getElementById("backToClientSearch");

  if (searchSection) searchSection.style.display = "none";
  if (cardSection) cardSection.style.display = "block";
  if (backToClientSearch) backToClientSearch.style.display = "block";
}

async function setupClientSearch() {
  const input = document.getElementById("clientSearchInput");
  const button = document.getElementById("clientSearchBtn");
  const results = document.getElementById("clientSearchResults");

  if (!input || !button || !results) {
    console.error("Zoekelementen niet gevonden");
    return;
  }

  results.innerHTML = `<div class="helper-text">"Bijvoorbeeld: gro voor Groothuizen."</div>`;

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("id, full_name, phone, city")
    .eq("owner_id", currentUser.id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Cliënten zoeken mislukt:", error);
    results.innerHTML = "Cliënten konden niet geladen worden.";
    return;
  }

  const clients = data || [];

  function renderSearchList() {
    const term = input.value.trim().toLowerCase();

    if (!term) {
      results.innerHTML = `<div class="helper-text">"Bijvoorbeeld: gro voor Groothuizen."</div>`;
      return;
    }

    const filtered = clients
  .filter(client =>
    String(client.full_name || "").toLowerCase().includes(term)
  )
  .slice(0, 10);

    if (!filtered.length) {
      results.innerHTML = `<div class="helper-text">Geen cliënt gevonden.</div>`;
      return;
    }

    results.innerHTML = filtered.map(client => `
  <div class="client-search-result">
    <div class="client-search-result-name">
      ${escapeHtml(client.full_name || "Onbekende cliënt")}
    </div>

    <div class="client-search-result-meta">
      ${client.phone ? `Telefoon: ${escapeHtml(client.phone)}<br>` : ""}
      ${client.city ? `Plaats: ${escapeHtml(client.city)}<br>` : ""}
    </div>

    <div class="client-search-result-actions">
      <a class="btn btn-secondary" href="./clientkaart.html?id=${client.id}">
        Open cliëntenkaart
      </a>
    </div>
  </div>
`).join("");
  }

  button.onclick = renderSearchList;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderSearchList();
  });
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

function normalizeInternalSignals(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned || cleaned === "[]" || cleaned === "-") return [];

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {}

    return cleaned
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function hasRealSignal(item) {
  const personStatus = String(item.person_status || "").trim();
  const houseStatus = String(item.house_status || "").trim();
  const signalNotes = String(item.signal_notes || "").trim();
  const internalSignals = normalizeInternalSignals(item.internal_signals);

  return (
    personStatus === "redelijk" ||
    personStatus === "zorgelijk" ||
    houseStatus === "rommelig" ||
    houseStatus === "zorgelijk" ||
    internalSignals.length > 0 ||
    (signalNotes !== "" && signalNotes !== "-")
  );
}

function buildSignalText(item) {
  const parts = [];

  if (item.person_status === "redelijk" || item.person_status === "zorgelijk") {
    parts.push(item.person_status);
  }

  if (item.house_status === "rommelig" || item.house_status === "zorgelijk") {
    parts.push(item.house_status);
  }

  parts.push(...normalizeInternalSignals(item.internal_signals));

  if (
    item.signal_notes &&
    item.signal_notes.trim() !== "" &&
    item.signal_notes.trim() !== "-"
  ) {
    parts.push(item.signal_notes);
  }

  return parts.length ? parts.join(" • ") : "-";
}

function countSignalPoints(appointments) {
  return appointments.filter(hasRealSignal).length;
}

function getLatestSignalText(appointments) {
  const latestSignalAppointment = appointments.find(hasRealSignal);
  return latestSignalAppointment ? buildSignalText(latestSignalAppointment) : "-";
}

async function loadClientSignals() {
  if (!currentUser || !currentClient?.id) return;

  const signalTotalEl = document.getElementById("signalTotal");
  const lastSignalEl = document.getElementById("lastSignal");
  const alertBoxEl = document.getElementById("alertBox");
  const alertStatusEl = document.getElementById("alertStatus");
  const closeBtn = document.getElementById("closeSignalBtn");

  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("owner_id", currentUser.id)
    .eq("client_id", currentClient.id)
    .neq("status", "verwijderd")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (error) {
    console.error("Signalen laden mislukt:", error);
    return;
  }

  const signalAppointments = (data || []).filter(hasRealSignal);
  const signalTotal = signalAppointments.length;
  const isClosed = !!currentClient.signal_closed_at;

  if (signalTotalEl) signalTotalEl.textContent = String(signalTotal);
  if (lastSignalEl) lastSignalEl.textContent = getLatestSignalText(signalAppointments);

  if (!alertBoxEl || !alertStatusEl) return;

  alertBoxEl.style.background = "#f9fafb";
  alertBoxEl.style.borderColor = "#e5e7eb";

  if (isClosed) {
    alertStatusEl.textContent = "Signaal afgesloten";
    if (closeBtn) closeBtn.style.display = "none";
    return;
  }

  if (signalTotal > 0) {
    alertStatusEl.textContent = "Actiesignaal actief";
    alertBoxEl.style.background = "#fef2f2";
    alertBoxEl.style.borderColor = "#fecaca";
    if (closeBtn) closeBtn.style.display = "block";
    return;
  }

  alertStatusEl.textContent = "Normaal";
  if (closeBtn) closeBtn.style.display = "none";
}

async function closeClientSignal() {
  if (!currentUser || !currentClient?.id) {
    alert("Geen cliënt geladen.");
    return;
  }

  const note = prompt(
    "Waarom sluit u het signaal af?\n\nBijvoorbeeld: situatie verbeterd, cliënt gestopt, contact gehad met mantelzorger."
  );

  if (note === null) return;

  const ok = confirm("Wilt u het actieve signaal afsluiten?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("Clients")
    .update({
      signal_closed_at: new Date().toISOString(),
      signal_closed_note: note || "Signaal handmatig afgesloten",
      updated_at: new Date().toISOString()
    })
    .eq("id", currentClient.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    document.getElementById("closeSignalMessage").textContent =
      "Afsluiten mislukt: " + error.message;
    return;
  }

  currentClient.signal_closed_at = new Date().toISOString();
  currentClient.signal_closed_note = note || "Signaal handmatig afgesloten";

  document.getElementById("closeSignalMessage").textContent =
    "Signaal afgesloten ✅";

  const alertBoxEl = document.getElementById("alertBox");
  const alertStatusEl = document.getElementById("alertStatus");
  const total = Number(document.getElementById("signalTotal")?.textContent || 0);

  setAlertStatus(total, alertBoxEl, alertStatusEl);
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
  showClientSearchOnly();
  await setupClientSearch();
  return;
}

showClientCardOnly();

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

  currentClient = selectedClient;
  const matchingClientIds = matchingClients.map(client => client.id);

  if (editPhone) editPhone.value = currentClient.phone || "";
if (editEmail) editEmail.value = currentClient.email || "";
if (editAddress) editAddress.value = currentClient.address || "";
if (editPostalCode) editPostalCode.value = currentClient.postal_code || "";
if (editCity) editCity.value = currentClient.city || "";
if (editIban) editIban.value = currentClient.iban || "";

if (editEmergencyContact) {
  editEmergencyContact.value = currentClient.emergency_contact || "";
}

if (editEmergencyContactEmail) {
  editEmergencyContactEmail.value =
    currentClient.emergency_contact_email || "";
}

if (editEmergencyContactPhone) {
  editEmergencyContactPhone.value =
    currentClient.emergency_contact_phone || "";
}

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
const clientHistoryBtn = document.getElementById("clientHistoryBtn");
const saveContactNoteBtn = document.getElementById("saveContactNoteBtn");
const invoiceRecipientTypeEl = document.getElementById("invoiceRecipientType");
const invoiceRecipientNameEl = document.getElementById("invoiceRecipientName");
const invoiceRecipientEmailEl = document.getElementById("invoiceRecipientEmail");
const invoiceRecipientPhoneEl = document.getElementById("invoiceRecipientPhone");
const editInvoiceRecipientBtn = document.getElementById("editInvoiceRecipientBtn");
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

  if (invoiceRecipientTypeEl) {
  invoiceRecipientTypeEl.textContent =
    currentClient.invoice_contact_type || "-";
}

if (invoiceRecipientNameEl) {
  invoiceRecipientNameEl.textContent =
    currentClient.invoice_contact_name || "-";
}

if (invoiceRecipientEmailEl) {
  invoiceRecipientEmailEl.textContent =
    currentClient.invoice_contact_email || "-";
}

if (invoiceRecipientPhoneEl) {
  invoiceRecipientPhoneEl.textContent =
    currentClient.invoice_contact_phone || "-";
}

if (editInvoiceRecipientBtn) {
  editInvoiceRecipientBtn.href =
    `./new-client.html?client_id=${currentClient.id}`;
}

  if (editInvoiceRecipientBtn) {
  editInvoiceRecipientBtn.href = `./new-client.html?client_id=${currentClient.id}`;
}

  if (callClientBtn) {
  const cleanPhone = String(currentClient.phone || "").replace(/\s+/g, "");

  if (cleanPhone) {
    callClientBtn.href = `tel:${cleanPhone}`;
    callClientBtn.textContent = "Bel cliënt";
  } else {
    callClientBtn.href = "#";
    callClientBtn.textContent = "Geen telefoonnummer bekend";
  }
}

 if (newAppointmentBtn) {
  newAppointmentBtn.href = `./new-client.html?client_id=${currentClient.id}`;
}

if (clientHistoryBtn) {
  clientHistoryBtn.href = `./client-geschiedenis.html?id=${currentClient.id}`;
}

totalAppointmentsEl.textContent = String(appointmentList.length);

const lastAppointment = appointmentList[0];
lastVisitEl.textContent = lastAppointment?.appointment_date
  ? formatDate(lastAppointment.appointment_date)
  : "-";

const monthPrefix = getCurrentMonthPrefix();

const minutesThisMonth = appointmentList
  .filter(item =>
    item.appointment_date &&
    item.appointment_date.startsWith(monthPrefix)
  )
  .reduce(
    (sum, item) =>
      sum + Number(item.worked_minutes || item.duration_minutes || 0),
    0
  );

minutesThisMonthEl.textContent = String(minutesThisMonth);


// Signalen laden
await loadClientSignals();

// Contactnotities
saveContactNoteBtn?.addEventListener("click", saveContactNote);
}

toggleEditClientBtn?.addEventListener("click", () => {
  const isOpen = editClientForm.style.display === "block";

  editClientForm.style.display = isOpen ? "none" : "block";
});

document.getElementById("closeSignalBtn")?.addEventListener("click", closeClientSignal);

saveClientEditBtn?.addEventListener("click", saveClientEdit);

window.closeClientSignal = closeClientSignal;

loadClientCard();

async function saveClientEdit() {
  if (!currentUser || !currentClient?.id) return;

  if (editClientMessage) {
    editClientMessage.textContent = "Opslaan...";
  }

  const updates = {
    phone: editPhone?.value.trim() || null,
    email: editEmail?.value.trim() || null,
    address: editAddress?.value.trim() || null,
    postal_code: editPostalCode?.value.trim() || null,
    city: editCity?.value.trim() || null,
    iban: editIban?.value.trim() || null,
    emergency_contact: editEmergencyContact?.value.trim() || null,
    emergency_contact_email: editEmergencyContactEmail?.value.trim() || null,
    emergency_contact_phone: editEmergencyContactPhone?.value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from("Clients")
    .update(updates)
    .eq("id", currentClient.id)
    .eq("owner_id", currentUser.id)
    .select()
    .single();

  if (error) {
    console.error("Cliëntgegevens opslaan mislukt:", error);
    if (editClientMessage) {
      editClientMessage.textContent = "Opslaan mislukt: " + error.message;
    }
    return;
  }

  currentClient = data;

  document.getElementById("clientPhone").textContent = currentClient.phone || "-";

  document.getElementById("clientAddress").textContent =
    [currentClient.address, currentClient.postal_code, currentClient.city]
      .filter(Boolean)
      .join(", ") || "-";

  document.getElementById("clientPayment").textContent =
    currentClient.iban ? `IBAN: ${currentClient.iban}` : "-";

  document.getElementById("clientEmergencyContact").textContent =
    currentClient.emergency_contact || "-";

  document.getElementById("clientEmergencyContactEmail").textContent =
    currentClient.emergency_contact_email || "-";

  document.getElementById("clientEmergencyContactPhone").textContent =
    currentClient.emergency_contact_phone || "-";

  const callClientBtn = document.getElementById("callClientBtn");
  if (callClientBtn) {
  const cleanPhone = String(currentClient.phone || "").replace(/\s+/g, "");

  if (cleanPhone) {
    callClientBtn.href = `tel:${cleanPhone}`;
    callClientBtn.textContent = "Bel cliënt";
  } else {
    callClientBtn.href = "#";
    callClientBtn.textContent = "Geen telefoonnummer bekend";
  }
}

  if (editClientMessage) {
  editClientMessage.textContent = "Gegevens opgeslagen.";
}

setTimeout(() => {
  if (editClientForm) {
    editClientForm.style.display = "none";
  }
}, 800);
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