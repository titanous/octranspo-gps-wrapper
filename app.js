var http    = require('http'),
    url     = require('url'),
    sys     = require('sys'),
    router  = require('choreographer').router(),
    redis   = require('redis').createClient(),
    elf     = require('elf-logger'),
    secrets = require('./secrets');

router.get('/stop/*/trips', function(req, res, stop) {
  var query = url.parse(req.url, true).query;

  if (query) {
    apiKey = query.key;

    redis.sismember('api_keys', apiKey, function(err, validDevKey) {
      if (!validDevKey) {
        badDevKey(res);
        return;
      }

      logHit(apiKey);
      getStopTrips(res, stop, query.count || 3);
    });
  } else {
    badDevKey(res);
  }
});

httpServer = http.createServer(router);
elf.createLogger(httpServer);
module.exports = httpServer; // for spark

function badDevKey(res) {
  res.writeHead(403, {'Content-Type': 'text/plain'});
  res.end('Please contact info@opendataottawa.ca for a dev key. Thanks!');
}

function logHit(apiKey) {
  redis.lpush(redisKey(apiKey, 'recent_hits'), new Date().getTime());
  redis.ltrim(redisKey(apiKey, 'recent_hits'), 0, 999);
  redis.hincrby(redisKey(apiKey, 'hits'), dateHourStamp(), 1);
}

function redisKey(apiKey, suffix) {
  return 'api_key:' + apiKey + ':' + suffix;
}

function dateHourStamp() {
  date = new Date();
  return '' + date.getFullYear() + (date.getMonth() + 1) + date.getDate() + date.getHours();
}

function getStopTrips(res, stop, count) {
  var body = getStopTripsBody(stop, count);

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
}

function getStopTripsBody(stop, count) {
    return '<?xml version="1.0" encoding="utf-8"?>                   \
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
xmlns:xsd="http://www.w3.org/2001/XMLSchema"                         \
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">              \
  <soap:Body>                                                        \
    <GetNextRoutesForStop xmlns="http://tempuri.org/">               \
      <stopId>' + stop + '</stopId>                                   \
      <tripCount>' + count + '</tripCount>                             \
      <includeGpsData>true</includeGpsData>                          \
      <apiKey>' + secrets.octranspo_api_key + '</apiKey>             \
    </GetNextRoutesForStop>                                          \
  </soap:Body>                                                       \
</soap:Envelope>'
}
