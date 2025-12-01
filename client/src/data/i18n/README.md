# Internationalization (i18n) Documentation

This directory contains all the text strings used in the game interface, organized by language.

## Structure

- `en.json` - English (base language)
- Future: `es.json`, `fr.json`, etc. - Translations for other languages

## Usage

All game UI texts are stored in these JSON files, organized by component/section:

- **gameOver**: Texts for the game over modal
- **roundSummary**: Texts for the round summary modal
- **colorPicker**: Texts for the color picker modal
- **menu**: Main menu texts
- **lobby**: Lobby screen texts
- **leaderboard**: Leaderboard screen texts
- **gameHud**: In-game HUD texts
- **playerSidebar**: Player sidebar menu texts
- **errors**: Error messages
- **defaults**: Default player names

## Adding a New Language

1. Copy `en.json` to a new file (e.g., `es.json` for Spanish)
2. Translate all the values while keeping the keys the same
3. Update the i18n system in the code to load the appropriate language file

## Placeholders

Some strings contain placeholders that will be replaced with actual values:
- `{round}` - Round number
- `{countdown}` - Countdown number
- `{error}` - Error message
- `{url}` - Server URL
- `{attempts}` - Number of attempts
- `{attempt}` - Current attempt number
- `{maxAttempts}` - Maximum attempts

Example: `"roundFinished": "Round {round} Finished"` becomes `"Round 3 Finished"`

## Notes

- The `curvePhrases.json` file is NOT included in this i18n system as it contains game-specific phrases that are separate from UI elements.
- All texts should be in English in the base file (`en.json`).
- When translating, maintain the same structure and keys.

