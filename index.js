// Load in dotenv vars
// Be sure to not use standard AWS naming conventions, as the lambda environment will already have these loaded
require('dotenv').load();

// Load Dependencies and set vars
var _ = require('lodash');
var Twitter = require('twitter');
var AWS = require('aws-sdk'); 
AWS.config.update({accessKeyId: process.env.AAK, secretAccessKey: process.env.ASAK, region: 'us-east-1', sslEnabled: true});
var s3 = new AWS.S3();

// Setup Twitter Client
var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Twitter Opening
var getOpening = function(){
  return _.sample(["Oh shit. ","Conflabbit! ","Just great. ","Nuts. ","Once again,","This is not a laughing matter, but ","Shawty fire burning on Metro. ","I wouldn't ride Metro today. ","Please be careful, ","Call in squirtle! ","Tell all your friends, ","Reset the counter! "]);
};

// Website "Yes"
var yesText = function(){
  return _.sample(["It looks like it","Twitter says yes","Yes","Unfortunately","Yep","Oh yeah!","Why, yes it is!","I'm afraid so"]);
};

// Website "No"
var noText = function(){
  return _.sample(["Not Yet!", "Nope!", "It is not", "Doesn't look like it", "No", "Nah", "Negative"]);
};

// Filter tweets 15 minutes old
var beforeDate = function(tweet) {
  date = tweet['created_at'];
  var now = new Date();
  now = now.getTime();
  fifteen = Date.parse(date) + (15*60000);
  if ( now < fifteen ) { 
    return true; 
  }
  else { 
    return false; 
  }
};

// Check to see if a string contains a string from an array
var checkForTerms = function (text,termsArray){
  var response = false;
  var lowerText = ' ' + text.toLowerCase() + ' ';
  termsArray.some(function (term) {
    if (lowerText.indexOf(' ' + term + ' ') >= 0) {
      response = true;
      return true;
    }
  });
  return response;
};

// Determine the line based on the station
var determineLine = function (text){
  var results = [];
  var red = ["rd", "red", "shady", "rockville", "twinbrook", "flint", "grosvenor", "strathmore ", "medical center", "bethesda", "friendship", "tenleytown", "van ness", "cleveland", "woodley", "dupont", "farragut north", "gallery", "judiciary", "union station", "noma gallaudet u", "rhode island", "brentwood", "brookland", "cua", "totten", "takoma", "silver spring", "forest glen", "wheaton", "glenmont", "udc", "metro center", "metro ctr", "chinatown", "noma", "galludet"];
  var silver = ["silver", "sv", "wiehle", "spring hill","metro center", "metro ctr", "greensboro", "tysons", "mclean", "east falls church", "efc", "ballston", "virginia", "clarendon", "court house", "rosslyn", "foggy", "farragut west", "mcpherson", "triangle", "smithsonian", "l'enfant", "federal center", "capitol south", "eastern", "potomac", "stadium", "benning", "heights", "addison", "morgan", "largo", "lenfant", "armory", "reston"];
  var blue = ["blue", "bl", "franconia", "dorn", "metro center", "metro ctr", "king", "braddock", "armory", "airport", "crystal", "pentagon", "cemetery", "rosslyn", "foggy", "farragut west", "mcpherson", "triangle", "smithsonian", "l'enfant", "federal center", "capitol south", "eastern market", "potomac", "stadium", "benning", "capitol heights", "addison", "morgan", "largo", "national", "old town", "lenfant", "dca"];
  var orange = ["orange", "or", "vienna", "dunn loring", "metro center", "metro ctr", "falls church", "ballston", "virginia square", "clarendon", "court house", "rosslyn", "foggy bottom", "farragut west", "mcpherson", "triangle", "smithsonian", "l'enfant plaza", "federal center", "capitol south", "eastern market", "potomac", "stadium", "minnesota", "deanwood", "cheverly", "landover", "carrollton", "lenfant", "armory"];
  var yellow = ["yellow", "yl", "huntington", "eisenhower", "king", "braddock", "potomac", "airport", "crystal city", "pentagon", "l'enfant", "archives", "gallery", "vernon", "shaw", "u street", "u st", "cardozo", "columbia", "petworth", "totten", "hyattsville", "george", "college park", "greenbelt", "chinatown", "lenfant", "georgia", "howard", "dca"];
  var green = ["green", "gr", "greenbelt", "branch", "suitland", "naylor", "southern", "congress", "anacostia", "navy yard", "waterfront", "l'enfant", "archives", "gallery", "vernon", "shaw", "u street", "u st", "cardozo", "columbia", "petworth", "totten", "hyattsville", "george", "college park", "chinatown", "lenfant", "georgia", "howard"];
  
  ["red","orange","yellow","green","blue","silver"].forEach(function(line){
    if (checkForTerms(text,eval(line))) { results.push(line); }
  });

  if (results.length === 0 ){
    return false;
  }
  else {
    return results
  }
};

