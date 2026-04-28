const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function getText(id) {
  const el = document.getElementById(id);
  return el ? el.textContent.trim() : "";
}

function formatToday() {
  return new Date().toLocaleDateString("nl-NL");
}

async function initInvoicePreview() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session || !data.session.user) {
    alert("U bent niet ingelogd. Log opnieuw in.");
    window.location.href = "login.html";
    return;
  }

  currentUser = data.session.user;

  setText("invoiceDate", formatToday());

  await loadBusinessProfile();
  await loadInvoiceDraft();
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

  if (!data) return;

  setText("companyName", data.company_name || "Bedrijfsnaam");
  setText("companyOwner", data.owner_name || "");
  setText("companyKvk", data.kvk_number || "");
  setText("companyIban", data.iban || "");
  setText("invoiceVatText", data.vat_text || "");
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
    alert("Geen gebruiker gevonden.");
    return;
  }

  const invoiceNumber = getText("invoiceNumber") || "#2026-TEST";

  const amountNumber = Number(
    getText("invoiceAmount")
      .replace("€", "")
      .replace(",", ".")
      .trim()
  ) || 0;

  const totalNumber = Number(
    getText("invoiceTotal")
      .replace("€", "")
      .replace(",", ".")
      .trim()
  ) || amountNumber;

  const payload = {
    owner_id: currentUser.id,
    invoice_number: invoiceNumber,

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

async function loadInvoiceDraft() {
  const invoiceNumber = getText("invoiceNumber") || "#2026-TEST";

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();

  if (error) {
    console.error("Conceptfactuur laden mislukt:", error.message);
    return;
  }

  if (!data) return;

  setText("invoiceClientName", data.client_name);
  setText("invoiceClientAddress", data.client_address);
  setText("invoiceClientPostcode", data.client_postcode);
  setText("invoiceClientCity", data.client_city);
  setText("invoiceClientEmail", data.client_email);
  setText("invoiceDescription", data.description);
  setText("invoiceMinutes", data.minutes ? String(data.minutes) : "");
  setText("invoiceAmount", data.amount ? `€${Number(data.amount).toFixed(2).replace(".", ",")}` : "");
  setText("invoiceTotal", data.total ? `€${Number(data.total).toFixed(2).replace(".", ",")}` : "");
}

function chooseSendMethod() {
  const sendBookkeeping = document.getElementById("sendToBookkeeping")?.checked;

  const choice = confirm(
    sendBookkeeping
      ? "Factuur verzenden naar cliënt én kopie naar boekhouding?"
      : "Factuur verzenden naar cliënt?"
  );

  if (!choice) return;

  const method = prompt("Hoe wilt u verzenden?\n\nTyp: email\nof typ: post");

  if (!method) return;

  if (method.toLowerCase() === "email") {
    alert(
      sendBookkeeping
        ? "Factuur wordt later per e-mail verzonden met kopie naar boekhouding."
        : "Factuur wordt later per e-mail verzonden."
    );
  } else if (method.toLowerCase() === "post") {
    alert(
      sendBookkeeping
        ? "Factuur wordt gemarkeerd voor postverzending met kopie naar boekhouding."
        : "Factuur wordt gemarkeerd voor postverzending."
    );
  } else {
    alert("Kies email of post.");
  }
}

document.addEventListener("DOMContentLoaded", initInvoicePreview);