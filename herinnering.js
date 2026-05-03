const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMzImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

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
  return params.get("invoice") || "";
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
    amount: 110
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
  const useInvoiceAddress =
    currentClient?.invoice_delivery_method === "address" &&
    currentClient?.invoice_same_as_client_address === false;

  const address = useInvoiceAddress
    ? currentClient?.invoice_address || ""
    : currentClient?.address || "";

  const postcode = useInvoiceAddress
    ? currentClient?.invoice_postal_code || ""
    : currentClient?.postal_code || "";

  const city = useInvoiceAddress
    ? currentClient?.invoice_city || ""
    : currentClient?.city || "";

  return `${address}\n${postcode} ${city}`.trim();
}

function fillReminderPage() {
  const invoiceNumber = currentInvoice?.invoice_number || "";
  const clientName = getClientName();
  const clientAddress = getClientAddressBlock();
  const amount = currentInvoice?.total || currentInvoice?.amount || 0;

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

  const salutation = currentClient?.salutation;
  let aanhef = clientName;

  if (salutation === "dhr") aanhef = `Dhr. ${clientName}`;
  if (salutation === "mw") aanhef = `Mevr. ${clientName}`;

  let text = `Beste ${aanhef},

Volgens onze administratie staat onderstaande factuur nog open.

Factuurnummer: ${invoiceNumber}
Openstaand bedrag: ${formatEuro(amount)}

Wellicht is deze factuur aan uw aandacht ontsnapt.

Wij verzoeken u vriendelijk het openstaande bedrag binnen 7 werkdagen alsnog te voldoen.

Heeft u de betaling inmiddels gedaan? Dan kunt u deze herinnering als niet verzonden beschouwen.

Met vriendelijke groet,

${signName}${iban ? `\nIBAN: ${iban}` : ""}${kvk ? `\nKVK: ${kvk}` : ""}`;

  if (clientAddress) {
    text = `Aan:\n${clientName}\n${clientAddress}\n\n${text}`;
  }

  reminderText.value = text;
}

async function registerReminderSent(type) {
  if (!currentInvoice?.invoice_number) {
    alert("Geen factuur gevonden.");
    return false;
  }

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      reminder_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", currentInvoice.invoice_number);

  if (error) {
    alert("Herinnering registreren mislukt: " + error.message);
    return false;
  }

  return true;
}

async function sendReminderByEmail() {
  const clientEmail = getClientEmail();

  if (!clientEmail) {
    alert("Geen e-mailadres van de cliënt gevonden.");
    return;
  }

  const invoiceNumber = currentInvoice?.invoice_number || "";
  const subject = encodeURIComponent(`Betalingsherinnering factuur ${invoiceNumber}`);
  const body = encodeURIComponent(document.getElementById("reminderText").value);

  const ok = await registerReminderSent("mail");
  if (!ok) return;

  window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;

  alert("Herinnering per mail is geregistreerd als verzonden.");
}

async function sendReminderByPost() {
  window.print();

  const confirmed = confirm("Is de herinnering geprint of opgeslagen als PDF en klaar om per post te versturen?");
  if (!confirmed) return;

  const ok = await registerReminderSent("post");
  if (!ok) return;

  alert("Herinnering is geregistreerd als per post verzonden.");
  window.location.href = "facturen.html";
}

document.addEventListener("DOMContentLoaded", initReminderPage);