# I Thought I Knew You

This is a static React game for GitHub Pages. The game follows four evenings in
which the player investigates videos, photos, social accounts, voice messages,
and conversations involving Nicole.

The project was extracted from `V8.html` and intentionally keeps the original
game behavior. `V8.html` is the reference/export file and must not be edited as
part of normal development.

## Agent Quick Start

When modifying this project:

1. Read this file first.
2. Identify whether the request changes content, game behavior, rendering, CSS,
   or assets.
3. Edit the smallest relevant source files.
4. Preserve existing IDs, state keys, asset paths, and template bindings unless
   the change explicitly requires them to change.
5. Run JavaScript syntax checks and verify the affected data paths.
6. Do not edit `V8.html`, React vendor files, or the generated runtime for a
   normal feature change.

## Source Of Truth

Use these organized files as the editable source:

- `content/`: story, dialogue, choices, and game content
- `src/game/methods/`: game behavior grouped by responsibility
- `src/game/game-logic.js`: state fields and the runtime adapter
- `src/template/app-template.html`: screen markup and template bindings
- `styles/`: design-system and game CSS
- `assets/`: media, fonts, and local React vendor files

Treat these as infrastructure or reference files:

- `V8.html`: unchanged reference/export artifact
- `src/runtime/dc-runtime.js`: generated template runtime
- `assets/vendor/`: bundled React and ReactDOM files

## Runtime Flow

The app does not use Vite or a package build step.

1. `index.html` loads local React and ReactDOM.
2. The game method files populate `window.GameMethods`.
3. `src/data/load-game-data.js` fetches the JSON files and creates
   `window.GameData`.
4. `index.html` fetches `src/template/app-template.html` and
   `src/game/game-logic.js`.
5. `src/runtime/dc-runtime.js` parses the custom template and connects it to
   React.
6. `game-logic.js` creates `Component` and merges `window.GameMethods` onto its
   prototype.

All method files must be loaded by `index.html` before the runtime is loaded.

## Content Editing

Content editors should normally work only in `content/`.

### Conversation Files

- `content/conversations/intro.json`: backstory, opening group chat, DM history,
  and recording prompts
- `content/conversations/day-1.json`: Monday video scenario
- `content/conversations/day-2.json`: Tuesday photo scenario
- `content/conversations/day-3.json`: Wednesday account scenario
- `content/conversations/day-4.json`: Thursday voice scenario
- `content/conversations/day-you.json`: later clip involving the player
- `content/conversations/dm-options.json`: Nicole private-message choices
- `content/chat_context.md`: day-specific context for typed chat replies

A normal message looks like this:

```json
{
  "who": "Hanna",
  "text": "Message text goes here"
}
```

Common optional message fields:

- `mine`: `true` when the message is from the player
- `kind`: `voice`, `video`, `photo`, or `shot`
- `caption`: media description shown in the conversation
- `dur`: duration text for a voice message
- `slow`: pauses the scripted introduction
- `stop`: pauses the scripted introduction before recording
- `old`: marks an older DM-history message
- `today`: assigned by game logic for current-day messages

Keep `{name}` in text when the player's chosen name should be inserted.

### Day Files

Each day file contains the scenario and investigation checks:

- `dayName`, `start`, and `feeling`: day presentation data
- `threadSub`: group-chat subtitle
- `deskLabel`, `deskTitle`, and `url`: evidence display data
- `name`, `truth`, `tell`, `fake`, and `volunteer`: scenario outcome data
- `chat`: messages added to the group chat
- `dm`: messages added to Nicole's DM thread
- `checks`: available investigation actions

Each check has a stable `id`, `where`, `cost`, `label`, `effect`, and `result`.
Do not rename an existing check ID because game state and variants refer to it.

### DM Choices

Each entry in `dm-options.json` contains:

- `label`: button text shown to the player
- `say`: message sent by the player
- `reply`: response from Nicole
- `sam`: friendship change
- `reason`: explanation shown after the action
- `clip`: whether the option depends on the clip situation
- `needs`: minimum required investigation progress, when applicable

### Rules

- `content/rules/pushback.json`: group reactions when the player challenges the
  group
