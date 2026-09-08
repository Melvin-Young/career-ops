# Private access to the application desk (#12)

The desk (`web/`) is a local-first app: its `/api` routes spawn the agent CLI and write the user layer, so it must never listen on a network address. Remote access comes from an identity-bound proxy on the same Mac that forwards to loopback. This runbook uses Tailscale Serve: free for personal use, no public exposure, and the phone joins the same tailnet so the Telegram in-app browser and Safari both reach it.

## 1. Run the desk as a service (loopback only)

```bash
cd web && npm run build
web/deploy/desk-service.sh            # launchd agent io.career-ops.desk on 127.0.0.1:3210
curl http://127.0.0.1:3210/api/version
```

The service reads `CAREER_OPS_ROOT` from the checkout the script lives in, restarts on crash and at login, and logs to `~/Library/Logs/career-ops-desk.log`. `--port N` changes the port, `--uninstall` removes it. Re-run after `npm run build` to pick up a new build.

## 2. Tailscale (one-time, needs your password and a browser login)

```bash
brew install --cask tailscale-app     # asks for sudo
open -a Tailscale                     # sign in; note the machine name shown as <name>.<tailnet>.ts.net
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3210
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve status
```

Serve terminates HTTPS on the tailnet and forwards to `127.0.0.1:3210`. The desk's origin guard still refuses that Host until you opt it in:

```bash
web/deploy/desk-service.sh --allow <name>.<tailnet>.ts.net
```

Install Tailscale on the phone, sign in with the same identity, and open `https://<name>.<tailnet>.ts.net/`. Nothing else on the internet can reach the desk; the tailnet ACL default (your own devices only) is the access control, and both pages and `/api` sit behind it because Serve fronts the whole port.

## 3. Device check (human, not emulation)

- [ ] Open a saved role on iPhone Safari; Download an approved resume; it lands in Files with the role+version filename.
- [ ] Same from the Telegram in-app browser after Hermes sends a `/role/{id}` link.
- [ ] Upload that PDF into an employer form from the phone.
- [ ] Record "I applied" from the phone; the tracker row turns Applied once, the ledger has one line.

## 4. Hermes bridge (#13)

`integrations/hermes/career-ops-desk/SKILL.md` is a Hermes skill that drives the desk's save/state/applied operations over loopback. Link it into Hermes and reload:

```bash
ln -s "$PWD/integrations/hermes/career-ops-desk" ~/.hermes/skills/career-ops-desk
# in Telegram or the Hermes CLI:  /reload-skills
```

Set `DESK_PUBLIC_URL` in the skill to the Tailscale name once step 2 is done so replies carry phone-openable links.

## Rollback

```bash
web/deploy/desk-service.sh --uninstall
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve reset
rm ~/.hermes/skills/career-ops-desk
```

No secrets live in this repo: the Telegram token stays in `~/.hermes/.env`, Tailscale identity in the Tailscale app.
