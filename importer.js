var fs = require('fs');
var tabletojson = require('tabletojson');
var renamekeys = require('rename-keys');
var nodegeocoder = require('node-geocoder');
var out = "pantries.json";

var providerOptions = {
  provider: 'google',
  apiKey: process.argv[2],
  formatter: null
};

function pantryGeocoder(providerOptions) {
  var geocoder = nodegeocoder(providerOptions);

  return async (pantry) => {
    if (!pantry || !pantry.address || !pantry.city) {
      console.error(pantry);
      throw new Error("Invalid pantry for geocoding.");
    }

    console.log('geocoding');
    var lookupAddress = pantry["address"] + " " + pantry["city"];
    return geocoder.geocode(lookupAddress).then(function(res) {
      return {
        latitude: res[0]["latitude"],
        longitude: res[0]["longitude"],
      };
    });
  };
}

function capturePantries(url, outputFile) {
  var savedPantries = (() => {
    var file = fs.readFileSync(out, 'utf8');
    if (!file) return { pantries: {} };

    var pantriesList = JSON.parse(file).pantries;
    var addresses = {};
    pantriesList.forEach((pantryObj) => {
      addresses[pantryObj.address] = pantryObj;
    });
    return addresses;
  })();

  tabletojson.convertUrl(url, { useFirstRowForHeadings: true }, function(tablesAsJson) {
    // capture pantries table
    var rawPantries = tablesAsJson[0];
    rawPantries.shift();

    // Setup Geocoder
    var geocodePantry = pantryGeocoder(providerOptions);

    const mergePantry = (src, target) => {
      const {
        organizations, address, city, days, hours, phone, info, prereq,
      } = target;

      return {
        organizations,
        address,
        city,
        days,
        hours,
        phone,
        info,
        prereq,
        latitude: src.latitude,
        longitude: src.longitude,
      };
    };

    // clean up keys to remove '.' and lowercase
    var pantryPromises = rawPantries.map((pantry) => {
      var target = renamekeys(pantry, function(key) {
        return key.toLowerCase().replace(/[\.]/, '');
      });

      // avoid geocoding if the address, lat, and lng were already saved
      if (savedPantries[target.address]) {
        return mergePantry(savedPantries[target.address], target);
      }

      return geocodePantry(target).then((result) => {
        return { ...target, ...result };
      });
    });

    // Once all promises resolved, write to file
    Promise.all(pantryPromises).then(function(pantries) {
      var output = { "pantries" : pantries };

      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    });
  });
}

capturePantries('http://www.endhungerdurham.org/food-pantries/', out);

