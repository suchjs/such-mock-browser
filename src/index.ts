import {
  createInterceptor,
  Interceptor,
  InterceptorApi,
  IsomorphicRequest,
  MockedResponse,
} from '@mswjs/interceptors';
import { interceptXMLHttpRequest } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest';
import { interceptFetch } from '@mswjs/interceptors/lib/interceptors/fetch';
import { match } from 'node-match-path';
import { Such } from 'suchjs/lib/core/such';
// !Use require to import the umd style library such
// eslint-disable-next-line @typescript-eslint/no-var-requires
const windowSuch = require('suchjs/lib/browser');
const globalSuchInstance = windowSuch.default as Such;
const protoOfSuch = Object.getPrototypeOf(globalSuchInstance);
/**
 * Interceptor Target
 * XHR -> XMLHttpRequest
 * FETCH -> window.fetch
 */
enum InterceptorTarget {
  XHR = 0b001,
  FETCH = 0b001 << 1,
}
/**
 * Request Methods
 */
enum RequestMethod {
  GET = 0b1,
  POST = 0b1 << 1,
  PUT = 0b1 << 2,
  DELETE = 0b1 << 3,
  HEAD = 0b1 << 4,
  OPTIONS = 0b1 << 5,
  PATCH = 0b1 << 6,
  ANY = (0b1 << 7) - 1,
}
type TObj<T = unknown> = { [index: string]: T };
type TReqMatchFunc = (request: IsomorphicRequest, params?: TObj) => boolean;
type TMockDataFunc = (request: IsomorphicRequest, params?: TObj) => unknown;
type TReqMatchParam = string | TReqMatchFunc | RequestMethod;
type TMockDataParam = TMockDataFunc | unknown;
type ResponseTransformer = Partial<MockedResponse> | ((resp: MockedResponse) => void);
type RouteItem<T extends string | RegExp = string | RegExp> = [
  T,
  TReqMatchFunc,
  TMockDataFunc,
  ResponseOptions,
];
export type SuchWithMock = typeof globalSuchInstance & {
  mock: (
    route: string | RegExp,
    match: TReqMatchParam,
    data: TMockDataParam,
    responseOptions?: ResponseOptions,
  ) => unknown;
};
/**
 * ResponseTimeout
 */
interface ResponseTimeout{
  timeout?: number | [number, number]
}
/**
 * InterceptorOptions
 */
type InterceptorOptions = ResponseTimeout 

/**
 * ResponseOptions
 */
interface ResponseOptions extends  ResponseTimeout {
  transformer?: ResponseTransformer
}

// Pick the value => key in ts enum.
const reqMethodPairs: [number, string][] = (() => {
  const pairs: [number, string][] = [];
  Object.keys(RequestMethod).map((key: keyof typeof RequestMethod) => {
    const valueRevKey = Number(key);
    if (!isNaN(valueRevKey)) {
      pairs.push([valueRevKey, RequestMethod[key] as unknown as string]);
    }
  });
  return pairs;
})();
// interceptor instance
let interceptor: InterceptorApi;
// routes
let stringRoutes: RouteItem<string>[] = [];
let regexRoutes: RouteItem<RegExp>[] = [];
// interceptRequest
const interceptRequest = (request: IsomorphicRequest, options: InterceptorOptions = {}) => {
  const url = request.url;
  const location = document.location;
  // first, check the host if is equal
  if (location.host !== url.host) {
    return;
  }
  // then check the pathname
  const loop = (...args: RouteItem[][]) => {
    for (let i = 0, j = args.length; i < j; i++) {
      const routes = args[i];
      for (let l = 0, m = routes.length; l < m; l++) {
        const [route, matchFn, dataFn, responseOptions] = routes[l];
        const { matches, params } = match(route, url.pathname);
        if (matches && matchFn(request, params)) {
          const data = dataFn(request, params);
          const response = {
            status: 200,
            statusText: 'Ok',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          };
          // if resp parameter is a function
          // use the function to transform response
          const { timeout, transformer } = responseOptions || {};
          if (typeof transformer === 'function') {
            transformer(response);
          } else if (transformer) {
            // if resp is a MockResponse
            // extend to override the response
            Object.assign(response, transformer);
          }
          return { response, timeout };
        }
      }
    }
  };
  // first check the string routes, then the regex routes
  const result = loop(stringRoutes, regexRoutes);
  if(result){
    const { timeout, response } = result;
    const useTimeout = timeout || options.timeout;
    if(useTimeout === undefined){
      return response;
    } else {
      const delay = Array.isArray(useTimeout) ? globalSuchInstance.utils.makeRandom.apply(null, useTimeout) : useTimeout;
      return new Promise((resolve) => {
        setTimeout(() => resolve(response), delay);
      });
    }
  }
};
/**
 * Such.mock
 */
const SuchPrototype: SuchWithMock = Object.assign(protoOfSuch, {
  mock(
    route: string | RegExp,
    match: TReqMatchParam,
    data: TMockDataParam,
    responseOptions?: ResponseOptions,
  ) {
    // handle the match function
    let matchFn: TReqMatchFunc;
    if (typeof match === 'string') {
      // any methods
      if (match === '*') {
        matchFn = (_req: IsomorphicRequest) => true;
      } else {
        const allowedMethods = match
          .split(',')
          .map((method) => method.trim().toUpperCase());
        matchFn = (req: IsomorphicRequest) =>
          allowedMethods.includes(req.method);
      }
    } else if (typeof match === 'function') {
      matchFn = match;
    } else {
      const allowedMethods: string[] = [];
      reqMethodPairs.map(([flag, name]) => {
        if ((flag & match) > 0) {
          allowedMethods.push(name);
        }
      });
      matchFn = (req: IsomorphicRequest) => allowedMethods.includes(req.method);
    }
    // data
    let dataFn: TMockDataFunc;
    if (typeof data === 'function') {
      dataFn = data as TMockDataFunc;
    } else {
      dataFn = (_req: IsomorphicRequest) => {
        return globalSuchInstance.as(data);
      };
    }
    // route
    if (typeof route === 'string') {
      stringRoutes.push([route, matchFn, dataFn, responseOptions]);
    } else if (route instanceof RegExp) {
      regexRoutes.push([route, matchFn, dataFn, responseOptions]);
    } else {
      throw new Error(`wrong route pattern of type "${typeof route}", please use a string or a RegExp rule instead.`);
    }
  },
});
/**
 * Define properties inject into Such.mock
 */
Object.assign(SuchPrototype.mock, {
  // the target need be interceptor, XHR or FETCH or both
  target: InterceptorTarget,
  // method
  method: RequestMethod,
  // intercept
  intercept(target: InterceptorTarget, options: InterceptorOptions = {}): InterceptorApi | never {
    const modules: Interceptor[] = [];
    if ((target & InterceptorTarget.XHR) > 0) {
      modules.push(interceptXMLHttpRequest);
    }
    if ((target & InterceptorTarget.FETCH) > 0) {
      modules.push(interceptFetch);
    }
    if (modules.length) {
      interceptor = createInterceptor({
        modules,
        resolver: (request: IsomorphicRequest) => {
          return interceptRequest(request, options);
        },
      });
      interceptor.apply();
      return interceptor;
    } else {
      throw new Error(
        `Wrong interceptor target parameter when call the "Such.mock.intercept": expect at least one interceptor target.`,
      );
    }
  },
  // unintercept
  unintercept() {
    interceptor.restore();
    interceptor = null;
    stringRoutes = [];
    regexRoutes = [];
  },
});
export default windowSuch;
