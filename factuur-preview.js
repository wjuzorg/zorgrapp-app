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

function getVatText(profile) {

  if (!profile) return "";

  if (profile.vat_status === "vrijgesteld") {
    return profile.vat_text || "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
  }

  if (profile.vat_status === "kor") {
    return "Er wordt geen btw berekend vanwege toepassing van de kleineondernemersregeling (KOR).";
  }

  if (profile.vat_status === "verlegd") {
    return `
      BTW verlegd naar afnemer.<br>
      BTW-nummer afnemer: ${profile.vat_customer_number || "-"}
    `;
  }

  if (profile.vat_status === "btw_plichtig") {
    return "BTW-plichtig. Btw-berekening wordt later toegevoegd.";
  }

  return "";
}

async function loadBusinessProfile() {
  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", currentUser.id)
    .Single();

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
  .order("created_at", { ascending: false })
  .limit(1)
  .maybesingle();

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
  setText("companyAddressLine", currentProfile?.company_address || "");
  setText(
    "companyCityLine",
    `${currentProfile?.company_postcode || ""} ${currentProfile?.company_city || ""}`.trim()
  );
  setText("companyBtw", currentProfile?.btw_number || "-");

  setText("invoiceVatText", currentProfile?.vat_text || "");
  setText("invoiceNumber", invoiceNumber);
  setText("invoiceDate", formatToday());

  const useInvoiceAddress =
    currentClient?.invoice_delivery_method === "address" &&
    currentClient?.invoice_same_as_client_address === false;

  setText("invoiceClientName", getClientName());
  setText(
    "invoiceClientAddress",
    useInvoiceAddress
      ? currentClient?.invoice_address || ""
      : currentClient?.address || currentInvoice?.client_address || ""
  );
  setText(
    "invoiceClientPostcode",
    useInvoiceAddress
      ? currentClient?.invoice_postal_code || ""
      : currentClient?.postal_code || currentInvoice?.client_postcode || ""
  );
  setText(
    "invoiceClientCity",
    useInvoiceAddress
      ? currentClient?.invoice_city || ""
      : currentClient?.city || currentInvoice?.client_city || ""
  );
  setText(
    "invoiceClientEmail",
    currentClient?.invoice_email ||
      currentClient?.email ||
      currentClient?.client_email ||
      currentInvoice?.client_email ||
      ""
  );

  setText("invoiceDescription", currentInvoice?.description || "Praktische ondersteuning aan huis");
  setText("invoiceMinutes", currentInvoice?.minutes || "");
  setText("invoiceAmount", formatEuro(amount));
  setText("invoiceTotal", formatEuro(total));

  const paymentDays = currentProfile?.payment_term_days || 14;
  setText(
    "invoicePaymentText",
    `Wij verzoeken u vriendelijk het bedrag binnen ${paymentDays} dagen te voldoen.`
  );

  renderInvoiceLines();
}

