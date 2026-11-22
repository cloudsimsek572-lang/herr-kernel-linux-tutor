#!/usr/bin/env bash
# =============================================================================
#  Herr Kernel – Linux-Befehle-Quiz fürs Terminal
#
#  Herr Kernel beschreibt eine Aufgabe, du tippst den passenden Befehl.
#  Deine Eingabe wird NIE ausgeführt, nur mit den Musterlösungen verglichen.
#
#  Aufruf:   ./quiz.sh [-n ANZAHL] [-k KATEGORIE] [-l] [-h]
#  Im Quiz:  ?    = Tipp (halbe Punkte)
#            skip = Frage überspringen (kostet ein Leben)
#            q    = Quiz beenden
# =============================================================================

set -u

# ---------- Farben (nur wenn Ausgabe ein Terminal ist) -----------------------
if [[ -t 1 ]]; then
    GRN=$'\e[32m'; RED=$'\e[31m'; YLW=$'\e[33m'; CYN=$'\e[36m'
    DIM=$'\e[2m';  BLD=$'\e[1m';  RST=$'\e[0m'
else
    GRN=''; RED=''; YLW=''; CYN=''; DIM=''; BLD=''; RST=''
fi

HIGHSCORE_FILE="${HERR_KERNEL_HIGHSCORE:-$HOME/.herr_kernel_highscore}"
MAX_LIVES=3

