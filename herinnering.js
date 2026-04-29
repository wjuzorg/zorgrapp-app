const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let companySignName = "ZorgInzicht";

function setReminderText() {
  const reminderText = document.getElementById("reminderText");
  if (!reminderText) return;

  reminderText.value = `Beste heer/mevrouw,

Volgens onze administratie staat onderstaande factuur nog open.

Factuurnummer: #2026-0031
Openstaand bedrag: €110,00

Wellicht is deze factuur aan uw aandacht ontsnapt.

Wij verzoeken u vriendelijk het openstaande bedrag binnen 7 werkdagen alsnog te voldoen.

Heeft u de betaling inmiddels gedaan? Dan kunt u deze herinnering als niet verzonden beschouwen.

Met vriendelijke groet,

${companySignName}`;
}

async function initReminderPage() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session || !data.session.user) {
    alert("U bent niet ingelogd. Log opnieuw in.");
    return;
  }

  currentUser = data.session.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("business_profiles")
    .select("company_name, owner_name")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (profileError) {
    alert("Bedrijfsprofiel laden mislukt: " + profileError.message);
    return;
  }

  if (profile) {
    companySignName = profile.owner_name || profile.company_name || "ZorgInzicht";
  }

  setReminderText();
}

function chooseReminderMethod() {
  const choice = prompt(
    "Hoe wilt u de herinnering versturen?\n\nTyp: email\nof typ: post"
  );

  if (!choice) return;

  if (choice.toLowerCase() === "email") {
    alert("Herinnering wordt later per e-mail verzonden.");
  } else if (choice.toLowerCase() === "post") {
    alert("Herinnering wordt gemarkeerd voor verzending per post.");
  } else {
    alert("Kies email of post.");
  }
}

document.addEventListener("DOMContentLoaded", initReminderPage);