# Editing Game Content

The JSON files in this folder are the content layer. They can be edited without
changing the React runtime or the game logic.

## Conversations

- `conversations/intro.json`: opening story, group chat, and recording prompts
- `conversations/day-1.json`: Monday video scenario
- `conversations/day-2.json`: Tuesday photo scenario
- `conversations/day-3.json`: Wednesday account scenario
- `conversations/day-4.json`: Thursday voice scenario
- `conversations/day-you.json`: the later clip involving the player
- `conversations/dm-options.json`: private-message choices and their effects

Typical chat messages use this shape:

```json
{
  "who": "Hanna",
  "text": "Message text goes here"
}
```

The `who` value must match the character name used by the game. Messages sent
by the player also use `"mine": true`. Keep the other optional fields when a
message is a voice note, video, screenshot, or timed message. Static voice notes
can use `"audioSrc"` with a relative path such as
`"assets/audios/example.wav"`.

The Day 3 cloned voice is generated at runtime by the local browser adapter.
Its source message uses `"audio": "clone"` and a `"ttsText"` value rather than
an asset path.

Day files also contain investigation checks. Each check has a stable `id`, a
player-facing `label`, a time `cost`, and a `result`. Keep IDs unchanged when
only editing wording.

## Choices

Each private-message choice has:

- `label`: text shown as the button
- `say`: message added to the conversation
- `reply`: character response
- `sam`: friendship change
- `reason`: explanation shown in the game

The `rules` folder contains game consequences rather than dialogue. Edit those
files carefully because their keys are used by the game logic.
