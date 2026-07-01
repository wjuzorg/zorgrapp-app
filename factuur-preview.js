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
  return `€${n.toFixed(2).replace(".", ",")} `;
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
    console.error("Factuur niet gevonden:", invoiceNumber, error);
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

  if (profile.vat_status === "kor") {
    return "Er wordt geen btw berekend vanwege toepassing van de kleineondernemersregeling (KOR).";
  }

  if (profile.vat_status === "verlegd") {
    return `BTW verlegd naar afnemer. BTW-nummer afnemer: ${profile.vat_customer_number || "-"}`;
  }

  if (profile.vat_status === "btw_plichtig") {
    return "BTW-plichtig. Btw-berekening wordt later toegevoegd.";
  }

  return profile.vat_text || "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
}

function getClientName() {
  const name =
    currentClient?.invoice_name ||
    currentClient?.full_name ||
    currentInvoice?.client_name ||
    "Cliënt";

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
  const invoiceNumber = currentInvoice.invoice_number;
  const total = getInvoiceTotal();

  setText("companyName", currentProfile?.company_name || "Bedrijfsnaam");
  setText("companyOwner", currentProfile?.owner_name || "");
  setText("companyAddressLine", currentProfile?.company_address || "");
  setText(
    "companyCityLine",
    `${currentProfile?.company_postcode || ""} ${currentProfile?.company_city || ""}`.trim()
  );
  setText("companyKvk", currentProfile?.kvk_number || "-");
  setText("companyBtw", currentProfile?.btw_number || "-");
  setText("companyIban", currentProfile?.iban || "-");

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

  setText("invoiceTotal", formatEuro(total));
  setText("invoiceVatText", getVatText());

  const paymentDays = currentProfile?.payment_term_days || 14;
  setText(
    "invoicePaymentText",
    `Wij verzoeken u vriendelijk het bedrag binnen ${paymentDays} dagen te voldoen.`
  );

  renderInvoiceLines();
renderFundingText();
renderInvoiceRecipient();
}

