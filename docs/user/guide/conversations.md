# Manage conversations

English | [中文](conversations.zh.md)

Each message and each completed turn has actions under it, and each conversation in the sidebar has a menu. Edit, rewind, and fork never rewrite a conversation: they create a new one, so earlier history stays readable.

## Copy a message

Click the copy icon under a user message or an assistant reply. User messages copy their text; assistant replies copy their Markdown.

## Fork from a turn

Click the branch icon at the end of any completed turn that has a reply. A new conversation opens with the history up to that turn. The original conversation stays unchanged and visible.

## Rewind to a turn

Click the rewind icon at the end of a completed turn. A new conversation opens with the history up to that turn, and the original is archived. To get the original back, choose **All conversations (show archived)** in the sidebar filter and restore it.

Rewinding does not undo file changes the agent made after that turn.

## Edit a sent message

Click the edit icon under one of your messages, change the text, and press **Enter** or **Send**. **Shift+Enter** adds a line, and **Escape** cancels. The edited message continues in a new conversation that holds the history before it, and the original is archived. Editing the first message starts a new conversation in the same workspace.

Messages with attachments cannot be edited yet; send a new message instead.

## Delete a conversation

Open the conversation's menu in the sidebar and choose **Delete session**. The dialog names the conversation; confirming removes its history from this machine and cannot be undone. A conversation that is still running, or that has background work, must be stopped first. To hide a conversation without losing it, archive it instead.

Deleting a conversation keeps conversations forked from it, and it keeps attachment files that other conversations may share.
