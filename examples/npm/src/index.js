import  "suchjs/lib/browser";
import Such from 'such-mock-browser';
import $ from 'jquery';
const globalSuch = Such.default;
const { mock } = globalSuch;
const { target, method } = mock;
const interceptor = mock.intercept(target.XHR | target.FETCH, {
  timeout: [1000, 5000]
});
mock('/a', 'GET', {
  a: ':string'
});
mock('/b', method.GET | method.POST, {
  b: ':number'
});
mock('/c', '*', {
  c: ':increment:{3}'
});
mock('/d', function(req){
  return req.method === 'POST';
}, {
  d: ':::haha'
});
mock(/\/\w+/, method.ANY, function(req){
  return {
    '*': '*'
  };
});
mock('/e/:id', 'GET,POST', function(req, params){
  return {
    id: params.id,
    words: globalSuch.as(':string')
  };
});
mock('/f', 'GET', function(req, params){
  return globalSuch.as({ plain: ':::haha,`:string`'});
}, {
  timeout: 2000,
  transformer: {
    headers: {
      'Content-Type': 'text/html'
    }
  }
});
mock('/g', 'GET', function(req){
  return globalSuch.as({
    'fetch{1,3}': ':string'
  });
}, {
  timeout: 3000
});
interceptor.on('response', (req, res) => {
  console.log(res);
});

// XHR
$.post('/a', function(res){
  console.log(res);
});
$.get('/b', function(res){
  console.log(res);
});
$.post('/b', function(res){
  console.log(res);
});
$.post('/c', function(res){
  console.log(res);
});
$.post('/d', function(res){
  console.log(res);
});
$.post('/e/123', function(res){
  console.log(res);
});
$.get('/f',  function(res){
  console.log(res);
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