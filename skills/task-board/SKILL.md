---
name: task-board
description: Use when the user asks to add, schedule, list, move, run, clean up or delete cards on the dsh task board (the kanban in the web GUI, "看板", "scheduled task", "nightly job", "cron a job for the agent"), or when a job should run later or on a schedule without them at the keyboard.
---

# Task board

The board is a kanban of agent jobs. Each card is a prompt plus optional workspace, agent preset, permission, model and a five-field cron. dsh's server runs the card as a real session when it is due; the browser can be closed. Every run spends API money.

Do everything through `~/.agents/skills/task-board/task-board.sh`. Raw curl against `/api/task-board/action` is wrong: the script fakes the same-origin headers the route wants, stamps an initiator, resolves short ids, and holds the delete gate.

## Recipe

1. `task-board.sh list` first, always. Card ids are shown as 8-char prefixes; every other command takes that prefix.
2. Create: `task-board.sh create "<title>" "<prompt>" [--desc TEXT] [--workspace ID] [--permission P] [--model M] [--mode PRESET] [--cron "m h dom mon dow"] [--reuse-session]`. Workspace ids come from `task-board.sh workspaces`; pick by folder name. Cron is in the board's own time zone (`list` prints it), five fields, no seconds.
3. Change: `move <id> <backlog|todo|done|failed>`, `schedule <id> <cron|off>`, `run <id>`, `archive <id>`.
4. Delete: only after step 5 below. The script refuses without `TASK_BOARD_CONFIRMED=1`.
5. Report by title and id prefix what you created or changed, and `list` again at the end so the reply shows the real board.

## Delete and schedule need the user's word on the exact card

Before `delete`, or before changing the `schedule` of a card you did not create in this same conversation, name the card (title + id prefix) and ask. "Clean up the board", "remove the junk", "tidy it" are not that word: they do not say which cards. If the user is away, do the additive part of the request, list the candidates with a one-line reason each, and stop. Never set `TASK_BOARD_CONFIRMED=1` from your own judgement.

Archive is the middle ground: `archive <id>` takes a card off the board without deleting its history, and the user can restore it in the UI. Offer it when the user wants a tidy board and has not named cards.

| Thought | Reality |
|---|---|
| "The user said clean up, that covers deleting" | It names an outcome, not a card. Delete needs a card. |
| "It's obviously a test card" | Test cards are the ones people forget they still need. Ask. |
| "The user is away and wanted it done now" | Do the create. Leave the delete list in the reply. |
| "I'll archive instead, that's not destructive" | Archive is allowed without asking. Say so in the reply. |

## Permission

Cards inherit the session default (`list` prints it). A card asking for more than the default is created but held: `list` shows `[awaiting-permission-confirm]` and the board will not run it until the user clicks confirm in the GUI. The script has no command for that confirmation, and you do not send `confirm-permission` by any other route either, even when they asked for the permission in the same message: the click is their attestation that they read the card. When you create such a card, tell them it is waiting for their click.

If the job does not touch local files (SSH-only checks, web lookups), say that `read-only` would run without the click, and offer the downgrade.

## Common mistakes

- Six-field cron (with seconds): the board takes five. `0 3 * * *` is 03:00 daily.
- Missed triggers are skipped, not caught up. A PC asleep at 03:00 means no run that night.
- A card is one session. "Run X on all my servers" belongs in the prompt (the ssh_cluster tool does the fan-out); do not create one card per server.
- The board writes `~/.dsh/task-board/`; it is machine-local and not mirrored by ai-config.
