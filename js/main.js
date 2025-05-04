// I begin by declaring global variables that are shared across functions.
// "map" will store the Google Map instance. "markers" is an array to hold all markers currently on the map.
// "infoWindow" will be a single popup window used to display cache details when a marker is clicked.
let map;
let markers = [];
let infoWindow;

// This function runs after the page loads and initializes the map.
// I center it on Tucson, like instructions said, and add an event listener to the Search button to trigger the geocache filter logic.
function initMap() {
  const defaultCenter = { lat: 32.253, lng: -110.912 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 8
  });

  infoWindow = new google.maps.InfoWindow();
  document.getElementById("searchBtn").addEventListener("click", filterGeocaches);
}

// This function collects input, builds bounding box coordinates, and sends the data to the PHP backend.
// This function handles everything from reading the user's input to sending it to the backend for processing.
// I begin by reading the values from the latitude and longitude input fields.
// If the user leaves them blank, I fall back to default coordinates (Tucson, AZ) to keep the app functional.
function filterGeocaches() {
  const lat = parseFloat(document.getElementById("lat").value) || 32.253;
  const lng = parseFloat(document.getElementById("lng").value) || -110.912;

  // Next, I read the distance the user entered in miles and default to 10 if the field is empty.
  // Since the Google Maps API expects radius values in meters, I multiply by 1609 to convert.
  const distanceMiles = parseFloat(document.getElementById("distance").value) || 10;
  const radius = distanceMiles * 1609;

  // I also grab the selected cache type and difficulty from their dropdown menus.
  // These are optional filters the user can apply to narrow down their results.
  const cacheType = document.getElementById("cacheType").value;
  const difficulty = document.getElementById("difficulty").value;

  // Now I create a position object from the latitude and longitude,
  // which I’ll use to define the center of the search area.
  const position = { lat, lng };

  // I move the map so it centers on the user's chosen coordinates,
  // and then zoom in to give a better view of the search radius.
  map.panTo(position);
  map.setZoom(7);

  // I don’t actually draw a circle on the map, but I do use one invisibly
  // to help calculate the bounding box of the area defined by the user’s location and distance.
  const bounds = new google.maps.Circle({ center: position, radius }).getBounds();

  // From the circle’s bounding box, I extract the minimum and maximum latitude and longitude values.
  // These values define the rectangular area that will be searched in the database.
  const params = {
    minLat: bounds.getSouthWest().lat(),
    maxLat: bounds.getNorthEast().lat(),
    minLng: bounds.getSouthWest().lng(),
    maxLng: bounds.getNorthEast().lng(),
    type: cacheType,
    difficulty: difficulty
  };

  // I print the parameters to the console so I can double-check them while testing.
  console.log("Sending params to API:", params);

  // Finally, I send a POST request to `api.php`, passing the user's filters as a JSON object.
  // The PHP script will query the database using these filters and return matching geocaches.
  fetch("api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  })

  // Once I get a response back, I convert it from JSON into a JavaScript object.
  // If everything worked, I pass the resulting geocache list to `displayGeocaches()`.
  .then(res => res.json())
  .then(rows => {
    console.log("Response from API:", rows);
    displayGeocaches(rows);
  })

  // If there’s a problem — maybe a network issue or a PHP error —
  // I catch it here and log it to the console for easier debugging.
  .catch(err => {
    console.error("Error fetching geocache data:", err);
  });
}


// This function is responsible for taking the geocache data returned from the backend
// and rendering it both on the Google Map and in the HTML table below it.
function displayGeocaches(rows) {
  // Before doing anything else, I make sure the data is actually an array.
  // If it's not (which could happen if the PHP script fails or returns an error),
  // I log the unexpected value and show an alert so the user knows something broke.
  if (!Array.isArray(rows)) {
    console.error("Expected array, but got:", rows);
    alert("Something went wrong. Please check the server!!");
    return;
  }

  // Now that I know the data is good, I remove any previous markers from the map.
  // This ensures we don’t show leftover points from a past search.
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  // I also clear out the table below the map.
  // This makes sure the new results don’t just stack on top of the old ones.
  const tableBody = document.querySelector("#results-table tbody");
  tableBody.innerHTML = "";

  // Now I loop through each geocache row returned from the server.
  // For each one, I’ll place a marker on the map and add a new row in the results table.
  rows.forEach(cache => {
    // I build a `position` object using the latitude and longitude from the current row.
    // I parse them as floats just in case they come in as strings.
    const position = {
      lat: parseFloat(cache.latitude),
      lng: parseFloat(cache.longitude)
    };

    // I create a new marker using the current cache’s position.
    // I set the title of the marker to show the cache type and difficulty rating as a tooltip.
    const marker = new google.maps.Marker({
      map,
      position,
      title: `${cache.cache_type}, Difficulty: ${cache.difficulty_rating}`
    });

    // I set up a click listener for this marker.
    // When the user clicks it, a pop-up window will show more information and photos.
    marker.addListener("click", () => openInfoWindow(marker, cache));

    // I store this marker in the global `markers` array so I can clear it later if needed.
    markers.push(marker);

    // Now I move on to building a new row in the results table.
    const row = document.createElement("tr");

    // I use template literals to fill in the row with the cache type, difficulty, and coordinates.
    row.innerHTML = `
      <td>${cache.cache_type}</td>
      <td>${cache.difficulty_rating}</td>
      <td>${cache.latitude}, ${cache.longitude}</td>
    `;

    // I also add a click event to this table row.
    // Clicking the row does the same thing as clicking the marker: the map pans to it, and a pop-up opens.
    row.addEventListener("click", () => {
      map.panTo(position);
      openInfoWindow(marker, cache);
    });

    // I add the new row to the table body so the user can scroll through all their results.
    tableBody.appendChild(row);
  });
}


// This function is triggered whenever the user clicks a map marker or a row in the results table.
// It opens a pop-up window (called an InfoWindow) on the map showing information about the selected cache.
function openInfoWindow(marker, cache) {
  // I start by building the content that will go inside the InfoWindow.
  // This includes the cache type (like Traditional or Multi-Cache), the difficulty rating,
  // the exact location (latitude and longitude), and an empty <div> where I’ll later insert Flickr photos.
  // I use template literals so I can easily insert the cache’s data into the HTML.
  const content = `
    <div>
      <strong>${cache.cache_type}</strong><br>
      Difficulty: ${cache.difficulty_rating}<br>
      Location: ${cache.latitude}, ${cache.longitude}
      <div id="infoPhotos" style="margin-top:10px;"></div>
    </div>
  `;

  // Once the content is built, I assign it to the `infoWindow` popup using `setContent`.
  // This replaces whatever was in the InfoWindow before (it’s reused for every marker).
  infoWindow.setContent(content);

  // Then I actually display the InfoWindow on the map, attached to the marker that was clicked.
  infoWindow.open(map, marker);

  // Lastly, I call another function — `loadFlickrPhotos()` — which will asynchronously fetch
  // thumbnails of photos taken near the geocache location using the Flickr API.
  // The photos will be inserted into the <div> I left inside the InfoWindow.
  loadFlickrPhotos(cache.latitude, cache.longitude, "infoPhotos");
}


// This function uses the Flickr API to get images near the coordinates of a selected geocache.
// It's called every time a marker or table row is clicked, and it fills the InfoWindow with photos.
function loadFlickrPhotos(lat, lng, containerId) {
  // First, I set my personal Flickr API key. This key allows me to send requests to the Flickr service.
  // Without this, Flickr would reject the request. (You’d normally want to hide this key in a secure place.)
  const flickrKey = "3cc36b75775608e19b32c07a2d74fdb9";

  // Now I build the full request URL.
  // This URL tells Flickr I want public photos taken near the provided lat/lng,
  // and I want the results in raw JSON format (not wrapped in a callback).
  const flickrURL = `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${flickrKey}&lat=${lat}&lon=${lng}&format=json&nojsoncallback=1&per_page=12`;

  // I use `fetch()` to send the request to Flickr’s API.
  // Once I get a response, I convert it to a JavaScript object using `.json()`.
  fetch(flickrURL)
    .then(res => res.json())

    // After parsing the JSON, I extract the array of photo metadata.
    // Each object in this array represents one photo and includes IDs needed to build the thumbnail URL.
    .then(data => {
      const photos = data.photos.photo;
      let output = "";

      // I loop through each photo and construct the full image URL using Flickr's naming pattern.
      // I use the `_t.jpg` version, which is a small thumbnail.
      // Then I build an <img> tag for each and add it to the `output` string.
      photos.forEach(photo => {
        const url = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_t.jpg`;
        output += `<img src="${url}" alt="Flickr photo" style="margin:2px;">`;
      });

      // Once all images are ready, I insert them into the specified container inside the InfoWindow.
      // This gives the user a quick visual of what the location looks like.
      document.getElementById(containerId).innerHTML = output;
    })

    // If something goes wrong — maybe the API fails or the network breaks —
    // I catch the error, log it to the console, and show a simple fallback message instead of the images.
    .catch(err => {
      console.error("Flickr error:", err);
      document.getElementById(containerId).innerHTML = "<p>Error loading photos.</p>";
    });
}


// The last step is I wait until the entire page has finished loading before initializing the map.
// This makes sure all the HTML elements (like the <div id="map">) are available before the JavaScript runs.
document.addEventListener("DOMContentLoaded", initMap);

