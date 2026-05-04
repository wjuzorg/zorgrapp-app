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
  const number = Number(value || 0);
  return number.toLocaleString("nl-NL", {
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
  const monthValue = monthPicker.value;
  const { start, end } = getMonthRange(monthValue);

  reportBody.innerHTML = `
    <tr>
      <td colspan="9">Rapportage laden...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from("invoices")
    .select(`
      *,
      clients (
        full_name,
        name
      )
    `)
    .gte("invoice_date", start)
    .lt("invoice_date", end)
    .order("invoice_date", { ascending: true });

  if (error) {
    console.error(error);
    reportBody.innerHTML = `
      <tr>
        <td colspan="9">Fout bij laden van rapportage.</td>
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
        <td colspan="9">Geen facturen gevonden voor deze maand.</td>
      </tr>
    `;
    updateTotals([]);
    return;
  }

  reportBody.innerHTML = rows.map(invoice => {
    const clientName =
      invoice.clients?.full_name ||
      invoice.clients?.name ||
      invoice.client_name ||
      "Onbekende cliënt";

    const workAmount = Number(invoice.work_amount || invoice.subtotal_amount || 0);
    const kmAmount = Number(invoice.km_amount || invoice.travel_amount || 0);
    const materialAmount = Number(invoice.material_amount || 0);
    const parkingAmount = Number(invoice.parking_amount || invoice.parking_costs || 0);
    const totalAmount = Number(invoice.total_amount || 0);

    return `
      <tr>
        <td>${invoice.invoice_number || "testnummer"}</td>
        <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("nl-NL") : "-"}</td>
        <td>${clientName}</td>
        <td>${invoice.status || "-"}</td>
        <td>${euro(workAmount)}</td>
        <td>${euro(kmAmount)}</td>
        <td>${euro(materialAmount)}</td>
        <td>${euro(parkingAmount)}</td>
        <td><strong>${euro(totalAmount)}</strong></td>
      </tr>
    `;
  }).join("");

  updateTotals(rows);
}

function updateTotals(rows) {
  let totalRevenue = 0;
  let paidTotal = 0;
  let openTotal = 0;
  let reminderTotal = 0;

  rows.forEach(invoice => {
    const amount = Number(invoice.total_amount || 0);
    totalRevenue += amount;

    if (invoice.status === "betaald") {
      paidTotal += amount;
    } else if (invoice.status === "herinnering") {
      reminderTotal += amount;
      openTotal += amount;
    } else {
      openTotal += amount;
    }
  });

  document.getElementById("totalRevenue").textContent = euro(totalRevenue);
  document.getElementById("paidTotal").textContent = euro(paidTotal);
  document.getElementById("openTotal").textContent = euro(openTotal);
  document.getElementById("reminderTotal").textContent = euro(reminderTotal);
}

function downloadCsv() {
  if (!currentRows.length) {
    alert("Er is nog geen rapportage om te downloaden.");
    return;
  }

  const headers = [
    "Factuurnummer",
    "Datum",
    "Client",
    "Status",
    "Werk",
    "Km",
    "Materiaal",
    "Parkeren",
    "Totaal"
  ];

  const csvRows = currentRows.map(invoice => {
    const clientName =
      invoice.clients?.full_name ||
      invoice.clients?.name ||
      invoice.client_name ||
      "Onbekende cliënt";

    return [
      invoice.invoice_number || "testnummer",
      invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("nl-NL") : "",
      clientName,
      invoice.status || "",
      Number(invoice.work_amount || invoice.subtotal_amount || 0).toFixed(2),
      Number(invoice.km_amount || invoice.travel_amount || 0).toFixed(2),
      Number(invoice.material_amount || 0).toFixed(2),
      Number(invoice.parking_amount || invoice.parking_costs || 0).toFixed(2),
      Number(invoice.total_amount || 0).toFixed(2),
    ];
  });

  const csvContent = [
    headers.join(";"),
    ...csvRows.map(row => row.join(";"))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `maandrapportage-facturen-${monthPicker.value}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

btnLoadReport.addEventListener("click", loadReport);
btnDownloadCsv.addEventListener("click", downloadCsv);
btnPrint.addEventListener("click", () => window.print());

loadReport();