#!/usr/bin/env bash
set -eu -o pipefail

archive_path="${1:?release archive path is required}"
commit_sha="${2:?commit identifier is required}"
target_path="/var/www/gxclosers-app"
source_env="/var/www/gigxomi-app/.env"

if [[ "$target_path" != "/var/www/gxclosers-app" ]]; then
  echo "Unexpected deployment target" >&2
  exit 1
fi

install -d -m 755 "$target_path"
existing_session_secret=""
if [[ -f "$target_path/.env" ]]; then
  existing_session_secret="$(grep '^GIGXOMI_SESSION_SECRET=' "$target_path/.env" | tail -n 1 | cut -d= -f2- || true)"
fi
tar -xzf "$archive_path" -C "$target_path"
cp "$source_env" "$target_path/.env"
chmod 600 "$target_path/.env"

cd "$target_path"
sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://closers.gigxomi.com|' .env
sed -i 's|^APP_BASE_URL=.*|APP_BASE_URL=https://closers.gigxomi.com|' .env
sed -i 's|^INSTAGRAM_PUBLIC_APP_URL=.*|INSTAGRAM_PUBLIC_APP_URL=https://closers.gigxomi.com|' .env
sed -i 's|^INSTAGRAM_OAUTH_REDIRECT_URI=.*|INSTAGRAM_OAUTH_REDIRECT_URI=https://closers.gigxomi.com/api/meta/instagram/oauth/callback|' .env

session_secret="${existing_session_secret:-$(openssl rand -hex 32)}"
if grep -q '^GIGXOMI_SESSION_SECRET=' .env; then
  sed -i "s|^GIGXOMI_SESSION_SECRET=.*|GIGXOMI_SESSION_SECRET=${session_secret}|" .env
else
  printf '\nGIGXOMI_SESSION_SECRET=%s\n' "$session_secret" >> .env
fi
unset existing_session_secret session_secret

printf '%s\n' "$commit_sha" > .deploy-commit

set -a
# shellcheck disable=SC1091
. ./.env
set +a

npm ci
npx prisma generate
npm run build
npm run db:verify
