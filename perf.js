// 脚本开始运行的时间，用于各种 log 等
var win = window;
var doc = win.document;
var util = require('./util');

var acftGlobal = require('./global-info');

var globalIndex = 0;

function generateApi() {

    // [Notice] 管理上报所需的配置参数&&函数
    // global包含：
    // - defaultGlobal 
    // - privateGlobal
    // 所有变量和函数定义在闭包环境，为了支持同时手动上报和自动上报功能
    var _global = util.mergeGlobal(util.initGlobal(), {
        hasStableFound: false
    });

    _global.globalIndex = 'perf-' + globalIndex++;

    // [Notice] 记录节点变更时间 && start节点开始经过的时间
    util.watchDomUpdate(_global);

    function runOnPageStable() {
        // 标记稳定时刻已经找到
        if (_global.hasStableFound) {
            return;
        }

        util.stopWatchDomUpdate(_global);
        util.stopCatchingRequest(_global);
        util.stopWatchingError(_global);

        _global.hasStableFound = true;

        // 标记停止监听请求
        _global.stopCatchingRequest = true;

        // 记录稳定时刻
        _global.stableTime = util.getTime() - _global.forcedNavStartTimeStamp;

        // 获取当前时刻获取的首屏信息，并根据该信息获取首屏时间
        var stableObject = recordFirstScreenInfo();

        // 触发用户注册的回调
        _global.onStableStatusFound(stableObject);
    }

    function _report(resultObj) {
        var canReport = function() {
            // 如果退出上报，则直接返回
            if (_global.hasReported) {
                return false;
            }

            if (_global.abortReport) {
                return false;
            }

            return true;
        };

        // 为 resultObj 添加 _global.ignoredImages 字段
        resultObj.ignoredImages = _global.ignoredImages;
        resultObj.device = _global.device;
        resultObj.success = true;
        resultObj.tryReportTime = util.getTime() - _global.forcedNavStartTimeStamp;

        // 为 resultObj 添加 network 和 error message 信息
        resultObj.errorMessages = _global.errorMessages;
        resultObj.network = util.generateNetwork();

        if (_global.delayReport) {
            var timer = setTimeout(function() {
                if (canReport()) {
                    _global.hasReported = true;
                    resultObj.reportTime = util.getTime() - _global.forcedNavStartTimeStamp;
                    _global.onReport(resultObj); // 上报的内容是定时器之前的数据
                }
                
                clearTimeout(timer);
            }, _global.delayReport);
        } else {
            if (canReport()) {
                resultObj.reportTime = util.getTime() - _global.forcedNavStartTimeStamp;
                _global.onReport(resultObj);
            }
        }
    }
 
    // 重操作：记录运行该方法时刻的 dom 信息，主要是 images
    function recordFirstScreenInfo() {
        var startTime =  util.getTime();
        var firstScreenImages = _getImagesInFirstScreen();
        var endTime = util.getTime();
        var firstScreenImagesDetail = [];

        // 找到最后一个图片加载完成的时刻，作为首屏时刻
        // 最终呈现给用户的首屏信息对象
        var resultObj = {
            type: 'perf',
            isStaticPage: _global.isFirstRequestSent ? false : (/auto/.test(_global.reportDesc) ? true : 'unknown'),
            firstScreenImages: [],
            firstScreenImagesLength: 0,
            firstScreenImagesDetail: firstScreenImagesDetail,
            requests: util.transRequestDetails2Arr(_global),
            delayAll: endTime - startTime,
            delayFirstScreen: endTime - startTime,
            firstScreenTime: -1, // 需要被覆盖的
            firstScreenTimeStamp: -1, // 需要被覆盖的
            maxErrorTime: 0,
            navigationStartTimeStamp: _global.forcedNavStartTimeStamp,
            navigationStartTime: _global.forcedNavStartTimeStamp - _global._originalNavStart,
            isOriginalNavStart: _global.forcedNavStartTimeStamp === _global._originalNavStart,
            version: util.version,
            recordTime: util.getTime() - _global.forcedNavStartTimeStamp,
            reportDesc: _global.reportDesc,
            url: window.location.href.substring(0, 200),
            globalIndex: _global.globalIndex,
            domChangeList: _global.domChangeList,
            navigationTagChangeMap: acftGlobal.navigationTagChangeMap,
            reportTimeFrom: _global.reportTimeFrom,
            errorMessages: [], // 获取错误信息
            network: [], // 模拟 network
            stableTime: _global.stableTime
        };

        var processNoImages = function() {
            if (/^hand/.test(_global.reportDesc)) {
                resultObj.firstScreenTimeStamp = _global.handExcuteTime;
                resultObj.firstScreenTime = _global.handExcuteTime - _global._originalNavStart;
                resultObj.reportTimeFrom = 'perf-hand-from-force';
                _report(resultObj);
            } else {
                util.getDomReadyTime(_global, function (domReadyTimeStamp, reportTimeFrom) {
                    resultObj.firstScreenTimeStamp = domReadyTimeStamp;
                    resultObj.firstScreenTime = domReadyTimeStamp - _global._originalNavStart;
                    resultObj.reportTimeFrom = reportTimeFrom;
                    _report(resultObj);
                });
            }
        };

        resultObj.firstScreenImages = firstScreenImages;
        resultObj.firstScreenImagesLength = firstScreenImages.length;

        if (!firstScreenImages.length) {
            processNoImages();
        } else {
            util.cycleGettingPerformaceTime(_global, firstScreenImages, function (performanceResult) {
                resultObj.firstScreenTime = performanceResult.firstScreenTime;
                resultObj.firstScreenTimeStamp = performanceResult.firstScreenTimeStamp;
                resultObj.firstScreenImagesDetail = performanceResult.firstScreenImagesDetail;
                resultObj.reportTimeFrom = 'perf-img-from-performance';
                _report(resultObj);
            }, function() {
                processNoImages();
            });
        }

        return resultObj;
    }

    function _getImagesInFirstScreen() {
        var screenHeight = win.innerHeight;
        var screenWidth = win.innerWidth;

        // 写入设备信息，用于上报（这里只会执行一次）
        _global.device.screenHeight = screenHeight;
        _global.device.screenWidth = screenWidth;

        var nodeIterator = util.queryAllNode(_global.ignoreTag);
        var currentNode = nodeIterator.nextNode();
        var imgList = [];

        var onImgSrcFound = function (imgSrc) {
            var protocol = util.parseUrl(imgSrc).protocol;
            if (protocol && protocol.indexOf('http') === 0) {
                // 去重
                if (imgList.indexOf(imgSrc) === -1) {
                    imgList.push(imgSrc);
                }
            }
        }

        while (currentNode) {
            var imgSrc = util.getImgSrcFromDom(currentNode, _global.img);

            if (!imgSrc) {
                currentNode = nodeIterator.nextNode();
                continue;
            }

            util.recordCurrentPos(currentNode, _global);

            if (util.isInFirstScreen(currentNode)) {
                onImgSrcFound(imgSrc);
            } else {
                var currentPos = util.currentPos;
                // 统计没有在首屏的图片信息
                _global.ignoredImages.push({
                    src: imgSrc,
                    screenHeight: screenHeight,
                    screenWidth: screenWidth,
                    scrollTop: currentPos.scrollTop,
                    top: currentPos.top,
                    bottom: currentPos.bottom,
                    vertical: (currentPos.scrollTop + currentPos.top) <= screenHeight,
                    left: currentPos.left,
                    right: currentPos.right,
                    horizontal: currentPos.right >= 0 && currentPos.left <= screenWidth
                });
            }

            currentNode = nodeIterator.nextNode();
        }

        // 格式化
        return util.formateUrlList(imgList, 'add');
    }

    // 插入脚本，用于获取脚本运行完成时间，这个时间用于获取当前页面是否有异步请求发出
    function testStaticPage() {
        util.testStaticPage(function() {
            runOnPageStable('perf-auto-timeout');   
        }, _global);
    }

    function overrideRequest() {
        util.overrideRequest(_global, function () {
            runOnPageStable('perf-auto-request-end');
        });
    }

    function mergeUserConfig(userConfig) {
        util.mergeUserConfig(_global, userConfig);
    }

    function watchError() {
        util.watchError(_global);
    }

    return {
        mergeUserConfig: mergeUserConfig,
        testStaticPage: testStaticPage,
        overrideRequest: overrideRequest,
        recordFirstScreenInfo: recordFirstScreenInfo,
        watchError: watchError,
        // [Notice] 此处追踪global -> 1
        global: _global
    };
}

module.exports = {
    auto: function (userConfig) {
        var go = function () {
            // [Notice] API包含什么见上面👆return内容
            var api = generateApi('auto');
            api.global.reportDesc = 'auto-perf';
            api.watchError();
            api.mergeUserConfig(userConfig);
            api.testStaticPage();
            api.overrideRequest();
            return api;
        };

        var api = go();

        // 针对单页应用处理
        var preGlobal = api.global;
        util.onNavigationStartChange(api.global, function (changeInfo) {
            preGlobal.abortReport = true;

            // 触发用户注册的回调
            preGlobal.onNavigationStartChange(changeInfo);

            // 下次启动首屏时间计算，设置 navStart 的时刻
            userConfig.forcedNavStartTimeStamp = changeInfo.timeStamp;

            // 重新运行首屏时间计算，但需要使用 dot 的方式
            preGlobal = require('./dot').auto(userConfig);
        });

        return api.global;
    },
    hand: function (userConfig) {
        var api = generateApi('hand');
        api.global.reportDesc = 'hand-perf';
        api.global.handExcuteTime = util.getTime();
        api.mergeUserConfig(userConfig);
        api.recordFirstScreenInfo('perf-hand');
    }
}
