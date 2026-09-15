---
name: telegram-notify
description: Push a notification to the user's phone through their Telegram bot. Use whenever they ask to be pinged, alerted, notified or messaged about something, and for any long-running, background or scheduled job whose result they will not sit and watch: builds, deploys, overnight runs, cron jobs, monitors. Also use when writing a script or cron job that needs to send an alert.
---

# Telegram notifications

The user has a Telegram bot for pushing messages to their phone. `dsh-phone` uses the same
bot to send the phone link. It was set up during SETUP.md; if the credentials file below is
missing, that step was skipped, so ask the user to do it rather than inventing a bot.

## Credentials

`~/.config/telegram.env` (mode 600) holds `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

```bash
set -a; . ~/.config/telegram.env; set +a
```

Never commit the token, echo it into logs, or put it on a command line. Pipe it via stdin or
env, and `chmod 600` any copy. If the token stops working, the user rotates it with @BotFather
and writes the new value into `~/.config/telegram.env`.

## Sending

Read the two values out of the env file and POST to `api.telegram.org/bot$TOKEN/sendMessage`.
Standard library only, no dependencies. Copy this pattern.

```python
#!/usr/bin/env python3
import json, os, sys, urllib.request

env = {}
for line in open(os.path.expanduser("~/.config/telegram.env")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

text = " ".join(sys.argv[1:]).strip() or sys.stdin.read().strip()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{env['TELEGRAM_BOT_TOKEN']}/sendMessage",
    data=json.dumps({"chat_id": env["TELEGRAM_CHAT_ID"], "text": text[:4000]}).encode(),
    headers={"Content-Type": "application/json"})
print("telegram:", urllib.request.urlopen(req, timeout=30).status)
```

If `TELEGRAM_CHAT_ID` is ever missing, the user sends `/start` to the bot once, then read the
id back from `https://api.telegram.org/bot$TOKEN/getUpdates`.

## Three gotchas

1. Pass message text via an env var, not inlined in a nested heredoc or quoted `ssh`
   command. Inner quotes get mangled and the send silently no-ops.
2. cron has a minimal `PATH`. Test any scheduled sender with
   `env -i PATH=/usr/bin:/bin HOME=$HOME bash script.sh` before trusting it.
3. Rehearse the alert branch before relying on it, and expect the rehearsal to send a
   real-looking message. Say it was a test immediately, on the same channel.
