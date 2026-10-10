# PromptAnxiety

Des scripts d'appel téléphonique à embranchements, pour ne pas perdre ses moyens
au téléphone : à chaque étape la phrase à dire, puis des cases à cocher selon ce
que répond l'interlocuteur, et la réplique suivante apparaît. Les cases cochées
et les notes restent dans le navigateur ; un bouton copie le compte rendu.

## Lancer l'outil (double-clic)

Il n'existe pas de fichier unique que les trois systèmes lancent en
double-clic : le nom du système est dans le nom du fichier.

| Système | Fichier | Prérequis |
|---|---|---|
| Linux | `Lancer-Linux.sh` | Python 3 (déjà là) |
| macOS | `Lancer-macOS.command` (première fois : clic droit > Ouvrir) | Python 3 (déjà là) |
| Windows | `Lancer-Windows.bat` | Python 3 : python.org ou Microsoft Store, cocher « Add to PATH » |

Le lanceur démarre un petit serveur local (Python seul, aucune dépendance),
ouvre l'éditeur dans le navigateur sur `http://127.0.0.1:7331/editeur.html`,
et **s'arrête tout seul 30 secondes après la fermeture de la page** (la page lui
envoie un signe de vie toutes les 5 s ; rouvrir l'onglet dans les 30 s ne coupe
rien). Avec le serveur, « Enregistrer » (ou Ctrl+S) écrit directement
`src/scripts/<identifiant>.json` et recompile `Output/`.

`editeur.html` s'ouvre aussi en double-clic sans serveur : dans ce cas on
exporte le `.json` et on le dépose soi-même dans `src/scripts/`.

Les pages de script générées dans `Output/` sont de simples fichiers HTML :
elles marchent en double-clic, sans serveur.

## Arborescence

```
Lancer-Linux.sh, Lancer-macOS.command, Lancer-Windows.bat   les lanceurs
editeur.html        l'éditeur (Vue 3), généré depuis src/, COMMITÉ : c'est l'outil distribué
README.md
src/
  scripts/*.json    LES SOURCES : un script par fichier (le nom = l'identifiant)
  serveur.py        serveur local : statique + API scripts + extinction automatique
  page/rendu.js     rend un script en page à embranchements (runtime, sans Vue)
  editeur/          l'éditeur : gabarit html (templates Vue) + app.js
  vendor/vue.global.prod.js   Vue 3.5.13, en local (fonctionne hors ligne)
  style/            jetons clair/sombre, blocs, script.css, editeur.css
  compiler.py       génère Output/ et editeur.html
  installer-hooks.sh  active les hooks git versionnés (.githooks/)
Output/             ce que l'utilisateur génère avec l'outil, JAMAIS commité
.githooks/          pre-commit (recompile si src/ change), post-merge, post-checkout
```

## Après un clone

```bash
src/installer-hooks.sh     # une fois : active les hooks git versionnés
```

Puis le lanceur de son système. `Output/` se génère au premier enregistrement
(ou avec `python3 src/compiler.py`).

## Créer ou modifier un script

1. Lancer l'outil. À gauche le formulaire, à droite l'aperçu en direct (c'est
   la vraie page, cases et notes comprises).
2. « Ouvrir un script… », « Nouveau » ou « Importer un .json ».
3. « Enregistrer » (Ctrl+S) : le fichier est écrit dans `src/scripts/`, `Output/`
   et `editeur.html` sont recompilés. « Ouvrir la page » montre le résultat.
4. `git commit` : le hook recompile si `src/` a changé et ajoute `editeur.html`.

## API du serveur local (pour brancher autre chose)

`GET /api/scripts` · `GET /api/scripts/<slug>` · `PUT /api/scripts/<slug>` (corps JSON,
écrit puis compile) · `DELETE /api/scripts/<slug>` · `POST /api/compiler` ·
`POST /api/ping` (signe de vie). Variable `PA_SANS_NAVIGATEUR=1` pour ne pas
ouvrir le navigateur au démarrage.

## Format d'un script (`src/scripts/<identifiant>.json`)

```json
{
  "titre": "Appel …", "sous_titre": "a · b · c", "numero": "01 …", "intro": "consigne",
  "etapes": [
    { "titre": "Qui décroche",
      "dire": "« La phrase à dire, **gras** pour les mots clés »",
      "aide": "petit texte gris",
      "mode": "une",                      "// une = radio, plusieurs = cases",
      "reponses": [
        { "texte": "ce qu'il répond", "replique": "« ma réplique »",
          "suite": "quoi faire ensuite", "note": "invite d'un champ de note (vide = aucun)",
          "sous": [ { "texte": "sous-cas", "replique": "", "suite": "", "note": "" } ] }
      ],
      "note": "invite d'un champ de note en bas de l'étape" }
  ],
  "apres": "ce qu'il faut faire juste après l'appel"
}
```

Le premier script, `appel-orpi.json`, est un appel à une agence immobilière pour
une location en colocation (objections : colocation, revenus, étudiants).
