// Setzt den Dunkelmodus vor dem ersten Rendern, damit die Seite beim Laden
// nicht kurz hell aufblitzt. Als eigene Datei statt inline, weil die CSP
// keine Inline-Skripte erlaubt. Logik muss zu src/lib/theme.ts passen.
(function () {
  try {
    var theme = localStorage.getItem("hauswart-app:theme");
    var dark =
      theme === "dark" ||
      (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    /* localStorage gesperrt: System-Einstellung gilt über theme.ts */
  }
})();
