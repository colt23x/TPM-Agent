# Leading an Engineering Team in the Age of AI-Assisted Development

**The practices I use to run a ~50-engineer organization on coding agents (Claude Code, Codex, Copilot, Cursor) — and how to apply them to any team.**

When we rolled out coding agents, the naive expectation was "everyone gets a license, everyone gets faster." That's not what happens. What actually happens is that AI amplifies whatever engineering system you already have: teams with fast tests, small PRs, and clear conventions pull ahead, and teams without them generate mess at a higher rate. So most of what follows isn't about the AI tools at all — it's about running the team so the tools compound instead of corrode.

These practices are organized the way I think about them: how we share context, how we keep repos agent-ready, how we drove adoption, how we changed review and planning, and how we measure whether any of it is working.

---

## The five rules I hold the team to

1. **AI amplifies your existing system.** If the fundamentals are weak — flaky tests, giant PRs, tribal knowledge — fix those first. They are now load-bearing.
2. **The bottleneck moved from writing code to specifying and verifying it.** We stopped optimizing for how fast code gets written and started optimizing for how fast it gets *understood and trusted*.
3. **Accountability never transfers to the tool.** Whoever opens the PR owns every line in it. This is written policy on my team, not an unspoken norm.
4. **Context is a team asset, versioned in git.** Agent instructions, permissions, and shared commands live in the repo and go through code review. One engineer's improvement makes everyone's next session better.
5. **Prose guides, automation enforces.** If a rule must hold every time, it's a hook or a CI gate. Instruction files are suggestions to a model; we treat them that way.

---

## 1. We share context as code

The biggest team-scale unlock wasn't a prompting technique — it was moving agent context out of individual heads and personal configs into the repo, where it's shared, reviewed, and compounds.

**Instruction files are checked in and treated like code.**
- Every active repo has an `AGENTS.md` (the cross-tool standard — Claude Code, Codex, Cursor, and Copilot all read it) at the root. It contains only what an agent can't infer from the code: exact copy-pasteable build/test/lint commands, conventions that differ from language defaults, branch and PR etiquette, known gotchas, and pointers to exemplar files ("new widgets follow `src/widgets/SearchWidget.tsx`").
- We keep them under ~200 lines. Bloated instruction files get ignored — my litmus test for every line is "would removing this cause the agent to make mistakes?" When agents start violating a written rule, that's my signal the file is too long, not that we need to write the rule louder.
- Changes to instruction files go through PR review like any code change, and when a PR changes a pattern, it updates the rule in the same PR. A stale instruction file is worse than none.
- In our monorepo, the root file *routes* (how to find and build the smallest valid slice of the workspace) and per-package files carry the specific commands.

**Repeated workflows become checked-in commands.**
- My rule: anything the team does twice becomes a shared slash command or skill in `.claude/commands/` — for example, `/fix-issue 1234` reads the issue, implements, runs tests and lint, and opens a PR. Engineers prototype in their personal config; when something proves out, it gets PR'd into the repo for everyone.
- We check in domain knowledge too, not just workflows: an API-conventions skill (pagination, URL casing), a metrics skill that wraps our warehouse CLI so anyone can pull numbers without writing SQL.
- Specialized review subagents (like a read-only security reviewer with a locked-down toolset) are also in-repo, so review standards are identical across all 50 engineers instead of varying by who ran the session.

**Team policy lives in committed settings, not per-person prompt-clicking.**
- `.claude/settings.json` is committed with our allowlist of known-safe commands and denials on `.env` and secret paths. Fifty people individually approving permission prompts is fifty chances to get it wrong; one reviewed policy file is not.
- MCP server definitions (Jira, Sentry, DB) ship via committed `.mcp.json`; credentials stay in each person's local scope. Tokens never touch git.
- Rules that must hold every time are hooks: format-on-edit, blocks on writing to protected paths like migrations, a stop-hook that won't let a session end until tests pass. Whenever I catch an agent following a written rule *inconsistently*, we convert that rule to a hook.

**Documentation now pays double.**
Every design doc, ADR, and runbook is consumed by humans *and* agents. Our `adr/` directory works as compressed architectural memory — decisions stop being re-litigated because every agent session can load them. The side effect I didn't expect: new engineers now onboard by asking the codebase questions through an agent instead of booking time with senior engineers, which gave me back real senior capacity.

---

## 2. We keep every repo agent-ready

The single highest-leverage thing we did: **give the agent a check it can run itself.** It's the difference between a session you babysit and a session you delegate.

- **One canonical verification entrypoint per repo** — `./verify.sh` runs install → lint → typecheck → test → build with clean exit codes. Nobody, human or agent, should guess how to validate a change.
- **We fixed flaky tests before scaling agents, not after.** A flaky suite poisons every agent loop with false signals. We re-ran suites repeatedly on the same commit to flush out offenders and quarantined them. I treat flaky-test count as a blocking metric for agent adoption in a repo.
- **"Done" requires evidence.** Team norm: a claim that something works comes with the test output and the commands that produced it — from agents and from people.
- **Environments are scripted** (devcontainers + setup scripts) so agent runs are reproducible, cloud agents can work autonomously, and we can safely relax permissions inside a sandbox.
- **We favor CLIs over bespoke integrations** for external services (`gh`, `aws`, `sentry-cli`). Agents teach themselves a CLI from `--help`, and it's the cheapest integration to maintain.

