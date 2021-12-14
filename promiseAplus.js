// 初始化promise状态
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

function MyPromise(executor) {
  let status = PENDING;
  let value = null;
  let reason = undefined;
  
  let that = this; // 保存this以便resolve和reject中调用
  function resolve(val) {
    if (that.status === PENDING) {
      that.status = FULFILLED;
      that.value = val;
    }
  }
  function reject(reason) {
    if (that.status === PENDING) {
      that.status = REJECTED;
      that.reason = reason;
    }
  }
  // 初始化执行器
  try {
    executor(resolve, reject);
  } catch (err) {
    reject(err);
  }
}

// then方法: 由于then方法可以链式调用，所以是实例方法，而且规范中的api是MyPromise.then(onFulfilled, onRejected), 所以基本的架子如下:
MyPromise.prototype.then = function(onFulfilled, onRejected) {}