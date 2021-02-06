'use strict';

import * as express from 'express';
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import * as bodyParserXml from 'body-parser-xml';
import * as xml2js from 'xml2js';
import { SwaggerUI } from './swagger.ui';
import { SwaggerRouter } from './swagger.router';
import { SwaggerParameters } from './swagger.parameters';
import * as logger from 'morgan';
import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import * as OpenApiValidator from 'express-openapi-validator';
import { Oas3AppOptions } from './oas3.options';

export class ExpressAppConfig {
    private app: express.Application;
    private routingOptions;
    private definitionPath;
    private openApiValidatorOptions;

    constructor(definitionPath: string, appOptions: Oas3AppOptions) {
        this.definitionPath = definitionPath;
        this.routingOptions = appOptions.routing;
        this.setOpenApiValidatorOptions(definitionPath, appOptions);
        this.app = express();

        const spec = fs.readFileSync(definitionPath, 'utf8');
        const swaggerDoc = jsyaml.safeLoad(spec);

        this.app.use(bodyParser.urlencoded());
        this.app.use(bodyParser.text());
        this.app.use(bodyParser.json());

        this.app.use(this.configureXmlParser(appOptions));
        this.app.use(this.configureXmlSanitiser(appOptions));

        // this.app.use(function (req, res, next){console.log(req.body);next();});

        this.app.use(this.configureLogger(appOptions.logging));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser());

        const swaggerUi = new SwaggerUI(swaggerDoc, appOptions.swaggerUI);
        this.app.use(swaggerUi.serveStaticContent());

        this.app.use(OpenApiValidator.middleware(this.openApiValidatorOptions));
        this.app.use(new SwaggerParameters().checkParameters());
        this.app.use(new SwaggerRouter().initialize(this.routingOptions));

        this.app.use(this.errorHandler);
    }

    private configureXmlParser(appOptions: Oas3AppOptions){
        bodyParserXml(bodyParser);
        const bodyParserPlusXMLParser: any = bodyParser;
        let xmlTagNameProcessors = [xml2js.processors.stripPrefix];
        let xmlValueProcessors = [xml2js.processors.parseNumbers, xml2js.processors.parseBooleans];
        let xmlOptions = appOptions.xml;
        if (xmlOptions != undefined) {
            if(xmlOptions.tagNameProcessors != undefined
                && Array.isArray(xmlOptions.tagNameProcessors)){
                    xmlTagNameProcessors = xmlOptions.tagNameProcessors;
            }
            if(xmlOptions.valueProcessors != undefined
                && Array.isArray(xmlOptions.valueProcessors)){
                    xmlValueProcessors = xmlOptions.valueProcessors;
            }

        }
        return bodyParserPlusXMLParser.xml({
            xmlParseOptions: {
                mergeAttrs :true,
                normalize: true,
                normalizeTags: false,
                explicitRoot :false,
                explicitArray: false,
                tagNameProcessors:xmlTagNameProcessors,
                valueProcessors: xmlValueProcessors
            }
        });
    }

    private configureXmlSanitiser(appOptions: Oas3AppOptions){
        let xmlSanitizerProcessor = function(req, res, next){next()};
        let xmlOptions = appOptions.xml;
        if (xmlOptions != undefined) {
            if(xmlOptions.sanitiseProcessors != undefined){
                    xmlSanitizerProcessor = xmlOptions.sanitiseProcessors;
            }
        }
        return xmlSanitizerProcessor;
    }

    private setOpenApiValidatorOptions(definitionPath: string, appOptions: Oas3AppOptions) {
        //If no options or no openApiValidator Options given, create empty options with api definition path
        if (!appOptions || !appOptions.openApiValidator) {
            this.openApiValidatorOptions = { apiSpec: definitionPath };
            return;
        }

        // use the given options
        this.openApiValidatorOptions = appOptions.openApiValidator;

        // Override apiSpec with definition Path to keep the prior behavior
        this.openApiValidatorOptions.apiSpec = definitionPath;
    }

    public configureLogger(loggerOptions) {
        let format = 'dev';
        let options:{} = {};

        if (loggerOptions != undefined) {
            if(loggerOptions.format != undefined
                && typeof loggerOptions.format === 'string'){
                    format = loggerOptions.format;
            }
    
            if(loggerOptions.errorLimit != undefined
                && (typeof loggerOptions.errorLimit === 'string' || typeof loggerOptions.errorLimit === 'number')){
                options['skip'] = function (req, res) { return res.statusCode < parseInt(loggerOptions.errorLimit); };
            }
        }

        return logger(format, options);
    }

    private errorHandler(error, request, response, next) {
        response.status(error.status || 500).json({
            message: error.message,
            errors: error.errors,
        });
    }

    public getApp(): express.Application {
        return this.app;
    }
}
