#!/usr/bin/env bash
# Thin wrapper over the dsh task-board plugin's HTTP API (@linxin666/dsh-client-ui-task-board).
# The routes are loopback-fenced and want browser same-origin markers, which this script fakes;
# it only works from a shell on the machine that runs dsh. No session cookie is needed.
#
# Usage:
#   task-board.sh list                       # every card, one line each
#   task-board.sh workspaces                 # workspace ids dsh knows, for --workspace
#   task-board.sh show <id-prefix>           # full JSON of one card
#   task-board.sh create <title> <prompt> [--desc TEXT] [--workspace ID] [--permission P]
#                                            [--model M] [--mode PRESET] [--cron "m h dom mon dow"]
#                                            [--reuse-session]
#   task-board.sh move <id-prefix> <backlog|todo|done|failed>
#   task-board.sh schedule <id-prefix> <cron|off>
#   task-board.sh run <id-prefix>
#   task-board.sh delete <id-prefix>         # refuses unless TASK_BOARD_CONFIRMED=1
#   task-board.sh archive <id-prefix>
#
# Permission P is one of read-only, workspace-write, danger-full-access. A card above the
# session default is held by the board until a human confirms it in the UI; this script never
# sends confirm-permission on purpose.
set -euo pipefail

BASE="${TASK_BOARD_URL:-http://127.0.0.1:3080}"
ORIGIN_HEADERS=(-H "Origin: $BASE" -H "Sec-Fetch-Site: same-origin")
INITIATOR="${TASK_BOARD_INITIATOR:-agent:$(hostname)}"

die() { printf 'task-board.sh: %s\n' "$*" >&2; exit 1; }
uuid() { python3 -c 'import uuid; print(uuid.uuid4())'; }

state() { curl -sS "${ORIGIN_HEADERS[@]}" "$BASE/api/task-board/state"; }

action() {  # action <json-action-object>
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps({"requestId": sys.argv[1], "initiator": sys.argv[2], "action": json.loads(sys.argv[3])}))' "$(uuid)" "$INITIATOR" "$1")
  local resp
  resp=$(curl -sS -X POST -H 'content-type: application/json' "${ORIGIN_HEADERS[@]}" "$BASE/api/task-board/action" -d "$body")
  if printf '%s' "$resp" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ok", True) is not False else 1)' 2>/dev/null; then
    printf '%s\n' "$resp"
  else
    die "board rejected the action: $resp"
  fi
}

resolve() {  # resolve <id-prefix> -> full id, or die
  local prefix="$1" ids
  ids=$(state | python3 -c 'import json,sys; p=sys.argv[1]; print("\n".join(t["id"] for t in json.load(sys.stdin)["tasks"] if t["id"].startswith(p)))' "$prefix")
  [ -n "$ids" ] || die "no card id starts with '$prefix'"
  [ "$(printf '%s\n' "$ids" | wc -l)" -eq 1 ] || die "more than one card starts with '$prefix':"$'\n'"$ids"
  printf '%s' "$ids"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  list)
    state | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('revision', d['revision'], ' tz', d['scheduler']['timeZone'], ' session-default-permission', d.get('sessionDefaultPermission', '?'))
for t in d['tasks']:
    s = t.get('schedule') or {}
    cron = ('cron ' + s.get('cron', '')) if s.get('enabled') else ''
    flags = []
    if t.get('archivedAt'): flags.append('archived')
    if t.get('permission') and not t.get('permissionConfirmedAt'): flags.append('awaiting-permission-confirm')
    tail = ('  [' + ','.join(flags) + ']') if flags else ''
    print(f\"{t['id'][:8]}  {t['status']:8}  {t.get('permission') or 'default':18}  {cron:20} {t['title']}{tail}\")
" ;;
  workspaces)
    python3 -c '
import json, os
d = json.load(open(os.path.expanduser("~/.dsh/storages/workspace.json")))
for k, v in d["tables"]["workspaces"].items(): print(k, " ", v.get("title", "?").ljust(14), v.get("path"))
' ;;
  show)
    id=$(resolve "${1:?id-prefix}")
    state | python3 -c 'import json,sys; i=sys.argv[1]; print(json.dumps(next(t for t in json.load(sys.stdin)["tasks"] if t["id"]==i), indent=2))' "$id" ;;
  create)
    title="${1:?title}"; prompt="${2:?prompt}"; shift 2
    desc="" workspace="" permission="" model="" mode="" cron="" reuse=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --desc) desc="$2"; shift 2 ;;
        --workspace) workspace="$2"; shift 2 ;;
        --permission) permission="$2"; shift 2 ;;
        --model) model="$2"; shift 2 ;;
        --mode) mode="$2"; shift 2 ;;
        --cron) cron="$2"; shift 2 ;;
        --reuse-session) reuse=1; shift ;;
        *) die "unknown flag $1" ;;
      esac
    done
    input=$(python3 -c '
import json, sys
title, prompt, desc, ws, perm, model, mode, cron, reuse = sys.argv[1:10]
d = {"title": title, "description": desc, "prompt": prompt}
if ws: d["workspaceId"] = ws
if perm: d["permission"] = perm
if model: d["model"] = model
if mode: d["mode"] = mode
if cron: d["schedule"] = {"enabled": True, "cron": cron}
if reuse: d["reuseSession"] = True
print(json.dumps(d))' "$title" "$prompt" "$desc" "$workspace" "$permission" "$model" "$mode" "$cron" "$reuse")
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"create","id":sys.argv[1],"input":json.loads(sys.argv[2])}))' "$(uuid)" "$input")" >/dev/null
    printf 'created: %s\n' "$title"
    "$0" list | grep -F -- "$title" ;;
  move)
    id=$(resolve "${1:?id-prefix}"); status="${2:?status}"
    case "$status" in backlog|todo|done|failed) ;; *) die "status must be backlog, todo, done or failed" ;; esac
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"move","taskId":sys.argv[1],"status":sys.argv[2]}))' "$id" "$status")" >/dev/null
    printf 'moved %s to %s\n' "${id:0:8}" "$status" ;;
  schedule)
    id=$(resolve "${1:?id-prefix}"); cron="${2:?cron or off}"
    if [ "$cron" = off ]; then patch='{"enabled": false}'; else patch=$(python3 -c 'import json,sys; print(json.dumps({"enabled": True, "cron": sys.argv[1]}))' "$cron"); fi
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"set-schedule","taskId":sys.argv[1],"patch":json.loads(sys.argv[2])}))' "$id" "$patch")" >/dev/null
    printf 'schedule for %s: %s\n' "${id:0:8}" "$cron" ;;
  run)
    id=$(resolve "${1:?id-prefix}")
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"run","taskId":sys.argv[1]}))' "$id")" >/dev/null
    printf 'run requested for %s\n' "${id:0:8}" ;;
  delete)
    [ "${TASK_BOARD_CONFIRMED:-}" = 1 ] || die "delete is destructive: get the user's confirmation for this exact card, then rerun with TASK_BOARD_CONFIRMED=1"
    id=$(resolve "${1:?id-prefix}")
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"delete","taskId":sys.argv[1]}))' "$id")" >/dev/null
    printf 'deleted %s\n' "${id:0:8}" ;;
  archive)
    id=$(resolve "${1:?id-prefix}")
    action "$(python3 -c 'import json,sys; print(json.dumps({"kind":"archive","taskId":sys.argv[1]}))' "$id")" >/dev/null
    printf 'archived %s\n' "${id:0:8}" ;;
  *)
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
