const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

async function enforceProcessorAgreement() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "./login.html";
    return false;
  }

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("processor_agreement_accepted")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Verwerkersovereenkomst check mislukt:", error);
    alert("Controle van bedrijfsprofiel mislukt. Probeer opnieuw.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  const accepted = data?.processor_agreement_accepted === true;

  if (!accepted) {
    alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  return true;
}

function euro(value) {
  return `€${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

async function getPaymentTermDays(userId) {
  const { data } = await supabaseClient
    .from("business_profiles")
    .select("payment_term_days")
    .eq("owner_id", userId)
    .maybeSingle();

  return Number(data?.payment_term_days || 14);
}

async function updateOverdueInvoices(userId) {
  const days = await getPaymentTermDays(userId);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      status: "herinnering",
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", userId)
    .eq("status", "open")
    .is("paid_at", null)
    .lt("sent_at", cutoff.toISOString());

  if (error) {
    console.error("Automatische herinnering mislukt:", error.message);
  }
}

async function loadFacturen() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  currentUser = sessionData?.session?.user;

  if (!currentUser) {
    alert("Niet ingelogd.");
    return;
  }

  await updateOverdueInvoices(currentUser.id);

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false });

    console.log("Ingelogde user:", currentUser.id);
console.log("Facturen uit Supabase:", data);
console.log("Supabase error:", error);

  if (error) {
    alert("Facturen laden mislukt: " + error.message);
    return;
  }

  renderFacturen(data || []);
}

function formatDateTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeInvoiceRow(factuur, buttons) {
  const bedrag = Number(factuur.amount || factuur.total || 0);

  const boekhouderStatus = factuur.bookkeeper_copy_sent_at
    ? `
      <div class="invoice-meta bookkeeper-ok">
        Boekhouderkopie verzonden naar: ${factuur.bookkeeper_email || "boekhouder"}<br>
        Datum: ${formatDateTime(factuur.bookkeeper_copy_sent_at)}
      </div>
    `
    : factuur.send_bookkeeper_copy
      ? `
        <div class="invoice-meta bookkeeper-wait">
          Boekhouderkopie staat klaar om te verzenden
        </div>
      `
      : "";

  const row = document.createElement("div");
  row.className = "invoice-row";

  row.innerHTML = `
    <div class="invoice-main">
      <strong>${factuur.client_name || "Onbekende cliënt"}</strong><br>
      <small>${factuur.invoice_number || ""}</small>

      ${
        factuur.reminder_sent_at
          ? `<div class="invoice-meta">
              Laatste herinnering: ${formatDateTime(factuur.reminder_sent_at)}
            </div>`
          : ""
      }

      ${boekhouderStatus}
    </div>

    <div class="invoice-minutes">${factuur.minutes || 0} minuten</div>
    <div class="invoice-amount">${euro(bedrag)}</div>

    <div class="invoice-actions">
      ${buttons}
    </div>
  `;

  return row;
}

function renderFacturen(facturen) {
  const ready = document.getElementById("readyInvoices");
  const open = document.getElementById("openInvoices");
  const reminder = document.getElementById("reminderInvoices");

  ready.innerHTML = "";
  open.innerHTML = "";
  reminder.innerHTML = "";

  let readyTotal = 0;
  let openTotal = 0;
  let reminderTotal = 0;
  let paidTotal = 0;

  let readyCount = 0;
  let openCount = 0;
  let reminderCount = 0;

  facturen.forEach((factuur) => {
    const status = factuur.status || "klaar";
    const bedrag = Number(factuur.total || factuur.amount || 0);

    const invoiceUrl =
      "factuur-preview.html?invoice=" + encodeURIComponent(factuur.invoice_number);

    const reminderUrl =
      "herinnering.html?invoice=" + encodeURIComponent(factuur.invoice_number);

    if (status === "klaar") {
      readyTotal += bedrag;
      readyCount++;

      ready.appendChild(
        makeInvoiceRow(
          factuur,
          `<button class="dark-btn" onclick="window.location.href='${invoiceUrl}'">
            Controleren en verzenden
          </button>`
        )
      );
    }

    if (status === "open") {
      openTotal += bedrag;
      openCount++;

      open.appendChild(
        makeInvoiceRow(
          factuur,
          `<button class="light-btn" onclick="window.location.href='${invoiceUrl}'">
            Factuur bekijken
          </button>
          <button class="light-btn" onclick="markAsPaid('${factuur.invoice_number}')">
            Markeer betaald
          </button>`
        )
      );
    }

    if (status === "herinnering") {
      reminderTotal += bedrag;
      reminderCount++;

      reminder.appendChild(
        makeInvoiceRow(
          factuur,
          `<button class="light-btn" onclick="window.location.href='${invoiceUrl}'">
            Bekijk factuur
          </button>
          <button class="light-btn" onclick="window.location.href='${reminderUrl}'">
            Herinnering sturen
          </button>
          <button class="light-btn" onclick="markAsPaid('${factuur.invoice_number}')">
            Markeer betaald
          </button>`
        )
      );
    }

    if (status === "betaald") {
      paidTotal += bedrag;
    }
  });

  document.getElementById("readyTotal").textContent = euro(readyTotal);
  document.getElementById("openTotal").textContent = euro(openTotal);
  document.getElementById("reminderTotal").textContent = euro(reminderTotal);
  document.getElementById("paidTotal").textContent = euro(paidTotal);

  document.getElementById("readyCount").textContent = `${readyCount} facturen`;
  document.getElementById("openCount").textContent = `${openCount} facturen`;
  document.getElementById("reminderCount").textContent = `${reminderCount} facturen`;

  if (!ready.innerHTML) ready.innerHTML = `<p class="empty-state">Geen facturen klaar om te verzenden.</p>`;
  if (!open.innerHTML) open.innerHTML = `<p class="empty-state">Geen openstaande facturen.</p>`;
  if (!reminder.innerHTML) reminder.innerHTML = `<p class="empty-state">Geen herinneringen nodig.</p>`;
}

async function markAsPaid(invoiceNumber) {
  const ok = confirm("Deze factuur markeren als betaald?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("invoice_drafts")
    .update({
      status: "betaald",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", invoiceNumber);

  if (error) {
    alert("Betaald zetten mislukt: " + error.message);
    return;
  }

  alert("Factuur gemarkeerd als betaald.");
  loadFacturen();
}

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await enforceProcessorAgreement();
  if (!ok) return;

  loadFacturen();
});