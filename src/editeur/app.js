/* app.js : l'éditeur, en Vue 3 (build global, fichier local, sans compilation).
   Deux modes, détectés au démarrage :
   - serveur local (src/serveur.py) : lecture/écriture directe dans src/scripts/,
     recompilation, signe de vie toutes les 5 s pour que le serveur s'éteigne
     quand la page est fermée ;
   - fichier ouvert en double-clic : scripts inclus dans la page, export .json. */
"use strict";
const { createApp, reactive, ref, computed, watch, onMounted, nextTick } = Vue;

const clone = (o) => JSON.parse(JSON.stringify(o));
const sousVide = () => ({ texte: "", replique: "", suite: "", note: "" });
const reponseVide = () => ({ texte: "", replique: "", suite: "", note: "", sous: [] });
const etapeVide = () => ({ titre: "Nouvelle étape", dire: "", aide: "", mode: "une", reponses: [], note: "" });
const scriptVide = () => ({ slug: "nouveau-script", titre: "Nouveau script", sous_titre: "", numero: "", intro: "",
  etapes: [{ ...etapeVide(), titre: "Qui décroche", dire: "« Bonjour, … »", reponses: [reponseVide()] }], apres: "" });
const slugifier = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

createApp({
  setup() {
    const serveur = ref(false);
    const manifeste = ref(clone(window.MANIFESTE || []));
    const script = reactive(scriptVide());
    const slugOuvert = ref("");
    const etat = ref("");
    const modifie = ref(false);
    const apercu = ref(null);
    let referenceEnregistree = "";
    let minuteurApercu = null;

    const existe = computed(() => manifeste.value.some((m) => m.slug === script.slug));

    /* ---------- API ---------- */
    async function api(methode, chemin, corps) {
      const r = await fetch(chemin, { method: methode, headers: corps ? { "Content-Type": "application/json" } : {}, body: corps ? JSON.stringify(corps) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erreur || d.message || r.statusText);
      return d;
    }
    async function detecter() {
      try { await api("POST", "/api/ping"); serveur.value = true; manifeste.value = await api("GET", "/api/scripts"); setInterval(() => api("POST", "/api/ping").catch(() => {}), 5000); }
      catch (e) { serveur.value = false; }
    }

    /* ---------- état du script ---------- */
    function remplacer(nouveau) {
      Object.keys(script).forEach((k) => delete script[k]);
      Object.assign(script, { ...scriptVide(), ...clone(nouveau) });
      (script.etapes || []).forEach((et) => { et.reponses = et.reponses || []; et.reponses.forEach((r) => (r.sous = r.sous || [])); });
      referenceEnregistree = JSON.stringify(script); modifie.value = false;
      slugOuvert.value = existe.value ? script.slug : "";
    }
    async function ouvrir(slug) {
      if (!slug) return;
      if (modifie.value && !confirm("Modifications non enregistrées : les abandonner ?")) { slugOuvert.value = script.slug; return; }
      try { remplacer(serveur.value ? await api("GET", "/api/scripts/" + slug) : (window.SCRIPTS || {})[slug]); etat.value = "Ouvert : " + slug; }
      catch (e) { etat.value = "Erreur : " + e.message; }
    }
    function nouveau() { if (modifie.value && !confirm("Modifications non enregistrées : les abandonner ?")) return; remplacer(scriptVide()); modifie.value = true; etat.value = "Nouveau script : choisir un identifiant puis enregistrer."; }
    async function enregistrer() {
      script.slug = slugifier(script.slug); if (!script.slug) { etat.value = "Identifiant vide."; return; }
      try {
        const d = await api("PUT", "/api/scripts/" + script.slug, script);
        manifeste.value = await api("GET", "/api/scripts"); referenceEnregistree = JSON.stringify(script); modifie.value = false; slugOuvert.value = script.slug;
        etat.value = "Enregistré et compilé · " + new Date().toLocaleTimeString("fr-FR") + (d.message ? " · " + d.message : "");
      } catch (e) { etat.value = "Erreur : " + e.message; }
    }
    async function supprimer() {
      if (!confirm("Supprimer définitivement « " + script.slug + ".json » et sa page ?")) return;
      try { await api("DELETE", "/api/scripts/" + script.slug); manifeste.value = await api("GET", "/api/scripts"); remplacer(scriptVide()); modifie.value = true; etat.value = "Supprimé."; }
      catch (e) { etat.value = "Erreur : " + e.message; }
    }
    function exporter() {
      const blob = new Blob([JSON.stringify(script, null, 2) + "\n"], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = script.slug + ".json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      etat.value = "Exporté : déposer " + script.slug + ".json dans src/scripts/ puis lancer src/compiler.py (ou le lanceur).";
    }
    function importer(e) {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => { try { const d = JSON.parse(t); if (!d.slug) d.slug = slugifier(f.name.replace(/\.json$/, "")); remplacer(d); modifie.value = true; etat.value = "Importé, pas encore enregistré."; } catch (err) { alert("JSON invalide : " + err.message); } });
      e.target.value = "";
    }
    function deplacer(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    function retirer(arr, i, quoi) { if (confirm("Supprimer " + quoi + " ?")) arr.splice(i, 1); }

    /* ---------- aperçu : la vraie page, rendue par rendu.js ---------- */
    function rafraichir() { if (apercu.value) window.PromptAnxiety.rendre(clone(script), apercu.value, "apercu:" + script.slug); }
    watch(script, () => {
      modifie.value = JSON.stringify(script) !== referenceEnregistree;
      clearTimeout(minuteurApercu); minuteurApercu = setTimeout(rafraichir, 200);
    }, { deep: true });
    window.addEventListener("beforeunload", (e) => { if (modifie.value) { e.preventDefault(); e.returnValue = ""; } });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (serveur.value) enregistrer(); else exporter(); } });

    onMounted(async () => {
      // premier affichage immédiat avec les scripts inclus dans la page
      const inclus = manifeste.value[0] && (window.SCRIPTS || {})[manifeste.value[0].slug];
      if (inclus) remplacer(inclus); else { remplacer(scriptVide()); modifie.value = true; }
      await nextTick(); rafraichir();
      // puis, si le serveur répond, la version à jour depuis src/scripts/
      await detecter();
      if (serveur.value) {
        const slug = existe.value ? script.slug : (manifeste.value[0] || {}).slug;
        if (slug) { try { remplacer(await api("GET", "/api/scripts/" + slug)); await nextTick(); rafraichir(); } catch (e) {} }
      }
      etat.value = serveur.value ? "Serveur local : enregistrement direct dans src/scripts/ (Ctrl+S)." : "Mode fichier : export .json (Ctrl+S).";
    });

    return { serveur, manifeste, script, slugOuvert, etat, modifie, existe, apercu, ouvrir, nouveau, enregistrer, supprimer, exporter, importer, deplacer, retirer, slugifier, sousVide, reponseVide, etapeVide };
  }
}).mount("#app");
