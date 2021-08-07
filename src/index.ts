import Such from 'suchjs/lib/browser';
import {
  createInterceptor,
  Interceptor,
  InterceptorApi,
  IsomorphicRequest,
} from '@mswjs/interceptors';
import { interceptXMLHttpRequest } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest';
import { interceptFetch } from '@mswjs/interceptors/lib/interceptors/fetch';
import { match } from 'node-match-path';
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
 *
 */
enum RequestMethods {
  GET = 0b1,
  POST = 0b1 << 1,
  PUT = 0b1 << 2,
  DELETE = 0b1 << 3,
  HEAD = 0b1 << 4,
  OPTIONS = 0b1 << 5,
  PATCH = 0b1 << 6,
  ANY = 0b1 << (7 - 1),
}
type TObj<T = unknown> = { [index: string]: T };
type TReqMatchFunc = (request: IsomorphicRequest, params?: TObj) => boolean;
type TMockDataFunc = (request: IsomorphicRequest, params?: TObj) => unknown;
type TReqMatchParam = string | TReqMatchFunc | RequestMethods;
type TMockDataParam = TMockDataFunc | unknown;
//
const reqMethodPairs: [number, string][] = (() => {
  const pairs: [number, string][] = [];
  Object.keys(RequestMethods).map((key: keyof typeof RequestMethods) => {
    const valueRevKey = Number(key);
    if (!isNaN(valueRevKey)) {
      pairs.push([valueRevKey, RequestMethods[key] as unknown as string]);
    }
  });
  return pairs;
})();

// interceptor instance
let interceptor: InterceptorApi;
// routes
const stringRoutes: [string, TReqMatchFunc, TMockDataFunc][] = [];
const regexRoutes: [RegExp, TReqMatchFunc, TMockDataFunc][] = [];

type SuchExtended = typeof Such & {
  mock?: (route: string | RegExp,
    match: TReqMatchParam,
    data: TMockDataParam) => unknown;
}
/**
 * Such.mock
 */
let ThisSuch: SuchExtended = Such;
ThisSuch.mock = (
  route: string | RegExp,
  match: TReqMatchParam,
  data: TMockDataParam,
) => {
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
      matchFn = (req: IsomorphicRequest) => allowedMethods.includes(req.method);
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
      return Such.as(data);
    };
  }
  // route
  if (typeof route === 'string') {
    stringRoutes.push([route, matchFn, dataFn]);
  } else {
    regexRoutes.push([route, matchFn, dataFn]);
  }
};

/**
 * Define properties inject into Such.mock
 */
Object.assign(ThisSuch.mock, {
  // the target need be interceptor, XHR or FETCH or both
  target: InterceptorTarget,
  // methods
  methods: RequestMethods,
  // intercept
  intercept(target: InterceptorTarget) {
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
          const url = request.url.toString();
          const loop = (
            ...args: [string | RegExp, TReqMatchFunc, TMockDataFunc][][]
          ) => {
            for (let i = 0, j = args.length; i < j; i++) {
              const routes = args[i];
              for (const [route, matchFn, dataFn] of routes) {
                const { matches, params } = match(route, url);
                if (matches && matchFn(request, params)) {
                  return dataFn(request, params);
                }
              }
            }
          };
          // first check the string routes, then the regex routes
          return loop(stringRoutes, regexRoutes);
        },
      });
      interceptor.apply();
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
  },
});
export default ThisSuch;
