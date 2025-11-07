// toast.js
const { spawn } = require("child_process");

function psEscape(str) {
  return (str || "").replace(/'/g, "''");
}

function showToast(title, body) {
  const psScript = `
    try {
      Import-Module 'C:\\Users\\maykel\\Documents\\WindowsPowerShell\\Modules\\BurntToast\\1.1.0\\BurntToast.psm1' -Force -ErrorAction Stop;

      $text1 = New-BTText -Content '${psEscape(title)}';
      $text2 = New-BTText -Content '${psEscape(body)}';

      $appLogo = New-BTImage -Source 'C:\\Users\\maykel\\Documents\\node-projects\\server\\pivete.jpg' -AppLogoOverride;
      $hero = New-BTImage -Source 'C:\\Users\\maykel\\Documents\\node-projects\\server\\pivete.jpg' -HeroImage;

      $binding = New-BTBinding -Children $text1, $text2 -AppLogoOverride $appLogo -HeroImage $hero
      $visual = New-BTVisual -BindingGeneric $binding

      # Adiciona botões para que o toast vire um "lembrete real"
      $actionDismiss = New-BTButton -Content 'Dispensar' -Dismiss
      $actionSnooze = New-BTButton -Content 'Adiar' -Snooze

      $content = New-BTContent -Visual $visual -Scenario Reminder -Actions (New-BTAction -Buttons $actionDismiss, $actionSnooze)

      Submit-BTNotification -Content $content
    } catch {
      Write-Error ('Falha ao criar toast: ' + $_.Exception.Message);
    }
  `;

  const ps = spawn("powershell.exe", [
    "-ExecutionPolicy", "Bypass",
    "-NoProfile",
    "-Command",
    psScript
  ], { windowsHide: true });

  ps.stderr.on("data", d => console.error("PowerShell STDERR:", d.toString()));
  ps.on("exit", code => {
    if (code !== 0) console.warn("PowerShell saiu com código", code);
  });
}

module.exports = { showToast };
