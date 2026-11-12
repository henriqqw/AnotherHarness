# 终端

[English](terminal.md) | 中文

右侧边栏的终端面板为你运行 Shell，也会显示 Agent（智能体）正在使用的 Shell。

## 选择终端配置

打开终端面板，点击**新建终端**旁的箭头选择配置。AH 会探测运行此对话的机器上的 Shell：

- 在 Windows 上：命令提示符、PowerShell、Windows PowerShell、Git Bash，以及每个 WSL 发行版（例如 Ubuntu 或 Debian）一个配置。
- 在 Linux 和 macOS 上：`/etc/shells` 中的 bash、zsh、fish 和 PowerShell。
- 在 WSL 中：还会提供 Windows PowerShell 和命令提示符，它们会在转换为 Windows 路径的当前文件夹中启动。

此浏览器会记住你上次的选择。选择**将 <配置> 设为默认**后，在任何浏览器中使用普通的**新建终端**操作都会打开该配置。部署方可以在[终端控制器](../../../packages/api/terminal-controller/README.zh.md)的 `profiles` 设置中添加自己的配置，包括参数和环境变量。

## 查看 Agent 运行的命令

Agent 运行命令时，对话中该命令的卡片会实时显示最新的输出行。命令结束后，卡片会显示完整输出。

## 查看和接管 Agent 终端

在多条命令之间保持 Shell 打开的 Agent 会使用 Agent 终端。打开终端面板，点击 **Agent 终端**旁的箭头打开其中一个：它会实时显示该 Shell，并且为只读。

选择**接管**即可在其中输入。你掌握键盘期间，Agent 无法向该 Shell 发送命令，并会被告知由你控制。选择**交还**即可把控制权还给 Agent。关闭标签页只会停止查看，Agent 的 Shell 会继续运行。
