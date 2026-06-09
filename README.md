# RCDD Quiz Bank

A progressive web app (PWA) for BICSI RCDD exam preparation.

**Live app:** https://probablyahuman24.github.io/Quiz/

---

## Features

- **745 questions** across all 22 BICSI RCDD chapters
- **Per-question explanations** — why the correct answer is right and why each wrong option is wrong
- **Cloud sync** — progress saved to Firestore; pick up where you left off on any device
- **Offline-capable** — service worker caches the app shell and question files for use without internet
- **Dark mode** — toggle between light and dark themes, persisted across sessions
- **Confidence tagging** — mark each question as Sure / Unsure / Guessing before answering; tracks "Danger Gaps" (sure but wrong)
- **Custom Quiz builder** — filter by wrong answers, starred questions, unsure/guessing tags, or "sure but wrong"; choose 10 / 25 / 50 / all questions
- **Focus Session** — auto-drills your weakest chapters once all 22 tests are complete
- **Wrong Answer Review** — replay every question you've ever missed, sorted by miss count
- **Spaced repetition** — questions answered incorrectly float to the top on reshuffle
- **Star questions** — bookmark any question for later review
- **Per-test reset** — reset a single chapter without touching any other progress
- **Progress tracking** — completion bar, per-chapter score breakdown, session history

---

## Question bank

| Chapter | Topic | Questions |
|---------|-------|-----------|
| 1 | Principles of Transmission | 45 |
| 2 | Electromagnetic Compatibility | 35 |
| 3 | Network Design | 35 |
| 4 | Telecommunications Spaces | 45 |
| 5 | Backbone Distribution Systems | 45 |
| 6 | Horizontal Distribution Systems | 45 |
| 7 | ICT Cables and Connecting Hardware | 35 |
| 8 | Fire Protection and Firestopping | 35 |
| 9 | Telecommunications Grounding and Bonding | 35 |
| 10 | Power Distribution | 30 |
| 11 | Telecommunications Administration | 30 |
| 12 | Field Testing Structured Cabling | 30 |
| 13 | Outside Plant (OSP) | 35 |
| 14 | Audiovisual Systems | 25 |
| 15 | Intelligent Building Systems | 30 |
| 16 | Wireless Networks | 35 |
| 17 | Electronic Access Control | 25 |
| 18 | Data Centers | 25 |
| 19 | Health Care | 25 |
| 20 | Residential Cabling Systems | 30 |
| 21 | Project Administration | 45 |
| 22 | Special Design Considerations | 25 |

---

## Tech stack

- React 18 (UMD CDN, no build step)
- Firebase Firestore (cloud progress sync)
- Service Worker (PWA / offline caching)
- Vanilla JS — no bundler, no dependencies beyond React and Firebase

## Install as app (iOS / Android)

1. Open the link in Safari (iOS) or Chrome (Android)
2. Tap **Share → Add to Home Screen**
3. The app installs as a full-screen PWA and works offline
