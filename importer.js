var fs = require('fs');
var tabletojson = require('tabletojson');
var renamekeys = require('rename-keys');
var nodegeocoder = require('node-geocoder');

var providerOptions = {
  provider: 'google',
  apiKey: process.argv[2],
  formatter: null
};


function capturePantries(url, outputFile, completion) {
  tabletojson.convertUrl(url, { useFirstRowForHeadings: true }, function(tablesAsJson) {
    // capture pantries table
    var rawPantries = tablesAsJson[0];
    rawPantries.shift();

    // clean up keys to remove '.' and lowercase
    var target = []
    for (index in rawPantries) {
      var pantry = rawPantries[index];
      var modified = renamekeys(pantry, function(key, value) {
        return key.toLowerCase().replace(/[\.]/, '');
      });

      // store modified 
      target.push(modified);
    }

    // build output
    var output = { "pantries" : target };

    // save as json
    fs.writeFileSync(outputFile, JSON.stringify(output));

    // notify complete
    completion(outputFile);
  });
}

function geocodePantries(file) {
  var pantries = JSON.parse(fs.readFileSync(file, 'utf8'))["pantries"];

  // Setup Geocoder
  var geocoder = nodegeocoder(providerOptions);

  // Get latitude and longitude for each pantry (async)
  var promises = pantries.map(function(pantry) {
    var lookupAddress = pantry["address"] + " " + pantry["city"];

    return geocoder.geocode(lookupAddress)
    .then(function(res) {
      pantry.latitude = res[0]["latitude"];
      pantry.longitude = res[0]["longitude"];

      return pantry;
    });
  });
  
  // Once all promises resolved, write to file
  Promise.all(promises).then(function(pantries) {
    var output = { "pantries" : pantries };
    
    fs.writeFileSync(file, JSON.stringify(output));
  });  
}

var output = "pantries.json";
capturePantries('http://www.endhungerdurham.org/food-pantries/', output, geocodePantries);

