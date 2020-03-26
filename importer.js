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
    if (!file) return { pantries: [] };

    return JSON.parse(file);
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
      if (src.organizations !== organizations) {
        throw new Error("Pantries do not match!");
      }
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
    var srcIndex = 0;
    var pantryPromises = rawPantries.map((pantry) => {
      var src = savedPantries.pantries[srcIndex];
      var target = renamekeys(pantry, function(key) {
        return key.toLowerCase().replace(/[\.]/, '');
      });

      // new pantry entry
      if (!src || src.organizations !== target.organizations) {
        return { ...target, ...geocodePantry(target) };
      }

      srcIndex += 1;
      const merged = mergePantry(src, target);
      if (src.address === target.address && src.city === target.city) {
        return merged;
      }

      return { ...merged, ...geocodePantry(merged) };
    });

    // Once all promises resolved, write to file
    Promise.all(pantryPromises).then(function(pantries) {
      var output = { "pantries" : pantries };

      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    });
  });
}

capturePantries('http://www.endhungerdurham.org/food-pantries/', out);

