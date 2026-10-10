#!/usr/bin/env bash
# Linux : double-clic (ou ./Lancer-Linux.sh). Lance le serveur local et le navigateur.
cd "$(dirname "$(readlink -f "$0")")"
exec python3 src/serveur.py
