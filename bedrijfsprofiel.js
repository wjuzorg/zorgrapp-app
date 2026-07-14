const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let loadedVatStatus = "";

const VAT_DEFAULT_TEXTS = {
  vrijgesteld:
    "BTW vrijgesteld van omzetbelasting volgens de geldende vrijstelling.",

  kor:
    "Geen btw in rekening gebracht vanwege toepassing van de kleineondernemersregeling (KOR).",

  verlegd:
    "BTW verlegd naar de afnemer."
};

const fields = [
  "company_name",
  "owner_name",
  "kvk_number",
  "btw_number",
  "iban",
  "hourly_rate",
  "payment_term_days",
  "vat_status",
  "vat_rate",
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

function el(id) {
  return document.getElementById(id);
}

function showMessage(text, isError = false) {
  const box = el("profileMessage");

  if (!box) return;

  box.textContent = text;
  box.style.color = isError ? "#b91c1c" : "#166534";
  box.style.display = text ? "block" : "none";
}

/**
 * Toont de juiste velden voor de gekozen btw-status.
 *
 * forceDefaultText:
 * true  = de standaardtekst invullen na een handmatige statuswijziging
 * false = bestaande opgeslagen tekst behouden bij het laden
 */
function updateVatFields(forceDefaultText = false) {
  const vatStatusInput = el("vat_status");
  const vatTextWrap = el("vatTextWrap");
  const vatTextInput = el("vat_text");
  const vatRateWrap = el("vatRateWrap");
  const vatRateInput = el("vat_rate");
  const vatCustomerWrap = el("vatCustomerWrap");
  const vatCustomerInput = el("vat_customer_number");

  if (
    !vatStatusInput ||
    !vatTextWrap ||
    !vatTextInput ||
    !vatRateWrap ||
    !vatRateInput ||
    !vatCustomerWrap ||
    !vatCustomerInput
  ) {
    return;
  }

  const status = vatStatusInput.value;

  // Eerst alles verbergen en vereisten uitschakelen.
  vatTextWrap.style.display = "none";
  vatRateWrap.style.display = "none";
  vatCustomerWrap.style.display = "none";

  vatTextInput.required = false;
  vatRateInput.required = false;
  vatCustomerInput.required = false;

  if (status === "btw_plichtig") {
    vatRateWrap.style.display = "block";
    vatRateInput.required = true;

    // Bij btw-plichtig gebruiken we geen vrije btw-tekst.
    vatTextInput.value = "";
    vatCustomerInput.value = "";

    if (!vatRateInput.value) {
      vatRateInput.value = "21";
    }

    return;
  }

  if (
    status === "vrijgesteld" ||
    status === "kor" ||
    status === "verlegd"
  ) {
    vatTextWrap.style.display = "block";
    vatTextInput.required = true;

    /*
     * Alleen automatisch vervangen wanneer:
     * - de zzp'er zelf de status wijzigt; of
     * - er nog helemaal geen tekst is opgeslagen.
     */
    if (forceDefaultText || !vatTextInput.value.trim()) {
      vatTextInput.value = VAT_DEFAULT_TEXTS[status] || "";
    }
  }

  if (status === "verlegd") {
    vatCustomerWrap.style.display = "block";
    vatCustomerInput.required = true;
  } else {
    vatCustomerInput.value = "";
  }
}

/**
 * Wordt aangeroepen wanneer de gebruiker de btw-status wijzigt.
 */
function handleVatStatusChange() {
  const newStatus = el("vat_status")?.value || "";

  /*
   * Bij een echte statuswijziging wordt de standaardtekst
   * van de nieuwe status ingevuld.
   */
  const statusChanged = newStatus !== loadedVatStatus;

  updateVatFields(statusChanged);

  loadedVatStatus = newStatus;
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

  const version =
    data.processor_agreement_version || "versie onbekend";

  statusBox.textContent =
    `Geaccepteerd op ${acceptedAt} (${version})`;

  statusBox.style.color = "#166534";

  if (acceptWrap) {
    acceptWrap.style.display = "none";
  }
}

async function loadBusinessProfile() {
  if (!currentUser) {
    showMessage("Niet ingelogd. Log opnieuw in.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Bedrijfsprofiel laden mislukt:", error);

    showMessage(
      "Bedrijfsprofiel laden mislukt: " + error.message,
      true
    );

    renderProcessorAgreementStatus(null);
    return;
  }

  if (!data) {
    loadedVatStatus = "";
    updateVatFields(false);
    renderProcessorAgreementStatus(null);
    return;
  }

  fields.forEach((field) => {
    const input = el(field);

    if (
      input &&
      data[field] !== null &&
      data[field] !== undefined
    ) {
      input.value = data[field];
    }
  });

  loadedVatStatus = data.vat_status || "";

  /*
   * false voorkomt dat een handmatig aangepaste opgeslagen tekst
   * tijdens het laden wordt overschreven.
   */
  updateVatFields(false);
  renderProcessorAgreementStatus(data);
}

async function init() {
  showMessage("");

  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError || !userData.user) {
    console.error("Gebruiker ophalen mislukt:", userError);

    showMessage(
      "Niet ingelogd. Log opnieuw in.",
      true
    );

    return;
  }

  currentUser = userData.user;

  await loadBusinessProfile();
}

