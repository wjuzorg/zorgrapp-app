const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let appointmentId = null;
let currentUser = null;
let currentAppointment = null;
let currentClient = null;

function el(id) {
  return document.getElementById(id);
}

function val(id) {
  return el(id)?.value?.trim() || "";
}

function setText(id, text) {
  const box = el(id);
  if (box) box.textContent = text || "-";
}

function setValue(id, value) {
  const box = el(id);
  if (box) box.value = value || "";
}

function showMessage(text, isError = false) {
  const box = el("saveMessage");
  if (!box) return;
  box.textContent = text;
  box.style.color = isError ? "#b91c1c" : "#6b7280";
}

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }

  return data.session.user;
}

function getAppointmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function getSelectedSignals() {
  return Array.from(document.querySelectorAll('.checkbox-list input[type="checkbox"]:checked'))
    .map(input => input.value)
    .join(", ");
}

function setSelectedSignals(signalString) {
  const selected = String(signalString || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(input => {
    input.checked = selected.includes(input.value);
  });
}

function clearSelectedSignals() {
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(input => {
    input.checked = false;
  });
}

function toggleInvoiceFields() {
  const method = val("invoice_delivery_method");

  el("invoiceEmailWrap")?.classList.add("hidden");
  el("invoiceAddressModeWrap")?.classList.add("hidden");
  el("invoiceAddressFields")?.classList.add("hidden");

  if (method === "email") {
    el("invoiceEmailWrap")?.classList.remove("hidden");
  }

  if (method === "address") {
    el("invoiceAddressModeWrap")?.classList.remove("hidden");

    if (val("invoice_same_as_client_address") === "false") {
      el("invoiceAddressFields")?.classList.remove("hidden");
    }
  }
}

function applySignalStatusBehavior() {
  const status = val("signal_status");

  if (status === "verbeterd" || status === "afgesloten" || status === "geen") {
    setValue("person_status", status === "geen" ? "" : "goed");
    setValue("house_status", status === "geen" ? "" : "netjes");
    clearSelectedSignals();
  }
}

async function loadAppointment() {
  appointmentId = getAppointmentIdFromUrl();

  if (!appointmentId) {
    showMessage("Geen afspraak gevonden.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("owner_id", currentUser.id)
    .single();

  if (error || !data) {
    showMessage(`Afspraak niet gevonden: ${error?.message || "onbekend"}`, true);
    return;
  }

 currentAppointment = data;

  // STAP 1: Haal EERST de cliënt op, zodat we de gegevens bij de hand hebben
  await loadClient(data.client_id);

  // STAP 2: Vul de algemene info in op het scherm
  setText("infoClientName", data.client_name || "-");
  setText("infoTime", data.appointment_time || "-");
  setText("infoServiceType", data.service_type || "-");

  // STAP 3: Vul de invoervelden in
  setValue("work_done", data.work_done || "");
  setValue("worked_minutes", data.worked_minutes || data.duration_minutes || "");
  setValue("person_status", data.person_status || "");
  setValue("house_status", data.house_status || "");
  setValue("signal_notes", data.signal_notes || "");

  // Slimme check: pak de betalingsvorm van de afspraak, of van de cliënt (als die al eerder is opgeslagen)
  setValue("payment_type", data.payment_type || currentClient?.payment_type || "");

  // Vul de PGB/Wmo gegevens in (pakt nu écht de gegevens van de cliënt als de afspraak nog leeg is!)
  setValue("funding_reference", data.funding_reference || currentClient?.funding_reference || "");
  setValue("funding_holder_name", data.funding_holder_name || currentClient?.invoice_contact_name || currentClient?.funding_holder_name || "");
  setValue("funding_organization", data.funding_organization || currentClient?.funding_organization || "");

  // Periode gokken we slim op basis van de afspraakdatum als deze nog niet specifiek is ingevuld
  if (!data.funding_period && data.appointment_date) {
    const date = new Date(data.appointment_date);
    const opties = { month: 'long', year: 'numeric' };
    setValue("funding_period", date.toLocaleDateString('nl-NL', opties));
  } else {
    setValue("funding_period", data.funding_period || currentClient?.funding_period || "");
  }

  setSelectedSignals(data.internal_signals || "");

  setValue("km", data.km || "");
  setValue("material_cost", data.material_cost || "");
  setValue("parking_cost", data.parking_cost || "");
}

async function loadClient(clientId) {
  if (!clientId) return;

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", clientId)
    .eq("owner_id", currentUser.id)
    .single();

  if (error || !data) {
    console.warn("Cliënt niet gevonden:", error?.message);
    return;
  }

  currentClient = data;

  setValue("invoice_delivery_method", data.invoice_delivery_method || "nog_niet_afgesproken");
  setValue("invoice_email", data.invoice_email || data.client_email || "");
  setValue(
    "invoice_same_as_client_address",
    String(data.invoice_same_as_client_address ?? true)
  );
  setValue("invoice_address", data.invoice_address || "");
  setValue("invoice_postal_code", data.invoice_postal_code || "");
  setValue("invoice_city", data.invoice_city || "");

  toggleInvoiceFields();
}

function buildAppointmentPayload(statusValue) {
  const signalStatus = val("signal_status");

  let personStatus = val("person_status") || null;
  let houseStatus = val("house_status") || null;
  let internalSignals = getSelectedSignals();

  if (signalStatus === "geen" || signalStatus === "verbeterd" || signalStatus === "afgesloten") {
    personStatus = signalStatus === "geen" ? null : "goed";
    houseStatus = signalStatus === "geen" ? null : "netjes";
    internalSignals = "";
  }

  return {
    work_done: val("work_done"),
    worked_minutes: val("worked_minutes") ? Number(val("worked_minutes")) : null,
    person_status: personStatus,
    house_status: houseStatus,
    internal_signals: internalSignals,
    signal_notes: val("signal_notes"),
    signal_status: signalStatus || "geen",
    payment_type: val("payment_type") || null,
    funding_reference: val("funding_reference") || null,
funding_holder_name: val("funding_holder_name") || null,
funding_organization: val("funding_organization") || null,
funding_period: val("funding_period") || null,
    ready_for_invoice: statusValue === "voltooid",
    status: statusValue,
    km: Number(val("km") || 0),
material_cost: Number(val("material_cost") || 0),
parking_cost: Number(val("parking_cost") || 0),
    updated_at: new Date().toISOString()
  };
}

function buildClientPayload() {
  return {
    invoice_delivery_method: val("invoice_delivery_method") || "nog_niet_afgesproken",
    invoice_email: val("invoice_email"),
    invoice_same_as_client_address: val("invoice_same_as_client_address") !== "false",
    invoice_address: val("invoice_address"),
    invoice_postal_code: val("invoice_postal_code"),
    invoice_city: val("invoice_city"),

    funding_type: val("payment_type") || currentClient?.funding_type || "",
    funding_reference: val("funding_reference") || currentClient?.funding_reference || "",
    funding_holder_name: val("funding_holder_name") || currentClient?.funding_holder_name || "",
    funding_organization: val("funding_organization") || currentClient?.funding_organization || "",
    funding_period: val("funding_period") || currentClient?.funding_period || "",

    updated_at: new Date().toISOString()
  };
}

async function saveClientInvoiceFields() {
  if (!currentClient?.id) return true;

  const { error } = await supabaseClient
    .from("Clients")
    .update(buildClientPayload())
    .eq("id", currentClient.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    showMessage(`Cliëntgegevens opslaan mislukt: ${error.message}`, true);
    return false;
  }

  return true;
}

async function saveAppointment(statusValue = "open") {
  if (!appointmentId) {
    showMessage("Geen afspraak-ID gevonden.", true);
    return false;
  }

  const clientOk = await saveClientInvoiceFields();
  if (!clientOk) return false;

  const { error } = await supabaseClient
    .from("Appointments")
    .update(buildAppointmentPayload(statusValue))
    .eq("id", appointmentId)
    .eq("owner_id", currentUser.id);

  if (error) {
    showMessage(`Opslaan mislukt: ${error.message}`, true);
    return false;
  }

  return true;
}

async function deleteAppointment() {
  const confirmed = window.confirm("Weet je zeker dat je deze afspraak wilt verwijderen?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("Appointments")
    .update({
      status: "verwijderd",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", appointmentId)
    .eq("owner_id", currentUser.id);

  if (error) {
    showMessage(`Verwijderen mislukt: ${error.message}`, true);
    return;
  }

  showMessage("Afspraak verwijderd.");

  setTimeout(() => {
    window.location.href = "./index.html";
  }, 800);
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireLogin();
  if (!currentUser) return;

  await loadAppointment();

  el("invoice_delivery_method")?.addEventListener("change", toggleInvoiceFields);
  el("invoice_same_as_client_address")?.addEventListener("change", toggleInvoiceFields);
  el("signal_status")?.addEventListener("change", applySignalStatusBehavior);

async function createInvoiceDraftFromAppointment() {
  const { data: appointment, error: appointmentError } = await supabaseClient
    .from("Appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (appointmentError || !appointment) {
    showMessage("Afspraak ophalen voor factuur mislukt.", true);
    return false;
  }

  const { data: existing } = await supabaseClient
    .from("invoice_drafts")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existing) {
    return true;
     }

    const minutes = Number(
  appointment.worked_minutes ||
  appointment.duration_minutes ||
  0
);
 

  const { data: businessProfile, error: businessError } = await supabaseClient
  .from("business_profiles")
  .select("hourly_rate")
  .eq("owner_id", currentUser.id)
  .maybeSingle();

if (businessError) {
  showMessage("Bedrijfsprofiel kon niet worden opgehaald.", true);
  return false;
}

const hourlyRate = Number(businessProfile?.hourly_rate || 0);

if (!hourlyRate) {
  showMessage("Geen standaard uurtarief ingesteld in het bedrijfsprofiel.", true);
  return false;
}

const km = Number(appointment.km || 0);
const kmAmount = km * 0.23;

const materialCost = Number(appointment.material_cost || 0);
const parkingCost = Number(appointment.parking_cost || 0);

const workAmount = (minutes / 60) * hourlyRate;

const amount =
  workAmount +
  kmAmount +
  materialCost +
  parkingCost;

const invoiceNumber = `TEST-${Date.now()}`;

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
      work_done: appointment.work_done || "",
service_name: appointment.service_type || appointment.service_name || appointment.appointment_type || "Ondersteuning",
appointment_date: appointment.appointment_date || null,
      km,
      km_amount: kmAmount,
      material_cost: materialCost,
      parking_cost: parkingCost,
      payment_type: appointment.payment_type || "particulier",
     invoice_delivery_method:
  appointment.invoice_delivery_method ||
  currentClient?.invoice_delivery_method ||
  "nog_niet_afgesproken",
  invoice_contact_type:
  currentClient?.invoice_contact_type || null,

invoice_contact_name:
  currentClient?.invoice_contact_name || null,

invoice_contact_email:
  currentClient?.invoice_contact_email || null,

invoice_contact_phone:
  currentClient?.invoice_contact_phone || null,

funding_reference: document.getElementById("funding_reference")?.value || null,
funding_holder_name: document.getElementById("funding_holder_name")?.value || null,
funding_organization: document.getElementById("funding_organization")?.value || null,
funding_period: document.getElementById("funding_period")?.value || null,
status: "klaar"
}]);

  if (insertError) {
    showMessage("Factuur maken mislukt: " + insertError.message, true);
    return false;
  }

  return true;
}

  el("fillForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  showMessage("Afspraak afronden...");

  const saved = await saveAppointment("voltooid");
  if (!saved) return;

  showMessage("Factuur wordt aangemaakt...");

  const invoiceOk = await createInvoiceDraftFromAppointment();
  if (!invoiceOk) return;

  alert("Factuur is aangemaakt. U vindt deze terug bij Facturen.");

  window.location.href = "./index.html";
});

  el("deleteAppointmentBtn")?.addEventListener("click", deleteAppointment);
});