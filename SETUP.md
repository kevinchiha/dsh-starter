# SETUP.md: install this dsh setup

You are an AI coding agent installing this on your user's Linux machine. Work through the
steps in order. Each step says what to run and what success looks like. Two steps are marked
STOP: tell the user exactly what to do, then wait until they say it is done. Do not skip
ahead past a STOP.

Step 0 sets the shell variable `$STARTER` to the clone folder. Every later step uses it. If
you run each command in a fresh shell, set `STARTER` again at the top of every step; the
variable does not survive between shells.

## 0. Clone

    git clone https://github.com/kevinchiha/dsh-starter.git ~/dsh-starter
    export STARTER=~/dsh-starter

If the user already cloned it elsewhere, set `STARTER` to that path instead.

## 1. Check the machine

Run: `uname -s; systemctl --user status >/dev/null && echo systemd-ok; cat /etc/os-release | head -2`
Expected: `Linux`, `systemd-ok`, and the distro name. Note the distro; package names below
are given for Debian/Ubuntu (apt) and Arch (pacman). Use the matching column.

## 2. System packages

Install, with the distro's package manager:

| Debian / Ubuntu | Arch | Why |
|---|---|---|
| `curl` | `curl` | downloads |
| `git` | `git` | clone |
| `python3` | `python` | the two scripts |
| `python3-yaml` | `python-yaml` | `dsh-model` reads settings.yaml |
| `python3-venv` | included in `python` | `youtube-fetcher`'s own Python env |
| `ffmpeg` | `ffmpeg` | `watch` skill (frames from video) |
| `build-essential` | `base-devel` | three plugins compile C++ during `pnpm install` |
| `nodejs` | `nodejs npm` | see step 3, not from Debian's repo |
| `socat` | `socat` | `dsh-phone` forwards the tailnet port |
| `qrencode` | `qrencode` | optional: `dsh-phone` prints a QR code in the terminal if present |
| `yt-dlp` | `yt-dlp` | `watch` and `youtube-fetcher` download videos; optional |

Run (Debian/Ubuntu):

    sudo apt-get install -y curl git python3 python3-yaml python3-venv ffmpeg build-essential socat qrencode yt-dlp

Run (Arch):

    sudo pacman -S --needed curl git python python-yaml ffmpeg base-devel socat qrencode yt-dlp

The apt line leaves out `nodejs` on purpose: step 3 installs it from nodesource, because
Debian's own package is too old. On Arch, `nodejs npm` goes in step 3's pacman line.

## 3. Node and dsh

If `node --version` prints 24.x, skip the first line.

Run:

    (Debian) curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash - && sudo apt-get install -y nodejs
    (Arch)   sudo pacman -S --needed nodejs npm
    corepack enable
    corepack prepare pnpm@11.7.0 --activate
    npm install -g @deepseek-ai/dsh@0.1.5-rc.1
    dsh --version
    pnpm --version

Expected: `dsh --version` prints `0.1.5-rc.1` and `pnpm --version` prints `11.7.0`.
`corepack enable` gives you `pnpm`, which dsh uses to install plugins. The version is pinned
because the lock file in this repo was written with pnpm 11.7.0 and step 7 installs with
`--frozen-lockfile`.

## 4. Tailscale

Run: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
`tailscale up` prints a login URL. Tell the user to open it and sign in.
Expected afterwards: `tailscale ip -4` prints an address like `100.x.y.z`.

## 5. CLIProxyAPI

CLIProxyAPI is a small program that logs into the user's Claude or ChatGPT account once and
then answers API requests locally, so dsh runs on the subscription instead of a metered key.

First check the machine's CPU type.

Run: `uname -m`
Expected: `x86_64` means the amd64 tarball below is right. `aarch64` means swap
`linux_amd64` for `linux_aarch64` in the download URL.

