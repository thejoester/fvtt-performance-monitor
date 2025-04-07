# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-04-07
### Fixed
- Fixed JS Heap display

## [0.1.3] - 2025-04-06
### Added
- Compendium with macro

## [0.1.2] - 2025-04-06
### Added
- Real-time tracking of performance data with optional 5-minute intervals.
- Export to JSON feature for report snapshots.
- DOM node count threshold warnings.
- Canvas redraw time tracking (disabled while tracking is active).
- Visual highlights (orange/red) based on performance thresholds.
- JS Heap memory usage display (used / total).
- Display of module count as "enabled / total".
- Active Scene Tokens/Actors count combined into one line.
- Multi-column UI layout for clearer data separation in the dialog.

### Changed
- Refactored to use `DialogV2` instead of older dialog API.
- Moved buttons back to bottom of dialog for layout consistency.
- Reduced default dialog width to improve readability.
- Grouped performance metrics into logical columns (Scene vs System).

## [0.1.1] - 2025-04-04
### Fixed
- DialogV2 rendering and button logic.
- JS heap memory display error due to browser restrictions.
- Layout overflow issues.

## [0.1.0] - 2025-04-03
### Added
- Initial implementation of Performance Monitor dialog.
- Snapshot of basic game metrics: actors, items, scenes, journals.