// FIX: Hier worden alle reiskosten en extra kosten weer netjes meegerekend voor het totaalbedrag!
function getInvoiceTotal() {
  const minutes = Number(currentInvoice.minutes || 0);
  const hourlyRate = Number(currentInvoice.hourly_rate || 0);

  const laborAmount = (minutes / 60) * hourlyRate;
  const kmAmount = Number(currentInvoice.km_amount || 0);
  const materialCost = Number(currentInvoice.material_cost || 0);
  const parkingCost = Number(currentInvoice.parking_cost || 0);

  return Number(
    currentInvoice.total ||
    currentInvoice.total_amount ||
    laborAmount + kmAmount + materialCost + parkingCost
  );
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

  let durationText = "";
  if (minutes > 0) {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remMinutes = minutes % 60;
      durationText = remMinutes > 0 ? `${hours} u ${remMinutes} min` : `${hours} u`;
    } else {
      durationText = `${minutes} min`;
    }
  } else {
    durationText = "-";
  }

  let rows = `
    <tr>
      <td><span id="invoiceDescription">${currentInvoice.work_done || currentInvoice.description || currentInvoice.service_name || "Praktische ondersteuning"}</span></td>
      <td>${durationText}</td>
      <td>${formatEuro(laborAmount)}</td>
    </tr>
  `;

  if (km > 0 || kmAmount > 0) {
    rows += `
      <tr>
        <td>Kilometervergoeding (${km} km × €0,23)</td>
        <td>${km} km</td>
        <td>${formatEuro(kmAmount)}</td>
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

  tbody.innerHTML = rows;
}

function renderFundingText() {
  const box = document.getElementById("invoiceFundingText");
  if (!box) return;

  const paymentType = currentInvoice.payment_type || "particulier";

  if (paymentType === "wmo") {
    box.innerHTML = `
      <p><strong>Betaalvorm:</strong> Wmo</p>
      <p>Ondersteuning geleverd op basis van maatschappelijke ondersteuning / Wmo.</p>
      <p>BTW vrijgesteld van omzetbelasting voor maatschappelijke ondersteuning, indien de cliënt hiervoor volgens de Wmo is aangewezen.</p>
      ${currentInvoice.funding_reference ? `<p><strong>Referentie/beschikking:</strong> ${currentInvoice.funding_reference}</p>` : ""}
      ${currentInvoice.funding_organization ? `<p><strong>Gemeente / organisatie:</strong> ${currentInvoice.funding_organization}</p>` : ""}
      ${currentInvoice.funding_period ? `<p><strong>Periode:</strong> ${currentInvoice.funding_period}</p>` : ""}
    `;
    return;
  }

  if (paymentType === "pgb") {
    box.innerHTML = `
      <p><strong>Betaalvorm:</strong> PGB</p>
      <p>Declaratie/factuur voor geleverde ondersteuning vanuit persoonsgebonden budget (PGB).</p>
      ${currentInvoice.funding_holder_name ? `<p><strong>Budgethouder:</strong> ${currentInvoice.funding_holder_name}</p>` : ""}
      ${currentInvoice.funding_reference ? `<p><strong>PGB-referentie:</strong> ${currentInvoice.funding_reference}</p>` : ""}
      ${currentInvoice.funding_organization ? `<p><strong>SVB / organisatie:</strong> ${currentInvoice.funding_organization}</p>` : ""}
      ${currentInvoice.funding_period ? `<p><strong>Periode:</strong> ${currentInvoice.funding_period}</p>` : ""}
    `;
    return;
  }

  box.innerHTML = "";
}

function renderInvoiceRecipient() {
  const box = document.getElementById("invoiceRecipientBox");
  if (!box || !currentInvoice) return;

  const typeLabels = {
    client: "Cliënt",
    budgethouder: "Budgethouder / vertegenwoordiger",
    gemeente: "Gemeente",
    zorgorganisatie: "Zorgorganisatie",
    anders: "Anders"
  };

  const type = typeLabels[currentInvoice.invoice_contact_type] || "Niet ingesteld";
  const name = currentInvoice.invoice_contact_name || "-";
  const email = currentInvoice.invoice_contact_email || "-";
  const phone = currentInvoice.invoice_contact_phone || "-";

  box.innerHTML = `
    <div class="invoice-check-row" style="display:block;">
      <strong>📨 Factuur wordt verzonden naar</strong>
      <p style="margin:10px 0 4px;"><strong>Type:</strong> ${type}</p>
      <p style="margin:4px 0;"><strong>Naam:</strong> ${name}</p>
      <p style="margin:4px 0;"><strong>E-mail:</strong> ${email}</p>
      <p style="margin:4px 0;"><strong>Telefoon:</strong> ${phone}</p>
    </div>
  `;
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

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update(payload)
    .eq("owner_id", currentUser.id)
    .eq("id", currentInvoice.id);

  if (error) {
    alert("Opslaan mislukt: " + error.message);
    return;
  }

  currentInvoice = { ...currentInvoice, ...payload };

  alert("Wijzigingen opgeslagen.");
  disableInvoiceEdit();
}

async function sendInvoiceEmail() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const companyName = currentProfile?.company_name || "ZorgRapp";
  const companyIban = currentProfile?.iban || "";
  
  // 1. Haal de e-mailadressen en de vinkjes op
  const bookkeeperEmail = currentProfile?.bookkeeping_email || ""; 
  const sendCopy = document.getElementById("sendAccountingCopy")?.checked === true;
  const onlyToBookkeeper = document.getElementById("onlyToBookkeeper")?.checked === true; // JE NIEUWE VINKJE

  const clientName = getClientName();
  const invoiceNumber = currentInvoice.invoice_number || "";
  const amount = formatEuro(getInvoiceTotal());

  const visibleEmail = document.getElementById("invoiceClientEmail")?.textContent?.trim();

  // Haal het e-mailadres van de cliënt op
 const clientEmail =
  currentInvoice?.invoice_contact_email ||
  currentClient?.invoice_contact_email ||
  currentClient?.invoice_email ||
  currentClient?.email ||
  currentClient?.client_email ||
  currentInvoice?.client_email ||
  visibleEmail ||
  "";

  // 2. Bepaal naar wie de e-mail ECHT verzonden moet worden
  let email = "";

  if (onlyToBookkeeper) {
    // Als het nieuwe vinkje aanstaat, MOET er een boekhouder-mail zijn ingesteld
    if (!bookkeeperEmail || !bookkeeperEmail.includes("@")) {
      alert("Fout: Je wilt de factuur alleen naar de boekhouder sturen, maar er is geen geldig boekhouder e-mailadres ingesteld in je bedrijfsprofiel!");
      return;
    }
    // De hoofdontvanger wordt nu de boekhouder!
    email = bookkeeperEmail;
  } else {
    // Normale situatie: De hoofdontvanger is de cliënt
    if (!clientEmail || !clientEmail.includes("@")) {
      alert("Geen geldig e-mailadres gevonden bij deze cliënt. Vul deze aan of kies voor alleen boekhouder.");
      return;
    }
    email = clientEmail;
  }
  const serviceName =
    currentInvoice?.service_name ||
    currentInvoice?.service_type ||
    currentInvoice?.appointment_type ||
    currentInvoice?.appointment_title ||
    currentInvoice?.description ||
    "Ondersteuning";

  const workDone = currentInvoice?.work_done || currentInvoice?.description || "";
  const workedMinutes = Number(currentInvoice?.minutes || 0); 

  const km = Number(currentInvoice?.km || 0);
  const kmRate = 0.23;
  const kmAmount = km > 0 ? km * kmRate : 0;

  const materialCost = Number(currentInvoice?.material_cost || 0);
  const parkingCost = Number(currentInvoice?.parking_cost || 0);

  let extraCostsText = "";

  if (km > 0) {
    extraCostsText += `\nKilometervergoeding: ${km} km × €0,23 = ${formatEuro(kmAmount)}`;
  }

  if (materialCost > 0) {
    extraCostsText += `\nMaterialen: ${formatEuro(materialCost)}`;
  }

  if (parkingCost > 0) {
    extraCostsText += `\nParkeerkosten: ${formatEuro(parkingCost)}`;
  }

  const paymentType = currentInvoice?.payment_type || currentInvoice?.funding_type || "";

  let fundingText = "";
  if (paymentType === "wmo") {
    fundingText = `\nBetalingsvorm: Wmo`;
    if (currentInvoice.funding_organization) fundingText += `\nGemeente: ${currentInvoice.funding_organization}`;
    if (currentInvoice.funding_reference) fundingText += `\nReferentie: ${currentInvoice.funding_reference}`;
    if (currentInvoice.funding_period) fundingText += `\nPeriode: ${currentInvoice.funding_period}`;
  } else if (paymentType === "pgb") {
    fundingText = `\nBetalingsvorm: PGB`;
    if (currentInvoice.funding_holder_name) fundingText += `\nBudgethouder: ${currentInvoice.funding_holder_name}`;
    if (currentInvoice.funding_organization) fundingText += `\nZorgkantoor/SVB: ${currentInvoice.funding_organization}`;
    if (currentInvoice.funding_period) fundingText += `\nPeriode: ${currentInvoice.funding_period}`;
  }

// DE VERBETERDE MAILTEKST
  let bodyText = `Beste ${clientName},

Hierbij ontvangt u uw factuur voor de uitgevoerde werkzaamheden.

Factuurnummer: ${invoiceNumber}

Omschrijving: ${workDone || serviceName}
Dienst: ${serviceName}
Datum afspraak: ${currentInvoice?.appointment_date || formatToday()} 
Gewerkte tijd: ${workedMinutes} minuten
${fundingText}
${extraCostsText}

Totaal factuurbedrag: ${amount}

Wij verzoeken u vriendelijk het bedrag binnen ${currentProfile?.payment_term_days || 14} dagen te voldoen op IBAN: ${companyIban}.

Heeft u vragen over deze factuur? Neem dan gerust contact op.

Met vriendelijke groet,

${companyName}`;

  if (companyIban) {
    bodyText += `\nIBAN: ${companyIban}`;
  }

  const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);
  const body = encodeURIComponent(bodyText);

  let mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;

  // FIX: Hier wordt de BCC opgebouwd met de juiste variabele
  if (sendCopy && bookkeeperEmail) {
    mailtoUrl += `&bcc=${encodeURIComponent(bookkeeperEmail.trim())}`;
  }

  window.location.href = mailtoUrl;

  const updateData = {
    status: "open",
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (sendCopy && bookkeeperEmail) {
    updateData.bookkeeper_copy_sent = true;
    updateData.bookkeeper_copy_sent_at = new Date().toISOString();
    updateData.bookkeeper_email = bookkeeperEmail;
    updateData.invoice_changed_after_bookkeeper_sent = false;
  }

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update(updateData)
    .eq("owner_id", currentUser.id)
    .eq("id", currentInvoice.id);

  if (error) {
    alert("Status aanpassen mislukt: " + error.message);
    return;
  }

  alert("Gmail geopend. Factuur staat nu bij Wacht op betaling.");
  window.location.href = "facturen.html";
}

async function printAndMarkSent() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  document.body.classList.add("print-mode");

  setTimeout(() => {
    window.print();
  }, 800);

  setTimeout(() => {
    document.body.classList.remove("print-mode");
  }, 2000);

  const ok = confirm(
    "Is de factuur geprint of opgeslagen als PDF en klaar om per post te versturen?"
  );

  if (!ok) return;

  const updateData = {
    status: "open",
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const bookkeeperEmail = currentProfile?.bookkeeping_email || "";
  const sendCopy = document.getElementById("sendAccountingCopy")?.checked === true;

  if (sendCopy && bookkeeperEmail) {
    updateData.bookkeeper_copy_sent = true;
    updateData.bookkeeper_copy_sent_at = new Date().toISOString();
    updateData.bookkeeper_email = bookkeeperEmail;
    updateData.invoice_changed_after_bookkeeper_sent = false;
  }

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update(updateData)
    .eq("owner_id", currentUser.id)
    .eq("id", currentInvoice.id);

  if (error) {
    alert("Status aanpassen mislukt: " + error.message);
    return;
  }

  alert("Factuur staat nu bij Wacht op betaling.");
  window.location.href = "facturen.html";
}

// Zorgt ervoor dat je maar één van de twee vinkjes tegelijk kunt selecteren
document.addEventListener("change", function(e) {
  const sendCopyEl = document.getElementById("sendAccountingCopy");
  const onlyBookkeeperEl = document.getElementById("onlyToBookkeeper");

  if (!sendCopyEl || !onlyBookkeeperEl) return;

  // Als vinkje 1 wordt aangezet, zet vinkje 2 uit
  if (e.target === sendCopyEl && sendCopyEl.checked) {
    onlyBookkeeperEl.checked = false;
  }
  
  // Als vinkje 2 wordt aangezet, zet vinkje 1 uit
  if (e.target === onlyBookkeeperEl && onlyBookkeeperEl.checked) {
    sendCopyEl.checked = false;
  }
});

document.addEventListener("DOMContentLoaded", initInvoicePreview);