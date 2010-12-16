var http = require('http');
var url = require('url');
var sys = require('sys');

require.paths.unshift('.');
var secrets = require('secrets');

function validDevKey (key) { 
  return secrets.dev_keys.indexOf(key) !== -1;
}

function badDevKey (res) {
  res.writeHead(403, {'Content-Type': 'text/plain'});
  res.write('Please contact info@opendataottawa.ca for a dev key. Thanks!');
  res.end();
}

http.createServer(function (req, res) {
  var query = url.parse(req.url, true).query;
  
  if(query) {
    var apiKey = query.apiKey;
    
    if(!validDevKey(apiKey)) {
      badDevKey(res);
      return;
    }
    sys.log(apiKey);
  } else {
    sys.log('no query or api key specified');
    badDevKey(res);
    return;
  }
  
  var stopId = query.stopId || 3006;
  var tripCount = query.tripCount || 3;
  
  var body = getNextRoutesForStop(stopId, tripCount); // just for now
  
  var octranspo = http.createClient(80, 'www.octranspo.com');
  var request = octranspo.request('POST', '/GpsService/Service.asmx',
    {'host':'www.octranspo.com',
     'Content-Type': 'text/xml',
     'Content-Length': body.length,
     'SOAPAction': '"http://tempuri.org/GetNextRoutesForStop"'});
  request.write(body);
  request.end();
  request.on('response', function (response) {
    res.writeHead(response.statusCode, response.headers);
    
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      res.write(chunk);
    });
    
    response.on('end', function () {
      res.end();
    });
  });
  
//}).listen(8080, "127.0.0.1");
}).listen(8080, "opendataottawa.ca");
console.log('Server running at http://127.0.0.1:8080/');

function getNextRoutesForStop(stopId, tripCount) {
    return '<?xml version="1.0" encoding="utf-8"?>                   \
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
xmlns:xsd="http://www.w3.org/2001/XMLSchema"                         \
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">              \
  <soap:Body>                                                        \
    <GetNextRoutesForStop xmlns="http://tempuri.org/">               \
      <stopId>' + stopId + '</stopId>                                \
      <tripCount>' + tripCount + '</tripCount>                       \
      <includeGpsData>true</includeGpsData>                          \
      <apiKey>' + secrets.octranspo_api_key + '</apiKey>                               \
    </GetNextRoutesForStop>                                          \
  </soap:Body>                                                       \
</soap:Envelope>'
}
