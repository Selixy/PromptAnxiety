@echo off
rem Windows : double-clic. Python 3 requis (python.org ou Microsoft Store).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 src\serveur.py & goto fin)
where python >nul 2>nul && (python src\serveur.py & goto fin)
echo Python 3 est necessaire : https://www.python.org/downloads/  (cocher "Add python.exe to PATH")
pause
:fin