function validateBusinessProfile() {
  const requiredFields = [
    {
      id: "company_name",
      label: "Bedrijfsnaam"
    },
    {
      id: "owner_name",
      label: "Naam ondernemer"
    },
    {
      id: "kvk_number",
      label: "KVK-nummer"
    },
    {
      id: "iban",
      label: "Rekeningnummer / IBAN"
    },
    {
      id: "payment_term_days",
      label: "Betaaltermijn"
    },
    {
      id: "vat_status",
      label: "BTW-instelling"
    }
  ];

  for (const field of requiredFields) {
    const input = el(field.id);

    if (!input || !String(input.value).trim()) {
      showMessage(
        `Vul het veld "${field.label}" in.`,
        true
      );

      input?.focus();
      return false;
    }
  }

  const vatStatus = el("vat_status")?.value || "";
  const vatText = el("vat_text")?.value.trim() || "";
  const vatRate = el("vat_rate")?.value || "";
  const vatCustomerNumber =
    el("vat_customer_number")?.value.trim() || "";

  if (
    ["vrijgesteld", "kor", "verlegd"].includes(vatStatus) &&
    !vatText
  ) {
    showMessage(
      "Vul de btw-tekst voor op de factuur in.",
      true
    );

    el("vat_text")?.focus();
    return false;
  }

  if (vatStatus === "btw_plichtig" && vatRate === "") {
    showMessage(
      "Kies het btw-percentage.",
      true
    );

    el("vat_rate")?.focus();
    return false;
  }

  if (vatStatus === "verlegd" && !vatCustomerNumber) {
    showMessage(
      "Vul het btw-nummer van de afnemer in.",
      true
    );

    el("vat_customer_number")?.focus();
    return false;
  }

  return true;
}

async function acceptProcessorAgreement() {
  if (!currentUser) {
    showMessage(
      "Niet ingelogd. Log opnieuw in.",
      true
    );

    return;
  }

  const checkbox = el("processorAgreementCheckbox");

  if (!checkbox || !checkbox.checked) {
    showMessage(
      "Vink eerst aan dat u akkoord gaat met de verwerkersovereenkomst.",
      true
    );

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
      {
        onConflict: "owner_id"
      }
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Verwerkersovereenkomst opslaan mislukt:",
      error
    );

    showMessage(
      "Opslaan mislukt: " + error.message,
      true
    );

    return;
  }

  renderProcessorAgreementStatus(data);

  showMessage(
    "Verwerkersovereenkomst geaccepteerd."
  );
}

async function saveBusinessProfile() {
  if (!currentUser) {
    showMessage(
      "Niet ingelogd. Log opnieuw in.",
      true
    );

    return;
  }

  if (!validateBusinessProfile()) {
    return;
  }

  const saveButton = el("saveBusinessProfileBtn");
  const vatStatus = el("vat_status")?.value || "";

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Bezig met opslaan...";
  }

  const payload = {
    owner_id: currentUser.id,

    company_name:
      el("company_name")?.value.trim() || "",

    owner_name:
      el("owner_name")?.value.trim() || "",

    kvk_number:
      el("kvk_number")?.value.trim() || "",

    btw_number:
      el("btw_number")?.value.trim() || "",

    iban:
      el("iban")?.value.trim() || "",

    hourly_rate:
      el("hourly_rate")?.value !== ""
        ? Number(el("hourly_rate").value)
        : 50,

    payment_term_days:
      el("payment_term_days")?.value !== ""
        ? Number(el("payment_term_days").value)
        : 14,

    vat_status: vatStatus,

    /*
     * Alleen bij btw-plichtig wordt een percentage opgeslagen.
     * Bij de overige statussen wordt vat_rate leeg opgeslagen.
     */
    vat_rate:
      vatStatus === "btw_plichtig"
        ? Number(el("vat_rate")?.value || 21)
        : null,

    /*
     * Alleen statussen met factuurtekst slaan vat_text op.
     */
    vat_text:
      vatStatus === "btw_plichtig"
        ? ""
        : el("vat_text")?.value.trim() || "",

    /*
     * Alleen bij btw verlegd wordt het btw-nummer
     * van de afnemer opgeslagen.
     */
    vat_customer_number:
      vatStatus === "verlegd"
        ? el("vat_customer_number")?.value.trim() || ""
        : "",

    company_email:
      el("company_email")?.value.trim() || "",

    company_phone:
      el("company_phone")?.value.trim() || "",

    company_address:
      el("company_address")?.value.trim() || "",

    company_postcode:
      el("company_postcode")?.value.trim() || "",

    company_city:
      el("company_city")?.value.trim() || "",

    bookkeeping_email:
      el("bookkeeping_email")?.value.trim() || "",

    accountant_name:
      el("accountant_name")?.value.trim() || "",

    updated_at: new Date().toISOString()
  };

  console.log("Payload bedrijfsprofiel:", payload);

  const { error } = await supabaseClient
    .from("business_profiles")
    .upsert(payload, {
      onConflict: "owner_id"
    });

  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "Bedrijfsprofiel opslaan";
  }

  if (error) {
    console.error(
      "Bedrijfsprofiel opslaan mislukt:",
      error
    );

    showMessage(
      "Opslaan mislukt: " + error.message,
      true
    );

    return;
  }

  loadedVatStatus = vatStatus;

  showMessage("Bedrijfsprofiel opgeslagen.");

  alert("Bedrijfsprofiel opgeslagen.");

  await loadBusinessProfile();
}

document.addEventListener("DOMContentLoaded", async () => {
  const saveButton = el("saveBusinessProfileBtn");
  const vatStatusInput = el("vat_status");
  const acceptAgreementButton =
    el("acceptProcessorAgreementBtn");

  if (vatStatusInput) {
    vatStatusInput.addEventListener(
      "change",
      handleVatStatusChange
    );
  }

  if (acceptAgreementButton) {
    acceptAgreementButton.addEventListener(
      "click",
      acceptProcessorAgreement
    );
  }

  if (saveButton) {
    saveButton.addEventListener(
      "click",
      saveBusinessProfile
    );
  }

  await init();
});