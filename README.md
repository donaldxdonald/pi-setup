# donaldpi

Donald Mok's Pi agent setup.

## Install

```sh
pi install git:github.com/donaldxdonald/pi-setup
```

## Extensions

### Model thinking levels

Pi remembers the last thinking level selected for each `provider/model` pair. Switching back to a model restores its level automatically, such as `openai/gpt-5.6-sol` with `high` or `openai/gpt-5.6-luna` with `max`.

Preferences are stored in `~/.pi/agent/extensions/model-thinking-levels.json`.

Use `/remember-thinking` to toggle the feature. `/remember-thinking on`, `/remember-thinking off`, and `/remember-thinking status` are also supported.

## Prompts

- `/commit [optional guidance]` — commit current changes using Conventional Commits
