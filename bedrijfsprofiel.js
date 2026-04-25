const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  "company_email",
  "company_phone",
  "company_address",
  "company_postcode",
  "company_city"
];

let currentUser = null;

function el(id) {
  return document.getElementById(id);
}

function showMessage(text, isError = false) {
  let box = document.getElementById("profileMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "profileMessage";
    box.style.marginTop = "14px";
    box.style.fontWeight = "700";
    document.querySelector(".action-stack").appendChild(box);
  }

  box.textContent = text;
  box.style.color = isError ? "#b91c1c" : "#166534";
}

async function init() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    showMessage("Niet ingelogd.", true);
    return;
  }

  currentUser = data.user;
  await loadBusinessProfile();
}

async function loadBusinessProfile() {
  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error) {
    showMessage("Laden mislukt: " + error.message, true);
    return;
  }

  if (!data) return;

  fields.forEach((field) => {
    if (el(field) && data[field] !== null && data[field] !== undefined) {
      el(field).value = data[field];
    }
  });
}

async function saveBusinessProfile() {
  if (!currentUser) {
    showMessage("Geen gebruiker gevonden.", true);
    return;
  }

  const payload = {
    owner_id: currentUser.id,

    company_name: el("company_name").value.trim(),
    owner_name: el("owner_name").value.trim(),
    kvk_number: el("kvk_number").value.trim(),
    btw_number: el("btw_number").value.trim(),

    iban: el("iban").value.trim(),
    hourly_rate: el("hourly_rate").value
      ? Number(el("hourly_rate").value)
      : 50,

    payment_term_days: el("payment_term_days").value
      ? Number(el("payment_term_days").value)
      : 14,

    vat_status: el("vat_status").value || "vrijgesteld",
    vat_text: el("vat_text").value.trim(),

    company_email: el("company_email").value.trim(),
    company_phone: el("company_phone").value.trim(),
    company_address: el("company_address").value.trim(),
    company_postcode: el("company_postcode").value.trim(),
    company_city: el("company_city").value.trim(),

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

document.addEventListener("DOMContentLoaded", () => {
  init();

  const saveBtn = document.getElementById("saveBusinessProfileBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", saveBusinessProfile);
  }
});