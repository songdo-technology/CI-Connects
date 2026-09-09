#!/bin/sh
# Is a redirect URI registered on the OAuth client?
#
# Google reports redirect_uri_mismatch in the error payload of its redirect,
# before any sign-in happens — so this asks the question without touching an
# account or entering a credential anywhere.
CID="898826571976-m0o3e6m03roftdtd2b7dsr5ak88unr9f.apps.googleusercontent.com"

for URI in "$@"; do
  LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" -G \
    "https://accounts.google.com/o/oauth2/v2/auth" \
    --data-urlencode "client_id=$CID" \
    --data-urlencode "redirect_uri=$URI" \
    --data-urlencode "response_type=code" \
    --data-urlencode "scope=openid")

  PAYLOAD=$(printf '%s' "$LOCATION" | sed -n 's/.*authError=\([^&]*\).*/\1/p')
  DECODED=$(printf '%s' "$PAYLOAD" | tr '_-' '/+' | base64 -d 2>/dev/null | tr -cd '[:print:]')

  case "$DECODED" in
    *redirect_uri_mismatch*) echo "NOT REGISTERED  $URI" ;;
    *)                       echo "registered      $URI" ;;
  esac
done
