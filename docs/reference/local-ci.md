# Local CI for the personal fork

The `fsafey/openrig` fork uses local CI only. GitHub Actions is disabled at the
repository level; inherited workflow files remain for upstream compatibility.
Main requires an up-to-date PR and the `local-ci` commit status. Branch protection
also applies to administrators, with force-push and deletion disabled. No admin
merge bypass is part of this workflow.

## Run the gate

Use a clean sibling worktree, macOS, Node 22 or 24, tmux and a running local Docker
engine. Installations and provider credentials are not used. The runner installs
its own worktree dependencies with `npm ci`; never share `node_modules`.
For the foundation machine, an existing Colima default profile supplies Docker:

```sh
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
colima start default                 # only if this profile is stopped
unset DOCKER_CONTEXT
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
npm run ci:local
```

The runner does not start or stop the VM. If you start an otherwise unused
profile for this run, stop it afterwards and restore your previous Docker
context. Never stop a shared engine or remove unrelated containers/images.

The gate requires a clean committed HEAD and performs these stages without skips:

1. Worktree-local dependency installation and dependency-root validation.
2. Full workspace build and typecheck.
3. Repository checks and daemon, CLI, TUI and UI package suites.
4. Dry-run package inventories for CLI, daemon and TUI, without lifecycle scripts.
5. Clean installed-package Linux scenarios on the explicitly selected local
   Docker socket: healthy/lost-baton/healthy for fixture and library cases,
   plus addressed transcript and capture scenarios.

Suites use the existing macOS network sandbox and process-observation probe,
with scratch HOME and temporary sockets and no inherited provider configuration.
The copied system `ps` is selected only after its bytes and behavior pass that
probe. These are test fixture homes, not alternate authenticated provider homes.
The installed scenarios retain their nonroot, network-none, resource-limited
containers without host mounts or credentials. Build/dependency downloads need
network access; provider-backed agents are not run. This confines trusted tests,
not malicious repository code: host tests still have ordinary filesystem access
and localhost TCP is allowed.

## Evidence and merge

A run writes `dist/local-ci/<commit>/receipt.json` and per-stage logs. Installed
scenario evidence remains under `dist/pr-scenarios/`. Preserve those ignored
outputs outside a worktree before its normal post-merge cleanup if needed.
Receipts begin FAIL, replace older results, and become PASS only after all stages
succeed and HEAD, tree, worktree cleanliness and dependency ownership still match.
A nonzero exit, missing stage, changed candidate or failed final check cannot pass.
This is local evidence; a GitHub status publishes its result, not hosted execution.

As the authorized operator, publish pending before a run. After a failed run,
publish failure. Publish success only for the exact candidate whose full gate
returned zero and whose receipt says PASS. For this fork:

```sh
ci_sha="$(git rev-parse HEAD)"
gh api --method POST "repos/fsafey/openrig/statuses/$ci_sha" \
  -f context=local-ci -f state=pending -f description='Local CI running'
if npm run ci:local; then ci_result=success; else ci_result=failure; fi
test "$ci_sha" = "$(git rev-parse HEAD)" || exit 1
gh api --method POST "repos/fsafey/openrig/statuses/$ci_sha" \
  -f context=local-ci -f state="$ci_result" \
  -f description="Local macOS and installed Linux CI: $ci_result"
test "$ci_result" = success || exit 1
gh pr merge <pr-number> --squash --match-head-commit "$ci_sha"
```

The status is an attributed report by a trusted repository writer, not an
independent CI attestation. Do not upload private logs or native provider state.
Read suite counts/skips and installed-scenario records before publishing success.
Normal branch protection remains the merge authority.

`npm run gate` remains the existing narrower lint/test runner; it is not the
fork's full local CI entry point. Hosted Linux build/typecheck/repo scheduling is
replaced by macOS execution of those checks, while installed Linux behavior is
still exercised in the container. Neither route qualifies real model behavior;
the [foundation runtime evidence](foundation/evidence.md) covers that separately.
