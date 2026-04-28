const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function formatToday() {
  return new Date().toLocaleDateString("nl-NL");
}

async function initInvoicePreview() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = data.user;

  setText("invoiceDate", formatToday());

  await loadBusinessProfile();
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

  if (!data) {
    setText("invoiceCompanyName", "Bedrijfsprofiel nog niet ingevuld");
    setText("invoiceVatText", "Vul eerst uw bedrijfsprofiel in.");
    return;
  }

  setText("invoiceCompanyName", data.company_name);
  setText("invoiceOwnerName", data.owner_name);

  setText(
    "invoiceCompanyAddress",
    `${data.company_address || ""} ${data.company_postcode || ""} ${data.company_city || ""}`.trim()
  );

  setText(
    "invoiceCompanyContact",
    `${data.company_email || ""} ${data.company_phone || ""}`.trim()
  );

  setText("invoiceKvk", data.kvk_number ? `KVK: ${data.kvk_number}` : "");
  setText("invoiceBtw", data.btw_number ? `BTW: ${data.btw_number}` : "");
  setText("invoiceIban", data.iban ? `IBAN: ${data.iban}` : "");

  setText("invoiceVatText", data.vat_text);
}

document.addEventListener("DOMContentLoaded", initInvoicePreview);

function chooseSendMethod() {
  const sendBookkeeping = document.getElementById("sendToBookkeeping")?.checked;

  const choice = confirm(
    sendBookkeeping
      ? "Factuur verzenden naar cliënt én kopie naar boekhouding?"
      : "Factuur verzenden naar cliënt?"
  );

  if (!choice) return;

  const method = prompt(
    "Hoe wilt u verzenden?\n\nTyp: email\nof typ: post"
  );

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

function enableInvoiceEdit() {
  const fields = document.querySelectorAll(
    "#invoiceNumber, \
#invoiceClientName, \
#invoiceClientAddress, \
#invoiceClientPostcode, \
#invoiceClientCity, \
#invoiceClientEmail, \
#invoiceDescription, \
#invoiceMinutes, \
#invoiceAmount, \
#invoiceTotal"
  );

  fields.forEach(field => {
    field.contentEditable = true;
    field.style.background = "#fff8dc";
    field.style.padding = "4px 6px";
    field.style.borderRadius = "6px";
  });

  alert("Factuur staat nu in bewerkmodus.");
}