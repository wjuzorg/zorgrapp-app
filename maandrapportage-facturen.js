const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const monthPicker = document.getElementById("monthPicker");
const btnLoadReport = document.getElementById("btnLoadReport");
const btnDownloadCsv = document.getElementById("btnDownloadCsv");
const btnPrint = document.getElementById("btnPrint");
const reportBody = document.getElementById("reportBody");

let currentRows = [];

function euro(value) {
  return Number(value || 0).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

function todayMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

monthPicker.value = todayMonth();

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function loadReport() {
  const { start, end } = getMonthRange(monthPicker.value);

  reportBody.innerHTML = `
    <tr>
      <td colspan="9">Laden...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("invoices")
    .select("*")
    .gte("invoice_date", start)
    .lt("invoice_date", end)
    .order("invoice_date", { ascending: true });

  if (error) {
    console.error(error);
    reportBody.innerHTML = `
      <tr>
        <td colspan="9">Fout bij laden</td>
      </tr>
    `;
    return;
  }

  currentRows = data || [];
  renderReport(currentRows);
}

function renderReport(rows) {
  if (!rows.length) {
    reportBody.innerHTML = `
      <tr>
        <td colspan="9">Geen facturen gevonden</td>
      </tr>
    `;
    updateTotals([]);
    return;
  }

  reportBody.innerHTML = rows.map(invoice => {
    const clientName =
      invoice.client_name ||
      invoice.full_name ||
      invoice.name ||
      "Onbekend";

    return `
      <tr>
        <td>${invoice.invoice_number || "-"}</td>
        <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("nl-NL") : "-"}</td>
        <td>${clientName}</td>
        <td>${invoice.status || "-"}</td>
        <td>${euro(invoice.work_amount)}</td>
        <td>${euro(invoice.km_amount)}</td>
        <td>${euro(invoice.material_amount)}</td>
        <td>${euro(invoice.parking_amount)}</td>
        <td><strong>${euro(invoice.total_amount)}</strong></td>
      </tr>
    `;
  }).join("");

  updateTotals(rows);
}

function updateTotals(rows) {
  let total = 0, paid = 0, open = 0, reminder = 0;

  rows.forEach(i => {
    const amount = Number(i.total_amount || 0);
    total += amount;

    if (i.status === "betaald") paid += amount;
    else if (i.status === "herinnering") {
      reminder += amount;
      open += amount;
    } else open += amount;
  });

  document.getElementById("totalRevenue").textContent = euro(total);
  document.getElementById("paidTotal").textContent = euro(paid);
  document.getElementById("openTotal").textContent = euro(open);
  document.getElementById("reminderTotal").textContent = euro(reminder);
}

function downloadCsv() {
  if (!currentRows.length) return alert("Geen data");

  const rows = currentRows.map(i => [
    i.invoice_number,
    i.invoice_date,
    i.client_name,
    i.status,
    i.work_amount,
    i.km_amount,
    i.material_amount,
    i.parking_amount,
    i.total_amount
  ]);

  const csv = [
    ["Nr","Datum","Client","Status","Werk","Km","Materiaal","Parkeren","Totaal"].join(";"),
    ...rows.map(r => r.join(";"))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "maandrapportage.csv";
  a.click();
}

btnLoadReport.onclick = loadReport;
btnDownloadCsv.onclick = downloadCsv;
btnPrint.onclick = () => window.print();

loadReport();