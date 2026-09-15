# SETUP.md: install this dsh setup

You are an AI coding agent installing this on your user's Linux machine. Work through the
steps in order. Each step says what to run and what success looks like. Three steps are marked
STOP: tell the user exactly what to do, then wait until they say it is done. Do not skip
ahead past a STOP.

Step 0 sets the shell variable `$STARTER` to the clone folder. Every block that uses it
starts with a line that defaults it to `~/dsh-starter` when unset, so a fresh shell per step
is fine. If the clone is somewhere else, set `STARTER` to that path before each block.

## 0. Clone

    git clone https://github.com/kevinchiha/dsh-starter.git ~/dsh-starter
    export STARTER=~/dsh-starter

If the user already cloned it elsewhere, set `STARTER` to that path instead.

## 1. Check the machine

Run: `uname -s; systemctl --user status >/dev/null && echo systemd-ok; cat /etc/os-release | head -2`
Expected: `Linux`, `systemd-ok`, and the distro name. Note the distro; package names below
are given for Debian/Ubuntu (apt) and Arch (pacman). Use the matching column.

If `systemd-ok` is missing, you are probably in a container or switched user with `su`; the
user session that runs services is absent. Log in as the user directly (console or ssh) and
run the check again. Do not go on without it; step 5 needs it.

## 2. System packages

Install, with the distro's package manager:

| Debian / Ubuntu | Arch | Why |
|---|---|---|
| `curl` | `curl` | downloads |
| `git` | `git` | clone |
| `openssl` | `openssl` | step 5 makes a random proxy key with it |
| `python3` | `python` | the two scripts |
| `python3-yaml` | `python-yaml` | `dsh-model` reads settings.yaml |
| `python3-venv` | included in `python` | `youtube-fetcher`'s own Python env |
| `ffmpeg` | `ffmpeg` | `watch` skill (frames from video) |
| `build-essential` | `base-devel` | three plugins compile C++ during `pnpm install` |
| `nodejs` | `nodejs-lts-krypton npm` | see step 3; Debian's own package is too old, Arch's default is too new |
| `socat` | `socat` | `dsh-phone` forwards the tailnet port |
| `qrencode` | `qrencode` | optional: `dsh-phone` prints a QR code in the terminal if present |
| `yt-dlp` | `yt-dlp` | `watch` and `youtube-fetcher` download videos; optional |

Run (Debian/Ubuntu):

    sudo apt-get install -y curl git openssl python3 python3-yaml python3-venv ffmpeg build-essential socat qrencode yt-dlp

Run (Arch):

    sudo pacman -S --needed curl git openssl python python-yaml ffmpeg base-devel socat qrencode yt-dlp

The apt line leaves out `nodejs` on purpose: step 3 installs it from nodesource, because
Debian's own package is too old. On Arch, `nodejs-lts-krypton npm` goes in step 3's pacman line.

## 3. Node and dsh

Run `node --version` first.

- Prints `v24.x`: skip the distro block, go to the install line.
- Prints nothing: run the distro block.
- Prints any other major version: stop and tell the user. dsh was tested on Node 24 only.
  Replacing a Node that another tool depends on is their call, not yours.

Run (Debian/Ubuntu):

    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash - && sudo apt-get install -y nodejs

If the nodesource script says the distro is unsupported, tell the user; the Linux tarball
from https://nodejs.org/en/download unpacked into `/usr/local` works too. This guide was
tested with the script on Debian 13.

Run (Arch):

    sudo pacman -S --needed nodejs-lts-krypton npm

`nodejs-lts-krypton` is Arch's name for Node 24; plain `nodejs` there is a newer major.

Then install pnpm and dsh. `pnpm` is the package manager dsh uses to install its plugins;
the version is pinned because the lock file in this repo was written with pnpm 11.7.0 and
step 7 installs with `--frozen-lockfile`. Whether the install needs `sudo` depends on where
Node lives: a distro package puts it under `/usr`, where only root can write, and a version
manager such as nvm or mise puts it under `/home`, where `sudo` breaks the install because
root's shell cannot find node. The first line below checks the path and picks for you.

