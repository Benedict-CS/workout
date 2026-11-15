---
description: Automatically ensures Git authorization and ownership checks pass when working across different computers from a portable USB drive.
globs: ["*"]
---

# Portable USB Git & Auto-Deployment Rule

When executing `git commit` or `git push` in this workspace:
1. If Git reports "dubious ownership in repository" or authentication errors on a new machine:
   - Run `cmd.exe /c F:\init-env.bat` (or execute the configuration commands reading `F:\.env.tokens`).
   - This globally configures:
     - `git config --global --add safe.directory "*"`
     - `git config --global user.name "Benedict-CS"`
     - `git config --global user.email "Benedict-CS@users.noreply.github.com"`
     - `git config --global url."https://<TOKEN>@github.com/".insteadOf "https://github.com/"`
2. Every `git push origin master` automatically triggers Vercel production deployment via GitHub webhook without requiring Vercel CLI login.
