# Edit code

English | [中文](edit-code.zh.md)

Workspace files open in the right sidebar as a read-only preview. Pick **Editor** from the preview's viewer menu to open the code editor.

## Open and edit a file

Open a file from the Files panel or from a link in the conversation, then pick **Editor** from the viewer menu at the top of the preview; files no other viewer handles, such as `.gitignore`, open in the editor directly. Choose **Edit** to type, then **Save** or Ctrl/Cmd+S. A dot marks unsaved changes; **Discard changes** goes back to the file on disk.

The editor uses VS Code key bindings: Alt+Click and Ctrl/Cmd+D for more cursors, Alt+Up/Down to move lines, Ctrl/Cmd+/ to comment, Ctrl/Cmd+F and Ctrl/Cmd+H to search and replace, and Ctrl+G to go to a line. Suggestions come from words in the file. The status bar shows the cursor position and lets you change the language, indentation, and line endings.

Each open file is a tab. Use the sidebar's fullscreen control for a full editor area, and Ctrl/Cmd+Alt+S to save every changed file. Closing a tab with unsaved changes asks whether to save first.

## When the file changes on disk

If the agent or another browser changes the file while you have unsaved changes, a banner keeps your draft and offers **Reload** (take the disk version), **Compare** (see both side by side), and **Overwrite** (save over the disk version after confirming). Without unsaved changes, the editor reloads quietly. After you save, an agent that edits the same file is told it changed and reads your version first.

Only UTF-8 text files inside the workspace, up to the editable size cap (1 MiB by default), can be edited.

## Manage files

In the Files panel, right-click a file or folder, or use the buttons in its header, for **New File**, **New Folder**, **Rename** (F2), and **Delete**. Delete always asks first and names the item; deleting a folder removes everything in it. Open tabs follow a renamed file.

## Navigate code

When a language server is configured for the file type, hover a symbol to see its type and documentation, press F12 or Ctrl/Cmd+Click to go to its definition, and press Shift+F12 to list its references. Without a language server these actions do nothing.
