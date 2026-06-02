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
  return params.get("invoice") || "";
}

function formatToday() {
  return new Date().toLocaleDateString("nl-NL");
}

async function initInvoicePreview() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session?.user) {
    alert("U bent niet ingelogd.");
    window.location.href = "./login.html";
    return;
  }

  currentUser = data.session.user;

  await loadBusinessProfile();
  await loadInvoiceDraft();
  await loadClientFromInvoice();

  if (!currentInvoice) return;

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

  currentProfile = data || {};
}

async function loadInvoiceDraft() {
  const invoiceNumber = getInvoiceNumberFromUrl();

  if (!invoiceNumber) {
    alert("Geen factuurnummer gevonden in de link.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    alert("Factuur laden mislukt: " + (error?.message || "Factuur niet gevonden."));
    return;
  }

  currentInvoice = data;
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

  currentClient = data || {};
}

function getVatText() {
  const profile = currentProfile || {};
  if (profile.vat_status === "vrijgesteld") {
    return profile.vat_text || "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
  }
  return "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
}

function getClientName() {
  const name = currentClient?.invoice_name || currentClient?.full_name || currentInvoice?.client_name || "Cliënt";
  const salutation = currentClient?.salutation;
  if (salutation === "dhr" && !name.toLowerCase().includes("dhr")) return `Dhr. ${name}`;
  if (salutation === "mw" && !name.toLowerCase().includes("mevr")) return `Mevr. ${name}`;
  return name;
}

function fillInvoicePreview() {
  const total = getInvoiceTotal();
  setText("companyName", currentProfile?.company_name || "Bedrijfsnaam");
  setText("companyOwner", currentProfile?.owner_name || "");
  setText("companyAddressLine", currentProfile?.company_address || "");
  setText("companyCityLine", `${currentProfile?.company_postcode || ""} ${currentProfile?.company_city || ""}`.trim());
  setText("companyKvk", currentProfile?.kvk_number || "-");
  setText("companyBtw", currentProfile?.btw_number || "-");
  setText("companyIban", currentProfile?.iban || "-");
  setText("invoiceNumber", currentInvoice.invoice_number);
  setText("invoiceDate", formatToday());
  setText("invoiceClientName", getClientName());
  setText("invoiceTotal", formatEuro(total));
  setText("invoiceVatText", getVatText());
  renderInvoiceLines();
  renderFundingText();
}

function getInvoiceTotal() {
  const labor = Number(currentInvoice.amount || 0);
  const km = Number(currentInvoice.km_amount || 0);
  const mat = Number(currentInvoice.material_cost || 0);
  const park = Number(currentInvoice.parking_cost || 0);
  return labor + km + mat + park;
}

function renderInvoiceLines() {
  const tbody = document.getElementById("invoiceLines");
  if (!tbody || !currentInvoice) return;
  const minutes = Number(currentInvoice.minutes || 0);
  const laborAmount = Number(currentInvoice.amount || 0);
  
  let rows = `
    <tr>
      <td><span id="invoiceDescription">${currentInvoice.work_done || currentInvoice.description || "Ondersteuning"}</span></td>
      <td>${minutes} min</td>
      <td>${formatEuro(laborAmount)}</td>
    </tr>
  `;
  tbody.innerHTML = rows;
}

function renderFundingText() {
  const box = document.getElementById("invoiceFundingText");
  if (!box) return;
  const paymentType = currentInvoice.payment_type || "particulier";
  if (paymentType === "wmo") {
    box.innerHTML = `<p><strong>Betaalvorm:</strong> Wmo</p><p>Ondersteuning geleverd op basis van Wmo.</p>`;
  } else if (paymentType === "pgb") {
    box.innerHTML = `<p><strong>Betaalvorm:</strong> PGB</p>`;
  } else {
    box.innerHTML = "";
  }
}

// --- HIER ZIT DE UPDATE VOOR BOOKKEEPING_EMAIL ---
async function sendInvoiceEmail() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const companyName = currentProfile?.company_name || "ZorgRapp";
  const companyIban = currentProfile?.iban || "";
  
  // AANPASSING: Gebruik nu bookkeeping_email uit database
  const bookkeeperEmail = currentProfile?.bookkeeping_email || ""; 
  
  const clientName = getClientName();
  const invoiceNumber = currentInvoice.invoice_number || "";
  const amount = formatEuro(getInvoiceTotal());

  const email = currentClient?.email || currentInvoice?.client_email || "";

  if (!email) {
    alert("Geen geldig e-mailadres gevonden.");
    return;
  }

  const sendCopy = document.getElementById("sendAccountingCopy")?.checked === true;

  // Jouw uitgebreide teksten behouden
  const serviceName = currentInvoice?.service_name || "Ondersteuning";
  const workDone = currentInvoice?.work_done || currentInvoice?.description || "";
  const workedMinutes = Number(currentInvoice?.minutes || 0);
  const km = Number(currentInvoice?.km || 0);
  const kmAmount = km * 0.23;
  const materialCost = Number(currentInvoice?.material_cost || 0);
  const parkingCost = Number(currentInvoice?.parking_cost || 0);

  let extraCostsText = "";
  if (km > 0) extraCostsText += `\nKilometervergoeding: ${km} km × €0,23 = ${formatEuro(kmAmount)}`;
  if (materialCost > 0) extraCostsText += `\nMaterialen: ${formatEuro(materialCost)}`;
  if (parkingCost > 0) extraCostsText += `\nParkeerkosten: ${formatEuro(parkingCost)}`;

  const paymentType = currentInvoice?.payment_type || "";
  let fundingText = paymentType ? `\nBetalingsvorm: ${paymentType.toUpperCase()}` : "";

  let bodyText = `Beste ${clientName},

Hierbij ontvangt u uw factuur voor de uitgevoerde werkzaamheden.

Factuurnummer: ${invoiceNumber}

Omschrijving werkzaamheden:
${workDone || serviceName}

Dienst: ${serviceName}
Datum afspraak: ${currentInvoice?.appointment_date || "-"}
Gewerkte tijd: ${workedMinutes} minuten
${fundingText}
${extraCostsText}

Factuurbedrag:
${amount}

Wij verzoeken u vriendelijk het bedrag binnen ${currentProfile?.payment_term_days || 14} dagen te voldoen.

Met vriendelijke groet,

${companyName}`;

  if (companyIban) bodyText += `\nIBAN: ${companyIban}`;

  const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);
  const body = encodeURIComponent(bodyText);

  // Universele mailto link (werkt op mobiel)
  let mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;

  // AANPASSING: BCC toevoegen met bookkeepingEmail
  if (sendCopy && bookkeeperEmail) {
    mailtoUrl += `&bcc=${encodeURIComponent(bookkeeperEmail.trim())}`;
  }

  window.location.href = mailtoUrl;

  // Status bijwerken in database
  const updateData = {
    status: "open",
    sent_at: new Date().toISOString()
  };

  if (sendCopy && bookkeeperEmail) {
    updateData.bookkeeper_copy_sent = true;
    updateData.bookkeeper_email = bookkeeperEmail;
  }

  await supabaseClient
    .from("invoice_drafts")
    .update(updateData)
    .eq("id", currentInvoice.id);

  alert("Mail geopend en status bijgewerkt.");
  window.location.href = "facturen.html";
}

document.addEventListener("DOMContentLoaded", initInvoicePreview);