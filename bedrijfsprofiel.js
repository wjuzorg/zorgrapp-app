const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

function el(id) {
  return document.getElementById(id);
}

const fields = [
  "company_name",
  "owner_name",
  "kvk_number",
  "btw_number",
  "iban",
  "hourly_rate",
  "payment_term_days",
  "vat_status",
  "vat_text",
  "vat_customer_number",
  "company_email",
  "company_phone",
  "company_address",
  "company_postcode",
  "company_city",
  "bookkeeping_email",
  "accountant_name"
];

function showMessage(text, isError = false) {
  const box = el("profileMessage");
  if (!box) return;

  box.textContent = text;
  box.style.color = isError ? "#b91c1c" : "#166534";
}

function updateVatText() {
  const vatStatus = el("vat_status");
  const vatText = el("vat_text");
  const vatCustomerWrap = el("vatCustomerWrap");

  if (!vatStatus || !vatText || !vatCustomerWrap) return;

  vatCustomerWrap.style.display = "none";

  if (vatStatus.value === "vrijgesteld") {
    vatText.value =
      "BTW vrijgesteld van omzetbelasting volgens geldende vrijstelling.";
  } else {
    vatText.value = "";
  }

  if (vatStatus.value === "verlegd") {
    vatCustomerWrap.style.display = "block";
  }
}

function renderProcessorAgreementStatus(data) {
  const statusBox = el("processorAgreementStatus");
  const acceptWrap = el("processorAgreementAcceptWrap");

  if (!statusBox) return;

  if (!data || !data.processor_agreement_accepted) {
    statusBox.textContent = "Nog niet geaccepteerd";
    statusBox.style.color = "#b91c1c";

    if (acceptWrap) {
      acceptWrap.style.display = "block";
    }

    return;
  }

  const acceptedAt = data.processor_agreement_accepted_at
    ? new Date(data.processor_agreement_accepted_at).toLocaleString("nl-NL")
    : "datum onbekend";

  const version = data.processor_agreement_version || "versie onbekend";

  statusBox.textContent = `Geaccepteerd op ${acceptedAt} (${version})`;
  statusBox.style.color = "#166534";

  if (acceptWrap) {
    acceptWrap.style.display = "none";
  }
}

async function init() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData.user) {
    showMessage("Niet ingelogd. Log opnieuw in.", true);
    return;
  }

  currentUser = userData.user;

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", currentUser.id)
    .single();

  if (error) {
  console.log("Nog geen bedrijfsprofiel gevonden:", error.message);
  updateVatText();
  renderProcessorAgreementStatus(null);
  return;
}

  fields.forEach(field => {
    const input = el(field);
    if (input && data[field] !== null && data[field] !== undefined) {
      input.value = data[field];
    }
  });

  updateVatText();
renderProcessorAgreementStatus(data);
}

async function acceptProcessorAgreement() {
  if (!currentUser) {
    showMessage("Niet ingelogd. Log opnieuw in.", true);
    return;
  }

  const checkbox = el("processorAgreementCheckbox");

  if (!checkbox || !checkbox.checked) {
    showMessage("Vink eerst aan dat u akkoord gaat met de verwerkersovereenkomst.", true);
    return;
  }

  const acceptedAt = new Date().toISOString();
  const version = "v1-2026-05-10";

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .upsert(
      {
        owner_id: currentUser.id,
        processor_agreement_accepted: true,
        processor_agreement_accepted_at: acceptedAt,
        processor_agreement_version: version,
        privacy_policy_version: version,
        updated_at: acceptedAt
      },
      { onConflict: "owner_id" }
    )
    .select()
    .single();

  if (error) {
    showMessage("Akkoord opslaan mislukt: " + error.message, true);
    return;
  }

  renderProcessorAgreementStatus(data);
  showMessage("Verwerkersovereenkomst geaccepteerd.");
}

async function saveBusinessProfile() {
  if (!currentUser) {
    showMessage("Niet ingelogd. Log opnieuw in.", true);
    return;
  }

  const payload = {
    owner_id: currentUser.id,

    company_name: el("company_name")?.value.trim() || "",
    owner_name: el("owner_name")?.value.trim() || "",
    kvk_number: el("kvk_number")?.value.trim() || "",
    btw_number: el("btw_number")?.value.trim() || "",
    iban: el("iban")?.value.trim() || "",

    hourly_rate: el("hourly_rate")?.value
      ? Number(el("hourly_rate").value)
      : 50,

    payment_term_days: el("payment_term_days")?.value
      ? Number(el("payment_term_days").value)
      : 14,

    vat_status: el("vat_status")?.value || "",
    vat_text: el("vat_text")?.value.trim() || "",
    vat_customer_number: el("vat_customer_number")?.value.trim() || "",

    company_email: el("company_email")?.value.trim() || "",
    company_phone: el("company_phone")?.value.trim() || "",
    company_address: el("company_address")?.value.trim() || "",
    company_postcode: el("company_postcode")?.value.trim() || "",
    company_city: el("company_city")?.value.trim() || "",

    bookkeeping_email: el("bookkeeping_email")?.value.trim() || "",
    accountant_name: el("accountant_name")?.value.trim() || "",

    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("business_profiles")
    .upsert(payload, { onConflict: "owner_id" });

  if (error) {
    showMessage("Opslaan mislukt: " + error.message, true);
    return;
  }

  showMessage("Bedrijfsprofiel opgeslagen.");
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();

  const saveBtn = el("saveBusinessProfileBtn");
  const vatStatus = el("vat_status");

  const acceptAgreementBtn = el("acceptProcessorAgreementBtn");

if (acceptAgreementBtn) {
  acceptAgreementBtn.addEventListener("click", acceptProcessorAgreement);
}

  if (vatStatus) {
    vatStatus.addEventListener("change", updateVatText);
  }

  if (saveBtn) {
  console.log("Opslaan-knop gevonden");
  saveBtn.addEventListener("click", () => {
    console.log("Opslaan-knop geklikt");
    saveBusinessProfile();
  });
} else {
  console.log("Opslaan-knop NIET gevonden");
}
});