// Send tweet!
var sendTweet = function(text){
  client.post('statuses/update', {status: text},  function(error, tweet, response){
    if(error) throw error;
    console.log(response);
  });
  return true;
};

// Update the S3 API
var updateS3 = function(result_json,context){
  var results = String(JSON.stringify(result_json));
  var params = {Bucket: 'www.ismetroonfire.com', Key: 'fireapi', Body: results, ContentType:"application/json; charset=utf-8", CacheControl: 'no-cache'};
  var request = s3.putObject(params);
  request.on('complete', function(response) { 
    console.log(response);
    context.done(); 
  }).on('error', function(response){
    throw response;
  }); 
  request.send();
  return true
};

// Main entry
var getTweets = function(event,context,callback){
  var affected_lines = [];

  // Check all twitter accounts
  client.get('statuses/home_timeline', function(error, tweets, response){
    if(error) { throw error; }
    // Make sure tweet are within the last 15 minutes
    var current_tweets = [];
    tweets.forEach(function(tweet){
      if (beforeDate(tweet)){
        current_tweets.push(tweet);
      }
    });

    // Check to see if any tweets contain information about fire or smoke
    current_tweets.forEach(function(tweet) {
      if (checkForTerms(tweet.text, ['fire','smoke','fd'])) {
        determineLine(tweet.text).forEach(function(line){
          if ( _.includes(["red","orange","silver","blue","green","yellow"], line) ) {
            affected_lines.push(line);
          }
        });
      }
    });
    callback(affected_lines,context);
  });
};

// Processor (called by getTweets)
var run = function(lines,context){
  var result_json = {"counts":{}};

  // If we have a line detected to be on fire
  if (lines.length > 0){
    lines = _.uniq(lines);

    // Get a human readable string
    var linesString;
    if (lines.length === 1 ){
      linesString = String(lines).split(",").join(", ") + " line";
    }
    else {
      linesString = String(lines).split(",").join(", ") + " lines"
    }
    
    // Tweet It
    sendTweet(getOpening() + "Twitter is reporting fire/smoke on the " + linesString + ". http://www.IsMetroOnFire.com");

    // Update S3
    ["red","orange","yellow","green","blue","silver"].forEach(function(line){
      if (lines.indexOf(line) > -1){
        result_json["counts"][line] = true;
      }
      else {
        result_json["counts"][line] = false;
      }
    });
    result_json["message"] = yesText();
  }
  // If we have detected no lines to be on fire
  else {
    result_json = {"counts":{"red":false,"orange":false,"yellow":false,"green":false,"blue":false,"silver":false}};
    result_json["message"] = noText();
  }
  // Much Success
  updateS3(result_json,context);
  return true;
};

// Lambda Entry
exports.handler = function(event, context) {
  // getTweets => run => updateS3 (where context.done() lives)
  getTweets(event, context, run);
};
