#!/usr/bin/env python3
"""Compile le dépôt PromptAnxiety :
- src/scripts/<slug>.json  ->  Output/<slug>.html (page de script, rendu au runtime)
                            +  Output/scripts/<slug>.js (le JSON dans une variable,
                               seul moyen de charger un voisin en file://)
- Output/scripts/manifeste.js : la liste des scripts
- Output/index.html : le sommaire
- editeur.html (racine, commité) : l'éditeur, avec les scripts existants inclus en ligne.
Aucune dépendance. Lancé à la main ou par le hook git pre-commit."""
import json, pathlib, re, sys, shutil

R = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = R / "src" / "scripts", R / "Output"
e = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

scripts = []
for f in sorted(SRC.glob("*.json")):
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        sys.exit(f"{f.name} : JSON invalide ({err})")
    slug = f.stem
    if not re.fullmatch(r"[a-z0-9-]+", slug):
        sys.exit(f"{f.name} : le nom de fichier doit être en minuscules, chiffres et tirets")
    d["slug"] = slug
    scripts.append(d)

# Output régénéré de zéro : on n'y édite jamais rien
if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "scripts").mkdir(parents=True)

for d in scripts:
    (OUT / "scripts" / f"{d['slug']}.js").write_text(
        "window.SCRIPTS = window.SCRIPTS || {};\n"
        f"window.SCRIPTS[{json.dumps(d['slug'])}] = {json.dumps(d, ensure_ascii=False)};\n", encoding="utf-8")
    (OUT / f"{d['slug']}.html").write_text(f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{e(d.get('titre', d['slug']))}</title>
<link rel="stylesheet" href="../src/style/style.css">
<script defer src="scripts/{d['slug']}.js"></script>
<script defer src="../src/page/rendu.js"></script>
</head>
<body data-script="{d['slug']}"></body>
</html>
""", encoding="utf-8")

manifeste = [{"slug": d["slug"], "titre": d.get("titre", d["slug"])} for d in scripts]
(OUT / "scripts" / "manifeste.js").write_text("window.MANIFESTE = " + json.dumps(manifeste, ensure_ascii=False) + ";\n", encoding="utf-8")

liens = "".join(f'<a href="{d["slug"]}.html">{e(d.get("titre", d["slug"]))}<small>{e(d.get("sous_titre", ""))}</small></a>' for d in scripts) or "<p>Aucun script. Ouvrir <code>editeur.html</code> à la racine pour en créer un.</p>"
(OUT / "index.html").write_text(f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>PromptAnxiety · scripts</title>
<link rel="stylesheet" href="../src/style/style.css">
</head>
<body><main class="page"><h1>Scripts d'appel</h1><div class="liste-scripts">{liens}</div>
<p class="mini"><a href="../editeur.html">Éditeur</a></p></main></body>
</html>
""", encoding="utf-8")

# L'éditeur est distribué (commité) : les scripts existants y sont inclus en
# ligne, pour qu'il n'ait pas besoin de Output/ (que l'utilisateur génère lui-même).
inclus = "<script>window.MANIFESTE = " + json.dumps(manifeste, ensure_ascii=False) + ";\nwindow.SCRIPTS = " + \
         json.dumps({d["slug"]: d for d in scripts}, ensure_ascii=False) + ";</script>\n"
gabarit = (R / "src" / "editeur" / "editeur.html").read_text(encoding="utf-8")
(R / "editeur.html").write_text(gabarit.replace("<!--MANIFESTE-->\n", inclus), encoding="utf-8")

print(f"{len(scripts)} script(s) compilé(s) -> Output/ ; editeur.html régénéré")