Run:

    mkdir -p ~/cliproxyapi && cd ~/cliproxyapi
    curl -fsSL -o cpa.tar.gz https://github.com/router-for-me/CLIProxyAPI/releases/download/v7.3.3/CLIProxyAPI_7.3.3_linux_amd64.tar.gz
    tar xzf cpa.tar.gz && rm cpa.tar.gz && ls
    cp $STARTER/cliproxyapi/config.yaml ~/cliproxyapi/config.yaml
    KEY=$(openssl rand -hex 24); sed -i "s/REPLACE_WITH_RANDOM_KEY/$KEY/" ~/cliproxyapi/config.yaml
    mkdir -p ~/.config/systemd/user && cp $STARTER/cliproxyapi/cliproxyapi.service ~/.config/systemd/user/
    loginctl enable-linger "$USER"
    systemctl --user daemon-reload && systemctl --user enable --now cliproxyapi
    systemctl --user is-active cliproxyapi

Expected: the binary `cli-proxy-api` in `~/cliproxyapi`, and `active`. `enable-linger` keeps
the service running when the user is not logged in, so the phone can reach it later.

## 6. STOP: log the proxy in

Tell the user: run `~/cliproxyapi/cli-proxy-api -claude-login` in a terminal (or
`-codex-login` for ChatGPT; both is fine, run them one after the other). It opens a browser;
finish the login there. Wait for the user to say it is done.

Then run:

    KEY=$($STARTER/bin/cliproxyapi-key)
    curl -s -H "Authorization: Bearer $KEY" http://127.0.0.1:8317/v1/models | head -c 400

The script is called by its full path because step 8 has not put it on `PATH` yet. The files
in `bin/` are already executable in the repo.

Expected: JSON that lists model ids; with a Claude login it contains ids starting `claude-`,
with a ChatGPT login ids starting `gpt-`. An empty `data` list means no login finished; ask
the user to run the login again.

## 7. dsh home folder

Run:

    mkdir -p ~/.dsh && cp -r $STARTER/dsh/. ~/.dsh/
    printf 'version: 1\nrefs:\n  CLIPROXYAPI_KEY: %s\n' "$($STARTER/bin/cliproxyapi-key)" > ~/.dsh/.credentials.yaml
    chmod 600 ~/.dsh/.credentials.yaml
    cd ~/.dsh/profiles/web && pnpm install --frozen-lockfile
    dsh --profile web --dump-config > /dev/null && echo composed-ok

Expected: `pnpm install` prints `Packages: +220` and compiles three native modules (node-pty,
cpu-features, ssh2), which takes a minute, then `composed-ok`. If it fails with
`not found: make` or `Unable to detect compiler type`, the compiler package from step 2 is
missing; install it and run the install again.

The credentials file holds the proxy key under the name `settings.yaml` refers to; never
commit it anywhere.

If the user has no ChatGPT subscription: in `~/.dsh/settings.yaml` delete the whole `openai:`
block under `llm-pi-ai` (from the line `    openai:` to the line before the next route or the
end of that section), and delete the four `- provider: openai` entries (two lines each) from
the `subagent-model-selection` list near the end of the file. Otherwise six GPT models sit in
the picker and fail. The comment above the block says the same.

## 8. Scripts

