# ClickUp Client Write Project Plan

Last updated: 2026-03-10

## Goal

Track the deferred mutation project separately from the read-only client. This project starts only after the read-only contract cleanup and read UX work are complete.

## Summary

This project owns all ClickUp mutation behavior that was previously mixed into the main plan:

- safe write adapters
- write-path verification
- write-mode product concepts
- daily status updates
- planning inline edits

The production list must remain protected. Real writes should first target a dedicated allowlisted ClickUp test workspace/list.

## Planned scope

- mutation adapter with:
  - `mock`
  - `test-space`
  - future gated `live`
- safe allowlisting for test workspace/list IDs
- guarded status updates for the daily board
- guarded custom-field updates for planning fields:
  - `Prio score`
  - assignee
  - `Planning bucket`
- write-mode UI and verification messaging
- mutation revalidation behavior and optimistic updates where appropriate

## Dependencies

- the read-only project removes `writeMode` from the current read contract and read UI
- the read-only project finishes daily read filters/totals and the visual refresh
- the backend read flows, logging, and rate-limit handling remain stable

## Safety rules

- do not write to the production list during development or automated testing
- start with `mock`
- only then add `test-space`
- keep `live` blocked until explicit verification gates exist