# ---------- Fragenkatalog ----------------------------------------------------
# Format: KATEGORIE#FRAGE#ANTWORT1;ANTWORT2;...#ERKLÄRUNG
# Antworten werden ohne doppelte Leerzeichen verglichen.
QUESTIONS=(
"navigation#In welchem Verzeichnis befindest du dich gerade? Gib es aus.#pwd#pwd = print working directory."
"navigation#Wechsle in dein Home-Verzeichnis (kürzeste Form).#cd;cd ~;cd \$HOME#cd ohne Argument springt nach Hause."
"navigation#Wechsle ein Verzeichnis nach oben.#cd ..#'..' ist immer das übergeordnete Verzeichnis."
"navigation#Wechsle zurück in das Verzeichnis, in dem du vorher warst.#cd -#'cd -' springt zum vorherigen Verzeichnis (\$OLDPWD)."
"navigation#Liste alle Dateien inkl. versteckter in Langform auf.#ls -la;ls -al;ls -l -a;ls -a -l#-l = Langform, -a = auch versteckte (Punkt-)Dateien."
"navigation#Liste Dateien mit menschenlesbaren Größen (z. B. 4.0K) in Langform.#ls -lh;ls -hl;ls -l -h#-h = human readable, funktioniert zusammen mit -l."
"dateien#Lege eine leere Datei namens notiz.txt an.#touch notiz.txt#touch erzeugt leere Dateien oder aktualisiert den Zeitstempel."
"dateien#Erstelle das Verzeichnis projekt/src inklusive aller Elternverzeichnisse.#mkdir -p projekt/src#-p legt fehlende Elternverzeichnisse mit an."
"dateien#Kopiere den Ordner bilder rekursiv nach backup.#cp -r bilder backup;cp -R bilder backup;cp -a bilder backup#-r/-R kopiert rekursiv, -a erhält zusätzlich Rechte und Zeitstempel."
"dateien#Benenne alt.txt in neu.txt um.#mv alt.txt neu.txt#Umbenennen ist unter Linux einfach Verschieben."
"dateien#Lösche das Verzeichnis tmp samt Inhalt.#rm -r tmp;rm -rf tmp;rm -R tmp;rm -fr tmp#-r löscht rekursiv. Vorsicht mit -f: keine Rückfrage!"
"dateien#Lösche das LEERE Verzeichnis leer.#rmdir leer#rmdir entfernt nur leere Verzeichnisse – sicher."
"dateien#Erstelle einen symbolischen Link namens link, der auf ziel zeigt.#ln -s ziel link#ln -s ZIEL LINKNAME – erst das Ziel, dann der Link."
"lesen#Zeige den Inhalt von datei.txt komplett an.#cat datei.txt#cat gibt Dateien aus (concatenate)."
"lesen#Zeige die ersten 5 Zeilen von log.txt.#head -n 5 log.txt;head -5 log.txt;head -n5 log.txt#head zeigt standardmäßig 10 Zeilen, -n ändert das."
"lesen#Zeige die letzten 20 Zeilen von log.txt.#tail -n 20 log.txt;tail -20 log.txt;tail -n20 log.txt#tail zeigt das Ende einer Datei."
"lesen#Verfolge syslog live, während neue Zeilen dazukommen.#tail -f syslog;tail -F syslog#-f = follow. Beenden mit Strg+C."
"lesen#Öffne lange.txt seitenweise zum Blättern.#less lange.txt;more lange.txt#less kann vor- und zurückblättern, 'q' beendet."
"lesen#Zähle die Zeilen in daten.csv.#wc -l daten.csv;wc -l < daten.csv#wc = word count, -l zählt Zeilen."
"suchen#Suche in config.txt nach Zeilen mit 'error', Groß-/Kleinschreibung egal.#grep -i error config.txt;grep -i 'error' config.txt;grep -i \"error\" config.txt#-i = ignore case."
"suchen#Suche rekursiv im aktuellen Verzeichnis nach 'TODO'.#grep -r TODO .;grep -R TODO .;grep -r 'TODO' .;grep -r \"TODO\" .;grep -rn TODO .#-r durchsucht Verzeichnisse rekursiv."
"suchen#Finde alle .log-Dateien unterhalb von /var.#find /var -name '*.log';find /var -name \"*.log\";find /var -name \\*.log;find /var -type f -name '*.log'#Das Muster quoten, sonst expandiert die Shell den Stern vorher."
"suchen#Finde heraus, wo das Programm python3 liegt.#which python3;command -v python3;type python3;whereis python3#which zeigt den Pfad aus \$PATH."
"suchen#Zeige Zeilen von daten.txt, die NICHT 'foo' enthalten.#grep -v foo daten.txt;grep -v 'foo' daten.txt;grep -v \"foo\" daten.txt#-v invertiert die Suche."
"rechte#Mache script.sh für den Besitzer ausführbar.#chmod u+x script.sh;chmod +x script.sh#u+x = user execute. +x allein gilt für alle."
"rechte#Setze die Rechte von geheim.txt auf rw-------.#chmod 600 geheim.txt;chmod u=rw,go= geheim.txt#6 = rw (4+2), 0 = nichts – nur der Besitzer darf lesen/schreiben."
"rechte#Setze die Rechte von web.sh auf rwxr-xr-x.#chmod 755 web.sh#7 = rwx, 5 = r-x. Klassiker für Skripte und Verzeichnisse."
"rechte#Ändere den Besitzer von datei.txt auf den Benutzer anna.#chown anna datei.txt;sudo chown anna datei.txt#chown = change owner, meist mit sudo nötig."
"rechte#Zeige an, als welcher Benutzer du angemeldet bist.#whoami;id -un;id -u -n#whoami gibt den aktuellen Benutzernamen aus."
"prozesse#Zeige alle laufenden Prozesse aller Benutzer (BSD-Stil).#ps aux;ps -aux#a = alle Benutzer, u = benutzerfreundlich, x = auch ohne Terminal."
"prozesse#Zeige eine live aktualisierte Prozessübersicht.#top;htop#top ist überall installiert, htop ist die bunte Variante."
"prozesse#Beende den Prozess mit der PID 1234 freundlich (SIGTERM).#kill 1234;kill -15 1234;kill -TERM 1234;kill -SIGTERM 1234#kill sendet standardmäßig SIGTERM (15)."
"prozesse#Beende den Prozess 1234 gewaltsam.#kill -9 1234;kill -KILL 1234;kill -SIGKILL 1234#SIGKILL (9) kann nicht abgefangen werden – letzte Wahl."
"prozesse#Beende alle Prozesse mit dem Namen firefox.#pkill firefox;killall firefox#pkill/killall arbeiten mit Namen statt PIDs."
"prozesse#Starte ./backup.sh im Hintergrund.#./backup.sh &#Ein & am Ende schickt den Befehl in den Hintergrund."
"system#Zeige den freien Speicherplatz aller Dateisysteme menschenlesbar.#df -h#df = disk free."
"system#Zeige, wie viel Platz das Verzeichnis downloads insgesamt belegt.#du -sh downloads;du -hs downloads;du -s -h downloads#du = disk usage, -s = nur Summe."
"system#Zeige den Arbeitsspeicher menschenlesbar an.#free -h#free zeigt RAM und Swap."
"system#Zeige die Kernel-Version an.#uname -r#-r = kernel release, -a zeigt alles."
"system#Zeige, wie lange das System schon läuft.#uptime#uptime zeigt Laufzeit und Load Average."
"system#Zeige die letzten Kernel-Meldungen.#dmesg;sudo dmesg;journalctl -k;dmesg | tail#dmesg liest den Kernel-Ringpuffer."
"netz#Zeige die IP-Adressen deiner Netzwerkschnittstellen (modern).#ip a;ip addr;ip address;ip addr show;ip a s#ip ersetzt das alte ifconfig."
"netz#Schicke genau 4 Pings an example.com.#ping -c 4 example.com;ping -c4 example.com#-c = count. Ohne -c pingt Linux endlos."
"netz#Zeige alle lauschenden TCP-Ports mit Prozess, numerisch.#ss -tlnp;ss -tulpn;ss -ltnp;ss -lntp;netstat -tlnp;sudo ss -tlnp#t = TCP, l = listening, n = numerisch, p = Prozess."
"netz#Lade https://example.com/datei.zip mit wget herunter.#wget https://example.com/datei.zip#wget speichert die Datei im aktuellen Verzeichnis."
"netz#Verbinde dich per SSH als bob mit server.de.#ssh bob@server.de;ssh -l bob server.de#ssh BENUTZER@HOST."
"pipes#Leite die Ausgabe von ls in die Datei liste.txt um (überschreiben).#ls > liste.txt#> überschreibt, >> hängt an."
"pipes#Hänge 'hallo' an das Ende von log.txt an.#echo hallo >> log.txt;echo 'hallo' >> log.txt;echo \"hallo\" >> log.txt#>> hängt an, ohne zu überschreiben."
"pipes#Sortiere namen.txt und entferne doppelte Zeilen (ein Befehl).#sort -u namen.txt#sort -u = sort | uniq in einem."
"pipes#Zähle, wie viele Prozesse laufen: ps aux in wc -l pipen.#ps aux | wc -l#Die Pipe | gibt die Ausgabe an den nächsten Befehl weiter."
"pipes#Leite Fehlermeldungen von ./run.sh nach /dev/null um.#./run.sh 2> /dev/null;./run.sh 2>/dev/null#2> leitet stderr (Kanal 2) um."
"archive#Packe den Ordner docs in das gzip-Archiv docs.tar.gz.#tar -czf docs.tar.gz docs;tar czf docs.tar.gz docs;tar -czvf docs.tar.gz docs;tar -cvzf docs.tar.gz docs;tar czvf docs.tar.gz docs#c = create, z = gzip, f = Dateiname (muss direkt davor stehen)."
"archive#Entpacke docs.tar.gz ins aktuelle Verzeichnis.#tar -xzf docs.tar.gz;tar xzf docs.tar.gz;tar -xf docs.tar.gz;tar xf docs.tar.gz;tar -xzvf docs.tar.gz;tar xzvf docs.tar.gz;tar -xvzf docs.tar.gz#x = extract. Moderne tar erkennen die Kompression selbst."
"archive#Zeige den Inhalt von docs.tar.gz an, ohne zu entpacken.#tar -tzf docs.tar.gz;tar tzf docs.tar.gz;tar -tf docs.tar.gz;tar tf docs.tar.gz;tar -tvf docs.tar.gz#t = list (table of contents)."
"hilfe#Öffne die Handbuchseite zu grep.#man grep#man zeigt die Manpage, 'q' beendet."
"hilfe#Zeige die zuletzt eingegebenen Befehle an.#history#history listet deine Befehls-Historie, !NUMMER führt einen erneut aus."
"hilfe#Durchsuche die Manpage-Kurzbeschreibungen nach 'copy'.#apropos copy;man -k copy#apropos = man -k."
)

