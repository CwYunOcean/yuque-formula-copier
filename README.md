# 复制公式到语雀

从知乎等网页复制带公式的文字，粘贴到语雀后直接得到**可编辑的公式**。独占一行的公式自动居中，正文里的公式保持行内。

**[安装脚本](https://raw.githubusercontent.com/CwYunOcean/yuque-formula-copier/main/FormulaCopier.user.js)** · [反馈问题](https://github.com/CwYunOcean/yuque-formula-copier/issues) · [MIT 许可证](LICENSE)

## 三步使用

1. 在 Edge 或 Chrome 安装并启用 [Tampermonkey（油猴）](https://www.tampermonkey.net/)。若扩展提示需要“允许用户脚本”，按提示开启。
2. 点击上面的**安装脚本**，在油猴页面确认安装。如果已安装原版 FormulaCopier，选择更新；列表中只保留一份启用的 FormulaCopier。
3. 打开来源网页，选中包含已渲染公式的文字，按 **Ctrl+C**，再到语雀文档正文按 **Ctrl+V**。

更新脚本后，关闭原来源标签页再重新打开，让新脚本生效。

## 复制后是什么样

正文里的 $A_i$ 保持行内。下面这样独占一行的目标函数会居中显示：

$$L=-\sum_{i=1}^{N} A_i\log\pi_\theta(a_i\mid s_i)$$

- 可以点击语雀中的公式继续编辑 LaTeX 源码。
- 粘贴到纯文本编辑器时，仍是原来的 `$...$` LaTeX 文本。
- 保留文字、换行和公式；图片、表格布局和标题样式不在复制范围内。

## 支持的来源

知乎、知乎专栏、Wikipedia、OpenReview、ChatGPT。

已验证 **Edge：知乎 → 语雀**的自动转换与独立公式居中。居中的判断依据是来源内容的段落和换行：一行仅有一个公式时居中，两侧空格不影响判断；带正文、编号或多个公式的行保持原有行内布局。

## 遇到问题

**粘贴后仍是 `$...$` 文本：**使用普通 Ctrl+V，不要用 Ctrl+Shift+V 或“粘贴为纯文本”。确认油猴脚本已启用，并从来源网页重新复制。

**独立公式没有居中：**确认只启用一份 FormulaCopier，更新后重新打开来源网页。已有的语雀内容需要重新复制、粘贴才会应用新格式。

需要进一步排查时，下载并在本地浏览器打开 [tools/clipboard-check.html](tools/clipboard-check.html)，把原文粘贴进去，再将生成的报告发到 Issue。报告仅含剪贴板格式和计数，便于区分复制输出与语雀粘贴的问题。提交时附上浏览器版本、来源网址和实际表现。

## 开发与测试

一份用户脚本，没有运行依赖或构建步骤。安装 Node.js 18 或以上后，在仓库目录运行：

```sh
node --check FormulaCopier.user.js
node tests/copy.test.cjs
```

测试覆盖四种公式提取方式、LaTeX 保留、HTML/Lake 编码、独立公式居中、行内公式、换行和检查报告。测试使用小型 DOM 替身；涉及网站编辑器的修改，还需在浏览器里实际复制、粘贴并确认公式可编辑。

脚本同时写入 `text/plain`、`text/html` 和语雀读取的 `text/lake`。语雀的公式标记和对齐属性属于编辑器实现；网站更新后若不兼容，请提交 Issue。

## 致谢

基于 [Yuhang Chen 的 FormulaCopier](https://github.com/yuhangchen0/FormulaCopier)，保留原版公式提取与高亮功能，以及 Yuhang Chen、Dramwig 的署名。此版本增加语雀可编辑公式输出、独立公式居中和换行修复。

使用 MIT 许可证，保留原项目版权声明。
