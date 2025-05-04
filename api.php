<?php
// First, I tell the browser that everything coming from this script should be interpreted as JSON.
// This makes sure the JavaScript on the frontend knows to expect structured data, not plain HTML.
header('Content-Type: application/json');

// Now I need to connect to the MySQL database.
// I'm using PDO here because it's more secure and flexible than the old MySQL functions.
// My database is called 'test', and I’m using the default MAMP login — root and root.
// I also want to make sure that if something goes wrong, I get a useful error.
try {
    $db = new PDO("mysql:host=localhost;dbname=test", "root", "root");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // If something goes wrong with the connection, I return an error in JSON format and stop the script.
    echo json_encode([
        "error" => "DB connection failed",
        "message" => $e->getMessage()
    ]);
    exit;
}

// The frontend (JavaScript) sends me some data using a POST request.
// That data is in JSON format, so I read it using `php://input` and decode it into a PHP array.
    $input = json_decode(file_get_contents("php://input"), true);

    // If the data is missing or not valid JSON, I stop the script and send back an error.
    // This helps me catch problems early and avoid weird undefined index errors later.
    if (!$input) {
        echo json_encode(["error" => "No valid input received."]);
        exit;
    }

    
// At this point, I want to extract the values sent by the user.
// These include latitude and longitude bounds for the map, and any optional filters like cache type and difficulty.
// I use the null coalescing operator (`??`) just in case something is missing.
$minLat     = $input['minLat'] ?? null;
$maxLat     = $input['maxLat'] ?? null;
$minLng     = $input['minLng'] ?? null;
$maxLng     = $input['maxLng'] ?? null;
$cacheType  = $input['type'] ?? "";
$difficulty = $input['difficulty'] ?? "";

// Now I build the SQL query that will get the data from the database.
// I’m using table aliases (`td` for test_data, and `ct` for cache_types) to keep the code clean.
// I join the two tables together so I can get the readable cache type name, not just the numeric ID.
// I also filter the results by latitude and longitude so I only return caches within the search area.
$query = "SELECT td.*, ct.cache_type AS cache_type
          FROM test_data td
          JOIN cache_types ct ON td.cache_type_id = ct.type_id
          WHERE td.latitude BETWEEN :minLat AND :maxLat
            AND td.longitude BETWEEN :minLng AND :maxLng";

// If the user selected a specific cache type from the dropdown,
// I add an extra filter to the SQL query so we only return that type.
if ($cacheType !== "") {
    $query .= " AND td.cache_type_id = :cacheType";
}

// Same thing here — if the user selected a difficulty rating,
// I add another filter to the query to narrow down the results.
if ($difficulty !== "") {
    $query .= " AND td.difficulty_rating = :difficulty";
}

// Now I prepare and execute the SQL query.
// I use bindValue to safely attach the parameters the user provided.
// This prevents SQL injection and keeps things secure.
try {
    $stmt = $db->prepare($query);
    $stmt->bindValue(':minLat', $minLat);
    $stmt->bindValue(':maxLat', $maxLat);
    $stmt->bindValue(':minLng', $minLng);
    $stmt->bindValue(':maxLng', $maxLng);

    // If the user set a cache type, I bind that as well.
    if ($cacheType !== "") $stmt->bindValue(':cacheType', $cacheType);

    // Same for difficulty — I only bind it if it was actually provided.
    if ($difficulty !== "") $stmt->bindValue(':difficulty', $difficulty);

    // Now I run the query.
    $stmt->execute();

    // I fetch all the rows that matched the search and store them in `$rows`.
    // I use `PDO::FETCH_ASSOC` so I get a clean array with column names as keys.
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Finally, I convert the rows into JSON and send them back to the frontend.
    // The JavaScript will take this response and place markers on the map and build the table.
    echo json_encode($rows);
}

// If something goes wrong with the query itself (like a typo or invalid field),
// I catch the error and return a message in JSON format for easier debugging.
catch (PDOException $e) {
    echo json_encode(["error" => "Query failed", "message" => $e->getMessage()]);
}
?>