---

## 3. How we drove adoption (it's a product launch, not a license purchase)

Handing out seats gets you a handful of power users and a plateau. What worked for us:

1. **Pilot first: 20–30 engineers** who were already leaning into AI tools — small enough to support, senior enough to judge output quality. Ran ~4 weeks while we hardened the shared config from §1.
2. **Pilot members became the champion network.** They ran the internal workshops, staffed a dedicated Slack channel where prompts/commands/configs get shared, and acted as first-line support. Internal champions beat external training every time because they know *our* codebase.
3. **Then a company-wide kickoff, not a slow drip** — pilot engineers demoing real workflows from our actual repos, followed by weekly office hours and team-level show-and-tells.
4. **The metric I manage is daily habit, not seat count.** The gains concentrate in people who use the tools most days of the week, so I track usage cohorts and aim enablement at moving the median engineer, not celebrating the top decile. The mechanism that moves the median is shared config plus enablement — not mandates.

---

## 4. We rebuilt code review around the new bottleneck

This is where AI-assisted teams break first. Generation is cheap now; comprehension is not. When PR volume roughly doubles, review is where the queue re-forms — I watched our open-PR count climb and senior engineers drift toward spending most of their week reviewing. What we changed:

- **Ownership is written policy:** a PR belongs to its author, full stop. You must be able to explain any line you submit. "The AI wrote it" is not a sentence anyone gets to say in review.
- **We disclose AI assistance** with a lightweight `Assisted-By:` git trailer / PR checkbox. Not stigma — calibration. It tells the reviewer what *kind* of scrutiny to apply, and the PRs that burn reviewers are the ones where the description doesn't match the code.
- **PR size limits got harder, not softer.** The reviewer's real job now is verifying that intent matches implementation, and that only scales when diffs are small and the description states intent precisely. Big agent-generated PRs get split before review, no exceptions.
- **Agents do the first pass, humans do the judgment pass.** A fresh-context review agent that sees only the diff and the criteria catches the mechanical stuff; for meaningful PRs we dispatch single-concern passes (logic, security, performance). Humans then spend their attention on design, intent, and product correctness — the things agents are worst at.
- **I budget senior review capacity like a first-class resource.** If throughput doubles, review capacity has to come from somewhere: agent pre-review, smaller PRs, stronger CI gates, and explicitly protecting senior calendars. Pretending it will absorb for free is how you get rubber-stamping.

---

## 5. We plan work so agents can execute it

The management-level shift: **spec quality now directly sets code quality**, because a spec is executed literally by an agent rather than interpreted by a colleague who fills gaps from shared context.

- **We write specs an agent could execute.** If the task description is vague, the vagueness ships. And a vague spec fanned out across parallel agents multiplies its errors across everything they produce. Tightening our task write-ups improved output more than any tool setting.
- **Work is decomposed into small, independently verifiable tasks.** The most common failure mode is asking for too much in one shot. Small tasks also unlock parallelism — disjoint-file work runs as concurrent agent sessions.
- **Default loop: explore → plan → implement → verify → commit.** Plans get reviewed before execution on multi-file or unfamiliar changes; one-line diffs skip the ceremony. Where it fits, tests-first gives the agent the self-check from §2.
- **Parallel agents are real but bounded.** In practice 2–3 concurrent sessions per engineer is the sustainable ceiling, isolated in git worktrees or separate branches — never two agents in one working tree, where the last writer silently wins.
- **Commit constantly.** Cheap checkpoints make failed agent experiments cheap to abandon. Git is the real safety net; agent-native undo doesn't cover shell side effects.
- **I'm explicit with senior engineers that their role is shifting** toward decomposing, delegating to a small fleet of agents, and reviewing — and I plan staffing and growth conversations around that reality instead of pretending the job is unchanged.

---

## 6. Guardrails we don't negotiate on

- **AI code gets at least the scrutiny of human code, plus AI-specific checks.** The failure modes are distinctive: insecure defaults, hallucinated or typosquatted dependencies, license-contaminated snippets, secrets pasted into prompts or agent-readable files. Reviewers know to look for exactly these.
- **Secret and PII scanning happens before commit,** in the IDE and pre-commit hooks — block, don't detect-after. Instruction files document *where* secrets live, never values.
- **CI is the load-bearing safety net:** SAST, dependency scanning, and license checks run uniformly on all code regardless of who or what wrote it. As generation scales up, CI is the thing standing between throughput and instability.
- **We budget refactoring explicitly.** Agents have a duplication bias — they'd rather write a new copy than find the existing one. Left alone, cloning creeps up and refactoring share drops. We hold a standing refactor allocation each sprint, watch duplication on the dashboard, and point instruction files at canonical implementations to reuse.

