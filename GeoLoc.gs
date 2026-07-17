function convertLatLongToExactAddress() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Readings");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    // No data rows
    return;
  }
  var latLongRange = sheet.getRange("i2:i" + lastRow);
  var latLongs = latLongRange.getValues();
  var addresses = [];

  for (var i = 0; i < latLongs.length; i++) {
    var latLong = latLongs[i][0];
    if (latLong && typeof latLong === 'string' && latLong.indexOf(",") > -1) {
      var parts = latLong.split(",");
      var lat = parseFloat(parts[0].trim());
      var lng = parseFloat(parts[1].trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          var response = Maps.newGeocoder().reverseGeocode(lat, lng);

          if (response.status === "OK" && response.results && response.results.length > 0) {
            var results = response.results;
            var preciseAddress = "";
            // Find the first result with type street_address or premise for max granularity
            for (var j = 0; j < results.length; j++) {
              var types = results[j].types;
              if (types.indexOf("street_address") > -1 || types.indexOf("premise") > -1) {
                preciseAddress = results[j].formatted_address;
                break;
              }
            }
            // Fallback to first result if no precise type found
            if (!preciseAddress) {
              preciseAddress = results[0].formatted_address;
            }
            addresses.push([preciseAddress]);
          } else {
            addresses.push(["Address not found"]);
          }
        } catch (e) {
          addresses.push(["Error: " + e.message]);
        }
      } else {
        addresses.push(["Invalid lat,long"]);
      }
    } else {
      // Blank or malformed input
      addresses.push([""]);
    }
  }

  // Write results into column J starting at row 2 (index 10 = column J)
  sheet.getRange(2, 10, addresses.length, 1).setValues(addresses);
  
}
