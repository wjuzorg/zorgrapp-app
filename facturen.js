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
  // FIX: Tel het kale bedrag, de reiskosten en eventuele btw bij elkaar op
  const kaalBedrag = Number(factuur.amount || factuur.total || 0);
  const reiskosten = Number(factuur.travel_expenses || factuur.reiskosten || 0);
  const btwBedrag = Number(factuur.vat_amount || factuur.btw_bedrag || 0);
  
  const bedrag = kaalBedrag + reiskosten + btwBedrag;

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
  return row; // Zorg dat de row netjes gereturned wordt
}
// Instelling voor de kilometervergoeding (pas aan naar jouw tarief indien nodig)
const KM_TARIEF = 0.23; 

function makeInvoiceRow(factuur, buttons) {
  // Pak de basisbedragen uit jouw 'Appointments' tabelkolommen
  const kaalBedrag = Number(factuur.amount || 0);
  const kilometers = Number(factuur.km || 0);
  const parkeerkosten = Number(factuur.parking_cost || 0);
  const materiaalkosten = Number(factuur.material_cost || 0);

  // Bereken de reiskosten: kilometers * tarief
  const berekendeReiskosten = kilometers * KM_TARIEF;

  // FIX: Tel alles bij elkaar op voor het échte totaalbedrag op de rij
  const bedrag = kaalBedrag + berekendeReiskosten + parkeerkosten + materiaalkosten;

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
      <small>${factuur.invoice_number || "Concept"}</small>

      ${
        factuur.reminder_sent_at
          ? `<div class="invoice-meta">
              Laatste herinnering: ${formatDateTime(factuur.reminder_sent_at)}
            </div>`
          : ""
      }

      ${boekhouderStatus}
    </div>

    <div class="invoice-minutes">${factuur.worked_minutes || factuur.minutes || 0} minuten</div>
    <div class="invoice-amount">${euro(bedrag)}</div>

    <div class="invoice-actions">
      ${buttons}
    </div>
  `;
  return row;
}

const KM_TARIEF = 0.23; 

function renderFacturen(facturen) {
  const ready = document.getElementById("readyInvoices");
  const open = document.getElementById("openInvoices");
  const reminder = document.getElementById("reminderInvoices");

  if (ready) ready.innerHTML = "";
  if (open) open.innerHTML = "";
  if (reminder) reminder.innerHTML = "";

  let readyTotal = 0;
  let openTotal = 0;
  let reminderTotal = 0;
  let paidTotal = 0;

  let readyCount = 0;
  let openCount = 0;
  let reminderCount = 0;

  facturen.forEach((factuur) => {
    // 1. Bereken het ECHTE totaalbedrag inclusief reiskosten per afspraak
    const kaalBedrag = Number(factuur.amount || 0);
    const kilometers = Number(factuur.km || 0);
    const berekendeReiskosten = kilometers * KM_TARIEF;
    const parkeerkosten = Number(factuur.parking_cost || 0);
    const materiaalkosten = Number(factuur.material_cost || 0);
    
    const bedrag = kaalBedrag + berekendeReiskosten + parkeerkosten + materiaalkosten;

    const invoiceUrl =
      "factuur-preview.html?invoice=" + encodeURIComponent(factuur.invoice_number || factuur.id);

    const reminderUrl =
      "herinnering.html?invoice=" + encodeURIComponent(factuur.invoice_number || factuur.id);

    const status = factuur.status || "klaar";

    // 2. Sorteer ze netjes terug in de juiste bakjes op je scherm met jouw originele knoppen
    if (status === "klaar") {
      readyTotal += bedrag;
      readyCount++;

      if (ready) {
        ready.appendChild(
          makeInvoiceRow(
            factuur,
            `<button class="dark-btn" onclick="window.location.href='${invoiceUrl}'">
              Controleren en verzenden
            </button>`
          )
        );
      }
    } 
    
    else if (status === "open") {
      openTotal += bedrag;
      openCount++;

      if (open) {
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
    } 
    
    else if (status === "herinnering") {
      reminderTotal += bedrag;
      reminderCount++;

      if (reminder) {
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
    } 
    
    else if (status === "betaald") {
      paidTotal += bedrag;
    }
  });

  // 3. Update alle bedrag-totalen op het scherm (Nu overal inclusief reiskosten!)
  if (document.getElementById("readyTotal")) document.getElementById("readyTotal").textContent = euro(readyTotal);
  if (document.getElementById("openTotal")) document.getElementById("openTotal").textContent = euro(openTotal);
  if (document.getElementById("reminderTotal")) document.getElementById("reminderTotal").textContent = euro(reminderTotal);
  if (document.getElementById("paidTotal")) document.getElementById("paidTotal").textContent = euro(paidTotal);

  // 4. Update de aantal-tellers op het scherm
  if (document.getElementById("readyCount")) document.getElementById("readyCount").textContent = `${readyCount} facturen`;
  if (document.getElementById("openCount")) document.getElementById("openCount").textContent = `${openCount} facturen`;
  if (document.getElementById("reminderCount")) document.getElementById("reminderCount").textContent = `${reminderCount} facturen`;

  // 5. Toon lege status meldingen als er geen facturen in een lijst staan
  if (ready && !ready.innerHTML) ready.innerHTML = `<p class="empty-state">Geen facturen klaar om te verzenden.</p>`;
  if (open && !open.innerHTML) open.innerHTML = `<p class="empty-state">Geen openstaande facturen.</p>`;
  if (reminder && !reminder.innerHTML) reminder.innerHTML = `<p class="empty-state">Geen herinneringen nodig.</p>`;
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