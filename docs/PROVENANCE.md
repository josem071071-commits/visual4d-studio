# Visual 4D Studio — Development Provenance Record

## Purpose

This record documents the provenance and human direction of Visual 4D Studio. It is intended to preserve a contemporaneous development history and to distinguish original project decisions from third-party materials and AI-assisted implementation.

## Human-directed creation

Project creator and director: José Guerrero.

Human-directed areas include, among others:

- conception and purpose of Visual 4D Studio;
- definition and evolution of the Visual 4D method and gated workflow;
- project requirements and acceptance criteria;
- decisions about architecture, security, approvals, provenance, persistence, layout, rendering, and user experience;
- selection, rejection, correction, and approval of implementation proposals;
- definition of sprint objectives and closure criteria;
- review of visual and functional outputs.

## AI-assisted development

Artificial intelligence tools are used as assistants in portions of the development process, including code drafting, refactoring suggestions, documentation, test generation, debugging, research, and design exploration.

AI-produced material is treated as proposed implementation, not as an autonomous project decision. Material may be reviewed, selected, modified, rejected, tested, or replaced under human direction.

No statement in this record should be interpreted as claiming copyright protection over material that applicable law determines is not copyrightable or is owned by a third party.

## Technical chronology

The Git commit history, architecture records under `docs/architecture/`, CI workflow history, certification reports, tests, and versioned project artifacts form part of the technical chronology of the project.

Sprint 2.4 established an externally executed CI certification baseline for the secure core. Subsequent work builds on that certified baseline through separately documented sprints.

## Third-party separation

Third-party dependencies, protocols, standards, trademarks, source materials, user-provided assets, and other external works are not represented as original Visual 4D Studio authorship. See `THIRD_PARTY_NOTICES.md` and the exact dependency lockfile.

## Release provenance rule

Before a public or commercial release:

1. preserve the exact release commit and dependency lockfile;
2. retain CI/test evidence for that release;
3. generate and review a complete third-party license inventory;
4. identify externally sourced visual, textual, font, model, and data assets;
5. retain evidence of licenses, permissions, or provenance where required;
6. distinguish human-created, user-provided, third-party, and AI-assisted materials in internal records;
7. obtain appropriate legal review for the intended jurisdictions and distribution model.

## Notice

Copyright © 2026 José Guerrero. All rights reserved with respect to original protectable project materials, subject to applicable law and third-party rights.
