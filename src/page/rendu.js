/* rendu.js : affiche un script d'appel (objet JSON) sous forme de page à
   embranchements. Tout est rendu au runtime, sans serveur (file://).
   Utilisé par les pages de Output/ et par l'aperçu de l'éditeur. */
"use strict";
window.PromptAnxiety = (function () {

  function echapper(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /* mise en forme minimale : **gras**, retours à la ligne */
  function enLigne(s) {
    return echapper(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }

  function rendre(script, conteneur, cle) {
    const prefixe = "pa:" + (cle || script.slug || "script") + ":";
    const lire = (k) => { try { return localStorage.getItem(prefixe + k); } catch (e) { return null; } };
    const ecrire = (k, v) => { try { localStorage.setItem(prefixe + k, v); } catch (e) {} };
    const effacer = () => { try { Object.keys(localStorage).filter((k) => k.startsWith(prefixe)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} };

    let h = '<main class="page">';
    h += `<h1>${echapper(script.titre || "Script d'appel")}</h1>`;
    if (script.sous_titre) h += `<div class="meta">${echapper(script.sous_titre).split(" · ").map((x) => `<span>${x}</span>`).join("")}</div>`;
    h += '<div class="etape">';
    if (script.numero) h += `<div class="tel">${echapper(script.numero)}</div>`;
    if (script.intro) h += `<p class="mini">${enLigne(script.intro)}</p>`;
    h += '<div class="barre"><button type="button" class="principal" data-action="copier">Copier le compte rendu</button>' +
         '<button type="button" data-action="imprimer">Imprimer</button><button type="button" data-action="vider">Tout effacer</button></div></div>';

    (script.etapes || []).forEach((et, i) => {
      const nom = "e" + i, plusieurs = et.mode === "plusieurs";
      h += `<div class="etape" data-etape="${i}"><h2><span class="n">${i}</span>${echapper(et.titre)}</h2>`;
      if (et.dire) h += `<div class="dire">${enLigne(et.dire)}</div>`;
      if (et.aide) h += `<p class="aide">${enLigne(et.aide)}</p>`;
      (et.reponses || []).forEach((r, j) => {
        const id = nom + "_" + j;
        h += `<div class="rep"><label><input type="${plusieurs ? "checkbox" : "radio"}" name="${nom}" data-cle="${id}"> <span class="texte">${enLigne(r.texte)}</span></label>`;
        h += '<div class="suite">';
        if (r.replique) h += `<div class="dire">${enLigne(r.replique)}</div>`;
        if (r.suite) h += `<div>${enLigne(r.suite)}</div>`;
        (r.sous || []).forEach((s, k) => {
          const sid = id + "_" + k;
          h += `<div class="rep"><label><input type="checkbox" data-cle="${sid}"> <span class="texte">${enLigne(s.texte)}</span></label><div class="suite">`;
          if (s.replique) h += `<div class="dire">${enLigne(s.replique)}</div>`;
          if (s.suite) h += `<div>${enLigne(s.suite)}</div>`;
          if (s.note) h += `<input class="note" data-cle="n_${sid}" placeholder="${echapper(s.note)}">`;
          h += "</div></div>";
        });
        if (r.note) h += `<input class="note" data-cle="n_${id}" placeholder="${echapper(r.note)}">`;
        h += "</div></div>";
      });
      if (et.note) h += `<input class="note" data-cle="n_${nom}" placeholder="${echapper(et.note)}">`;
      h += "</div>";
    });

    if (script.apres) h += `<div class="etape"><h2><span class="n">+</span>Juste après</h2><div class="fin">${enLigne(script.apres)}</div></div>`;
    h += '<div class="etape"><label class="mini">Notes libres</label><textarea class="note" data-cle="n_libre" rows="4"></textarea></div></main>';
    conteneur.innerHTML = h;

    /* état : cases et notes, restaurés puis sauvegardés à chaque changement */
    const cases = conteneur.querySelectorAll("input[type=radio], input[type=checkbox]");
    function majSuites() {
      cases.forEach((c) => c.closest(".rep").classList.toggle("coche", c.checked));
    }
    cases.forEach((c) => {
      if (lire(c.dataset.cle) === "1") c.checked = true;
      c.addEventListener("change", () => {
        if (c.type === "radio") conteneur.querySelectorAll(`input[name="${c.name}"]`).forEach((r) => ecrire(r.dataset.cle, r.checked ? "1" : "0"));
        else ecrire(c.dataset.cle, c.checked ? "1" : "0");
        majSuites();
      });
    });
    conteneur.querySelectorAll(".note").forEach((n) => {
      const v = lire(n.dataset.cle); if (v !== null) n.value = v;
      n.addEventListener("input", () => ecrire(n.dataset.cle, n.value));
      n.addEventListener("click", (e) => e.stopPropagation());
    });
    majSuites();

    function compteRendu() {
      const lignes = ["COMPTE RENDU · " + (script.titre || "") + " · " + new Date().toLocaleString("fr-FR")];
      conteneur.querySelectorAll(".etape[data-etape]").forEach((et) => {
        lignes.push("\n## " + et.querySelector("h2").textContent.trim());
        et.querySelectorAll("input:checked").forEach((c) => lignes.push("- " + c.parentElement.querySelector(".texte").textContent.trim()));
        et.querySelectorAll(".note").forEach((n) => { if (n.value) lignes.push("  · " + (n.placeholder || "note") + " : " + n.value); });
      });
      const libre = conteneur.querySelector('[data-cle="n_libre"]');
      if (libre && libre.value) lignes.push("\nNotes : " + libre.value);
      return lignes.join("\n");
    }
    conteneur.querySelector('[data-action="copier"]').addEventListener("click", function () {
      const t = compteRendu(), b = this;
      const ok = () => { b.textContent = "Copié"; setTimeout(() => (b.textContent = "Copier le compte rendu"), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => prompt("Copie manuelle :", t)); else prompt("Copie manuelle :", t);
    });
    conteneur.querySelector('[data-action="imprimer"]').addEventListener("click", () => window.print());
    conteneur.querySelector('[data-action="vider"]').addEventListener("click", () => {
      if (!confirm("Tout effacer ?")) return;
      effacer(); rendre(script, conteneur, cle);
    });
    return { compteRendu };
  }

  /* démarrage automatique d'une page de Output/ : <body data-script="slug"> */
  document.addEventListener("DOMContentLoaded", () => {
    const slug = document.body.dataset.script;
    if (slug && window.SCRIPTS && window.SCRIPTS[slug]) {
      document.title = window.SCRIPTS[slug].titre || slug;
      rendre(window.SCRIPTS[slug], document.body, slug);
    }
  });

  return { rendre, echapper, enLigne };
})();
