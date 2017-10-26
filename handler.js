const axios = require('axios');
const Twitter = require('twitter');
const _ = require('lodash');
const parallel = require('async/parallel');

const stationLines = require('./dict/stationLines.js')
const texts = require('./dict/texts.js');
const humanLines = require('./dict/humanLines.js')

const parseMetroHeroResp = (metroHeroRes) => {
  console.log(JSON.stringify(metroHeroRes));
  const stationsWithFireReports = Object.keys(metroHeroRes).reduce((acc,stationCode) => {
    if (metroHeroRes[stationCode]["numTagsByType"]["SMOKE_OR_FIRE"]) {
      acc.push(stationCode);
    }
    return acc;
  },[]); 
  const uniqStationsWithFireReports = stationsWithFireReports.map(code => {
    const lineCode = stationLines[code];
    return humanLines[lineCode]
  });
  return = _.uniq(_.flatten(uniqStationsWithFireReports));
}

const sendTweet = (lines,cb) => {
  const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });
  const opening = _.sample(texts.openings);
  const linesString = (String(lines).split(",").join(", ")).trim() + " line" +(lines.length > 1 ? "s" : "")
  const status = opening + " Twitter is reporting fire/smoke on the " + linesString + ". http://www.IsMetroOnFire.com");

  client.post('statuses/update', {status}, (error, tweet, response) => {
    cb(error,response);
  });
}

const updateS3 = (lines, cb) => {
  let lineObj = {red:false,orange:false,yellow:false,green:false,blue:false,silver:false}
  let message = _.sample(texts.no);
  let activated = {};

  // If Yes
  if (lines.length > 0) {
    activated = lines.reduce((acc,line) => {
      const lowerCase = line.toLowerCase();
      return _.assign(acc, {[lowerCase]: true});
    },{});
    message = _.sample(texts.yes);
  }

  const resultJson = {counts: _.assign(lineObj,activated), message: message};
  var results = String(JSON.stringify(resultJson));
  var params = {Bucket: 'www.ismetroonfire.com', Key: 'fireapi', Body: results, ContentType:"application/json; charset=utf-8", CacheControl: 'no-cache'};
  var request = s3.putObject(params);
  request.on('complete', response => cb(null,response)).on('error', err => cb(err)); 
  request.send();
};

module.exports.scrape = (event, context, lambdaFinished) => {
  const request = axios.create({
    baseURL: 'https://dcmetrohero.com/api/v1/',
    timeout: 5000,
    headers: {'apiKey': process.env.METRO_HERO_API_KEY}
  });
  request.get('metrorail/stations/tags')
  .then(response => {
    const lines = parseMetroHeroResp(response.data);
    if (lines.length > 0) {
      const tasks = [cb=>updateS3(lines,cb),cb=>sendTweet(lines,cb)];
      parallel(tasks,(err,res)=>lambdaFinished(err,res));
    } else {
      updateS3([],lambdaFinished);
    }
  })
  .catch(error => {
    console.log(error);
  });
};
