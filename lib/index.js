//#region lib/types/index.js
/**
* 模型选择分组插件，node 半边。纯 UI 插件：空的 apply 只为让本包出现在 host 的
* Loader 里；浏览器半边通过 exports["./client"] + package.json 的 dsh.client 声明发现。
*/
/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}
//#endregion
export { apply };
