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

  let rows = `
    <tr>
      <td>${currentInvoice.description || "Praktische ondersteuning"}</td>
      <td>${minutes} minuten</td>
      <td>${euro(laborAmount)}</td>
    </tr>
  `;

  if (km > 0 || kmAmount > 0) {
    rows += `
      <tr>
        <td>Kilometervergoeding (${km} km × €0,23)</td>
        <td>${km} km</td>
        <td>${euro(kmAmount)}</td>
      </tr>
    `;
  }

  if (materialCost > 0) {
    rows += `
      <tr>
        <td>Materiaal / overige kosten</td>
        <td>-</td>
        <td>${euro(materialCost)}</td>
      </tr>
    `;
  }

  if (parkingCost > 0) {
    rows += `
      <tr>
        <td>Parkeerkosten</td>
        <td>-</td>
        <td>${euro(parkingCost)}</td>
      </tr>
    `;
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

async function sendInvoiceEmail() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const companyName = currentProfile?.company_name || "Uw zorgonderneming";
  const clientName = currentInvoice.client_name || "cliënt";
  const email = currentInvoice.client_email || "";
  const invoiceNumber = currentInvoice.invoice_number || "";
  const amount = euro(currentInvoice.total || currentInvoice.amount || 0);

  if (!email) {
    alert("Geen e-mailadres gevonden bij deze cliënt.");
    return;
  }

  const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);

  const body = encodeURIComponent(
`Beste ${clientName},

Hierbij ontvangt u uw factuur.

Factuurnummer: ${invoiceNumber}
Bedrag: ${amount}

Wij verzoeken u vriendelijk het bedrag binnen ${currentProfile?.payment_term_days || 14} dagen te voldoen.

Met vriendelijke groet,

${companyName}`
  );

  // 👉 checkbox uitlezen (JOUW ID)
  const sendCopy = document.getElementById("sendAccountingCopy")?.checked;
  const bookkeepingEmail = currentProfile?.bookkeeping_email || "";

  let gmailUrl =
    `https://mail.google.com/mail/?view=cm` +
    `&to=${encodeURIComponent(email)}` +
    `&su=${subject}` +
    `&body=${body}`;

  // 👉 BCC toevoegen als vinkje aan staat
  if (sendCopy && bookkeepingEmail) {
    gmailUrl += `&bcc=${encodeURIComponent(bookkeepingEmail)}`;
  }

  window.open(gmailUrl, "_blank");

  // 👉 status aanpassen
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

async function sendInvoice() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    alert("Niet ingelogd");
    return;
  }

  const invoiceNumber = document
    .getElementById("invoiceNumber")
    ?.textContent?.replace("Factuurnummer:", "")
    .trim();

  if (!invoiceNumber) {
    alert("Factuurnummer niet gevonden");
    return;
  }

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      status: "open",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .eq("invoice_number", invoiceNumber);

  if (error) {
    alert("Verzenden mislukt: " + error.message);
    return;
  }
function sendInvoiceEmail() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  const clientName = currentInvoice.client_name || "cliënt";
  const email = currentInvoice.client_email || "";
  const invoiceNumber = currentInvoice.invoice_number || "";
  const amount = `€${Number(currentInvoice.total || 0).toFixed(2).replace(".", ",")}`;

  const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);

  const body = encodeURIComponent(
`Beste ${clientName},

Hierbij ontvangt u uw factuur.

Factuurnummer: ${invoiceNumber}
Bedrag: ${amount}

Wij verzoeken u vriendelijk het bedrag binnen 14 dagen te voldoen.

Met vriendelijke groet,
${currentInvoice.company_name || "WJU Zorg"}`
  );

  // 👉 Gmail openen
  window.location.href = `https://mail.google.com/mail/?view=cm&to=${email}&su=${subject}&body=${body}`;

  // 👉 status aanpassen
  markAsSent(invoiceNumber);
}
  

  window.location.href = "facturen.html";
}

async function printAndMarkSent() {
  if (!currentInvoice) {
    alert("Geen factuur geladen.");
    return;
  }

  window.print();

  const ok = confirm("Is de factuur geprint of opgeslagen als PDF en klaar om per post te versturen?");

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