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

function getText(id) {
  const el = document.getElementById(id);
  return el ? el.textContent.trim() : "";
}

function formatEuro(value) {
  const n = Number(value || 0);
  return `€${n.toFixed(2).replace(".", ",")}`;
}

function getInvoiceNumberFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invoice") || "#2026-TEST";
}

function formatToday() {
  return new Date().toLocaleDateString("nl-NL");
}

async function initInvoicePreview() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session?.user) {
    alert("U bent niet ingelogd.");
    return;
  }

  currentUser = data.session.user;

  await loadBusinessProfile();
  await loadInvoiceDraft();
  await loadClientFromInvoice();

  fillInvoicePreview();
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
    description: "Praktische ondersteuning aan huis",
    minutes: 220,
    amount: 110,
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
  const name =
    currentClient?.invoice_name ||
    currentClient?.full_name ||
    currentInvoice?.client_name ||
    "Dhr. Test";

  const salutation = currentClient?.salutation;

  if (salutation === "dhr" && !name.toLowerCase().includes("dhr")) {
    return `Dhr. ${name}`;
  }

  if (salutation === "mw" && !name.toLowerCase().includes("mevr")) {
    return `Mevr. ${name}`;
  }

  return name;
}

function fillInvoicePreview() {
  const invoiceNumber = currentInvoice?.invoice_number || getInvoiceNumberFromUrl();
  const amount = currentInvoice?.amount || 0;
  const total = currentInvoice?.total || amount;

  setText("companyName", currentProfile?.company_name || "Bedrijfsnaam");
  setText("companyOwner", currentProfile?.owner_name || "");
  setText("companyKvk", currentProfile?.kvk_number || "");
  setText("companyIban", currentProfile?.iban || "");
  setText("invoiceVatText", currentProfile?.vat_text || "");

  setText("invoiceNumber", invoiceNumber);
  setText("invoiceDate", formatToday());

  setText("invoiceClientName", getClientName());
  setText("invoiceClientAddress", currentClient?.invoice_address || currentClient?.address || currentInvoice?.client_address || "");
  setText("invoiceClientPostcode", currentClient?.invoice_postal_code || currentClient?.postal_code || currentInvoice?.client_postcode || "");
  setText("invoiceClientCity", currentClient?.invoice_city || currentClient?.city || currentInvoice?.client_city || "");
  setText("invoiceClientEmail", currentClient?.invoice_email || currentClient?.email || currentClient?.client_email || currentInvoice?.client_email || "");

  setText("invoiceDescription", currentInvoice?.description || "Praktische ondersteuning aan huis");
  setText("invoiceMinutes", currentInvoice?.minutes || "");
  setText("invoiceAmount", formatEuro(amount));
  setText("invoiceTotal", formatEuro(total));
}

function enableInvoiceEdit() {
  const fields = document.querySelectorAll(
    "#invoiceNumber, #invoiceClientName, #invoiceClientAddress, #invoiceClientPostcode, #invoiceClientCity, #invoiceClientEmail, #invoiceDescription, #invoiceMinutes, #invoiceAmount, #invoiceTotal"
  );

  fields.forEach((field) => {
    field.contentEditable = "true";
    field.style.background = "#fff8dc";
    field.style.padding = "4px 6px";
    field.style.borderRadius = "6px";
  });

  alert("Factuur staat nu in bewerkmodus.");
}

async function saveInvoiceDraft() {
  if (!currentUser) {
    alert("Geen ingelogde gebruiker gevonden.");
    return;
  }

  const invoiceNumber = getText("invoiceNumber") || getInvoiceNumberFromUrl();

  const amountNumber =
    Number(getText("invoiceAmount").replace("€", "").replace(",", ".").trim()) || 0;

  const totalNumber =
    Number(getText("invoiceTotal").replace("€", "").replace(",", ".").trim()) || amountNumber;

  const payload = {
    owner_id: currentUser.id,
    invoice_number: invoiceNumber,
    client_id: currentInvoice?.client_id || null,

    client_name: getText("invoiceClientName"),
    client_address: getText("invoiceClientAddress"),
    client_postcode: getText("invoiceClientPostcode"),
    client_city: getText("invoiceClientCity"),
    client_email: getText("invoiceClientEmail"),

    description: getText("invoiceDescription"),
    minutes: Number(getText("invoiceMinutes")) || null,
    amount: amountNumber,
    total: totalNumber,

    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .upsert(payload, { onConflict: "owner_id,invoice_number" });

  if (error) {
    alert("Opslaan mislukt: " + error.message);
    return;
  }

  alert("Wijzigingen opgeslagen.");
}

function chooseSendMethod() {
  const sendBookkeeping =
    document.getElementById("sendToBookkeeping")?.checked ||
    document.getElementById("sendAccountingCopy")?.checked;

  const method = prompt("Hoe wilt u verzenden?\n\nTyp: email\nof typ: post");

  if (!method) return;

  if (method.toLowerCase() === "email") {
    alert(
      sendBookkeeping
        ? "Factuur wordt later per e-mail verzonden met kopie naar boekhouding."
        : "Factuur wordt later per e-mail verzonden."
    );
  } else if (method.toLowerCase() === "post") {
    window.print();
  } else {
    alert("Kies email of post.");
  }
}

document.addEventListener("DOMContentLoaded", initInvoicePreview);