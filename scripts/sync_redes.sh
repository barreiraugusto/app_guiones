#!/bin/bash
# Copiado desde el Storage - sube al storage el ultimo archivo grabado.
# Se dispara desde el PHP al detener la grabacion.

set -u

ORIGEN="/media/video"
PATRON="*_9r.mp4"
DESTINO_HOST="root@192.168.2.50"
DESTINO_BASE="/media/storage/noticias"
# Sin BatchMode, si falta la clave SSH el script queda esperando el prompt de
# password: lanzado desde PHP no hay terminal y el proceso cuelga en silencio.
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"

td=$(date +%Y/%m/%d)
destino="$DESTINO_BASE/$td/REDES/"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

ultimo_archivo=$(ls -1t $ORIGEN/$PATRON 2>/dev/null | head -n 1)

if [ -z "$ultimo_archivo" ]; then
    log "ERROR: no hay archivos $PATRON en $ORIGEN"
    exit 1
fi

# ffmpeg puede seguir cerrando el archivo: esperar a que deje de crecer (max 30s)
for i in $(seq 1 30); do
    t1=$(stat -c %s "$ultimo_archivo")
    sleep 1
    t2=$(stat -c %s "$ultimo_archivo")
    [ "$t1" = "$t2" ] && break
done

log "Subiendo: $ultimo_archivo -> $DESTINO_HOST:$destino"

ssh $SSH_OPTS "$DESTINO_HOST" "mkdir -p '$destino'" || { log "ERROR: no se pudo crear $destino"; exit 1; }

if rsync -e "ssh $SSH_OPTS" -av --partial "$ultimo_archivo" "$DESTINO_HOST:$destino"; then
    log "OK: $(basename "$ultimo_archivo")"
else
    log "ERROR: rsync fallo para $(basename "$ultimo_archivo")"
    exit 1
fi