Run:

    mkdir -p ~/.local/bin && cp $STARTER/bin/* ~/.local/bin/ && chmod +x ~/.local/bin/{dsh-phone,dsh-model,cliproxyapi-key,yt-md}
    echo "$PATH" | tr : '\n' | grep -qx "$HOME/.local/bin" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile
    dsh-model

Expected: a list of models grouped by route, then `current default: claude-fable-5-1 on claude`.
If it says `No module named yaml`, install the PyYAML package from step 2. The `chmod +x` is
harmless; the files already arrive executable.

## 9. STOP: Telegram bot

`dsh-phone` sends the phone link through Telegram, and the `telegram-notify` skill pings the
phone about long jobs. Tell the user:

1. In Telegram, open @BotFather, send `/newbot`, follow the prompts. It gives you a token
   that looks like `123456789:AAxxxxxxxx`.
2. Open the new bot's chat and send it `/start`.
3. Paste the token here.

When you have the token, run (paste the token in place of TOKEN, nowhere else):

    TOKEN='TOKEN'
    CHAT=$(curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | python3 -c 'import json,sys; u=json.load(sys.stdin)["result"]; print(u[-1]["message"]["chat"]["id"])')
    printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_CHAT_ID=%s\n' "$TOKEN" "$CHAT" > ~/.config/telegram.env
    chmod 600 ~/.config/telegram.env
    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT" -d text="dsh setup: Telegram works"
    unset TOKEN

The token is now only in `~/.config/telegram.env` (mode 600). Never put it into a chat log
or a commit.

Expected: the user sees "dsh setup: Telegram works" on their phone. If `getUpdates` returns
an empty result, the user has not sent `/start` yet.

## 10. Skills

Run:

    mkdir -p ~/.agents && cp -r $STARTER/skills/. ~/.agents/skills/
    ls ~/.agents/skills | wc -l

Expected: `18`.

`youtube-fetcher` needs its own Python environment (optional; skip if the user will not feed
videos to the agent):

    python3 -m venv ~/.agents/skills/youtube-fetcher/.venv
    ~/.agents/skills/youtube-fetcher/.venv/bin/pip install -r ~/.agents/skills/youtube-fetcher/requirements.txt
    # watch scaffolds its own config on first use

## 11. First run

Run: `dsh web`
It prints a URL with a token and opens the browser. On the very first load a dialog titled
"Internal Testing Notice" appears; click Continue.

Send "say hi". Expected: a greeting, with "Claude Fable 5.1" and "Xhigh" shown on the model
button at the bottom right of the composer. The first reply can take a minute at Xhigh
effort.

The model picker is a two-level menu. The button at the bottom right of the composer opens
two rows, "Model" and "Effort"; click "Model" to see the list. It shows 21 entries: 4
built-in DeepSeek rows (they come with dsh and need a DeepSeek API key, so ignore them or
tell the user), 11 Claude, and 6 GPT (0 GPT if step 7 deleted the block). Stop the server
with Ctrl-C.

Then the phone. Tell the user to install Tailscale on the phone and sign into the same
account. `dsh-phone` needs Tailscale connected (`tailscale ip -4` must print an address) and
`socat` installed; without either it exits with a one-line error.

Run: `dsh-phone`
Expected: a Telegram message with a link. The link is a tailnet URL, so only the user's own
Tailscale devices can open it. The user opens it on the phone; the page shows the phone
layout. `dsh-phone --stop` shuts it down; `dsh-phone --status` shows how long is left. For a
quick test without Telegram, `dsh-phone --no-telegram` prints the link in the terminal
instead.

## 12. Checklist

Tick each one with the user:

- [ ] `dsh web` answers a prompt on the default model
- [ ] the Model list shows 11 Claude and 6 GPT entries (plus 4 DeepSeek rows that need their own key) and switching works
- [ ] `dsh-model claude-sonnet-5` changes the default; `dsh-model claude-fable-5-1` puts it back
- [ ] `dsh-phone` sends the link; it opens on the phone with the phone layout
- [ ] the sidebar shows the task board and plugin manager, and no ssh panel
- [ ] asking for `/grilling` on any idea starts the questioning
- [ ] a subagent runs (ask "use a subagent to count the files in $STARTER")
- [ ] `telegram-notify` sends a test message

## Things left out on purpose

The original setup also had a memory store, a self-hosted page fetcher, browser control,
and an API marketplace plugin (treg). They need services this guide does not set up. The
design notes in `docs/specs/` say what each was. The four DeepSeek entries in the model
picker come with dsh itself; they work only with a DeepSeek API key, which this guide does
not set up.

## If something breaks

**The proxy does not answer.** Check the service and its log:

    systemctl --user status cliproxyapi
    journalctl --user -u cliproxyapi -n 50

**`pnpm install` fails on a native build.** The message names `make` or a compiler. Install
the compiler package from step 2 (`build-essential` on Debian/Ubuntu, `base-devel` on Arch)
and run the install again.

**`dsh web` shows an error about a model.** The login in step 6 did not cover that provider.
Either delete that provider's block as step 7 describes, or run the matching login
(`-claude-login` or `-codex-login`) and restart the proxy.
