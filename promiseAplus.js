// 初始化promise状态
const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

function MyPromise(executor) {
  this.status = PENDING;
  this.value = null;
  this.reason = undefined;
  this.onFulfilledCallbacks = [];
  this.onRejectedCallbacks = [];
  
  let that = this; // 保存this以便resolve和reject中调用
  function resolve(val) {
    if (that.status === PENDING) {
      that.status = FULFILLED;
      that.value = val;
      // #3
      this.onFulfilledCallbacks.forEach(callback => {
        callback(that.value);
      })
    }
  }
  function reject(reason) {
    if (that.status === PENDING) {
      that.status = REJECTED;
      that.reason = reason;
      // #3
      this.onRejectedCallbacks.forEach(callback => {
        callback(that.reason);
      })
    }
  }
  // 初始化执行器
  try {
    executor(resolve, reject);
  } catch (err) {
    reject(err);
  }
}

// #1 then方法: 由于then方法可以链式调用，所以是实例方法，而且规范中的api是MyPromise.then(onFulfilled, onRejected), 所以基本的架子如下:
// 规范里要求：
// 1. 先检查onFulfilled以及onRejected是不是函数
// 2. 如果不是函数就忽略他们，所谓忽略就是如果是onFulfilled那么就返回value，如果是onRejected那么就返回reason，因为onRejected属于错误分支，那么应该throw an error.
// #1
MyPromise.prototype.then = function (onFulfilled, onRejected) {
  let realOnFulfilled = onFulfilled;
  if (typeof realOnFulfilled !== 'function') {
    realOnFulfilled = function (val) {
      return val;
    };
  }

  let realOnRejected = onRejected;
  if (typeof realOnRejected !== 'function') {
    realOnRejected = function (reason) {
      throw reason;
    }
  }
  
  // #2 当我们使用Promise的时候，如果执行成功, 那么就会执行onFulfilled, 如果失败了就会执行onRejected
  // 所以我们检查status，如果是fulfilled，那么就调用onFulfilled，如果是rejected，那我们调用onRejected.
  
  // #3 这里有个问题就是我们初始化promise可能类似：new Promise(fn).then(onFulfilled, onRejected),这里一初始化后，就可以调用onFulfilled/onRejected，显然是不对的，要等到初始化成功，
  // 并且判断status状态，如果是PENDING，那么就应该将他们存起来，等到fn有了结论，resolve/reject的时候再来调用对应的代码;
  // 还有可能多个then伴随多个onFulfilled或者是onRejected，所以可以先存起来，等resolve或者是rejected的时候拿出来一一执行一遍;
  // #3
  if (this.status === PENDING) {
    this.onFulfilledCallbacks.push(realOnFulfilled);
    this.onRejectedCallbacks.push(realOnRejected);
  }
  // #2
  if (this.status === FULFILLED) {
    onFulfilled(this.value);
  }
  if (this.status === REJECTED) {
    onFulfilled(this.reason);
  }

}