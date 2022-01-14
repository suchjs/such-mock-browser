# such-mock-browser

Extend the ability for `suchjs` with `Such.mock` in browser, intercept the reqeust made by `XMLHttpRequest` or `fetch` API, response a mock data instead.

## How to use

See the document: [Suchjs mock](https://suchjs.github.io/vp-suchjs/en/mock.html)

## Examples

### Method 1: [use with npm package](./examples/npm/src/index.js)

```shell
# use npm/yarn/pnpm
npm install --save suchjs such-mock-browser jquery
```

```javascript
import  "suchjs/lib/browser";
import Such from 'such-mock-browser';
import $ from 'jquery';
const globalSuch = Such.default;
const { mock } = globalSuch;
const { target, method } = mock;
// intercept both the XMLHttpRequest and fetch API
const interceptor = mock.intercept(target.XHR | target.FETCH, {
  // set timeout between 1000ms to 5000ms
  timeout: [1000, 5000]
});

mock('/a', method.GET, {
  a: ':string'
});

mock('/g', 'GET', function(req){
  return globalSuch.as({
    'fetch{1,3}': ':string'
  });
}, {
  // set this request's timeout as 3000ms
  timeout: 3000
});

// xhr
$.post('/a', function(res){
  console.log(res); // will output something like this { a: "dkDo23k"}
});

// fetch
window.fetch('/g', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
    // 'Content-Type': 'application/x-www-form-urlencoded',
  },
}).then((res) => res.json()).then((data) => {
  console.log(data);
});
```

### Method 2: [use with scripts](./examples/browser/index.html)

```html
<script src="https://cdn.jsdelivr.net/gh/suchjs/such@master/dist/such.min.js"></script>
<script src="./such-mock-browser.min.js"></script>
<script src="https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.js"></script>
<script>
const globalSuch = Such.default;
const { mock } = globalSuch;
const { target, method } = mock;
// ...... same code like the style with npm package
</script>
```


## Dependencies

Interceptor: [https://github.com/mswjs/interceptors](https://github.com/mswjs/interceptors)

Pathname match: [https://github.com/mswjs/node-match-path](https://github.com/mswjs/node-match-path) 
