'use strict';

import {defaults, each, isArray, isFunction, isPlainObject, isUndefined} from 'lodash';
import * as fs from 'fs';
import { debugError, removeDashElementToCamelCase } from "./helpers";
import * as path from 'path';
import Debug from "debug";
const debug = Debug("oas3-tools:routing");

export class SwaggerRouter {

  handlerCacheFromDir(dirOrDirs: any) {
    const  handlerCache: object = {};
    const  jsFileRegex = /\.(coffee|js|ts)$/;
    var  dirs = new Array<any>();

    if (isArray(dirOrDirs)) {
      dirs = dirOrDirs;
    } else {
      dirs.push(dirOrDirs);
    }

    debug('  Controllers:');

    each(dirs, function (dir) {
      each(fs.readdirSync(dir), function (file: string) {
        const controllerName: string = file.replace(jsFileRegex, '');
        let controller: string;

        if (file.match(jsFileRegex) && file.indexOf(".test.js") === -1) {
          controller = require(path.resolve(path.join(dir, controllerName)));

          debug('    %s%s:',
              path.resolve(path.join(dir, file)),
              (isPlainObject(controller) ? '' : ' (not an object, skipped)'));

          if (isPlainObject(controller)) {
            each(controller, function (value, name) {
              let handlerId = controllerName + '_' + name;

              debug('      %s%s',
                  handlerId,
                  (isFunction(value) ? '' : ' (not a function, skipped)'));

              if (isFunction(value) && !handlerCache[handlerId]) {
                handlerCache[handlerId] = value;
              }
            });
          }
        }
      });
    });

    return handlerCache;
  }

  initialize(options) {
    var handlerCache = {};

    debug('Initializing swagger-router middleware');

    // Set the defaults
    options = defaults(options || {}, {
      controllers: {},
      useStubs: false // not for now.
    });

    console.log('  Mock mode: %s', options.useStubs === true ? 'enabled' : 'disabled');

    if (isPlainObject(options.controllers)) {
      // Create the handler cache from the passed in controllers object
      each(options.controllers, function (func, handlerName) {
        console.log('    %s', handlerName);

        if (!isFunction(func)) {
          throw new Error('options.controllers values must be functions');
        }
      });

      handlerCache = options.controllers;
    } else {
      // Create the handler cache from the modules in the controllers directory
      handlerCache = this.handlerCacheFromDir(options.controllers);
    }

    const getHandlerName = (req) => {
      if (req.openapi.schema['x-swagger-router-controller']) {
        let operationId = req.openapi.schema.operationId ? req.openapi.schema.operationId : req.method.toLowerCase();
        operationId = removeDashElementToCamelCase(operationId);
        return req.openapi.schema['x-swagger-router-controller'] + '_' + operationId;
      } else {
        return removeDashElementToCamelCase(req.openapi.schema.operationId);
      }
    };

    const send405 = (req, res, next) => {
      let err = new Error('Route defined in OpenAPI specification (' + req.openapi.openApiRoute + ') but there is no defined on' + req.method.toUpperCase() + ' operation.');
      res.statusCode = 405;
      return next(err);
    };

    return (req, res, next) => {
      let operation = req.openapi ? req.openapi.schema.operationId : undefined;
      let handler;
      let handlerName;
      let rErr;

      if (isUndefined(req.openapi)) {
        return next(rErr);
      }
      
      debug('%s %s', req.method, req.url);
      debug('  Will process: %s', isUndefined(operation) ? 'no' : 'yes');

      if (operation) {
        handlerName = getHandlerName(req);
        handler = handlerCache[handlerName];

        debug('  Route handler: %s', handlerName);
        debug('    Missing: %s', isUndefined(handler) ? 'yes' : 'no');
        debug('    Ignored: %s', options.ignoreMissingHandlers === true ? 'yes' : 'no');

        if (isUndefined(handler)) {
          return send405(req, res, next);
        }

        if (!isUndefined(handler)) {
          try {
            return handler.apply(this, req.openapi.swaggerParameters);
          } catch (err) {
            rErr = err;
            debug('Handler threw an unexpected error: %s\n%s', err.message, err.stack);
          }
        } else if (options.ignoreMissingHandlers !== true) {
          rErr = new Error('Cannot resolve the configured swagger-router handler: ' + handlerName);
          res.statusCode = 500;
        }
      } else {
        debug('  No handler for method: %s', req.method);
        return send405(req, res, next);
      }
      if (rErr) {
        debugError(rErr, debug);
      }
      return next(rErr);
    };
  };
}
