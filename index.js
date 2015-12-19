require('dotenv').load();
var _ = require('lodash');
var Twitter = require('twitter');
var AWS = require('aws-sdk'); 
AWS.config.update({accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});
var s3 = new AWS.S3();

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

var getOpening = function(){
  var openings = ["Oh shit. ", "Conflabbit! ", "Just great. ", "Nuts. ", "Once again,", "This is not a laughing matter, but ", "Shawty fire burning on Metro. ", "I wouldn't ride Metro today. ", "Please be careful, ", "Call in squirtle! "];
  var item = openings[Math.floor(Math.random()*openings.length)];
  return item;
};

var yesText = function(){
  yes = ["It looks like it","Twitter says yes","Yes","Unfortunately","Yep","Why, yes it is!","I'm afraid so"]
  var item = yes[Math.floor(Math.random()*yes.length)];
  return item;
};

var noText = function(){
  no = ["Not Yet!", "Nope!", "It is not", "Doesn't look like it", "No"] 
  var item = no[Math.floor(Math.random()*no.length)];
  return item;
};

var beforeDate = function(tweet) {
  date = tweet['created_at'];
  var now = new Date();
  now = now.getTime();
  if ( now  < (Date.parse(date) + (15*60000) ) ){
    return true;
  }
  else {
    return false;
  }
};

var checkForTerms = function (text,termsArray){
  var response = false;
  var lowerText = text.toLowerCase();
  termsArray.forEach(function(term){
    if (lowerText.indexOf(term) >= 0) {
      response = true;
    }
  });
  return response;
};

var determineLine = function (text){
  var results = [];
  var red = ["rd", "red", "shady", "rockville", "twinbrook", "white flint", "grosvenor", "medical center", "bethesda", "friendship heights", "tenleytown", "van ness", "cleveland park", "woodley", "dupont", "farragut north", "metro center", "gallery place", "judiciary", "union station", "noma gallaudet u", "rhode island avenue brentwood", "brookland cua", "totten", "takoma", "silver spring", "forest glen", "wheaton", "glenmont", "strathmore", "udc", "friendship hts", "metro ctr", "chinatown", "noma", "galludet"];
  var silver = ["silver", "sv", "wiehle", "spring hill", "greensboro", "tysons", "mclean", "east falls church", "ballston", "virginia", "clarendon", "court house", "rosslyn", "foggy bottom", "farragut west", "mcpherson", "metro center", "triangle", "smithsonian", "l'enfant plaza", "federal center", "capitol south", "eastern market", "potomac", "stadium", "benning", "heights", "addison", "morgan", "largo", "metro ctr", "lenfant", "armory", "reston"];
  var blue = ["franconia", "dorn", "king", "braddock", "armory", "national airport", "crystal", "pentagon city", "pentagon", "arlington cemetery", "rosslyn", "foggy", "farragut west", "mcpherson", "metro center", "triangle", "smithsonian", "l'enfant", "federal center", "capitol south", "eastern market", "potomac", "stadium", "benning", "capitol heights", "addison road", "morgan", "largo", "metro ctr", "national airport", "national", "franconia", "old town", "cemetery", "lenfant", "armory", "dca", "airport"];
  var orange = ["vienna", "dunn loring", "falls church", "ballston", "virginia square", "clarendon", "court house", "rosslyn", "foggy bottom", "farragut west", "mcpherson", "metro center", "triangle", "smithsonian", "l'enfant plaza", "federal center", "capitol south", "eastern market", "potomac", "stadium", "minnesota", "deanwood", "cheverly", "landover", "carrollton", "metro ctr", "lenfant", "armory"];
  var yellow = ["huntington", "eisenhower", "king street", "braddock", "potomac", "national airport", "crystal city", "pentagon city", "pentagon", "l'enfant plaza", "archives", "gallery place", "vernon", "shaw", "u street", "columbia", "petworth", "totten", "hyattsville", "george", "college park", "greenbelt", "cardozo", "chinatown", "national airport", "national", "lenfant", "georgia", "howard", "dca", "airport"];
  var green = ["greenbelt", "branch", "suitland", "naylor", "southern", "congress", "anacostia", "navy yard", "waterfront", "l'enfant", "archives", "gallery", "vernon", "shaw", "u street", "columbia", "petworth", "totten", "west hyattsville", "george", "college park", "greenbelt", "chinatown", "lenfant", "georgia", "howard"];
  if (checkForTerms(text,red)){ results.push("red"); }
  if (checkForTerms(text,silver)){ results.push("silver"); }
  if (checkForTerms(text,blue)){ results.push("blue"); }
  if (checkForTerms(text,orange)){ results.push("orange"); }
  if (checkForTerms(text,yellow)){ results.push("yellow"); }
  if (checkForTerms(text,green)){ results.push("green"); }
  if (results.length === 0 ){
    return false;
  }
  else {
    return results
  }
};

var sendTweet = function(text){
  client.post('statuses/update', {status: text},  function(error, tweet, response){
    if(error) throw error;
  });
};

var updateS3 = function(result_json){
  var results = JSON.stringify(result_json);
  var params = {Bucket: 'www.ismetroonfire.com', Key: 'fireapi', Body: results};
  s3.putObject(params, function(err, data) {
    if (err) {
      console.log(err);
    }        
  });
  s3.putObject(params)
};

var getTwitter = function() {
  result_json = {"counts":{}};
  client.get('statuses/user_timeline', {screen_name: 'loudnick123pig', exclude_replies:true, include_rts: true},  function(error, tweets, response){
    if(error) { throw error; }
    var current_tweets = [];
    tweets.forEach(function(tweet){
      if (beforeDate(tweet)){
        current_tweets.push(tweet);
      }
    });

    affected_lines = [];
    current_tweets.forEach(function(tweet) {
      if ( checkForTerms(tweet.text, ['fire','smoke','fd'] ) ){
        determineLine(tweet.text).forEach(function(line){
          affected_lines.push(line);
        });
      }
    });

    if (affected_lines.length > 0){
      affected_lines = _.uniq(affected_lines);
      
      ["red","orange","yellow","green","blue","silver"].forEach(function(line){
        if (affected_lines.indexOf(line) > -1){
          result_json["counts"][line] = true;
        }
        else {
          result_json["counts"][line] = false;
        }
      });

      result_json["message"] = yesText();

      // Update S3
      updateS3(result_json);

      // Tweet It
      var lines;
      if (affected_lines.length === 1 ){
        var lines = String(affected_lines).split(",").join(", ") + " line";
      }
      else {
        var lines = String(affected_lines).split(",").join(", ") + " lines"
      }

      sendTweet(getOpening() + "Twitter is reporting fire/smoke on the " + lines + ". http://www.IsMetroOnFire.com");
    }
    else {
      result_json = {"counts":{"red":false,"orange":false,"yellow":false,"green":false,"blue":false,"silver":false}};
      result_json["message"] = noText();
      updateS3(result_json);
    }
  });
};

exports.handler = function(event, context) {
  getTwitter();  
  context.succeed("complete!");
};