# ---------- Hilfsfunktionen --------------------------------------------------
usage() {
    cat <<EOF
${BLD}Herr Kernel – Linux-Befehle-Quiz${RST}

Aufruf: $(basename "$0") [Optionen]

  -n ANZAHL      Anzahl der Fragen (Standard: 10, 0 = alle)
  -k KATEGORIE   Nur Fragen einer Kategorie (siehe -l)
  -l             Kategorien auflisten
  -r             Highscore zurücksetzen
  -h             Diese Hilfe

Im Quiz:  ${CYN}?${RST} Tipp (halbe Punkte)  ${CYN}skip${RST} überspringen  ${CYN}q${RST} beenden
Du hast ${MAX_LIVES} Leben. Jede richtige Antwort gibt 10 Punkte, Serien geben Bonus.
EOF
}

list_categories() {
    local q cat
    declare -A count=()
    for q in "${QUESTIONS[@]}"; do
        cat="${q%%#*}"
        count[$cat]=$(( ${count[$cat]:-0} + 1 ))
    done
    echo "${BLD}Kategorien:${RST}"
    for cat in $(printf '%s\n' "${!count[@]}" | sort); do
        printf "  %-12s %2d Fragen\n" "$cat" "${count[$cat]}"
    done
}

# Leerzeichen am Rand weg, mehrfache Leerzeichen zu einem
normalize() {
    local s="$*"
    s="${s#"${s%%[![:space:]]*}"}"
    s="${s%"${s##*[![:space:]]}"}"
    tr -s '[:space:]' ' ' <<<"$s" | sed 's/ $//'
}

hearts() {
    local i out=""
    for (( i = 0; i < MAX_LIVES; i++ )); do
        if (( i < lives )); then out+="${RED}♥${RST}"; else out+="${DIM}♡${RST}"; fi
    done
    printf '%s' "$out"
}

load_highscore() {
    if [[ -r "$HIGHSCORE_FILE" ]]; then
        local v; v=$(head -n1 "$HIGHSCORE_FILE")
        [[ "$v" =~ ^[0-9]+$ ]] && { echo "$v"; return; }
    fi
    echo 0
}

# ---------- Optionen ---------------------------------------------------------
num_questions=10
category=""
while getopts ":n:k:lrh" opt; do
    case "$opt" in
        n) [[ "$OPTARG" =~ ^[0-9]+$ ]] || { echo "Fehler: -n braucht eine Zahl." >&2; exit 1; }
           num_questions="$OPTARG" ;;
        k) category="$OPTARG" ;;
        l) list_categories; exit 0 ;;
        r) rm -f "$HIGHSCORE_FILE"; echo "Highscore zurückgesetzt."; exit 0 ;;
        h) usage; exit 0 ;;
        :) echo "Fehler: -$OPTARG braucht ein Argument." >&2; exit 1 ;;
        *) echo "Unbekannte Option: -$OPTARG" >&2; usage; exit 1 ;;
    esac
