# Terminals

English | [中文](terminal.zh.md)

The Terminal panel in the right sidebar runs shells for you and shows the shells agents use.

## Choose a terminal profile

Open the Terminal panel and use the arrow next to **New terminal** to pick a profile. AH detects the shells of the machine running the conversation:

- On Windows: Command Prompt, PowerShell, Windows PowerShell, Git Bash, and one profile per WSL distribution, such as Ubuntu or Debian.
- On Linux and macOS: bash, zsh, fish, and PowerShell from `/etc/shells`.
- Inside WSL: also Windows PowerShell and Command Prompt, which start in the current folder translated to a Windows path.

Your last choice is remembered in this browser. Choose **Make <profile> the default** to open that profile from the plain **New terminal** action in every browser. Deployments can add their own profiles, with arguments and environment variables, in the `profiles` setting of the [terminal controller](../../../packages/api/terminal-controller/README.md).

## Watch agent commands

While an agent runs a command, its card in the conversation shows the latest output lines as they arrive. The full output appears in the card when the command finishes.

## Watch and take over agent terminals

Agents that keep a shell open between commands use agent terminals. Open the Terminal panel and use the arrow next to **Agent terminals** to open one: it shows the shell live and is read-only.

Choose **Take over** to type in it. While you hold the keyboard the agent cannot send commands to that shell; it is told that you are in control. Choose **Give back** to return control to the agent. Closing the tab stops watching and leaves the agent's shell running.
