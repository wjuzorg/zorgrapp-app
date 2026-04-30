const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentInvoice = null;
let currentClient = null;
let currentProfile = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function formatEuro(value) {
  const number = Number(value || 0);
  return `€${number.toFixed(2).replace(".", ",")}`;
}

function getInvoiceNumberFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invoice") || "#2026-0031";
}

async function initReminderPage() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session?.user) {
    alert("U bent niet ingelogd.");
    return;
  }

  currentUser = data.session.user;

  await loadBusinessProfile();
  await loadInvoiceDraft();
  await loadClientFromInvoice();

  fillReminderPage();
}

async function loadBusinessProfile() {
  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error) {
    alert("Bedrijfsprofiel laden mislukt: " + error.message);
    return;
  }

  currentProfile = data;
}

async function loadInvoiceDraft() {
  const invoiceNumber = getInvoiceNumberFromUrl();

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();

  if (error) {
    alert("Factuur laden mislukt: " + error.message);
    return;
  }

  currentInvoice = data || {
    invoice_number: invoiceNumber,
    client_name: "Dhr. Test",
    client_email: "test@email.nl",
    total: 110
  };
}

async function loadClientFromInvoice() {
  if (!currentInvoice?.client_id) return;

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", currentInvoice.client_id)
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error) {
    alert("Cliëntgegevens laden mislukt: " + error.message);
    return;
  }

  currentClient = data;
}

function getClientName() {
  return (
    currentClient?.invoice_name ||
    currentClient?.full_name ||
    currentInvoice?.client_name ||
    "Dhr. Test"
  );
}

function getClientEmail() {
  return (
    currentClient?.invoice_email ||
    currentClient?.email ||
    currentClient?.client_email ||
    currentInvoice?.invoice_email ||
    currentInvoice?.client_email ||
    ""
  );
}

function getClientAddressBlock() {
  const invoiceAddress = currentClient?.invoice_address;
  const invoicePostcode = currentClient?.invoice_postal_code;
  const invoiceCity = currentClient?.invoice_city;

  const normalAddress = currentClient?.address;
  const normalPostcode = currentClient?.postal_code;
  const normalCity = currentClient?.city;

  const address = invoiceAddress || normalAddress || "";
  const postcode = invoicePostcode || normalPostcode || "";
  const city = invoiceCity || normalCity || "";

  return `${address}\n${postcode} ${city}`.trim();
}

function fillReminderPage() {
  const invoiceNumber = currentInvoice?.invoice_number || "#2026-0031";
  const clientName = getClientName();
  const clientAddress = getClientAddressBlock();
  const amount = currentInvoice?.total || currentInvoice?.amount || 110;

  const signName =
    currentProfile?.owner_name ||
    currentProfile?.company_name ||
    "ZorgInzicht";

  const iban = currentProfile?.iban || "";
  const kvk = currentProfile?.kvk_number || "";

  setText("reminderClientName", clientName);
  setText("reminderInvoiceNumber", `Factuur ${invoiceNumber}`);
  setText("reminderAmount", `Openstaand bedrag: ${formatEuro(amount)}`);

  const reminderText = document.getElementById("reminderText");
  if (!reminderText) return;

  reminderText.value = `Beste heer/mevrouw,

Volgens onze administratie staat onderstaande factuur nog open.

Factuurnummer: ${invoiceNumber}
Openstaand bedrag: ${formatEuro(amount)}

Wellicht is deze factuur aan uw aandacht ontsnapt.

Wij verzoeken u vriendelijk het openstaande bedrag binnen 7 werkdagen alsnog te voldoen.

Heeft u de betaling inmiddels gedaan? Dan kunt u deze herinnering als niet verzonden beschouwen.

Met vriendelijke groet,

${signName}${iban ? `\nIBAN: ${iban}` : ""}${kvk ? `\nKVK: ${kvk}` : ""}`;

  if (clientAddress) {
    reminderText.value =
      `Aan:\n${clientName}\n${clientAddress}\n\n` + reminderText.value;
  }
}

function sendReminderByEmail() {
  const clientEmail = getClientEmail();

  if (!clientEmail) {
    alert("Geen e-mailadres van de cliënt gevonden.");
    return;
  }

  const invoiceNumber = currentInvoice?.invoice_number || "#2026-0031";
  const subject = encodeURIComponent(`Betalingsherinnering factuur ${invoiceNumber}`);
  const body = encodeURIComponent(document.getElementById("reminderText").value);

  window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
}

function sendReminderByPost() {
  window.print();
}

document.addEventListener("DOMContentLoaded", initReminderPage);