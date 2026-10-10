#!/bin/bash
# macOS : double-clic dans le Finder (première fois : clic droit > Ouvrir).
cd "$(dirname "$0")"
exec python3 src/serveur.py