---

## 7. How I measure whether it's working

- **I banned the vanity metrics on day one:** lines of AI-generated code and suggestion acceptance rate measure activity, not value — and in the agentic era every line is "accepted," so they're noise. Worse, they create incentives to ship slop.
- **We measure outcomes:** the DORA four keys (lead time, deploy frequency, change failure rate, MTTR) plus developer-experience signals. While dashboards matured, the fastest useful signal was self-reported *time saved per engineer per week*, segmented by usage cohort.
- **Correlate, don't assume:** throughput and quality tracked against adoption timing — before/after completion time on standard task types — not tool telemetry.
- **I don't trust self-reported speedup, including my own.** The best available controlled study found experienced developers *slower* with AI tools while estimating they were 20% faster. Perception and reality diverge here more than anywhere else I've managed. Measure delivery, not vibes.
- **Stability gets watched as hard as speed.** If change failure rate or duplication trends up while throughput rises, we're borrowing from next quarter and I want to see it immediately.

---

## 8. Failure modes I actively manage

| Failure mode | What it looks like | What we do about it |
|---|---|---|
| **Verification bottleneck** | PR queue growing, review latency up, seniors doing mostly review | Smaller PRs, agent pre-review, stronger CI gates, protected senior time (§4) |
| **Review fatigue** | Plausible-looking code merged unread; rubber-stamping | Disclosure norms, intent-stated descriptions, hard PR-size limits |
| **Skill atrophy, especially juniors** | Juniors delegating wholesale and losing comprehension of their own code | Structure junior work deliberately: AI for explanation and exploration, manual reps on core skills, review participation as the learning mechanism |
| **Junior pipeline erosion** | "Why hire juniors when agents exist?" | Keep hiring them — agents are an onboarding accelerant (the biggest speed gains go to people *new* to a codebase), and they're your senior bench in five years |
| **Adoption plateau** | A minority of power users driving all gains; median engineer barely touching the tool | Champion network, shared in-repo config, office hours, cohort tracking (§3) |
| **Silent quality debt** | Duplication rising, refactor share falling | Standing refactor budget, duplication on the dashboard (§6) |

---

## 9. Applying this to a new team: my 30/60/90

If I were bringing this to another ~50-engineer org, the sequence I'd run:

**Days 1–30 — Foundations and pilot**
- Pick 20–30 pilot engineers across teams; stand up the tool with SSO and managed settings.
- Ship `AGENTS.md` + committed permission settings in the 3–5 highest-traffic repos; add a `verify.sh` entrypoint to each.
- Fix or quarantine flaky tests in those repos.
- Write the two policies: PR ownership/accountability, and secrets/security guardrails.
- Baseline the metrics: DORA four keys, PR review latency, PR size distribution.

**Days 31–60 — Expand and systematize**
- Company-wide kickoff run by pilot engineers demoing real workflows; launch the shared Slack channel and weekly office hours.
- Promote proven personal workflows into checked-in team commands; add the format/protected-path hooks.
- Adopt the disclosure convention and agent-first-pass review; enforce PR size norms.
- Extend instruction files and verify entrypoints to the rest of the active repos.

**Days 61–90 — Measure and institutionalize**
- Review metrics against baseline — throughput *and* stability (change failure rate, duplication trend, review latency).
- Publish an internal "what's working" write-up; prune instruction files against observed agent behavior.
- Set the standing refactor budget; put duplication and review latency on team dashboards.
- Make the champion network permanent, and fold agent-readiness (`AGENTS.md`, verify entrypoint, flaky-test SLO) into the definition of done for every new repo.

---

## Further reading

The external work that most shaped these practices, if you want to go deeper:

- [DORA 2025: State of AI-assisted Software Development](https://dora.dev/dora-report-2025/) — the "AI is an amplifier" evidence, and why stability suffers without strong testing and small batches
- [METR: measuring AI's effect on experienced developers](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) — why I don't trust self-reported speedup
- [Anthropic: Claude Code best practices](https://code.claude.com/docs/en/best-practices) and [How Anthropic teams use Claude Code](https://claude.com/blog/how-anthropic-teams-use-claude-code) — instruction files, checked-in commands, verification loops
- [OpenAI: Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) and the [AGENTS.md standard](https://agents.md/)
- [GitHub: spec-driven development](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) — the spec-as-contract mindset from §5
- [GitClear: AI and code quality](https://www.gitclear.com/ai_assistant_code_quality_2025_research) — the duplication data behind the refactor budget
- [DX Core 4](https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/) — the measurement framework in §7
- [Addy Osmani: Code review in the age of AI](https://addyo.substack.com/p/code-review-in-the-age-of-ai) and [The Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/)

---

*Maintained in [TPM-Agent](../README.md). Last updated July 2026.*
