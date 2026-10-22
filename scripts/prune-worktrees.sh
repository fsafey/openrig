#!/usr/bin/env bash
# Remove worktrees and local branches whose work already landed through a
# merged PR. Dry run by default: prints a
# verdict per candidate and leaves worktrees and local branches intact.
#
# Usage (from the main checkout or any worktree):
#   ./scripts/prune-worktrees.sh [--apply] [--include-runtime] [--include-empty]
#
#   --apply            remove what the dry run marks "prune"
#   --include-runtime  also judge .claude/worktrees and .codex/worktrees; one
#                      with no commits of its own (detached or not) goes once
#                      its git state has been idle for a day
#   --include-empty    also remove clean branches with no commits beyond
#                      origin/main (a fresh worktree someone may be about to use)
#
# - "Merged" means GitHub records a merged PR from that branch whose head is, or
#   contains, the local tip. Being on main is not enough: a branch created a
#   minute ago is on main too.
# - A tip on main's first-parent line never counts as merged through an old PR
#   of the same name: that is a fresh branch reusing the name.
# - A worktree goes only when it is clean (submodule included), unlocked, and no
#   process has its working directory inside it, checked again just before
#   removal. `git worktree remove` never uses --force.
# - Git deletes ignored files even without --force. Archive unique ignored
#   payload before removal; skip dependency installs, caches, build output, and
#   exact copies of the main checkout. Keep unique local configuration for a
#   person to inspect. Archives are private under $HOME/Project/_worktree-archive.
# - Status reads take no optional locks, so scanning never rewrites a worktree's
#   index and makes it look recently used.
# - Only same-repository PR heads qualify. A fork can reuse a branch name.
# - No remote deletion: the fetch below only updates local tracking refs.

set -euo pipefail

apply=0 runtime=0 empty=0
for arg in "$@"; do
  case $arg in
    --apply) apply=1 ;;
    --include-runtime) runtime=1 ;;
    --include-empty) empty=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
# How to repeat this run with --apply. `make prune-worktrees` passes its own
# spelling, so the hint matches whatever the caller typed.
rerun=${PRUNE_WORKTREES_RERUN:-"$0${*:+ $*} --apply"}
for command_name in gh lsof; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done

export GIT_OPTIONAL_LOCKS=0
# How long a runtime worktree with no commits of its own must sit untouched:
# time to come back to a session that closed without committing.
runtime_idle_minutes=$((24 * 60))

cd "$(git rev-parse --path-format=absolute --git-common-dir)/.."
git fetch origin --prune --quiet
# Ask origin's repository for its PRs, not gh's default repository: in a fork that also has an
# upstream remote, gh can resolve to the upstream, whose PRs say nothing about these branches.
merged_prs=$(gh pr list --repo "$(git remote get-url origin)" --state merged --limit 2000 --json headRefName,headRefOid,isCrossRepository \
  --jq '.[] | select(.isCrossRepository == false) | "\(.headRefName) \(.headRefOid)"')
[[ -n "$merged_prs" ]] || { echo "gh returned no merged PRs; refusing to judge" >&2; exit 1; }
mainline=$(git rev-list --first-parent origin/main)
read_cwds() {
  local output
  output=$(lsof -d cwd -Fn 2>/dev/null) || { echo "lsof failed; refusing to judge" >&2; exit 1; }
  cwds=$(sed -n 's/^n//p' <<<"$output")
  active "$PWD" || { echo "lsof reports no working directories; refusing to judge" >&2; exit 1; }
}

