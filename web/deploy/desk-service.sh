#!/usr/bin/env bash
# Install (or reinstall) the application desk as a per-user launchd service on
# macOS, bound to loopback only. Idempotent; re-run to change options.
#
#   web/deploy/desk-service.sh                      # loopback only, port 3210
#   web/deploy/desk-service.sh --allow mac.tail.ts.net   # also answer on this Host (Tailscale Serve)
#   web/deploy/desk-service.sh --port 3000
#   web/deploy/desk-service.sh --uninstall
#
# The app itself never binds a non-loopback address. Remote access is meant to
# come from an identity-bound proxy on the same machine (Tailscale Serve) that
# forwards to 127.0.0.1:PORT; --allow tells the origin guard to accept that Host.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; WEB="$(cd "$HERE/.." && pwd)"; ROOT="$(cd "$WEB/.." && pwd)"
LABEL=io.career-ops.desk; PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"; LOG="$HOME/Library/Logs/career-ops-desk.log"
PORT=3210; ALLOW=""; UNINSTALL=0
while [ $# -gt 0 ]; do case "$1" in
  --port) PORT="$2"; shift 2;; --allow) ALLOW="$2"; shift 2;; --uninstall) UNINSTALL=1; shift;;
  *) echo "unknown option: $1" >&2; exit 2;; esac; done
UID_="$(id -u)"
launchctl bootout "gui/$UID_/$LABEL" 2>/dev/null || true
if [ "$UNINSTALL" = 1 ]; then rm -f "$PLIST"; echo "removed $LABEL"; exit 0; fi
[ -d "$WEB/.next" ] || { echo "no production build: run 'npm run build' in $WEB first" >&2; exit 1; }
NODE_DIR="$(dirname "$(command -v node)")"; CLAUDE_DIR="$(dirname "$(command -v claude 2>/dev/null || echo "$NODE_DIR/claude")")"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_DIR/node</string><string>$WEB/node_modules/.bin/next</string><string>start</string>
    <string>--hostname</string><string>127.0.0.1</string><string>--port</string><string>$PORT</string>
  </array>
  <key>WorkingDirectory</key><string>$WEB</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$NODE_DIR:$CLAUDE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME</string>
    <key>NODE_ENV</key><string>production</string>
    <key>CAREER_OPS_ROOT</key><string>$ROOT</string>
    <key>CAREER_OPS_WEB_ALLOWED_HOSTS</key><string>$ALLOW</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
launchctl bootstrap "gui/$UID_" "$PLIST"
for _ in $(seq 1 15); do sleep 1; if curl -fs -m 2 "http://127.0.0.1:$PORT/api/version" >/dev/null; then
  echo "desk is up: http://127.0.0.1:$PORT  (root: $ROOT; allowed hosts: ${ALLOW:-loopback only}; log: $LOG)"; exit 0; fi; done
echo "desk did not answer on port $PORT; see $LOG" >&2; exit 1
