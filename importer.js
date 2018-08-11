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

// completely naive and non performant, need to better understand how promises work
function geocodePantries(file) {
  var pantries = JSON.parse(fs.readFileSync(file, 'utf8'))["pantries"];

  // Setup Geocoder
  var geocoder = nodegeocoder(providerOptions);

  function geocodePantry(index) {
    var pantry = pantries[index];

    var lookupAddress = pantry["address"] + " " + pantry["city"];
    geocoder.geocode(lookupAddress, function(err, res) {
      var latitude = res[0]["latitude"];
      var longitude = res[0]["longitude"];

      pantries[index]["latitude"] = latitude;
      pantries[index]["longitude"] = longitude;
      var output = { "pantries" : pantries };

      fs.writeFileSync(file, JSON.stringify(output));
    });
  }

  for (var i = 0; i < pantries.length; ++i) {
    geocodePantry(i);
  }
}

var output = "pantries.json";
capturePantries('http://www.endhungerdurham.org/food-pantries/', output, geocodePantries);