function renderInvoiceLines() {
  const tbody = document.getElementById("invoiceLines");
  if (!tbody || !currentInvoice) return;

  const minutes = Number(currentInvoice.minutes || 0);
  const hourlyRate = Number(currentInvoice.hourly_rate || 0);
  const laborAmount = (minutes / 60) * hourlyRate;

  const km = Number(currentInvoice.km || 0);
  const kmAmount = Number(currentInvoice.km_amount || 0);
  const materialCost = Number(currentInvoice.material_cost || 0);
  const parkingCost = Number(currentInvoice.parking_cost || 0);
  const invoiceVatText = document.getElementById("invoiceVatText");

  let rows = `
  <tr>
    <td><span id="invoiceDescription">${currentInvoice.description || "Praktische ondersteuning"}</span></td>
    <td><span id="invoiceMinutes">${minutes}</span> minuten</td>
    <td><span id="invoiceAmount">${formatEuro(laborAmount)}</span></td>
  </tr>
`;

  if (km > 0 || kmAmount > 0) {
    rows += `
      <tr>
        <td>Kilometervergoeding (${km} km × €0,23)</td>
        <td>${km} km</td>
        <td>${formateuro(kmAmount)}</td>
      </tr>
    `;
  }

  if (materialCost > 0) {
    rows += `
      <tr>
        <td>Materiaal / overige kosten</td>
        <td>-</td>
        <td>${formatEuro(materialCost)}</td>
      </tr>
    `;
  }

  if (parkingCost > 0) {
    rows += `
      <tr>
        <td>Parkeerkosten</td>
        <td>-</td>
        <td>${formatEuro(parkingCost)}</td>
      </tr>
    `;
  }

  if (invoiceVatText && currentProfile) {
  invoiceVatText.innerHTML = getVatText(currentProfile);
}

if (invoiceVatText && currentProfile) {
  invoiceVatText.innerHTML = getVatText(currentProfile);
}

  tbody.innerHTML = rows;
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

function disableInvoiceEdit() {
  const fields = document.querySelectorAll(
    "#invoiceNumber, #invoiceClientName, #invoiceClientAddress, #invoiceClientPostcode, #invoiceClientCity, #invoiceClientEmail, #invoiceDescription, #invoiceMinutes, #invoiceAmount, #invoiceTotal"
  );

  fields.forEach((field) => {
    field.contentEditable = "false";
    field.style.background = "";
    field.style.padding = "";
    field.style.borderRadius = "";
  });
}

async function saveInvoiceDraft() {
  if (!currentUser || !currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const invoiceNumber = getText("invoiceNumber") || currentInvoice.invoice_number;
  const amountNumber =
    Number(getText("invoiceAmount").replace("€", "").replace(",", ".").trim()) || 0;
  const totalNumber =
    Number(getText("invoiceTotal").replace("€", "").replace(",", ".").trim()) || amountNumber;

  const payload = {
    invoice_number: invoiceNumber,
    client_name: getText("invoiceClientName"),
    description: getText("invoiceDescription"),
    minutes: Number(getText("invoiceMinutes")) || null,
    amount: amountNumber,
    total: totalNumber,
    updated_at: new Date().toISOString()
  };

  if (currentInvoice.bookkeeper_copy_sent === true) {
    payload.invoice_changed_after_bookkeeper_sent = true;
  }

  let query = supabaseClient
    .from("invoice_drafts")
    .update(payload)
    .eq("owner_id", currentUser.id);

  if (getInvoiceId()) {
    query = query.eq("id", getInvoiceId());
  } else {
    query = query.eq("invoice_number", currentInvoice.invoice_number);
  }

  const { error } = await query;

  if (error) {
    alert("Opslaan mislukt: " + error.message);
    return;
  }

  alert("Wijzigingen opgeslagen.");
  disableInvoiceEdit();

  currentInvoice = {
    ...currentInvoice,
    ...payload
  };
}

function getInvoiceId() {
  return currentInvoice?.id || null;
}

async function sendInvoiceEmail() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const companyName = currentProfile?.company_name || "ZorgRapp";
  const companyIban = currentProfile?.iban || "";
  const clientName = currentInvoice.client_name || "cliënt";
  const invoiceNumber = currentInvoice.invoice_number || "";
  const amount = formatEuro(currentInvoice.total || currentInvoice.amount || 0);

  const visibleEmail =
    document.getElementById("invoiceClientEmail")?.textContent?.trim();

  const email =
    currentInvoice.client_email ||
    currentInvoice.email ||
    currentInvoice.invoice_email ||
    currentInvoice.billing_email ||
    visibleEmail ||
    "";

  if (!email || !email.includes("@")) {
    alert("Geen geldig e-mailadres gevonden bij deze cliënt.");
    return;
  }

  const sendCopy =
    document.getElementById("sendAccountingCopy")?.checked === true;

  const bookkeepingEmail =
    currentProfile?.bookkeeping_email ||
    currentProfile?.bookkeeper_email ||
    currentProfile?.boekhouder_email ||
    "";

  const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);

  const body = encodeURIComponent(
`Beste ${clientName},

Hierbij ontvangt u uw factuur.

Factuurnummer: ${invoiceNumber}
Bedrag: ${amount}

Wij verzoeken u vriendelijk het bedrag binnen ${currentProfile?.payment_term_days || 14} dagen te voldoen.

Met vriendelijke groet,

${companyName}
${companyIban ? `IBAN: ${companyIban}` : ""}`
  );

  let gmailUrl =
    `https://mail.google.com/mail/?view=cm` +
    `&to=${encodeURIComponent(email)}` +
    `&su=${subject}` +
    `&body=${body}`;

const alreadySent =
  currentInvoice.bookkeeper_copy_sent === true ||
  !!currentInvoice.bookkeeper_copy_sent_at;

if (sendCopy && alreadySent) {
  const opnieuw = confirm(
    "Deze factuur is al eerder naar de boekhouder gestuurd.\n\nWilt u opnieuw een kopie naar de boekhouder sturen?"
  );

  if (!opnieuw) {
    return;
  }
}

const gmailWindow = window.open(gmailUrl, "_blank");

if (!gmailWindow) {
  window.location.href = gmailUrl;
}

  const updateData = {
    status: "open",
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (sendCopy && bookkeepingEmail) {
    updateData.bookkeeper_copy_sent = true;
    updateData.bookkeeper_copy_sent_at = new Date().toISOString();
    updateData.bookkeeper_email = bookkeepingEmail;
    updateData.invoice_changed_after_bookkeeper_sent = false;
  }

  let query = supabaseClient
    .from("invoice_drafts")
    .update(updateData)
    .eq("owner_id", currentUser.id);

  if (getInvoiceId()) {
    query = query.eq("id", getInvoiceId());
  } else {
    query = query.eq("invoice_number", invoiceNumber);
  }

  const { error } = await query;

  if (error) {
    alert("Status aanpassen mislukt: " + error.message);
    return;
  }

  alert("Gmail geopend. Factuur staat nu bij Wacht op betaling.");
}

async function markInvoiceAsOpen() {
  const invoiceNumber = getText("invoiceNumber") || getInvoiceNumberFromUrl();

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      status: "open",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber);

  if (error) {
    alert("Status aanpassen mislukt: " + error.message);
    return false;
  }

  return true;
}

async function printAndMarkSent() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  window.print();

  const ok = confirm(
    "Is de factuur geprint of opgeslagen als PDF en klaar om per post te versturen?"
  );

  if (!ok) return;

  const invoiceNumber = currentInvoice.invoice_number;

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      status: "open",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber);

  if (error) {
    alert("Status aanpassen mislukt: " + error.message);
    return;
  }

  alert("Factuur staat nu bij Wacht op betaling.");

  window.location.href = "facturen.html";
}

document.addEventListener("DOMContentLoaded", initInvoicePreview);