merged() { # BRANCH TIP
  local name head
  while read -r name head; do
    [[ "$name" == "$1" ]] || continue
    [[ "$head" == "$2" ]] && return 0
    grep -qx "$2" <<<"$mainline" && continue
    git cat-file -e "$head^{commit}" 2>/dev/null && git merge-base --is-ancestor "$2" "$head" && return 0
  done <<<"$merged_prs"
  return 1
}
# git records worktree paths resolved, as lsof reports working directories.
active() { awk -v p="$1" '$0 == p || index($0, p "/") == 1 { found = 1 } END { exit !found }' <<<"$cwds"; }
dirty() {
  local status
  status=$(git -C "$1" status --porcelain 2>&1) || return 0
  [[ -n "$status" ]]
}
safe_ignored() {
  local output line path
  archive_paths=()
  # matching: report the path that matched an ignore rule (web/node_modules/),
  # not a parent that holds only ignored files (web/).
  output=$(git -C "$1" status --porcelain --ignored=matching --untracked-files=normal 2>&1) || return 1
  while IFS= read -r line; do
    [[ "$line" == '!! '* ]] || continue
    path=${line#'!! '}
    [[ -L "$1/$path" ]] && continue
    case $path in
      node_modules/|*/node_modules/|.venv/|*/.venv/) ;;
      __pycache__/|*/__pycache__/|.pytest_cache/|*/.pytest_cache/|.ruff_cache/|*/.ruff_cache/) ;;
      .mypy_cache/|*/.mypy_cache/|*.tsbuildinfo|.DS_Store|*/.DS_Store) ;;
      dist/|*/dist/|coverage/|*/coverage/|.wrangler/|*/.wrangler/) ;;
      .claude/hooks/logs/|.agents/hooks/logs/) ;;
      .env|.env.*|*/.env|*/.env.*|.mcp.json|*/.mcp.json|*/settings.local.json)
        copy_of_main "$1" "$path" || return 1 ;;
      *) copy_of_main "$1" "$path" || archive_paths+=("${path%/}") ;;
    esac
  done <<<"$output"
}
archive_ignored() { # WORKTREE HEAD
  [[ ${#archive_paths[@]} -gt 0 ]] || return 0
  local archive_dir="$HOME/Project/_worktree-archive/${PWD##*/}" archive
  (umask 077; mkdir -p "$archive_dir") || return 1
  # GNU stat uses -c; BSD stat uses -f. Unknown modes fail closed.
  [[ $(stat -c %a "$archive_dir" 2>/dev/null || stat -f %Lp "$archive_dir" 2>/dev/null) == 700 ]] || { echo "archive directory is not private: $archive_dir" >&2; return 1; }
  archive=$(umask 077; mktemp "$archive_dir/${1##*/}-${2:0:12}.XXXXXX") || return 1
  if ! tar -czf "$archive" -C "$1" -- "${archive_paths[@]}"; then
    rm -f "$archive"
    return 1
  fi
  echo "archived $1 ignored payload to $archive"
}
# Session setup copies ignored config (.env, .claude/settings.local.json) from
# the main checkout; an unchanged copy loses nothing.
copy_of_main() { # WORKTREE PATH
  [[ -e "$PWD/$2" ]] || return 1
  if [[ -d "$1/$2" ]]; then diff -rq "$1/$2" "$PWD/$2" >/dev/null 2>&1; else cmp -s "$1/$2" "$PWD/$2"; fi
}
# HEAD, reflog, or index changed within the idle window. Unknown means recent.
recent() {
  local admin
  admin=$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null) || return 0
  [[ -n $(find "$admin/HEAD" "$admin/index" "$admin/logs/HEAD" -mmin "-$runtime_idle_minutes" 2>/dev/null) ]]
}
on_main() { git merge-base --is-ancestor "$1" origin/main; }
verdict() { printf '%-6s %-70s %s\n' "$1" "$2" "$3"; }
# This shell works in the main checkout. If lsof cannot see that, it cannot see
# anyone working in a worktree either.
read_cwds

pruned_trees=() pruned_branches=() checked_out=" " stale=0 main_checkout=1 archive_failed=0
judge_worktree() {
  [[ -n "$wt" ]] || return 0
  [[ -z "$branch" ]] || checked_out+="$branch "
  # git lists the main checkout first.
  if [[ $main_checkout == 1 ]]; then main_checkout=0; return 0; fi
  [[ -z "$prunable" ]] || { verdict prune "$wt" "directory is gone"; stale=1; return 0; }
  local owned=0 label=${branch:-detached}
  if [[ "$wt" == */.claude/worktrees/* || "$wt" == */.codex/worktrees/* ]]; then
    [[ $runtime == 1 ]] || { verdict keep "$wt" "runtime-owned (--include-runtime)"; return 0; }
    owned=1
  fi
  [[ -z "$locked" ]] || { verdict keep "$wt" "locked"; return 0; }
  # A person detaches a worktree on purpose (a release, an exact SHA); a runtime
  # detaches its scratch checkouts.
  [[ -n "$branch" || $owned == 1 ]] || { verdict keep "$wt" "detached HEAD"; return 0; }
  ! dirty "$wt" || { verdict keep "$wt" "uncommitted changes ($label)"; return 0; }
  safe_ignored "$wt" || { verdict keep "$wt" "unique local config needs inspection ($label)"; return 0; }
  ! active "$wt" || { verdict keep "$wt" "a process is working in it ($label)"; return 0; }
  if [[ -n "$branch" ]] && merged "$branch" "$head"; then
    verdict prune "$wt" "merged PR ($branch)"
  elif on_main "$head" && [[ $owned == 1 ]]; then
    ! recent "$wt" || { verdict keep "$wt" "runtime, git activity within a day ($label)"; return 0; }
    verdict prune "$wt" "runtime, idle a day, no commits beyond main ($label)"
  elif on_main "$head"; then
    [[ $empty == 1 ]] || { verdict keep "$wt" "no commits beyond main, --include-empty ($branch)"; return 0; }
    verdict prune "$wt" "no commits beyond main ($branch)"
  else
    verdict keep "$wt" "unmerged commits ($label)"; return 0
  fi
  pruned_trees+=("$wt|$branch|$head")
}

wt='' head='' branch='' locked='' prunable=''
while IFS= read -r line; do
  case $line in
    "worktree "*) wt=${line#worktree } ;;
    "HEAD "*) head=${line#HEAD } ;;
    "branch "*) branch=${line#branch refs/heads/} ;;
    locked*) locked=1 ;;
    prunable*) prunable=1 ;;
    "") judge_worktree; wt='' head='' branch='' locked='' prunable='' ;;
  esac
done < <(git worktree list --porcelain; echo)

while read -r branch tip; do
  [[ "$branch" != main && "$checked_out" != *" $branch "* ]] || continue
  if merged "$branch" "$tip"; then
    verdict prune "branch $branch" "merged PR"
  elif [[ $empty == 1 ]] && on_main "$tip"; then
    verdict prune "branch $branch" "no commits beyond main"
  else
    continue
  fi
  pruned_branches+=("$branch|$tip")
done < <(git for-each-ref --format='%(refname:short) %(objectname)' refs/heads)

if [[ $apply == 0 ]]; then
  echo
  echo "Dry run: no worktrees or local branches changed. To remove the lines marked prune, run:"
  echo "  $rerun"
  exit 0
fi

for entry in ${pruned_trees[@]+"${pruned_trees[@]}"}; do
  head=${entry##*|} entry=${entry%|*}
  wt=${entry%|*} branch=${entry##*|}
  read_cwds
  if [[ $(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null || true) != "$branch" ]] ||
     [[ $(git -C "$wt" rev-parse HEAD 2>/dev/null || true) != "$head" ]] ||
     dirty "$wt" || ! safe_ignored "$wt" || active "$wt"; then
    echo "skipped $wt: changed since the scan"
    continue
  fi
  if ! archive_ignored "$wt" "$head"; then
    echo "skipped $wt: could not archive ignored payload"
    archive_failed=1
    continue
  fi
  if git worktree remove "$wt"; then
    [[ -z "$branch" ]] || git branch -D --quiet "$branch"
    echo "removed $wt${branch:+ and $branch}"
  fi
done
[[ $stale == 0 ]] || git worktree prune -v
for entry in ${pruned_branches[@]+"${pruned_branches[@]}"}; do
  branch=${entry%|*} tip=${entry##*|}
  [[ $(git rev-parse -q --verify "refs/heads/$branch" 2>/dev/null || true) == "$tip" ]] || {
    echo "skipped branch $branch: changed since the scan"
    continue
  }
  git branch -D --quiet "$branch"
  echo "removed branch $branch"
done
exit $archive_failed