done

# ---------- Fragen auswählen und mischen -------------------------------------
pool=()
for q in "${QUESTIONS[@]}"; do
    [[ -z "$category" || "${q%%#*}" == "$category" ]] && pool+=("$q")
done
if (( ${#pool[@]} == 0 )); then
    echo "Keine Fragen für Kategorie '$category'." >&2
    list_categories >&2
    exit 1
fi

mapfile -t pool < <(printf '%s\n' "${pool[@]}" | shuf)
(( num_questions == 0 || num_questions > ${#pool[@]} )) && num_questions=${#pool[@]}

# ---------- Quiz -------------------------------------------------------------
lives=$MAX_LIVES
score=0
streak=0
correct=0
asked=0
wrong_list=()
highscore=$(load_highscore)

trap 'echo; echo "${YLW}Abgebrochen.${RST}"; exit 130' INT

cat <<EOF
${GRN}
          .---.
         /     \\
        (  o o  )     ${BLD}Herr Kernel prüft dich!${RST}${GRN}
        |   V   |     ${num_questions} Fragen · ${MAX_LIVES} Leben · Highscore: ${highscore}
       / \\     / \\
      (   '._.'   )   Tippe den passenden Befehl ein.
       \\__/_\\__/      ${DIM}? = Tipp · skip = überspringen · q = beenden${RST}
EOF

for (( i = 0; i < num_questions; i++ )); do
    IFS='#' read -r q_cat q_text q_answers q_explain <<<"${pool[$i]}"
    IFS=';' read -r -a answers <<<"$q_answers"
    asked=$(( asked + 1 ))
    hint_used=0

    echo
    printf '%s[%d/%d]%s %s %s%s%s  Punkte: %s%d%s\n' \
        "$DIM" "$((i + 1))" "$num_questions" "$RST" "$(hearts)" \
        "$CYN" "$q_cat" "$RST" "$BLD" "$score" "$RST"
    echo "${BLD}${q_text}${RST}"

    while true; do
        if ! read -r -e -p "${GRN}\$ ${RST}" input; then
            echo; input="q"   # EOF (Strg+D) = beenden
        fi
        input=$(normalize "$input")

        case "$input" in
            "") continue ;;
            q|quit|exit)
                echo "${YLW}Herr Kernel: Schon Feierabend? Na gut.${RST}"
                asked=$(( asked - 1 ))
                break 2 ;;
            "?"|hint|tipp)
                if (( hint_used )); then
                    echo "${YLW}Mehr Tipps gibt's nicht. Der Befehl fängt mit '${answers[0]%% *}' an.${RST}"
                else
                    hint_used=1
                    first="${answers[0]}"
                    cmd="${first%% *}"
                    # Tipp: Befehlsname + Länge der Lösung als Platzhalter
                    rest="${first#"$cmd"}"
                    echo "${YLW}Tipp: ${cmd}$(sed 's/[^ ]/_/g' <<<"$rest")${RST}"
                fi
                continue ;;
            skip)
                lives=$(( lives - 1 )); streak=0
                wrong_list+=("${q_text} → ${answers[0]}")
                echo "${RED}Übersprungen.${RST} Lösung: ${BLD}${answers[0]}${RST}"
                echo "${DIM}${q_explain}${RST}"
                break ;;
        esac

        ok=0
        for a in "${answers[@]}"; do
            [[ "$input" == "$(normalize "$a")" ]] && { ok=1; break; }
        done

        if (( ok )); then
            streak=$(( streak + 1 ))
            correct=$(( correct + 1 ))
            points=10
            (( hint_used )) && points=5
            (( streak >= 3 )) && points=$(( points + 5 ))
            score=$(( score + points ))
            msg="Richtig! +${points}"
            (( streak >= 3 )) && msg+=" ${YLW}(Serie ×${streak}!)${GRN}"
            echo "${GRN}✔ ${msg}${RST}"
            (( ${#answers[@]} > 1 )) && echo "${DIM}Auch richtig: $(printf '%s, ' "${answers[@]}" | sed 's/, $//')${RST}"
            echo "${DIM}${q_explain}${RST}"
        else
            lives=$(( lives - 1 )); streak=0
            wrong_list+=("${q_text} → ${answers[0]}")
            echo "${RED}✘ Falsch.${RST} Richtig wäre: ${BLD}${answers[0]}${RST}"
            echo "${DIM}${q_explain}${RST}"
        fi
        break
    done

    if (( lives <= 0 )); then
        echo
        echo "${RED}${BLD}Keine Leben mehr! Herr Kernel schickt dich zurück in die Manpages.${RST}"
        break
    fi
done

# ---------- Auswertung -------------------------------------------------------
echo
echo "${BLD}════════════ Auswertung ════════════${RST}"
printf "  Richtig:  %d von %d\n" "$correct" "$asked"
printf "  Punkte:   %s%d%s\n" "$BLD" "$score" "$RST"
if (( asked > 0 )); then
    pct=$(( correct * 100 / asked ))
    if   (( pct == 100 )); then rank="Kernel-Hacker 🐧"
    elif (( pct >= 80 ));  then rank="Sysadmin"
    elif (( pct >= 50 ));  then rank="Power-User"
    else                        rank="Terminal-Tourist"
    fi
    printf "  Quote:    %d%%  →  %s\n" "$pct" "$rank"
fi

if (( score > highscore )); then
    echo "$score" > "$HIGHSCORE_FILE" 2>/dev/null \
        && echo "  ${YLW}${BLD}Neuer Highscore!${RST} (vorher: $highscore)"
else
    echo "  Highscore: $highscore"
fi

if (( ${#wrong_list[@]} > 0 )); then
    echo
    echo "${BLD}Nochmal anschauen:${RST}"
    for w in "${wrong_list[@]}"; do echo "  ${DIM}•${RST} $w"; done
fi
echo
