
## 1. 首屏时间如何确定？
- 有图片时（首屏时间 = 首屏内的图片时间 - NavigationStart）
- 无图片时（首屏时间 = 最后DOM更新时间 - NavigationStart）

## 2. 如何确定首屏内有没有图片，怎么确定，何时确定？
### [M] 页面加载分为：
- 1. 加载HTML|CSS|JS等资源 
- 2. 执行JS拉取页面数据
- 3. 更新页面节点&&刷新页面

### [M] 检查时机在于：
- 页面请求发出，数据已返回后

### [M] 多个请求如何计算，请求的串联&&并联问题：
- 1. 第一个请求发起时，监控此后 1s 内的请求
- 2. 在一个请求收到回包后，监控 0.5s 内发出的新请求
- 3. 收到上述请求（时间T1）后，给 0.3s 的渲染事件，即 T1 + 0.3s（T2)认为首屏页面处于稳定状态

### [E] 监听哪些类型？
- XHR
- Fetch
- Jsonp

### [E] 关于请求如何监听？
- 1. 代理XhrOpen、XhrSend、ReadyStateChange
- 2. 重写Fetch
- 3. 扫描Script标签并确定何时load

## 3. 如何确定首屏内有没有图片，怎么确定，何时确定？
遍历节点树，检测一下内容：
- Img标签且src符合要求的
- 节点computedStyle中background-image符合要求的

## 4. DOM节点变更结束时间？
- MutationObserver（T2后停止）
- performance.timing.domContentLoadedEventStart

## 5. 计算首屏以内的图片有哪些？
- T2后扫描节点时计算图片位置getBoundingClientRect + scrollTop
- 去重后记录

## 6. 如何确定这些图片加载完成？
- setInterval + performance.getEntries()
- Entries记录了图片相关的加载信息


关于首屏时间的解释：
https://github.com/hoperyy/blog/issues/102

关于Performance、TTFB：
https://juejin.im/post/5d8cc378f265da5ba0776f36

FP、FCP、FMP：
https://juejin.im/post/5bee7dd4e51d451f5b54cbb4


