#!/bin/sh
# Planche de contrôle : sheet.sh sortie.png fichiers...
out=$1; shift
montage "$@" -background '#5a5a5a' -geometry +4+4 -tile 4x "$out"
