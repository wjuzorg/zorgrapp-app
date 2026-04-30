const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let companySignName = "ZorgInzicht";

async function initReminderPage() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session?.user) {
    alert("U bent niet ingelogd.");
    return;
  }

  const user = data.session.user;

  const { data: profile } = await supabaseClient
    .from("business_profiles")
    .select("company_name, owner_name")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (profile) {
    companySignName = profile.owner_name || profile.company_name || "ZorgInzicht";
  }

  fillReminderText();
}

function fillReminderText() {
  const box = document.getElementById("reminderText");
  if (!box) return;

  box.value = `Beste heer/mevrouw,

Volgens onze administratie staat onderstaande factuur nog open.

Factuurnummer: #2026-0031
Openstaand bedrag: €110,00

Wellicht is deze factuur aan uw aandacht ontsnapt.

Wij verzoeken u vriendelijk het openstaande bedrag binnen 7 werkdagen alsnog te voldoen.

Heeft u de betaling inmiddels gedaan? Dan kunt u deze herinnering als niet verzonden beschouwen.

Met vriendelijke groet,

${companySignName}`;
}

function sendReminderByEmail() {
  alert("Herinnering wordt later per e-mail verzonden.");
}

function sendReminderByPost() {
  alert("Herinnering wordt gemarkeerd voor verzending per post.");
}


document.addEventListener("DOMContentLoaded", initReminderPage);