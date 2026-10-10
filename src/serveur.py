#!/usr/bin/env python3
"""Serveur local de PromptAnxiety. Python 3 seul, aucune dépendance.

- sert le dépôt en statique (editeur.html, src/, Output/) sur 127.0.0.1 ;
- API : lire / écrire / supprimer les scripts de src/scripts/ et recompiler ;
- ouvre le navigateur sur l'éditeur au démarrage ;
- s'arrête tout seul quand la page ne lui a plus parlé depuis 30 secondes
  (la page envoie un signe de vie toutes les 5 s ; fermer l'onglet puis le
  rouvrir dans les 30 s ne coupe rien).
"""
import json, os, re, subprocess, sys, threading, time, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(RACINE, "src", "scripts")
COMPILER = os.path.join(RACINE, "src", "compiler.py")
DELAI_ARRET = 30          # secondes sans signe de vie avant extinction
GRACE_DEPART = 90         # le navigateur peut mettre du temps à s'ouvrir
PORT_PREFERE = 7331

dernier_signe = time.time() + GRACE_DEPART - DELAI_ARRET
SLUG = re.compile(r"^[a-z0-9-]{1,80}$")


def compiler():
    r = subprocess.run([sys.executable, COMPILER], capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RACINE, **k)

    def log_message(self, fmt, *args):   # silence, sauf erreurs
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    # ---------- utilitaires ----------
    def json(self, code, obj):
        corps = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corps)

    def corps(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else None

    def slug(self):
        m = re.match(r"^/api/scripts/([^/?]+)$", self.path)
        s = m.group(1) if m else None
        return s if s and SLUG.match(s) else None

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ---------- API ----------
    def do_GET(self):
        global dernier_signe
        if self.path == "/api/scripts":
            liste = []
            for f in sorted(os.listdir(SCRIPTS)):
                if f.endswith(".json"):
                    try:
                        with open(os.path.join(SCRIPTS, f), encoding="utf-8") as fh:
                            d = json.load(fh)
                        liste.append({"slug": f[:-5], "titre": d.get("titre", f[:-5]), "sous_titre": d.get("sous_titre", "")})
                    except (OSError, json.JSONDecodeError):
                        liste.append({"slug": f[:-5], "titre": f[:-5] + " (JSON invalide)", "sous_titre": ""})
            return self.json(200, liste)
        s = self.slug()
        if s:
            chemin = os.path.join(SCRIPTS, s + ".json")
            if not os.path.exists(chemin):
                return self.json(404, {"erreur": "script inconnu"})
            with open(chemin, encoding="utf-8") as fh:
                d = json.load(fh)
            d["slug"] = s
            return self.json(200, d)
        if self.path.startswith("/api/"):
            return self.json(404, {"erreur": "route inconnue"})
        return super().do_GET()

    def do_POST(self):
        global dernier_signe
        if self.path == "/api/ping":
            dernier_signe = time.time()
            return self.json(200, {"ok": True})
        if self.path == "/api/compiler":
            ok, msg = compiler()
            return self.json(200 if ok else 500, {"ok": ok, "message": msg})
        return self.json(404, {"erreur": "route inconnue"})

    def do_PUT(self):
        s = self.slug()
        if not s:
            return self.json(400, {"erreur": "identifiant invalide : minuscules, chiffres, tirets"})
        try:
            d = self.corps()
        except (ValueError, json.JSONDecodeError):
            return self.json(400, {"erreur": "JSON invalide"})
        if not isinstance(d, dict):
            return self.json(400, {"erreur": "le script doit être un objet"})
        d["slug"] = s
        os.makedirs(SCRIPTS, exist_ok=True)
        with open(os.path.join(SCRIPTS, s + ".json"), "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        ok, msg = compiler()
        return self.json(200 if ok else 500, {"ok": ok, "message": msg})

    def do_DELETE(self):
        s = self.slug()
        if not s:
            return self.json(400, {"erreur": "identifiant invalide"})
        chemin = os.path.join(SCRIPTS, s + ".json")
        if os.path.exists(chemin):
            os.remove(chemin)
        ok, msg = compiler()
        return self.json(200 if ok else 500, {"ok": ok, "message": msg})


def veilleur(serveur):
    while True:
        time.sleep(2)
        if time.time() - dernier_signe > DELAI_ARRET:
            print("Page fermée depuis 30 s : arrêt du serveur.")
            threading.Thread(target=serveur.shutdown, daemon=True).start()
            return


def main():
    os.chdir(RACINE)
    if not os.path.exists(os.path.join(RACINE, "editeur.html")):
        compiler()
    serveur = None
    for port in range(PORT_PREFERE, PORT_PREFERE + 20):
        try:
            serveur = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if serveur is None:
        sys.exit("Aucun port libre entre 7331 et 7350.")
    url = f"http://127.0.0.1:{port}/editeur.html"
    print(f"PromptAnxiety : {url}  (se coupe 30 s après la fermeture de la page)")
    threading.Thread(target=veilleur, args=(serveur,), daemon=True).start()
    if not os.environ.get("PA_SANS_NAVIGATEUR"):
        threading.Timer(0.4, webbrowser.open, args=(url,)).start()
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
    print("Arrêté.")


if __name__ == "__main__":
    main()
