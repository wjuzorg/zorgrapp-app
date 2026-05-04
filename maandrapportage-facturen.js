const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

function euro(value) {
  return `€${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleDateString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function initPage() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session?.user) {
    alert("Niet ingelogd.");
    window.location.href = "login.html";
    return;
  }

  currentUser = data.session.user;

  const monthPicker = document.getElementById("monthPicker");
  monthPicker.value = getCurrentMonthValue();

  monthPicker.addEventListener("change", () => {
    loadInvoiceReport();
  });

  await loadInvoiceReport();
}

async function loadInvoiceReport() {
  const monthValue = document.getElementById("monthPicker").value;
  const { start, end } = getMonthRange(monthValue);

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", currentUser.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    alert("Rapportage laden mislukt: " + error.message);
    return;
  }

  renderInvoiceReport(data || []);
}

function renderInvoiceReport(invoices) {
  const list = document.getElementById("invoiceReportList");

  if (!invoices.length) {
    setText("totalInvoiced", "€0");
    setText("totalPaid", "€0");
    setText("totalOpen", "€0");
    setText("totalReminders", "0");

    list.innerHTML = `
      <div class="empty-state">
        Geen facturen gevonden voor deze maand.
      </div>
    `;
    return;
  }

  const totalInvoiced = invoices.reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);

  const totalPaid = invoices
    .filter(item => item.status === "betaald")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalOpen = invoices
    .filter(item => item.status === "open" || item.status === "herinnering")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalReminders = invoices.filter(item => {
    return item.status === "herinnering" || item.reminder_sent_at;
  }).length;

  setText("totalInvoiced", euro(totalInvoiced));
  setText("totalPaid", euro(totalPaid));
  setText("totalOpen", euro(totalOpen));
  setText("totalReminders", String(totalReminders));

  list.innerHTML = invoices.map(invoice => {
    const statusLabel = getStatusLabel(invoice.status);
    const bedrag = euro(invoice.amount || 0);

    return `
      <article class="report-row">
        <div>
          <strong>${invoice.client_name || "Onbekende cliënt"}</strong><br>
          <small>${invoice.invoice_number || "-"}</small><br>
          <small>Aangemaakt: ${formatDate(invoice.created_at)}</small>
          ${
            invoice.sent_at
              ? `<br><small>Verzonden: ${formatDate(invoice.sent_at)}</small>`
              : ""
          }
          ${
            invoice.paid_at
              ? `<br><small>Betaald: ${formatDate(invoice.paid_at)}</small>`
              : ""
          }
          ${
            invoice.reminder_sent_at
              ? `<br><small>Herinnering: ${formatDate(invoice.reminder_sent_at)}</small>`
              : ""
          }
        </div>

        <div>
          <strong>${bedrag}</strong><br>
          <small>${invoice.minutes || 0} minuten</small><br>
          <small>${statusLabel}</small>
        </div>
      </article>
    `;
  }).join("");
}

function getStatusLabel(status) {
  if (status === "klaar") return "Klaar om te verzenden";
  if (status === "open") return "Wacht op betaling";
  if (status === "herinnering") return "Herinnering nodig";
  if (status === "betaald") return "Betaald";
  return status || "-";
}

document.addEventListener("DOMContentLoaded", initPage);