const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const monthPicker = document.getElementById("monthPicker");
const statusFilter = document.getElementById("statusFilter");
const btnLoadReport = document.getElementById("btnLoadReport");
const btnDownloadCsv = document.getElementById("btnDownloadCsv");
const btnPrint = document.getElementById("btnPrint");
const reportBody = document.getElementById("reportBody");
const companyInfo = document.getElementById("companyInfo");

let currentProfile = null;

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

async function loadBusinessProfile() {
  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .single();

  if (error) {
    console.error(error);

    companyInfo.innerHTML = `
      Bedrijfsgegevens nog niet ingesteld.<br>
      Voeg later bedrijfsnaam, KvK, btw-id en IBAN toe via Bedrijfsprofiel.
    `;
    return;
  }

  currentProfile = data;

  companyInfo.innerHTML = `
    <strong>${data.company_name || "Bedrijfsnaam niet ingevuld"}</strong><br>
    KvK: ${data.kvk_number || "-"}<br>
    BTW-ID: ${data.btw_number || "-"}<br>
    IBAN: ${data.iban || "-"}<br><br>
    <strong>Boekhouder</strong><br>
    ${data.accountant_name || "Naam niet ingevuld"}<br>
    ${data.bookkeeping_email || "E-mail niet ingevuld"}<br>
    <button class="mini-btn" onclick="window.location.href='bedrijfsprofiel.html'">
      Wijzig
    </button>
  `;
}

async function loadReport() {
  const { start, end } = getMonthRange(monthPicker.value);

  reportBody.innerHTML = `
    <tr>
      <td colspan="9">Laden...</td>
    </tr>
  `;

let query = supabaseClient
  .from("invoice_drafts")
  .select("*")
  .gte("created_at", start)
  .lt("created_at", end);

 if (statusFilter.value !== "all") {
  query = query.eq("status", statusFilter.value);
}

const { data, error } = await query.order("created_at", {
  ascending: true
});

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
    <td>
  <a class="invoice-link" href="factuur-preview.html?invoice=${encodeURIComponent(invoice.invoice_number)}">
    ${invoice.invoice_number || "-"}
  </a>
</td>

    <td>
      ${invoice.created_at
        ? new Date(invoice.created_at).toLocaleDateString("nl-NL")
        : "-"}
    </td>

   <td>
  ${
    invoice.status === "klaar"
      ? "Openstaand"
      : invoice.status === "herinnering"
      ? "Herinnering"
      : invoice.status === "betaald"
      ? "Betaald"
      : invoice.status || "-"
  }
</td>

    <td>${invoice.status || "-"}</td>

    <td>${euro(invoice.amount)}</td>

    <td>${euro(invoice.km_amount)}</td>

    <td>${euro(invoice.material_cost)}</td>

    <td>${euro(invoice.parking_cost)}</td>

    <td>${formatVatStatus(currentProfile?.vat_status)}</td>

    <td>
      <strong>
        ${euro(
          Number(invoice.amount || 0) +
          Number(invoice.km_amount || 0) +
          Number(invoice.material_cost || 0) +
          Number(invoice.parking_cost || 0)
        )}
      </strong>
    </td>
  </tr>
`;
  }).join("");

  updateTotals(rows);
}

function formatVatStatus(status) {
  if (status === "vrijgesteld") return "Vrijgesteld";
  if (status === "kor") return "KOR";
  if (status === "verlegd") return "Verlegd";
  if (status === "btw_plichtig") return "BTW-plichtig";
  return "-";
}

function updateTotals(rows) {
  let total = 0, paid = 0, open = 0, reminder = 0;

  rows.forEach(i => {
    const amount =
  Number(i.amount || 0) +
  Number(i.km_amount || 0) +
  Number(i.material_cost || 0) +
  Number(i.parking_cost || 0);

    total += amount;

    if (i.status === "betaald") {

      paid += amount;

    } else if (i.status === "herinnering") {

      reminder += amount;
      open += amount;

    } else {

      open += amount;
    }
  });

  document.getElementById("totalRevenue").textContent = euro(total);
  document.getElementById("paidTotal").textContent = euro(paid);
  document.getElementById("openTotal").textContent = euro(open);
  document.getElementById("reminderTotal").textContent = euro(reminder);
}

function getMonthNameForFile() {
  const [year, month] = monthPicker.value.split("-");
  const monthNames = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december"
  ];

  return `${monthNames[Number(month) - 1]}${year}`;
}

function downloadCsv() {
  if (!currentRows.length) return alert("Geen data");

  const rows = currentRows.map(i => {
    const total =
      Number(i.amount || 0) +
      Number(i.km_amount || 0) +
      Number(i.material_cost || 0) +
      Number(i.parking_cost || 0);

    return [
      i.invoice_number || "-",
      i.created_at ? new Date(i.created_at).toLocaleDateString("nl-NL") : "",
      i.client_name || "Onbekend",
      i.status === "klaar" ? "Openstaand" : i.status || "",
      Number(i.amount || 0).toFixed(2).replace(".", ","),
      Number(i.km_amount || 0).toFixed(2).replace(".", ","),
      Number(i.material_cost || 0).toFixed(2).replace(".", ","),
      Number(i.parking_cost || 0).toFixed(2).replace(".", ","),
      formatVatStatus(currentProfile?.vat_status),
      total.toFixed(2).replace(".", ",")
    ];
  });

  const csv = [
    ["Factuurnummer", "Datum", "Cliënt", "Status", "Werk", "Km", "Materiaal", "Parkeren", "BTW-status", "Totaal"].join(";"),
    ...rows.map(r => r.join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `maandrapportage-${getMonthNameForFile()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

btnLoadReport.onclick = loadReport;
btnDownloadCsv.onclick = downloadCsv;
btnPrint.onclick = () => window.print();

statusFilter.addEventListener("change", loadReport);

async function startPage() {
  await loadBusinessProfile();
  await loadReport();
}

startPage();