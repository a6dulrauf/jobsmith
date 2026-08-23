# Jobsmith

**One CV, forged per job.** A local-first job-search workbench: finds openings,
scores them honestly against your CV, tailors a document set per application, and
tracks the whole pipeline — from a browser, on your own machine.

It will not apply to anything for you. That is the point.

> **Jobsmith is a fork of [career-ops](https://github.com/santifer/career-ops) by
> [Santiago Fernández de Valderrama](https://santifer.io), MIT licensed.** Most of
> what makes this work is his — the scanner, the 75+ job-board providers, the
> evaluation methodology, every mode prompt, the fact-check gate. This fork adds a
> full web portal, a CI scanner, and a verification sandbox. See [NOTICE](NOTICE)
> for the exact boundary. Not affiliated with or endorsed by career-ops.

---

## What it does

| | |
|---|---|
| **Finds jobs** | 75+ ATS and job-board providers (Greenhouse, Lever, Ashby, Workday, and the rest). Zero tokens — plain HTTPS against public endpoints |
| **Scores them** | A–G evaluation against your actual CV, including a posting-legitimacy check that flags ghost jobs and scams |
| **Names your gaps** | Requirements you do not meet are stated plainly, not smoothed over |
| **Tailors documents** | CV, cover letter and application email per role — with a fact gate that refuses to render an invented metric |
| **Tracks everything** | Pipeline, follow-up cadence, outcomes, and analytics that tell you *why* you are being rejected |
| **Never submits** | Every flow stops before the send button. You decide |

## The part worth understanding

The fact gate is the reason to use this rather than a prompt.

`verify-cv-facts.mjs` runs against every generated document **before** it is
rendered, and blocks anything not traceable to your `cv.md`. In practice that
means a generated CV omits a skill the posting asks for when you do not have it —
and the evaluation tells you it is missing instead. A tool that quietly adds
"A/B testing" because the posting wants it is not saving you work; it is writing a
claim you have to defend in an interview.

The same discipline shows up elsewhere. The offer-prep flow runs with **no network
tools at all**, because contract figures must never leave your machine. Adding a
project to your CV requires an explicit confirmation after a preview. The
analytics refuse to compute a rate from too small a sample, and say why.

---

## Quick start

```bash
git clone <your-fork> jobsmith && cd jobsmith
npm install
npx playwright install chromium     # PDF rendering only

npm run doctor                      # check prerequisites
cp templates/portals.example.yml portals.yml
```

Then open your AI coding CLI in the directory and let it set you up:

```bash
claude        # or codex / opencode / qwen / agy / grok
```

It will ask for your CV and build `cv.md`, `config/profile.yml` and your scanner
config by conversation. Nothing to hand-edit.

### Which CLI

Any CLI following the open agent-skill standard works — Claude Code, Codex,
OpenCode, Antigravity, Qwen, Kimi, Copilot, Grok — because the logic lives in
`modes/*.md` and `AGENTS.md`, not in a vendor SDK.

**Codex is the exception worth knowing about.** Slash commands are not guaranteed
there, so if a slash command is unavailable, ask for the mode in plain language
instead. `CODEX.md` carries the Codex-specific wrapper:

```bash
codex                                   # interactive
codex exec "Run the scan mode and summarize new matches."
codex exec "Evaluate this JD: https://company.com/jobs/123"
codex exec "Run the pdf mode for the latest evaluated role."
```

### The portal

```bash
cd web && npm ci && npm run dev     # http://localhost:3000
```

Fourteen pages covering the whole loop: Explore, Pipeline, Insights, Compare,
Interview, Offer, CV, Profile, Documents, Follow-ups, Portals, Analytics, Config.

### Daily scan on GitHub Actions

`.github/workflows/jobsmith-scan.yml` scans every morning and emails you only the
postings you have not seen, so your laptop can be off. It needs **no CV, no AI and
no API key** — the scanner reads none of your personal files. Three SMTP secrets
and it runs. See [scanner/README.md](scanner/README.md).

---

## Verifying changes without touching your job search

```bash
node make-sandbox.mjs
```

Builds a disposable install with a fictional persona (`example.test` addresses — a
reserved TLD that cannot resolve), then point anything at it:

```bash
cd web && CAREER_OPS_ROOT=../../jobsmith-sandbox npm run dev -- --port 3100
```

This exists because verifying an end-to-end job-search tool otherwise means
generating real documents for real jobs, and a bug in a generated document reaches
an employer. It has already earned its place: a renderer crash and four
input-validation holes were only visible against a populated sandbox.

---

## What this fork changed

**Added** — the Insights, Profile, Documents, Compare, Interview and Offer pages;
cover-letter, application-email, outreach, add-to-CV, outcome-recording and
tracker-maintenance flows; a GitHub Actions scanner with a zero-dependency SMTP
digest; the sandbox harness.

**Kept** — everything else, unchanged. Where a portal button runs a career-ops
mode, it runs the real one rather than reimplementing it, so behaviour matches the
CLI exactly and cannot drift.

**Removed** — the upstream auto-updater. This is a hard fork; upstream
improvements have to be brought over deliberately. The original README is kept at
[docs/README.career-ops-original.md](docs/README.career-ops-original.md).

---

## Licence, and using this commercially

Both the upstream code and this fork's additions are **MIT licensed**, which
grants the right to "use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies". Selling this, or running it as a paid service, is permitted.
The single obligation is to keep the copyright and permission notices with every
copy — see [LICENSE](LICENSE).

**The name is a separate matter.** "career-ops" is a trademark of the upstream
author, with an application pending in classes 9 and 42 (software and SaaS).
Its policy reserves the name for product naming, endorsement claims, domains and
visual identity in commercial contexts — and explicitly permits forking, naming a
fork distinctly, and describing lineage with attribution. Jobsmith does the
latter and none of the former.

If you fork this in turn, or take it commercial, [NOTICE](NOTICE) sets out the
boundary in full, including the two items worth settling first: the bundled fonts
ship without their SIL OFL text (see [fonts/NOTICE](fonts/NOTICE)), and the
upstream trademark policy invites a short note to its maintainer before a
commercial launch. Dependencies were checked for copyleft that would conflict
with a closed or paid offering; there is none.

Not legal advice.

## Credit

career-ops was built by Santiago Fernández de Valderrama, who used it to evaluate
740+ offers and land a Head of Applied AI role. If this is useful to you, the
original deserves your attention:
**https://github.com/santifer/career-ops**

Licensed MIT — both his work and this fork's additions. See [LICENSE](LICENSE) and
[NOTICE](NOTICE).
