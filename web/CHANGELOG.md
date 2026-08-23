# Changelog

## [0.6.0](https://github.com/a6dulrauf/jobsmith/compare/web-v0.5.0...web-v0.6.0) (2026-08-23)


### Features

* **patterns:** per-agency advance-rate analysis from the Via channel ([9ef9b7d](https://github.com/a6dulrauf/jobsmith/commit/9ef9b7d200cb73b8f1e1d2dce8a0d42bbeff5f05))
* **providers:** add VDAB zero-auth provider ([#2084](https://github.com/a6dulrauf/jobsmith/issues/2084)) ([c68182c](https://github.com/a6dulrauf/jobsmith/commit/c68182c9acbc46cdbb8ac083888ec49cf3f14773))
* sandbox persona for verification + insights renderers it revealed ([a077cd0](https://github.com/a6dulrauf/jobsmith/commit/a077cd02225cc8a672b4c2d0b8481778e5a1fd86))
* tell the candidate what to ask for, not just what the job pays ([20641c5](https://github.com/a6dulrauf/jobsmith/commit/20641c542ba8c96eee6b5b4477d908233f5c642b))
* the salary answer, written for the box it goes in ([ea8ede5](https://github.com/a6dulrauf/jobsmith/commit/ea8ede5abc95a22ad00934451ab0c296d3656a0b))
* **tracker:** Via channel — end employer vs recruiter/agency intermediary ([#1599](https://github.com/a6dulrauf/jobsmith/issues/1599)) ([b4f2b9c](https://github.com/a6dulrauf/jobsmith/commit/b4f2b9c7c452c57bd006d273a4ab0bf86d137373))
* **web:** a guided next-step card on the home page ([8c3be19](https://github.com/a6dulrauf/jobsmith/commit/8c3be1951a4596a22c376cbbf0f815a294d2444e))
* **web:** cover letter + application email from the report page ([ff92226](https://github.com/a6dulrauf/jobsmith/commit/ff92226e173038a9f3cf2b98f8dd1002f4ec6025))
* **web:** Follow-up Tracker page with logging, history, and cadence settings ([#1422](https://github.com/a6dulrauf/jobsmith/issues/1422)) ([cb9a65b](https://github.com/a6dulrauf/jobsmith/commit/cb9a65b92b4ce6f8e46c8ef9bc8903137cdfb1ea))
* **web:** insights page — seven analytics tools, zero model calls ([89b783f](https://github.com/a6dulrauf/jobsmith/commit/89b783fc656a8d2f4b72d85022bd01118762b6c4))
* **web:** interview suite — research, plan, red-flags, debrief, practice ([9a2a54c](https://github.com/a6dulrauf/jobsmith/commit/9a2a54c58b76cf5eff21878135add23472b8b990))
* **web:** offer prep — contract clause walk with the PII guard in code ([ec74ffe](https://github.com/a6dulrauf/jobsmith/commit/ec74ffe773348a90611ac8dc34a7e8fe97d414bc))
* **web:** outreach, offer comparison, and a gated add-to-CV ([db68bd7](https://github.com/a6dulrauf/jobsmith/commit/db68bd75d5b26cf9f2e0c814c02be224028161c3))
* **web:** record outcomes + run tracker maintenance from the portal ([b7e004f](https://github.com/a6dulrauf/jobsmith/commit/b7e004f86243193fb4bde5b9ab03a6845190b6bb))
* **web:** surface profile narrative and generated documents ([9aa3e83](https://github.com/a6dulrauf/jobsmith/commit/9aa3e8309696f91c895ccc4a37c7d883d9d731a3))
* **web:** the portal calls itself Jobsmith ([19b6f12](https://github.com/a6dulrauf/jobsmith/commit/19b6f12615830523bc3aa7a292258996e693a56d))


### Bug Fixes

* **dashboard:** localize the hired status label and buffer split stream openers ([#2295](https://github.com/a6dulrauf/jobsmith/issues/2295)) ([fc6243f](https://github.com/a6dulrauf/jobsmith/commit/fc6243ff2abcba15c51d9b21536ef8721a2a416c))
* **deps:** update dependency next to v16.2.11 [security] ([#2198](https://github.com/a6dulrauf/jobsmith/issues/2198)) ([b90c3de](https://github.com/a6dulrauf/jobsmith/commit/b90c3de7aedb3b50fc22c5d03551a308b0bf006e))
* **web:** add Hired to the states.ts FALLBACK so the degraded path accepts it ([#2282](https://github.com/a6dulrauf/jobsmith/issues/2282)) ([dd34f4c](https://github.com/a6dulrauf/jobsmith/commit/dd34f4c319b84f312c87f8af8f848854593ec61c))
* **web:** an evaluation is the heaviest agent we run, on the smallest budget ([7a7a8d0](https://github.com/a6dulrauf/jobsmith/commit/7a7a8d0ccf03fddc0d244c413950d61637e72799))
* **web:** every action for an application in one row ([f68f9a2](https://github.com/a6dulrauf/jobsmith/commit/f68f9a24062c2d80b94cf29ab1ef780da80974d6))
* **web:** insights renderers must not crash on object-valued fields ([b0a292a](https://github.com/a6dulrauf/jobsmith/commit/b0a292a2f51c144ce6704868eab68e6b0752d936))
* **web:** keep the run stream alive, and give an evaluation the time it takes ([4e80ebd](https://github.com/a6dulrauf/jobsmith/commit/4e80ebd3c63cf4320c6137f18edff324f8faee63))
* **web:** label-aware pipeline.md reader — posted:/trust:/note: never misread as columns ([a4ac194](https://github.com/a6dulrauf/jobsmith/commit/a4ac19413c00c9fda2b11033c057de4eb7c097e3))
* **web:** make inbox triage rows link to the actual posting ([0933437](https://github.com/a6dulrauf/jobsmith/commit/093343735c0223735fdca841cb9d56d9cef8b28e))
* **web:** propagate the Hired terminal-success state across the whole dashboard ([#2250](https://github.com/a6dulrauf/jobsmith/issues/2250)) ([c60ba69](https://github.com/a6dulrauf/jobsmith/commit/c60ba693025292b52c483513b36e217178c6a8db))
* **web:** put the job posting back where someone about to apply would look ([c5067c0](https://github.com/a6dulrauf/jobsmith/commit/c5067c0a9e33cd4d6ff3a99796d55f77c6ef4ebd))
* **web:** render PDFs from the backend instead of the spawned agent ([#2182](https://github.com/a6dulrauf/jobsmith/issues/2182)) ([ca4d611](https://github.com/a6dulrauf/jobsmith/commit/ca4d611111cff95b8667c304f2bf84cd51f60f53))
* **web:** resolve nested postcss and sharp advisories via overrides ([#2216](https://github.com/a6dulrauf/jobsmith/issues/2216)) ([e000c23](https://github.com/a6dulrauf/jobsmith/commit/e000c23d51cf3fa1baba36edf2ba44af9b466df9))
* **web:** the report page guessed which documents existed instead of looking ([7a345b3](https://github.com/a6dulrauf/jobsmith/commit/7a345b3b3f06fedbd4751931fe060de8c789769b))
* **web:** ux-audit cleanup — CostBadge global CSS + last sub-44 stragglers ([#1648](https://github.com/a6dulrauf/jobsmith/issues/1648)) ([ec4fda4](https://github.com/a6dulrauf/jobsmith/commit/ec4fda49a5ee2c9a9024a78cfeeaf038cdd5b7ca))

## [0.5.0](https://github.com/santifer/career-ops/compare/web-v0.4.0...web-v0.5.0) (2026-07-30)


### Features

* **compliance:** check-table-freshness.mjs — staleness validator for jurisdiction tables (closes [#2036](https://github.com/santifer/career-ops/issues/2036)) ([1e83f67](https://github.com/santifer/career-ops/commit/1e83f6711e5e1587fc1d220b40eb925b8ef73542))
* **oferta/apply:** immigration-status requirement overreach — jurisdiction table + posting signal + form warning ([2a681d1](https://github.com/santifer/career-ops/commit/2a681d129a5ad2fb1b191072dac74a0a90ea6cb5))
* **oferta/apply:** jurisdiction-prohibited content signal — table + Block G + apply-form warning ([d8dac75](https://github.com/santifer/career-ops/commit/d8dac7589b228051abe79ca3acf4014cf8b9c6fb))
* **oferta:** agency licensing check — jurisdiction table + registry pointer for agency-mediated postings (closes [#2037](https://github.com/santifer/career-ops/issues/2037)) ([10bf77f](https://github.com/santifer/career-ops/commit/10bf77fb7c5c2f8eb6ca1a03ba91736f5bf95ca3))


### Bug Fixes

* **web:** add Hired to the states.ts FALLBACK so the degraded path accepts it ([#2282](https://github.com/santifer/career-ops/issues/2282)) ([fd112c9](https://github.com/santifer/career-ops/commit/fd112c972d23cf0028e0411f36f67b1adf5520db))
* **web:** label-aware pipeline.md reader — posted:/trust:/note: never misread as columns ([6c75d9a](https://github.com/santifer/career-ops/commit/6c75d9aa03c919803ffe6939b2ba6f1cf7238db6))
* **web:** propagate the Hired terminal-success state across the whole dashboard ([#2250](https://github.com/santifer/career-ops/issues/2250)) ([29503dc](https://github.com/santifer/career-ops/commit/29503dca07c4f1725675299db48685565f159acb))

## [0.4.0](https://github.com/santifer/career-ops/compare/web-v0.3.0...web-v0.4.0) (2026-07-28)


### Features

* **providers:** add VDAB zero-auth provider ([#2084](https://github.com/santifer/career-ops/issues/2084)) ([6164384](https://github.com/santifer/career-ops/commit/6164384768fa47b7e164e2c36f53e86b2fd620cc))


### Bug Fixes

* **deps:** update dependency next to v16.2.11 [security] ([#2198](https://github.com/santifer/career-ops/issues/2198)) ([b6d1c87](https://github.com/santifer/career-ops/commit/b6d1c871d985c278af51d26fa51ef09274c1076b))
* **web:** resolve nested postcss and sharp advisories via overrides ([#2216](https://github.com/santifer/career-ops/issues/2216)) ([ec02af8](https://github.com/santifer/career-ops/commit/ec02af816abc81b500475f81bf1c2753727a1e79))

## [0.3.0](https://github.com/santifer/career-ops/compare/web-v0.2.0...web-v0.3.0) (2026-07-07)


### Features

* **patterns:** per-agency advance-rate analysis from the Via channel ([b6ce551](https://github.com/santifer/career-ops/commit/b6ce551e4404f15b20404ecc642886cfe8a2c4c5))
* **tracker:** Via channel — end employer vs recruiter/agency intermediary ([#1599](https://github.com/santifer/career-ops/issues/1599)) ([b66c0b4](https://github.com/santifer/career-ops/commit/b66c0b4a76e9f3738bbddac2ebeb612053e0a9cc))


### Bug Fixes

* **deps:** update npm dependencies ([#1593](https://github.com/santifer/career-ops/issues/1593)) ([253c571](https://github.com/santifer/career-ops/commit/253c5719df403cdaa493db27cdd17349f54f7889))
* **tracker:** retrofit remaining positional readers onto the shared header-aware parser ([#1598](https://github.com/santifer/career-ops/issues/1598)) ([369a5ff](https://github.com/santifer/career-ops/commit/369a5ffcf6623750fcbedbd16be7d3c1c84f1111))
* **web:** 44px tap-targets at the component level ([#1629](https://github.com/santifer/career-ops/issues/1629)) ([388542f](https://github.com/santifer/career-ops/commit/388542f3c0a2f82eeac83be8db5b616c213225b9))
* **web:** contrast tokens — AA across both themes ([#1627](https://github.com/santifer/career-ops/issues/1627)) ([ee89bea](https://github.com/santifer/career-ops/commit/ee89bea997702d40d1cc01620f727bbb66146b9b))
* **web:** portals copy + analytics semantics ([#1628](https://github.com/santifer/career-ops/issues/1628)) ([f8daa19](https://github.com/santifer/career-ops/commit/f8daa19d8ea164dd2bbb63834f2d048a34ccaa63))
* **web:** ux-audit cleanup — CostBadge global CSS + last sub-44 stragglers ([#1648](https://github.com/santifer/career-ops/issues/1648)) ([786b960](https://github.com/santifer/career-ops/commit/786b960c2761e88a534886eafdc9d59f82aba56b))

## [0.2.0](https://github.com/santifer/career-ops/compare/web-v0.1.0...web-v0.2.0) (2026-07-05)


### Features

* experimental local-first web UI (opt-in alpha) ([#1451](https://github.com/santifer/career-ops/issues/1451)) ([1791dc4](https://github.com/santifer/career-ops/commit/1791dc4e3a14aeb10decd852c927bb636aefe00d))
* **pipeline:** optional per-offer note in the pipeline writer ([#1483](https://github.com/santifer/career-ops/issues/1483)) ([6435b1a](https://github.com/santifer/career-ops/commit/6435b1a4dc93a9d441df8768e481d878e3309ae3))
* **web:** Config microcopy humanized (P1.5) ([#1538](https://github.com/santifer/career-ops/issues/1538)) ([8ae3475](https://github.com/santifer/career-ops/commit/8ae347502b8380692a5f80f490bc59f20d1c8491))
* **web:** cost affordance — CostBadge muted (P1.6) ([#1536](https://github.com/santifer/career-ops/issues/1536)) ([b212bb3](https://github.com/santifer/career-ops/commit/b212bb3591de4c374347dec40fc400c4d6ab9bda))
* **web:** dedupe bug reports at write — stable fingerprint + click-gated similar-issue search ([#1473](https://github.com/santifer/career-ops/issues/1473)) ([e13a4f3](https://github.com/santifer/career-ops/commit/e13a4f37d6df9d21c0acca1d1716993df036e01d))
* **web:** empty-state free-scan button (P0.1) ([#1534](https://github.com/santifer/career-ops/issues/1534)) ([28f12e3](https://github.com/santifer/career-ops/commit/28f12e39e3e41104bb7a1f3650a0a508701f82fe))
* **web:** extract cleanChips to a tested module + tab/CR paste delimiter ([#1516](https://github.com/santifer/career-ops/issues/1516)) ([7e676f4](https://github.com/santifer/career-ops/commit/7e676f403e16c84231bb08669c79218615a88c83))
* **web:** inbox triage — Abundance → Triage → Shortlist → Opt-in Score ([#1569](https://github.com/santifer/career-ops/issues/1569)) ([f1e6cc0](https://github.com/santifer/career-ops/commit/f1e6cc0ef2dae1f134e9d6bbb152611107a36308))
* **web:** mobile tap-targets ≥44px + FAB clearance ([#1542](https://github.com/santifer/career-ops/issues/1542)) ([7f6fd1c](https://github.com/santifer/career-ops/commit/7f6fd1c8f34fd0137a995bd2bb4b1f295c8a9303))
* **web:** orange hierarchy — brand-soft Mark-applied + inbox cost legend (P1.4) ([#1537](https://github.com/santifer/career-ops/issues/1537)) ([85d8290](https://github.com/santifer/career-ops/commit/85d829018c7b7225a1bbd547c53b817fd165924d))
* **web:** report progressive disclosure (P0.3+P1.8) ([#1535](https://github.com/santifer/career-ops/issues/1535)) ([30fa1d1](https://github.com/santifer/career-ops/commit/30fa1d19d00bf9a269adcef6778c52a1627d668c))
* **web:** richer bug-report diagnostics — data-shape fingerprint, core version, API errors ([#1469](https://github.com/santifer/career-ops/issues/1469)) ([6a13d8a](https://github.com/santifer/career-ops/commit/6a13d8a7a5448c5f488cac1631a1da471c070335))


### Bug Fixes

* correctness sweep across tracker, providers, and eval reporting ([#1528](https://github.com/santifer/career-ops/issues/1528)) ([bd2a44f](https://github.com/santifer/career-ops/commit/bd2a44f4ee1ea6c6def70200d7750969e67ebadf)), closes [#1527](https://github.com/santifer/career-ops/issues/1527)
* **web:** bump FOLLOW-UPS DUE tap-targets to 44px on mobile ([#1568](https://github.com/santifer/career-ops/issues/1568)) ([f5e8362](https://github.com/santifer/career-ops/commit/f5e836268c8a16707566becb51675d0b52a670dd))
* **web:** pin turbopack.root to prevent Windows postcss OOM ([#1530](https://github.com/santifer/career-ops/issues/1530)) ([8560153](https://github.com/santifer/career-ops/commit/8560153ad8aa37a3993418d32f951f25c868c6c4))
* **web:** point the 'Get one free' link at the free-AI-engine guide ([#1540](https://github.com/santifer/career-ops/issues/1540)) ([8369b40](https://github.com/santifer/career-ops/commit/8369b4001ba63be78818240b9dbc3aa94aebe2e8))
* **web:** restore the report-a-bug kit lost between the RC branch and main ([#1456](https://github.com/santifer/career-ops/issues/1456)) ([b11231f](https://github.com/santifer/career-ops/commit/b11231ffc77dfbd36b745b35df0b6ded3bb73720))