Run:

    case "$(command -v node)" in /usr/*) SUDO=sudo;; *) SUDO=;; esac; echo "sudo: ${SUDO:-no}"
    $SUDO npm install -g pnpm@11.7.0 @deepseek-ai/dsh@0.1.5-rc.1
    dsh --version
    pnpm --version

Expected: `sudo: sudo` or `sudo: no` on the first line, then `0.1.5-rc.1` and `11.7.0`.

## 4. STOP: Tailscale

Tailscale is the private network that lets the user's phone reach this machine. Install it,
then start the login in the background so your shell does not hang waiting for it:

    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up > /tmp/tailscale-up.log 2>&1 &
    for i in $(seq 1 30); do URL=$(grep -o 'https://login\.tailscale\.com/[^[:space:]]*' /tmp/tailscale-up.log) && break; sleep 1; done; echo "$URL"

Expected: a login URL on the last line. If it is empty after 30 seconds, run
`tailscale ip -4`: an address means the machine was already logged in (`tailscale up` then
prints nothing and exits), so skip to the check below. No address means it failed; read
`/tmp/tailscale-up.log`, the error is there.

Tell the user to open that URL and sign in. Wait until they say it is done.

Then run: `tailscale ip -4`
Expected: an address like `100.x.y.z`. If it prints nothing, the login has not finished;
ask the user to check the browser tab.

## 5. CLIProxyAPI

CLIProxyAPI is a small program that logs into the user's Claude or ChatGPT account once and
then answers API requests locally, so dsh runs on the subscription instead of a metered key.

The second line below reads the machine's CPU type and picks the matching tarball, so there
is no URL to edit by hand. On anything other than a 64-bit Intel/AMD or ARM machine it prints
`unsupported:` followed by the CPU type; stop there and tell the user, because the download
on the next line would fail anyway.

Run:

    STARTER=${STARTER:-$HOME/dsh-starter}
    mkdir -p ~/cliproxyapi && cd ~/cliproxyapi
    ARCH=$(uname -m); case "$ARCH" in x86_64) A=amd64;; aarch64) A=aarch64;; *) echo "unsupported: $ARCH"; false;; esac
    curl -fsSL -o cpa.tar.gz "https://github.com/router-for-me/CLIProxyAPI/releases/download/v7.3.3/CLIProxyAPI_7.3.3_linux_$A.tar.gz"
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

    STARTER=${STARTER:-$HOME/dsh-starter}
    KEY=$($STARTER/bin/cliproxyapi-key)
    curl -s -H "Authorization: Bearer $KEY" http://127.0.0.1:8317/v1/models | head -c 400

The script is called by its full path because step 8 has not put it on `PATH` yet. The files
in `bin/` are already executable in the repo.

Expected: JSON that lists model ids; with a Claude login it contains ids starting `claude-`,
with a ChatGPT login ids starting `gpt-`. An empty `data` list means no login finished; ask
the user to run the login again.

If curl prints nothing at all, the proxy is not running; see "The proxy does not answer" at
the end of this guide.

## 7. dsh home folder

Run:

    STARTER=${STARTER:-$HOME/dsh-starter}
    mkdir -p ~/.dsh && cp -r $STARTER/dsh/. ~/.dsh/
    printf 'version: 1\nrefs:\n  CLIPROXYAPI_KEY: %s\n' "$($STARTER/bin/cliproxyapi-key)" > ~/.dsh/.credentials.yaml
    chmod 600 ~/.dsh/.credentials.yaml
    cd ~/.dsh/profiles/web && pnpm install --frozen-lockfile
    dsh --profile web --dump-config > /dev/null && echo composed-ok

Expected: `pnpm install` prints `Packages: +220` and compiles three native modules (node-pty,
cpu-features, ssh2), which takes a minute, then `composed-ok`. If it fails with
`not found: make` or `Unable to detect compiler type`, the compiler package from step 2 is
missing; install it and run the install again.

Two things in that folder are easy to break later, so know they are there. The web pack
(`@linxin666/dsh-web-all`) ships its own phone layout, hard-coded and with no switch, and
it blanks the page next to the phone layout plugin in `dsh/plugins/`. So the pack is
patched: `profiles/web/patches/` turns its phone breakpoint off, `pnpm-workspace.yaml`
names the patch, and the version is pinned to `0.3.22`. Bumping the pack version makes
`pnpm install` refuse until the patch is redone for the new version (`pnpm patch
@linxin666/dsh-web-all@<new>`, change `768px` to `0px` in the three spots in
`lib/client.js` where it appears, `pnpm patch-commit <path pnpm printed>`). If a later
pack version adds a switch for its phone layout, drop the patch and use the switch instead.

The credentials file holds the proxy key under the name `settings.yaml` refers to; never
commit it anywhere.

If the user has no ChatGPT subscription: in `~/.dsh/settings.yaml` delete the whole `openai:`
block under `llm-pi-ai` (from the line `    openai:` to the line before the next route or the
end of that section), and delete the four `- provider: openai` entries (two lines each) from
the `subagent-model-selection` list near the end of the file. Otherwise six GPT models sit in
the picker and fail. The comment above the block says the same.

## 8. Scripts

Run:

    STARTER=${STARTER:-$HOME/dsh-starter}
    mkdir -p ~/.local/bin && cp $STARTER/bin/* ~/.local/bin/ && chmod +x ~/.local/bin/{dsh-phone,dsh-model,cliproxyapi-key,yt-md}
    echo "$PATH" | tr : '\n' | grep -qx "$HOME/.local/bin" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile
    export PATH="$HOME/.local/bin:$PATH"
    dsh-model

Expected: a list of models grouped by route, then the line
`current default: claude-fable-5-1 on claude  (reasoning effort: xhigh)`.
If it says `No module named yaml`, install the PyYAML package from step 2. The `chmod +x` is
harmless; the files already arrive executable.

The `export PATH` line is for this shell; the `~/.profile` line is for the user's next login.
If the user's shell is zsh or fish, put the same line in its own rc file instead.

## 9. STOP: Telegram bot

`dsh-phone` sends the phone link through Telegram, and the `telegram-notify` skill pings the
phone about long jobs. The bot token is a secret, so the user writes it to the file
themselves; you never see it in a command or a reply. Tell the user:

1. In Telegram, open @BotFather, send `/newbot`, follow the prompts. It gives you a token
   that looks like `123456789:AAxxxxxxxx`.
2. Open the new bot's chat and send it `/start`.
3. Create the file `~/.config/telegram.env` with one line. Put the token from point 1 (the
   `123456789:AAxxxxxxxx`-shaped one) in place of `your-token-here`:

       TELEGRAM_BOT_TOKEN=your-token-here

   Any text editor works, or in a terminal (with your own token inside the quotes):
   `mkdir -p ~/.config && printf 'TELEGRAM_BOT_TOKEN=%s\n' 'your-token-here' > ~/.config/telegram.env`
4. Say "done".

Wait for "done". Then run the block below line by line. The second line looks up the chat
id (the number Telegram gives the conversation between the user and the bot). If it prints
`no messages yet: ...`, the user has not sent `/start`; ask them to, run that line again,
and do not go on until `CHAT` holds a number.

    chmod 600 ~/.config/telegram.env
    TOKEN=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' ~/.config/telegram.env)
    CHAT=$(curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | python3 -c 'import json,sys; r=json.load(sys.stdin).get("result",[]); sys.exit("no messages yet: ask the user to open the bot chat and send /start, then run this line again") if not r else print(r[-1]["message"]["chat"]["id"])')
    printf 'TELEGRAM_CHAT_ID=%s\n' "$CHAT" >> ~/.config/telegram.env
    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT" -d text="dsh setup: Telegram works"
    unset TOKEN CHAT

Append the chat id once. The file now has two lines and mode 600; `dsh-phone` and
`telegram-notify` read it from there. Never print the token or paste it into a chat.

Expected: the user sees "dsh setup: Telegram works" on their phone.

## 10. Skills

Run:

    STARTER=${STARTER:-$HOME/dsh-starter}
    mkdir -p ~/.agents && cp -r $STARTER/skills/. ~/.agents/skills/
    ls ~/.agents/skills | wc -l

Expected: `18`.

`youtube-fetcher` needs its own Python environment (optional; skip if the user will not feed
videos to the agent):

    python3 -m venv ~/.agents/skills/youtube-fetcher/.venv
    ~/.agents/skills/youtube-fetcher/.venv/bin/pip install -r ~/.agents/skills/youtube-fetcher/requirements.txt
    # watch scaffolds its own config on first use

## 11. First run

You cannot press keys in a browser, and you cannot press Ctrl-C in a server you started, so
start the server in the background, hand the URL to the user, and stop it by its process id.

Run:

    dsh web --no-open --port 3080 > /tmp/dsh-web.log 2>&1 &
    echo $! > /tmp/dsh-web.pid
    for i in $(seq 1 30); do URL=$(grep -o 'http://127.0.0.1:3080/?token=[^ ]*' /tmp/dsh-web.log) && break; sleep 1; done; echo "$URL"

If it prints an empty line after 30 seconds, read `/tmp/dsh-web.log`; the error is there.

Give the user that URL to open in a browser (the token is what lets the browser in). Wait for
them to say the page is up. On the very first load a dialog titled "Internal Testing Notice"
appears; tell them to click Continue.

Ask them to send "say hi". Expected: a greeting, with "Claude Fable 5.1" and "Xhigh" shown on
the model button at the bottom right of the composer. The first reply can take a minute at
Xhigh effort.

The model picker is a two-level menu. The button at the bottom right of the composer opens
two rows, "Model" and "Effort"; clicking "Model" shows the list. It has 21 entries: 4
built-in DeepSeek rows (they come with dsh and need a DeepSeek API key, so ignore them or
tell the user), 11 Claude, and 6 GPT (0 GPT if step 7 deleted the block). Walk the user
through opening it and reading the count back to you.

Then stop the server:

    kill "$(cat /tmp/dsh-web.pid)"

Expected: the URL line printed, the reply arrived, the kill returns silently.

Then the phone. Tell the user to install Tailscale on the phone and sign into the same
account. `dsh-phone` needs Tailscale connected (`tailscale ip -4` must print an address) and
`socat` installed; without either it exits with a one-line error.

Run:

    export PATH="$HOME/.local/bin:$PATH"
    dsh-phone

Expected: a Telegram message with a link. The link is a tailnet URL, so only the user's own
Tailscale devices can open it. The user opens it on the phone; the page shows the phone
layout. `dsh-phone --stop` shuts it down; `dsh-phone --status` shows how long is left. For a
quick test without Telegram, `dsh-phone --no-telegram` prints the link in the terminal
instead.

## 12. Checklist

Tick each one with the user:

- [ ] `dsh web` answers a prompt on the default model
- [ ] the Model list shows 11 Claude and 6 GPT entries (0 GPT if step 7 deleted the block; plus 4 DeepSeek rows that need their own key) and switching works
- [ ] `dsh-model claude-sonnet-5` changes the default; `dsh-model claude-fable-5-1` puts it back
- [ ] `dsh-phone` sends the link; on the phone the conversation fills the screen, a round hamburger sits top-left, and tapping it opens the sidebar as a drawer (the phone layout plugin)
- [ ] the sidebar shows the task board and plugin manager, and no ssh panel
- [ ] asking for `/grilling` on any idea starts the questioning
- [ ] a subagent runs (ask "use a subagent to count the files in $STARTER")
- [ ] `telegram-notify` sends a test message

## Things left out on purpose

The original setup also had a memory store, a self-hosted page fetcher, browser control,
and an API marketplace plugin (treg). They need services this guide does not set up, so
they are gone rather than half-working. Two more plugins, an agent-team orchestrator
(`@nanmicoder/dsh-agent-teams`) and a context-compression tool (`billion-context-dsh`),
were dropped from this snapshot on 2026-09-15 because together they add ~13K tokens of
tool definitions to every request and the built-in `subagent` and `workflow` tools cover
the same ground. `dsh plugin --profile web add <name>` brings either back. The four DeepSeek entries in the model
picker come with dsh itself; they work only with a DeepSeek API key, which this guide does
not set up. The ssh panel of the web pack is switched off in
`dsh/profiles/web/cordis.patch.yml`; it is a remote-terminal feature this setup does not
need, so its absence in the sidebar is correct. The pack's own phone layout is switched
off too, by the patch step 7 describes; the phone layout in use is the plugin in
`dsh/plugins/dsh-client-ui-mobile`.

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
