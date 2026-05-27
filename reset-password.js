const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const newPasswordEl = document.getElementById("newPassword");
const savePasswordBtn = document.getElementById("savePasswordBtn");
const msgEl = document.getElementById("msg");

savePasswordBtn.addEventListener("click", async () => {
  const newPassword = newPasswordEl.value;

  if (!newPassword || newPassword.length < 6) {
    msgEl.textContent = "Kies een wachtwoord van minimaal 6 tekens.";
    return;
  }

  msgEl.textContent = "Wachtwoord opslaan...";

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    msgEl.textContent = `Fout: ${error.message}`;
    return;
  }

  msgEl.textContent = "Wachtwoord aangepast. Je gaat nu naar de inlogpagina.";

  setTimeout(() => {
    window.location.href = "./login.html";
  }, 1800);
});