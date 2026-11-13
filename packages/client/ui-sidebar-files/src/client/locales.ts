/**
 * `sidebarFiles` namespace dictionaries, and the namespace's declaration.
 *
 * The failure lines name what the tree could not list, one code each, because a
 * directory that is gone, one outside the workspace, and a path that is not a
 * directory each suggest a different next step.
 *
 * The namespace merge lives with its key set so that any module naming
 * `TranslateNS<'sidebarFiles'>` or `PropsLocale<'sidebarFiles'>` needs only this
 * file, whichever entry a program loads first.
 */
import type {} from '@anotherharness/ah-client-ui-slots'

declare module '@anotherharness/ah-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** File-tree type name, guide entry, row states, and failure lines. */
    sidebarFiles: SidebarFilesKey
  }
}

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  'shortcut.noSession': '请先选择会话',
  'type.label': '文件',
  'guide.title': '工作区文件',
  'guide.description': '浏览会话工作区的文件',
  loading: '正在读取…',
  empty: '空目录',
  truncated: '条目太多，只显示了一部分。',
  noWorkspace: '这个会话没有工作区目录。',
  reload: '重新读取',
  autoRefresh: '自动刷新',
  'autoRefresh.enable': '开启自动刷新',
  'autoRefresh.disable': '关闭自动刷新',
  'entry.other': '这不是文件或目录，没法打开。',
  'error.notFound': '这个目录不在了。可能已被移动或删除。',
  'error.outsideWorkspace': '这个目录在工作区之外，侧栏不会读取它。',
  'error.notDirectory': '这不是一个目录。',
  'error.unavailable': '读取失败：{message}',
  'action.newFile': '新建文件',
  'action.newFolder': '新建文件夹',
  'action.rename': '重命名',
  'action.delete': '删除',
  'action.renameKey': 'F2',
  'action.deleteKey': 'Del',
  'action.reveal': '显示文件位置',
  'changes.toggle': '已更改的文件',
  'changes.empty': '没有更改',
  'changes.noRepository': '此工作区不是 git 仓库。',
  'git.modified': '已修改',
  'git.added': '已添加',
  'git.deleted': '已删除',
  'git.untracked': '未跟踪',
  'git.conflicted': '冲突',
  'dialog.create-file.title': '新建文件',
  'dialog.create-folder.title': '新建文件夹',
  'dialog.rename.title': '重命名',
  'dialog.delete.title': '删除',
  'dialog.delete.file': '删除“{name}”？此操作无法撤销。',
  'dialog.delete.folder': '删除文件夹“{name}”及其中的所有内容？此操作无法撤销。',
  'dialog.name': '名称',
  'dialog.filePlaceholder': '文件名，例如 src/index.ts',
  'dialog.folderPlaceholder': '文件夹名',
  'dialog.create': '创建',
  'dialog.cancel': '取消',
  'dialog.invalidName': '请输入有效的名称（不能为空，不能包含 ..、反斜杠或开头/结尾的 /）。',
  'dialog.exists': '这个名称已被占用。',
} satisfies Record<string, string>

/** Files dictionary key union. */
export type SidebarFilesKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  'shortcut.noSession': 'Select a session first',
  'type.label': 'Files',
  'guide.title': 'Workspace files',
  'guide.description': 'Browse files in this session\'s workspace',
  loading: 'Reading…',
  empty: 'Empty directory',
  truncated: 'Too many entries, showing only some of them.',
  noWorkspace: 'This session has no workspace directory.',
  reload: 'Reload',
  autoRefresh: 'Auto refresh',
  'autoRefresh.enable': 'Enable auto refresh',
  'autoRefresh.disable': 'Disable auto refresh',
  'entry.other': 'Not a file or a directory, so it cannot be opened.',
  'error.notFound': 'That directory is gone. It may have been moved or deleted.',
  'error.outsideWorkspace': 'That directory is outside the workspace, so the sidebar will not read it.',
  'error.notDirectory': 'That is not a directory.',
  'error.unavailable': 'Read failed: {message}',
  'action.newFile': 'New File',
  'action.newFolder': 'New Folder',
  'action.rename': 'Rename',
  'action.delete': 'Delete',
  'action.renameKey': 'F2',
  'action.deleteKey': 'Del',
  'action.reveal': 'Show file location',
  'changes.toggle': 'Changed files',
  'changes.empty': 'No changes',
  'changes.noRepository': 'This workspace is not a git repository.',
  'git.modified': 'Modified',
  'git.added': 'Added',
  'git.deleted': 'Deleted',
  'git.untracked': 'Untracked',
  'git.conflicted': 'Conflict',
  'dialog.create-file.title': 'New file',
  'dialog.create-folder.title': 'New folder',
  'dialog.rename.title': 'Rename',
  'dialog.delete.title': 'Delete',
  'dialog.delete.file': 'Delete "{name}"? This cannot be undone.',
  'dialog.delete.folder': 'Delete the folder "{name}" and everything in it? This cannot be undone.',
  'dialog.name': 'Name',
  'dialog.filePlaceholder': 'File name, for example src/index.ts',
  'dialog.folderPlaceholder': 'Folder name',
  'dialog.create': 'Create',
  'dialog.cancel': 'Cancel',
  'dialog.invalidName': 'Enter a valid name: not empty, without .., backslashes, or a leading or trailing /.',
  'dialog.exists': 'That name is already taken.',
} satisfies Record<SidebarFilesKey, string>
