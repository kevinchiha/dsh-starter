# dsh-starter

A copy of one person's DeepSeek Harness (dsh) setup, with the personal parts removed, for a
friend to reproduce on their own Linux machine. dsh is a coding agent you talk to in a
browser; this setup adds a plugin set, a phone layout, a local proxy so it runs on your own
Claude or ChatGPT subscription, and a command that opens it on your phone over Tailscale.

**This is a snapshot** of the setup on 2026-09-15. It does not track later changes to the
original. Once installed, it is yours: change what you like.

## How to install

Give your AI coding agent this link and tell it to follow the guide:

    https://github.com/kevinchiha/dsh-starter/blob/main/SETUP.md

The agent does the install. It stops twice for you: once to log the proxy into your Claude
or ChatGPT account in a browser, once to create a Telegram bot. Plan on about an hour.

## What you need

- A Linux machine with systemd (any mainstream distro).
- A Claude Pro/Max or ChatGPT Plus/Pro subscription. The proxy logs into it; there is no
  per-token bill.
- Node 24. Step 3 of the guide installs it; Debian's own package is too old and Arch's
  default is too new.
- A C compiler and Node headers (`build-essential` on Debian/Ubuntu, `base-devel` on Arch):
  three plugins compile native code during install.
- A phone with Telegram and Tailscale installed, if you want the phone part.

## What is in here

| Folder | What it is |
|---|---|
| `dsh/` | dsh's home folder: model list, plugin profile, phone layout plugin |
| `cliproxyapi/` | config and service file for CLIProxyAPI, the local proxy |
| `bin/` | `dsh-phone`, `dsh-model`, two helpers |
| `skills/` | 18 skills the agent can invoke |
| `scripts/` | the checks the author ran before publishing: leak grep, local install test, clean-machine container test |
| `SETUP.md` | the guide |
| `docs/` | the design notes behind this repo |

## Licences

Everything written for this repo: MIT. Skills that came with their own licence keep it:
`refactoring-ui` (MIT, s13k), `watch` (MIT, bradautomates), `convert-documents-to-markdown`
(MIT, Firecrawl), `frontend-design` (see its LICENSE.txt), `youtube-fetcher` (see its
LICENSE). The rest were written or adapted without a licence file by Kevin Chiha and are
shared here under MIT.
