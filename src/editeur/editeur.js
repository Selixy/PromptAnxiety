/* editeur.js : formulaire d'édition d'un script (objet JSON) avec aperçu en
   direct rendu par rendu.js. Le brouillon est gardé en localStorage ; le
   résultat s'exporte en .json à déposer dans src/scripts/, puis on compile. */
"use strict";
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const form = $("#formulaire"), apercu = $("#apercu"), etat = $("#etat");
  const { echapper } = window.PromptAnxiety;

  const VIDE = () => ({ slug: "nouveau-script", titre: "Nouveau script", sous_titre: "", numero: "", intro: "",
    etapes: [{ titre: "Qui décroche", dire: "« Bonjour, … »", aide: "", mode: "une",
      reponses: [{ texte: "Réponse possible", replique: "", suite: "", note: "", sous: [] }] }], apres: "" });

  let script = VIDE();
  let minuteur = null;

  /* ---------- brouillons ---------- */
  const cleBrouillon = () => "pa:brouillon:" + script.slug;
  function sauver() { try { localStorage.setItem(cleBrouillon(), JSON.stringify(script)); } catch (e) {} }
  function charger(slug) {
    try { const v = localStorage.getItem("pa:brouillon:" + slug); if (v) return JSON.parse(v); } catch (e) {}
    return null;
  }

  /* ---------- formulaire ---------- */
  function champ(label, chemin, valeur, type) {
    const id = "f_" + chemin.replace(/[^\w]/g, "_");
    const ctrl = type === "zone" ? `<textarea id="${id}" data-chemin="${chemin}">${echapper(valeur)}</textarea>`
      : type === "mode" ? `<select id="${id}" data-chemin="${chemin}"><option value="une"${valeur !== "plusieurs" ? " selected" : ""}>Une seule réponse (radio)</option><option value="plusieurs"${valeur === "plusieurs" ? " selected" : ""}>Plusieurs réponses (cases)</option></select>`
      : `<input id="${id}" data-chemin="${chemin}" value="${echapper(valeur)}">`;
    return `<div class="champ"><label for="${id}">${label}</label>${ctrl}</div>`;
  }
  const bouton = (action, chemin, texte, cls) => `<button type="button" class="petit ${cls || ""}" data-action="${action}" data-chemin="${chemin}">${texte}</button>`;

  function dessiner() {
    let h = "<h2>Le script</h2>";
    h += champ("Identifiant (nom du fichier, sans espace)", "slug", script.slug);
    h += champ("Titre", "titre", script.titre);
    h += champ("Sous-titre (séparer par « · »)", "sous_titre", script.sous_titre);
    h += champ("Numéro à appeler", "numero", script.numero);
    h += champ("Consigne d'introduction", "intro", script.intro, "zone");
    h += "<h2>Les étapes</h2>";
    script.etapes.forEach((et, i) => {
      const p = `etapes.${i}`;
      h += `<div class="bloc-etape"><div class="entete"><h3>${i}. ${echapper(et.titre || "")}</h3>${bouton("monter", p, "↑")}${bouton("descendre", p, "↓")}${bouton("supprimer", p, "Supprimer", "danger")}</div>`;
      h += champ("Titre de l'étape", p + ".titre", et.titre);
      h += champ("La phrase à dire (**gras** pour les mots clés)", p + ".dire", et.dire, "zone");
      h += champ("Aide-mémoire (petit texte gris)", p + ".aide", et.aide);
      h += champ("Type de réponses", p + ".mode", et.mode, "mode");
      (et.reponses || []).forEach((r, j) => {
        const q = `${p}.reponses.${j}`;
        h += `<div class="bloc-reponse"><div class="entete"><span>Réponse ${j + 1}</span>${bouton("monter", q, "↑")}${bouton("descendre", q, "↓")}${bouton("supprimer", q, "×", "danger")}</div>`;
        h += champ("Ce qu'il répond", q + ".texte", r.texte);
        h += champ("Ma réplique", q + ".replique", r.replique, "zone");
        h += champ("Et ensuite (consigne)", q + ".suite", r.suite);
        h += champ("Champ de note (texte d'invite, vide = pas de champ)", q + ".note", r.note);
        (r.sous || []).forEach((s, k) => {
          const t = `${q}.sous.${k}`;
          h += `<div class="bloc-sous"><div class="entete"><span>Sous-cas ${k + 1}</span>${bouton("supprimer", t, "×", "danger")}</div>`;
          h += champ("Cas", t + ".texte", s.texte) + champ("Réplique", t + ".replique", s.replique, "zone") + champ("Ensuite", t + ".suite", s.suite) + champ("Champ de note", t + ".note", s.note);
          h += "</div>";
        });
        h += `<div class="ajout">${bouton("ajouter-sous", q, "+ sous-cas")}</div></div>`;
      });
      h += `<div class="ajout">${bouton("ajouter-reponse", p, "+ réponse")}</div>`;
      h += champ("Champ de note en bas de l'étape (invite, vide = aucun)", p + ".note", et.note);
      h += "</div>";
    });
    h += `<div class="ajout">${bouton("ajouter-etape", "", "+ étape")}</div>`;
    h += "<h2>Après l'appel</h2>" + champ("Ce qu'il faut faire juste après", "apres", script.apres, "zone");
    form.innerHTML = h;
  }

  /* ---------- modèle ---------- */
  function lireChemin(chemin) {
    const parts = chemin.split("."); let o = script;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    return [o, parts[parts.length - 1]];
  }
  function parent(chemin) { const parts = chemin.split("."); const idx = Number(parts.pop()); let o = script; parts.forEach((p) => (o = o[p])); return [o, idx]; }

  form.addEventListener("input", (e) => {
    const chemin = e.target.dataset.chemin; if (!chemin) return;
    const [o, k] = lireChemin(chemin); o[k] = e.target.value;
    if (chemin === "slug") script.slug = e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "script";
    if (chemin.endsWith(".titre") && chemin.startsWith("etapes.")) { const h3 = e.target.closest(".bloc-etape").querySelector("h3"); h3.textContent = chemin.split(".")[1] + ". " + e.target.value; }
    sauver(); clearTimeout(minuteur); minuteur = setTimeout(rafraichir, 250);
  });
  form.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-action]"); if (!b) return;
    const a = b.dataset.action, chemin = b.dataset.chemin;
    if (a === "ajouter-etape") script.etapes.push({ titre: "Nouvelle étape", dire: "", aide: "", mode: "une", reponses: [], note: "" });
    else if (a === "ajouter-reponse") { const [o, k] = lireChemin(chemin + ".reponses"); (o[k] = o[k] || []).push({ texte: "", replique: "", suite: "", note: "", sous: [] }); }
    else if (a === "ajouter-sous") { const [o, k] = lireChemin(chemin + ".sous"); (o[k] = o[k] || []).push({ texte: "", replique: "", suite: "", note: "" }); }
    else if (a === "supprimer") { const [arr, i] = parent(chemin); if (confirm("Supprimer ?")) arr.splice(i, 1); else return; }
    else if (a === "monter" || a === "descendre") { const [arr, i] = parent(chemin); const j = a === "monter" ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    sauver(); dessiner(); rafraichir();
  });

  function rafraichir() {
    window.PromptAnxiety.rendre(script, apercu, "apercu:" + script.slug);
    etat.textContent = "Brouillon sauvegardé dans le navigateur · " + new Date().toLocaleTimeString("fr-FR");
  }

  /* ---------- ouvrir / nouveau / importer / exporter ---------- */
  const sel = $("#ouvrir");
  (window.MANIFESTE || []).forEach((m) => { const o = document.createElement("option"); o.value = m.slug; o.textContent = m.titre; sel.appendChild(o); });
  sel.addEventListener("change", () => {
    const slug = sel.value; if (!slug) return;
    const brouillon = charger(slug);
    const source = window.SCRIPTS && window.SCRIPTS[slug];
    if (brouillon && source && JSON.stringify(brouillon) !== JSON.stringify(source) && !confirm("Un brouillon non exporté existe pour ce script. Le reprendre ? (Annuler = repartir du fichier compilé)")) script = JSON.parse(JSON.stringify(source));
    else script = brouillon || JSON.parse(JSON.stringify(source));
    dessiner(); rafraichir();
  });
  $("#nouveau").addEventListener("click", () => { script = VIDE(); sel.value = ""; dessiner(); rafraichir(); });
  $("#importer").addEventListener("click", () => $("#fichier").click());
  $("#fichier").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => { try { script = JSON.parse(t); if (!script.slug) script.slug = f.name.replace(/\.json$/, ""); dessiner(); rafraichir(); sauver(); } catch (err) { alert("JSON invalide : " + err.message); } });
    e.target.value = "";
  });
  $("#exporter").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(script, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = script.slug + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    etat.textContent = "Exporté : déposer " + script.slug + ".json dans src/scripts/ puis compiler (ou commiter).";
  });
  $("#copier-json").addEventListener("click", function () {
    const t = JSON.stringify(script, null, 2); const b = this;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { b.textContent = "Copié"; setTimeout(() => (b.textContent = "Copier le JSON"), 1500); });
  });

  /* ---------- démarrage : dernier brouillon ouvert, sinon premier script, sinon vide ---------- */
  const dernier = (() => { try { return localStorage.getItem("pa:dernier"); } catch (e) { return null; } })();
  if (dernier && (charger(dernier) || (window.SCRIPTS || {})[dernier])) { script = charger(dernier) || JSON.parse(JSON.stringify(window.SCRIPTS[dernier])); sel.value = dernier; }
  else if (window.MANIFESTE && window.MANIFESTE.length) { const s = window.MANIFESTE[0].slug; script = charger(s) || JSON.parse(JSON.stringify(window.SCRIPTS[s])); sel.value = s; }
  dessiner(); rafraichir();
  setInterval(() => { try { localStorage.setItem("pa:dernier", script.slug); } catch (e) {} }, 2000);
})();
