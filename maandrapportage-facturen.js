const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function loadBusinessProfile(userId) {
  const companyInfo = document.getElementById("companyInfo");

  if (!companyInfo) {
    console.error("Element #companyInfo niet gevonden.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Bedrijfsprofiel laden mislukt:", error);
    companyInfo.innerHTML = `
      Bedrijfsgegevens nog niet ingesteld.<br>
      Voeg later bedrijfsnaam, KvK, btw-id en IBAN toe via Bedrijfsprofiel.
    `;
    return;
  }

  if (!data) {
    companyInfo.innerHTML = `
      Bedrijfsgegevens nog niet ingesteld.<br>
      Voeg later bedrijfsnaam, KvK, btw-id en IBAN toe via Bedrijfsprofiel.
    `;
    return;
  }

  companyInfo.innerHTML = `
    <strong>${data.company_name || "Bedrijfsnaam niet ingevuld"}</strong><br>
    ${data.address || "Adres niet ingevuld"}<br>
    ${(data.postal_code || "")} ${(data.city || "")}<br>
    KvK: ${data.kvk_number || "Niet ingevuld"}<br>
    Btw-id: ${data.vat_number || "Niet ingevuld"}<br>
    IBAN: ${data.iban || "Niet ingevuld"}
  `;
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
  const months = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december"
  ];
  return `${months[Number(month) - 1]}${year}`;
}

function cleanStatus(status) {
  if (status === "klaar") return "Openstaand";
  if (status === "betaald") return "Betaald";
  if (status === "herinnering") return "Herinnering";
  if (status === "open") return "Openstaand";
  return status || "-";
}

function downloadCsv() {
  if (!currentRows.length) return alert("Geen data");

  const rows = currentRows.map(i => {
    const total =
      Number(i.amount || 0) +
      Number(i.km_amount || 0) +
      Number(i.material_cost || 0) +
      Number(i.parking_cost || 0);

    return {
      Factuurnummer: i.invoice_number || "-",
      Datum: i.created_at ? new Date(i.created_at).toLocaleDateString("nl-NL") : "",
      Cliënt: i.client_name || "Onbekend",
      Status: cleanStatus(i.status),
      Werk: Number(i.amount || 0),
      Km: Number(i.km_amount || 0),
      Materiaal: Number(i.material_cost || 0),
      Parkeren: Number(i.parking_cost || 0),
      "BTW-status": formatVatStatus(currentProfile?.vat_status),
      Totaal: total
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Facturen");

  XLSX.writeFile(workbook, `maandrapportage-${getMonthNameForFile()}.xlsx`);
}

btnLoadReport.onclick = loadReport;
btnDownloadCsv.onclick = downloadCsv;
btnPrint.onclick = () => window.print();

statusFilter.addEventListener("change", loadReport);

async function startPage() {
  await loadBusinessProfile(user.id);
  await loadReport();
}

(async () => {
  const ok = await enforceProcessorAgreement();
  if (!ok) return;

  startApp();
})();