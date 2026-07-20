---
description: Commit current changes with a Conventional Commit message
argument-hint: "[optional guidance]"
---
Commit the current changes using Conventional Commits.

Guidance: ${ARGUMENTS:-Infer the message from the changes.}

1. Review `git status`, staged changes, unstaged changes, and relevant untracked files.
2. Run the appropriate checks for the changed files when practical.
3. Choose a concise message in this format:

   ```text
   <type>(<optional-scope>): <description>
   ```

   Use the most accurate type, such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, or `chore`. Use imperative mood and no trailing period.
4. Stage only related files and commit them.
5. Do not include secrets, bypass hooks, amend commits, or push.
6. Report the commit hash, message, checks run, and anything left uncommitted.

If the changes are unrelated or unsafe to commit together, explain the issue instead of committing.
