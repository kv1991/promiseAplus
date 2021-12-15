const axios = require('axios');

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
      that.onFulfilledCallbacks.forEach(callback => {
        callback(that.value);
      })
    }
  }
  function reject(reason) {
    if (that.status === PENDING) {
      that.status = REJECTED;
      that.reason = reason;
      // #3
      that.onRejectedCallbacks.forEach(callback => {
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

// #1 then方法: 由于then方法可以链式调用,所以是实例方法,而且规范中的api是MyPromise.then(onFulfilled, onRejected), 所以基本的架子如下:
// 规范里要求: 
// 1. 先检查onFulfilled以及onRejected是不是函数
// 2. 如果不是函数就忽略他们,所谓忽略就是如果是onFulfilled那么就返回value,如果是onRejected那么就返回reason,因为onRejected属于错误分支,那么应该throw an error.
// #4 根据规范,then的返回值必须是promise,这样才能实现链式调用,规范中还定义了不同情况如何处理,下面是简单的几种情况:
// #4-1: 如果onFulfilled或者onRejected抛出一个异常, 则promise2必须拒绝执行,并返回拒因;
// #4-2: 如果onFulfilled不是函数,且成功执行,那么returned promise必须成功执行,并返回相同的值;
// #4-3-1: 如果onRejected不是函数且promise1拒绝执行，promise2必须拒绝执行并返回相同的拒因。
// #4-3-2: 如果promise1的onRejected执行成功了，promise2我们直接resolve
// #5 onFulfilled和onRejected的执行时机：onFulfilled 和 onRejected 只有在执行环境堆栈仅包含平台代码时才可被调用。
// 这个规范要求是实践中要确保onFulfilled和onRejected异步执行，且在then方法被调用的那一轮事件循环之后的新执行栈中执行，所以我们应该在执行onFulfilled和onRejected的时候应该包在setTimeout中
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
  
  // #2 当我们使用Promise的时候,如果执行成功, 那么就会执行onFulfilled, 如果失败了就会执行onRejected
  // 所以我们检查status,如果是fulfilled,那么就调用onFulfilled,如果是rejected,那我们调用onRejected.
  
  // #3 这里有个问题就是我们初始化promise可能类似: new Promise(fn).then(onFulfilled, onRejected),这里一初始化后,就可以调用onFulfilled/onRejected,显然是不对的,要等到初始化成功,
  // 并且判断status状态,如果是PENDING,那么就应该将他们存起来,等到fn有了结论,resolve/reject的时候再来调用对应的代码;
  // 还有可能多个then伴随多个onFulfilled或者是onRejected,所以可以先存起来,等resolve或者是rejected的时候拿出来一一执行一遍;
  // #3
  let that = this;
  if (this.status === PENDING) {
    // #4-1
    return new MyPromise((resolve, reject) => {
      that.onFulfilledCallbacks.push(() => {
        setTimeout(() => { // #5 setTimeout
          try {
            let x = realOnFulfilled(that.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      });
      that.onRejectedCallbacks.push(() => {
        setTimeout(() => { // #5 setTimeout
          try {
            let x = realOnRejected(that.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      });
    });
  }
  // #2
  if (this.status === FULFILLED) {
    // #4-1
    let promise2 = new MyPromise((resolve, reject) => {
      setTimeout(() => { // #5 setTimeout
        try {
          if (typeof onFulfilled === 'function') { // #4-2 如果onFulfilled是存在并且是函数，才执行。否则返回相同的值
            let x = realOnFulfilled(that.value);
            resolvePromise(promise2, x, resolve, reject);
          } else {
            resolve(that.value);
          }
        } catch (err) {
          reject(err);
        }
      }, 0);
    });
    return promise2;
  }
  
  if (this.status === REJECTED) {
    // #4-1
    let promise2 = new MyPromise((resolve, reject) => {
      setTimeout(() => { // #5 setTimeout
        try {
          if (typeof onRejected === 'function') { // #4-3-2
            let x = realOnRejected(that.reason);
            resolvePromise(promise2, x, resolve, reject);
          } else {
            reject(that.reason); // #4-3-1
          }
        } catch (err) {
          reject(err);
        }
      }, 0);
    });
    return promise2
  }
}

// #5 规范要求: 如果onFulfilled或者onRejected返回一个值x，这运行promise解决过程[[Promise]](promise, x).所以我们需要对onFulfilled或者onRejected的返回值进行判断，如果有返回值的话就要进行promise解决过程
function resolvePromise(promise, x, resolve, reject) {
  // 判断promise与x是否指向同一个对象，如果是则throw一个TypeError拒绝执行
  if (promise === x) {
    return reject(new TypeError('The promise and the return value are the same'));
  }
  // 如果x是非空对象或者是函数
  if (!!x && typeof x === 'object' || typeof x === 'function') {
    try {
      var then = x.then;
    } catch (err) {
      return reject(err);
    }
    
    if (typeof then === 'function') {
      var called = false;
      try {
        then.call(
          x,
          // 如果resolvePromise以值y为参数被调用，那么执行[[Promise]](promise, x)
          y => {
            // 如果resolvePromise和rejectedPromise均被调用
            // 或者被同一参数调用多次，则优先采用首次调用忽略剩下的调用
            // 实现这一功能需要加上flag called
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject);
          },
          r => {
            // 如果rejectPromise以r为参数被调用，那就以r为拒因拒绝执行primise
            if (called) return;
            called = true;
            reject(r);
          }
        )
      } catch (err) {
        if (called) return;
        // called = true;
        reject(err);
      }
    } else {
      resolve(x);
    }
  } else {
   return resolve(x);
  }
}
MyPromise.deferred = function() {
  var result = {};
  result.promise = new MyPromise(function(resolve, reject){
    result.resolve = resolve;
    result.reject = reject;
  });

  return result;
}

let promise1 = new MyPromise((resolve) => {
  axios.get('https://www.baidu.com')
    .then(response => {
      // console.log('response: ', response);
      if (response.status === 200) {
        resolve('request1 success');
      }
    })
    .catch(error => {
      console.log('error: ', error);
    });
});

promise1.then(value => {
  console.log(value);
});

let promise2 = new MyPromise((resolve, reject) => {
  axios.get('https://www.baidu.com')
    .then(response => {
      console.log('response: ', response);
      if (response.status === 200) {
        reject('request2 failed');
      }
    })
    .catch(error => {
      console.log('error: ', error);
    });
});

promise2.then(value => {
  console.log(value);
}, reason => {
  console.log(reason);
});

module.exports = MyPromise;