- `content/rules/variants.json`: alternate scenario outcomes keyed by day and
  variant number

Rules contain keys used by game logic. Change wording freely, but preserve the
object structure and IDs unless also updating the corresponding method.

## Game Logic

`src/game/game-logic.js` contains the state shape and content references. It is
intentionally small. Behavior is split into these files:

- `methods/core.js`: day lookup, formatting, avatars, relationship tiers, and
  selectors
- `methods/chat-llm.js`: local chat model loading, prompts, typed replies, and
  fallbacks
- `methods/actions.js`: player actions, investigation checks, time, and scoring
- `methods/days.js`: day transitions and day cards
- `methods/intro.js`: name entry and introduction flow
- `methods/relationships.js`: friendship, group standing, and reports
- `methods/audio.js`: microphone recording and playback
- `methods/ending.js`: ending screens and final summaries
- `methods/lifecycle.js`: mount, unmount, scrolling, and keyboard shortcuts
- `methods/render.js`: values passed from game state into the template

Methods are regular object methods that use `this`. They are merged onto the
component prototype in `game-logic.js`. When adding a method, put it in the
appropriate file and ensure that file is loaded in `index.html` before the
runtime script.

If a new template binding is added, add the matching value or handler to
`methods/render.js`. A template binding does not work automatically just because
the method exists.

## Template Syntax

`src/template/app-template.html` uses the existing DC template syntax rather
than normal JSX.

Examples:

```html
<sc-if value="{{ isTitle }}">
  ...
</sc-if>

<sc-for list="{{ messages }}" as="message">
  {{ message.text }}
</sc-for>

<button sc-camel-on-click="{{ start }}">Start</button>
```

Use these conventions when editing the current template:

- `{{ value }}` reads a value from `renderVals()`.
- `sc-camel-on-click` connects a click handler.
- `sc-camel-on-change` and `sc-camel-on-key-down` connect input handlers.
- `sc-if` conditionally renders content.
- `sc-for` renders a list.
- `ref="{{ refName }}"` connects a React ref.

Do not edit `src/runtime/dc-runtime.js` to add a screen or fix a game feature.
Convert the template to native JSX only as a deliberate, separate migration.

## Styling

- `styles/design-system.css`: tokens and reusable design-system classes
- `styles/game.css`: game-specific resets and animations
- Inline styles in the template are still part of the current visual system.

Preserve the existing visual language unless the design request explicitly asks
for a redesign. Keep the phone layout usable on narrow screens.

## Assets

Use relative paths because the GitHub Pages site may be hosted below a repository
path, for example `/I-thought-I-knew-you/`.

Use paths such as:

```text
assets/nicole-party.jpg
assets/av-nicole.png
```

Do not use root-relative paths such as `/assets/nicole-party.jpg`. GitHub Pages
paths are case-sensitive, so filename casing must match exactly.

When adding an asset:

1. Put it in the correct `assets/` subfolder.
2. Reference it with a relative path in the template or method.
3. Check that the file is served successfully from the repository URL.

## Local Preview

The app fetches template, logic, and JSON files. Do not open `index.html`
directly with `file://`.

From the workspace root, run:

```text
python -m http.server 8000
```

Open:

```text
http://localhost:8000/I-thought-I-knew-you/
```

## Verification

There is no package manager or test runner currently configured. At minimum,
after changing JavaScript, run:

```text
node --check src/data/load-game-data.js
node --check src/game/game-logic.js
node --check src/game/methods/core.js
node --check src/game/methods/actions.js
node --check src/game/methods/days.js
node --check src/game/methods/intro.js
node --check src/game/methods/relationships.js
node --check src/game/methods/audio.js
node --check src/game/methods/ending.js
node --check src/game/methods/lifecycle.js
node --check src/game/methods/render.js
```

When changing JSON, validate that every affected file is valid JSON and that
all referenced IDs still exist. Then manually verify the affected game path:

- title and name entry
- introduction chat
- each affected day
- group chat and Nicole DM choices
- investigation checks
- gallery, fact checker, and social screens
- ending and replay flow

Check the browser console for failed fetches, missing assets, template errors,
and runtime errors.
