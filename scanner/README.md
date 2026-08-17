# Jobsmith scanner — daily job scan on GitHub Actions

Finds new job postings every morning and emails you the ones you have not seen
before. Runs on GitHub's machines, so your laptop can be off.

**What it does not do:** evaluate, score, tailor a CV, or apply to anything. Those
stay in the Jobsmith portal on your machine, where your CV lives.

---

## What is in this repo, and what is deliberately not

| In | Why |
|----|-----|
| `portals.yml` | Your target-role keywords, location filters and company list |
| `data/scan-history.tsv` | URLs already seen, so you are only emailed new ones |
| `scan.mjs` + `providers/` | At the repo ROOT, shared with the portal — not duplicated here |

**Not here, on purpose:** `cv.md`, `config/profile.yml`, your tracker, your
reports, your salary data. The scanner never reads them — verified by running a
full scan in a checkout with all of them deleted. So this repo holds no CV, no
contact details and no compensation figures.

Even so, **keep the repo private.** `portals.yml` reveals what you are looking
for and where.

**No AI, no model API key, no cost.** The scan is plain HTTPS against public ATS
endpoints.

---

## Setup

### 1. Create a PRIVATE repo and push

```bash
gh repo create jobsmith-mine --private --source=. --push
```

### 1b. Opt your config into git

`portals.yml` and the scan ledger are gitignored by default — that default keeps a
user's job search out of git, and keeps a fresh clone asking new users to
customise the scanner rather than silently handing them a generic company list.

A CI instance needs them tracked, so opt in explicitly, in your PRIVATE fork only:

```bash
git add -f portals.yml data/scan-history.tsv
git commit -m "my scanner config"
git push
```

If you do not use `gh`, create the private repo on github.com and push to it.

### 2. Add the email secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `DIGEST_SMTP_USER` | your Gmail address |
| `DIGEST_SMTP_PASS` | a Gmail **app password** — never your account password |
| `DIGEST_TO` | where to send it (defaults to `DIGEST_SMTP_USER`) |

An app password is generated at <https://myaccount.google.com/apppasswords> and
requires 2-Step Verification. It can be revoked without touching your password.

For a provider other than Gmail, also set `DIGEST_SMTP_HOST` and
`DIGEST_SMTP_PORT` (implicit TLS, usually 465).

**Skipping this step is fine.** With no credentials the workflow still runs and
prints what it found into the Actions log — useful for confirming the scan works
before wiring up email.

### 3. Run it once by hand

**Actions → Daily job scan → Run workflow.** Confirm you get an email, then let
the 06:00 UTC schedule take over.

---

## Changing what it looks for

Edit `portals.yml` and push. The two blocks that matter:

- `title_filter.positive` / `negative` — role keywords. **`negative` always
  wins**, so one careless entry can silently hide a whole category. The stock
  career-ops template excludes `.NET`, `iOS` and `Android`, which would have
  removed most of this search.
- `location_filter` — `always_allow` is checked before `block`, which is what
  keeps a multi-country posting that includes one of your markets.

There is only one `portals.yml`, at the repo root, shared by the CI scan and the
portal. An earlier two-repo layout kept a copy in each, which meant the two could
silently drift onto different filters.

---

## Running it locally

```bash
npm install
npm run scan:daily:dry        # scan, write nothing, send nothing
node scanner/run-scan.mjs --no-email   # scan and write data/new-postings.json
npm run scan:daily            # the real thing
npm run test:digest     # digest self-test, no network
```

---

## How it decides what is "new"

`data/scan-history.tsv` is the scanner's own dedup ledger. Each run diffs it
against its state before the run; anything whose URL was not already there is new.

**The workflow commits that file back after every run.** If that commit ever
stops working, every run will re-report the same jobs forever — that is the first
thing to check if a digest looks repetitive.

Rows the scanner recorded as blocked or invalid are ledger entries, not
opportunities, and are never emailed as finds.

---

## When something looks wrong

**A digest repeating yesterday's jobs** — the ledger commit failed. Check the
"Commit the dedup ledger" step, and that Actions has write permission
(Settings → Actions → General → Workflow permissions).

**No email, and none expected** — a run finding nothing sends nothing, on
purpose. A daily "nothing new" message trains you to ignore the sender, which
costs you the day there is something. Check the Actions log to confirm it ran.

**A failed run** — a crashed scan exits non-zero rather than reporting zero
finds, so a red run means "did not work", never "nothing out there". The
`new-postings` artifact on each run holds the exact payload for 14 days.
