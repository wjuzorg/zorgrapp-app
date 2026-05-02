const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function euro(value) {
  return `€${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

async function loadFacturen() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  currentUser = sessionData?.session?.user;

  if (!currentUser) {
    alert("Niet ingelogd.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    alert("Facturen laden mislukt: " + error.message);
    return;
  }

  renderFacturen(data || []);
}

function makeInvoiceRow(factuur, buttons) {
  const bedrag = Number(factuur.total || factuur.amount || 0);

  const row = document.createElement("div");
  row.className = "invoice-row";
  row.innerHTML = `
    <div>
      <strong>${factuur.client_name || "Onbekende cliënt"}</strong><br>
      <small>${factuur.invoice_number || ""}</small>
    </div>

    <span>${factuur.minutes || 0} minuten</span>
    <strong>${euro(bedrag)}</strong>

    ${buttons}
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

document.addEventListener("DOMContentLoaded", loadFacturen);