'use strict';

var path = require('path');
var http = require('http');
var xml2js = require('xml2js');

var oas3Tools = require('oas3-tools');
var serverPort = 8080;

function validate(request, scopes, schema) {
    // security stuff here
    return true;
}

function doNothing(value, name){
    //console.log(name, value);
    return value;
}

function sanitiser(req, res, next){
    //console.log(req.body);
    let body = req.body;
    if (body.photoUrls){
        if (!Array.isArray(body.photoUrls) && typeof body.photoUrls === 'string'){
            body.photoUrls = [body.photoUrls];
        }
    }
    //console.log(body);
    req.body = body;
    next();
}

// swaggerRouter configuration
var options = {
    routing: {
        controllers: path.join(__dirname, './controllers')
    },
    logging: {
        format: 'combined',
        errorLimit: 400
    },
    openApiValidator: {

        validateSecurity: {
            handlers: {
                petstore_auth: validate,
                api_key: validate
            }
        }
    },
    xml:{
        tagNameProcessors: [xml2js.processors.stripPrefix],
        valueProcessors: [xml2js.processors.parseNumbers, xml2js.processors.parseBooleans, doNothing],
        sanitiseProcessors: sanitiser
    }
}; 


var expressAppConfig = oas3Tools.expressAppConfig(path.join(__dirname, 'api/petstore.yaml'), options);
var app = expressAppConfig.getApp();

// Initialize the Swagger middleware
http.createServer(app).listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
    console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
});
