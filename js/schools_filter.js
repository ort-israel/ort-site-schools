jQuery(document).ready(function ($) {

    /**********************************
     ************* EVENTS *************
     **********************************/

    /* When a user types, or focuses in the text input call the filterSchools function.
    * Can't use arrow function because the this isn't the element which the event happened on */
    $("#schools_filter_text").on('keyup', function (e) {
        filterSchools($(this), e);
    });

    $("#schools_filter_text").on('focus', function () {
        schoolsFilterTextFocusHandler($(this));
    });

    /* When a city name is clicked call the cityClickedHandler function */
    $('.elementor-accordion .elementor-tab-title').on('click', cityClickedHandler);

    /* There is a button to jump from the city list to the map, and a button to kump back.
    * They  interchange on scroll */
    window.addEventListener('scroll', windowScrollHandler);


    /**********************************
     ***** SEARCH SCHOOLS FILTER ******
     **********************************/

    /**
     * Show and hide cities and schools according to the value entered in the text input.
     * The logic of looking up the text from the search in the city names using a Regular Expression is taken from:
     * https://stackoverflow.com/questions/27096548/filter-by-search-using-text-found-in-element-within-each-div/27096842#27096842
     */
    function filterSchools(self) {


        /* Create the Regular Expression from the search text and then filter out the cities that don't match the Regular Expression. */
        var matcher = new RegExp(self.val(), 'gi');


        /* Start with CITY names - find('.elementor-tab-content a') -
        * find the schools that don't match the searched value,
        * then Check the city name:
        * If it doesn't match the searched value hide the whole city.
        * If the city does match the searched value, leave it showing.
        * Start with showing all, for cases when the search changed completely */
        let shownCities = $('.elementor-accordion-item').show().each(function () {
                if (!matcher.test($(this).find('.elementor-tab-content li').text())) {
                    // if city name doesn't contain the value entered, hide it
                    if (!matcher.test($(this).find('.elementor-tab-title a').text())) {
                        $(this).hide();
                    } else {
                        // if the title (city name) does contain the value, leave it showing and also show all the school names
                        $(this).find('.elementor-tab-content li').show();
                    }
                }
            }
        );

        /* Then go on with the schools in the shown cities: hide all schools that don't match the value,
        * but only in the cities that don't match the value.
        * Because in the cities that do match the value we want to show all schools */
        shownCities
            .not(matcher.test($(this).find('.elementor-tab-title a').text()))
            .find('.elementor-tab-content li').show().not(function () {
            return matcher.test($(this).text())
        }).hide();

    }

    /**
     * What to do when user puts focus on the text input of the school filter:
     * 1. The map should go back to initial state
     * 2. The cities and schools should be filtered acoording to whatever input is in the text box
     * 3. Any markers showing on the map should be closed
     * @param self - $("#schools_filter_text")
     */
    function schoolsFilterTextFocusHandler(self, e) {
        // return map to original bounds and size
        resetMap();
        // filter the schools
        filterSchools(self);
        // close any open markers and infowindows
        closeClickHandler();
    }

    /***************************************
     * ********* Google Maps API ********* *
     ***************************************/

    let map, geocoder, kmlLayer, infowindow, marker;
    let mapIsReset = true;

    /**
     * Needs to called before the map is created,
     * so any new cities are inserted into the json file and are shown in the list
     */
    updateCitiesFile();

    /* Call initMap to initialize the map */
    initMap();

    /**
     * Initialize the map and all its objects - kmlLayer, infowindow
     */
    function initMap() {

        createMap();

        addKmlLayer();

        createInfoWindowObject();

        /***********/
        /* EVENTS */
        /***********/

        /* When the map bounds are changed, change the city list to reflect the new bounds */
        google.maps.event.addListener(map, 'bounds_changed', boundsChangedHandler);

        /* When one of the markers is clicked, open a styled popup, using the InfoWindow object created earlier */
        kmlLayer.addListener('click', kmlLayerClickedHandler);

        /* event taken from here: https://stackoverflow.com/questions/6777721/google-maps-api-v3-infowindow-close-event-callback/6777885#6777885 */
        google.maps.event.addListener(infowindow, 'closeclick', closeClickHandler);

        /* Clicking the map closes anything that had to do with clicking a marker */
        google.maps.event.addListener(map, 'click', mapClickHandler);

    }

    /**
     * Create map and center it in the center of Israel
     */
    function createMap() {
        let mapOptions = {
            center: new google.maps.LatLng(32.61074307932485, 36.474776492187516),
        };
        map = new google.maps.Map(document.getElementById('map'), mapOptions);
    }

    /**
     * Synchronize with an externally created mao by using the KmlLayer object.
     * We export a kmz file from the external map and upload it to our site uploads folder.
     */
    function addKmlLayer() {
        kmlLayer = new google.maps.KmlLayer({
            url: `${schools_and_map_filter_ajax_obj.xmz_file}`
        });
        resetMap();
    }

    /**
     * Reset the map to the kmlLayer
     */
    function resetMap() {
        kmlLayer.setMap(map);
        mapIsReset = true;
    }

    /**
     * The window which pops up on clicking a marker has to be styled,
     * and instead of trying to style the actual popup, we create our own.
     */
    function createInfoWindowObject() {
        infowindow = new google.maps.InfoWindow({
            /* The pixelOffset tells the infoWindow to move 35 pixels above its position.
            * This is so the user can still see the marker that was clicked.
            * Taken from:
            * https://stackoverflow.com/questions/31064916/how-to-change-position-of-google-maps-infowindow/31068910#31068910
            * */
            pixelOffset: new google.maps.Size(0, -35)
        });
    }

    /**
     * When the map's bounds change (by zoom or by dragging the map),
     * filter the city list to only the cities that appear in the map
     * This is fired right on the map load because of the kmlLayer added.
     */
    function boundsChangedHandler() {
        /* Sometimes the kml layer comes late and the bounds change while the user is filtering.
        * Since the bounds chage affect the city list and so does the filtering, we should make sure
        * the application of the changed bounds shouldn't happen if the user is in the middle of filtering. */
        if (!$("#schools_filter_text").is(':focus')) {
            // get new bounds
            let mapBounds = map.getBounds();
            if (mapBounds !== null) {
                $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {
                    let res = getCitiesinMap(data, mapBounds);

                    // filter out cities that don't appear in bounds
                    $('.elementor-accordion .elementor-tab-title a').each((key, value) => {
                        // if the innerHTML, which is the city name, doesn't exist in the list of filtered cities, hide it
                        let cityExists = res.filter(item => item.name.trim() === value.innerHTML.trim());
                        // if the city doesn't appear in bounds, hide it
                        if (cityExists.length === 0) {
                            // hide it
                            $(value).parents('.elementor-accordion-item').hide();
                        }
                        // if the city appears - make it show (needed on zoom out, to return the cities previously hidden)
                        else {
                            /* The value is the ('.elementor-accordion .elementor-tab-title a')
                            * if the city exists, turn on its parent and its siblings which are the schools */
                            $(value).parents('.elementor-accordion-item').show();
                            $(value).parents('.elementor-accordion-item').find('.elementor-tab-content a').show();
                        }
                    });
                });
            }
            mapIsReset = false;
        }
    }

    /**
     * Get an array of cities that appear in the map after its bounds have changed
     * @param cityFilecontents - the cities that we stored in our json file, including their geocode data
     * @param mapBounds - the bounds of the map after change
     * @returns array of cities that appear in the map
     */
    function getCitiesinMap(cityFilecontents, mapBounds) {
        return cityFilecontents.filter(city => {
            // first check if the map contains this city's location
            let mapContainsCity = mapBounds.contains(city.location);
            /* if not, it could be because of very large zoom, that excludes this city's bounds.
             * In this case we want to check if the center of the map is in this city's bounds */
            if (!mapContainsCity) {
                // create a bounds object out of this city's bounds
                let cityBounds = new google.maps.LatLngBounds(
                    city.southWestViewport,
                    city.northEastViewport
                );
                // check if the city bounds contain this map's center
                mapContainsCity = cityBounds.contains(map.getCenter());
            }
            if (mapContainsCity) {
                return city;
            }
        });
    }


    /**
     * Run when the infowindow is closed. It changes the marker back to the original one
     */
    function closeClickHandler() {
        closeInfoWindow();
        removeProviouslySelectedMarker();
    }

    /**
     * Clicking the map closes anything that had to do with clicking a marker, namely:
     * 1. The info window
     * 2. The selected marker
     */
    function mapClickHandler() {
        closeClickHandler();
    }

    /**
     * Remove the marker that was created a marker was clicked, back to the original marker
     */
    function closeInfoWindow() {
        if (infowindow != null) {
            infowindow.close();
        }
    }

    /**
     * delete the marker that was created for the previously clicked marker
     */
    function removeProviouslySelectedMarker() {
        if (marker != null) {
            marker.setMap(null);
        }
    }


    /**
     * This function is run when a city is clicked and it syncs city click with map, i.e the map zooms in on that city.
     * It looks up the city in our JSON file (cities_map.json, in the JS folder of this plugin),
     * returns its coordinates, and those coordinates are assigned to the center of the map.
     */
    function cityClickedHandler() {
        /* Give the current item a class so we know if it's open or closed.
        * We give the class to the parent, elementor-accordion-item */
        // shut off the other cities
        let accordionItem = $(this).parent();
        if (accordionItem.siblings().hasClass('cityOpen')) {
            accordionItem.siblings().removeClass('cityOpen');
        }
        // toggle class so we know if we're opening or closing a city
        accordionItem.toggleClass('cityOpen');
        /* If the click was to open city, change the map bounds.
         * Else the click is closing the city, and the bpunds should return to original */
        if (accordionItem.hasClass('cityOpen')) {
            /* if we clicked after search, some of the schools might be hidden.
            * If the map is reset that means we're in filter mode, and we want to show only the filtered schools.
            * But if the map is focused then we're in regular mode and we want to show all schools */
            if (!mapIsReset) {
                accordionItem.find('li').show();
            }
            // this is the link that was clicked, and its inner HTML contains the city name
            let address = $(this).children('a').html();
            // read fron the JSON file. Added the Date.now() to the version, so the file is always fresh during development.
            // TODO: remove version when upload to production
            $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {
                    // check if the current clicked city is in the file
                    let res = data.filter(item => item.name === address);
                    // if it's in the file, sync the map to zoom in on that city
                    if (res.length > 0) {
                        applyCityClickToMap(res[0]);
                    }
                }
            );
        } else {
            // when the city is clicked closed, resume the original bounds and zoom
            resetMap();
        }
    }

    /**
     * Change the zoom and bounds of the map according to the location of the city that was clicked.
     * The method attempts to first use the southWestViewport and northEastViewport properties because they are the most accurate.
     * If they don't exist, it uses the bounds property.
     * If the doesn't exist, it uses the location and zoom properties which are the least accurate measures.
     * @param result - the result object. It has the location, zoom, bounds, southWestViewport, and northEastViewport properties.
     */
    function applyCityClickToMap(result) {
        /*  code taken from: https://stackoverflow.com/questions/9491114/google-maps-api-v3-geocoder-results-issue-with-bounds */
        if (result.southWestViewport && result.northEastViewport) {
            var resultBounds = new google.maps.LatLngBounds(
                result.southWestViewport,
                result.northEastViewport
            );
            map.fitBounds(resultBounds);
        } else {
            if (result.bounds) {
                map.fitBounds(result.bounds);
            } else {
                map.setCenter(result.location);
                map.setZoom(result.zoom);
            }
        }
    }

    /**
     * If the city doesn't exist in the JSON file, we use the geocoder to get its ccordinates info from google, and insert it into the JSON file
     */
    function updateCitiesFile() {
        $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {

            // filter out cities that don't appear in bounds
            $('.elementor-accordion .elementor-tab-title a').each((key, cityElement) => {
                // if the innerHTML, which is the city name, doesn't exist in the list of filtered cities, hide it
                let cityExists = data.filter(item => item.name.trim() === cityElement.innerHTML.trim());
                // if the city doesn't appear in bounds, hide it
                if (cityExists.length === 0) {
                    // then check if it has a geocode and simply didn't appear in the file
                    let address = cityElement.innerHTML; // get the name of the current city
                    /**** prepare the geocode request and send it to the geocode function ****/
                    var geocodeRequest = {
                        address: address
                    };
                    geocoder = new google.maps.Geocoder();
                    geocoder.geocode(geocodeRequest, (results, status) => {
                        if (status === google.maps.GeocoderStatus.OK) {
                            if (results.length > 0) {
                                /* Insert the result from the geocode function into the file*/
                                result = results[0];
                                insertCityIntoJson(data, address, result);
                            }
                        } else {
                            console.log('Could not gecode: ' + status);
                        }
                    });
                } // END if (cityExists.length === 0)
            }); // END $('.elementor-accordion .elementor-tab-title a') iteration
        }); // END json file iteration
    }

    /**
     * Adds the new city to the city array and sends it to the backend via AJAX.
     * The backend inserts it into the json file
     * @param cities
     * @param newCityName
     * @param geocodeResult
     */
    function insertCityIntoJson(cities, newCityName, geocodeResult) {
        let newCity = {
            "name": newCityName,
            "location": geocodeResult.geometry.location,
            "zoom": 8,
            "bounds": geocodeResult.geometry.bounds,
            "southWestViewport": result.geometry.viewport.getSouthWest(),
            "northEastViewport": result.geometry.viewport.getNorthEast()
        };
        cities.push(newCity);
        let newData = JSON.stringify(cities);
        $.post(
            schools_and_map_filter_ajax_obj.ajax_url,
            {
                //POST request
                _ajax_nonce: schools_and_map_filter_ajax_obj.nonce,
                action: "schools_map_locations_update",
                newData: newData // cities
            },
            function (data) {
                //nothing to do with data
            }
        );
    }

    function openInfoWindow(event) {
        let infowindowTitle = "<h3 class='info_window_header'>" + event.featureData.name + "</h3>";
        let infowindowDescription = "<div class='info_window_content'>";
        infowindowDescription += getInfowindowFeaturedData(event.featureData.description);
        infowindowDescription += "</div>"; // + event.featureData.description +
        infowindow.setContent(infowindowTitle + infowindowDescription);
        infowindow.setPosition(event.latLng); // even though we set the pixelOffset in the constructor, we also have to set the position.
        /* this is the only way I found to hide the original infowindow because suppressInfoWindows doesn't work and neither does showInfoWindowOnClick.
        Got the idea from here: https://stackoverflow.com/a/22083454/278
        maybe try baloonstyle: https://stackoverflow.com/questions/32557103/kml-file-is-there-a-way-to-completely-disable-description-bubbles*/
        event.featureData.infoWindowHtml = "";
        infowindow.open(map);
    }

    function getInfowindowFeaturedData(description) {
        let descriptionParts = description.split('<br>');
        let ret = "", schoolAddress, schoolUrl;
        if (descriptionParts.length === 4) {
            /* the string has 4 parts, where the first 2 are a lesser duplications of the 2 latter ones.
             * In the 2 latter ones:
             * descriptionParts[2] is the school address,
             * descriptionParts[3] is the school url
             * make the term title bold:
             * */
            schoolAddress = descriptionParts[2];
            schoolUrl = descriptionParts[3];
        } else if (descriptionParts.length) {
            /* Ths string only has the description. We'll work with that */
            schoolAddress = leaveOutUnnecessaryStuff(descriptionParts[0]);
            schoolUrl = descriptionParts[1];
        }

        /* Only if there is an actual address and not only the title, display it in HTML */
        if (schoolAddress.indexOf(":") < schoolAddress.length - 1) {
            schoolAddress = removeTrailingSlashFromURL(schoolAddress);
            ret += "<div>" + makeTitleBold(schoolAddress) + "</div>";
        }

        /* Only if there is an actual address and not only the title, display it in HTML */
        if (schoolUrl.indexOf(":") < schoolUrl.length - 1) {
            // remove trailing slash from site url
            schoolUrl = removeTrailingSlashFromURL(schoolUrl);

            ret += "<div>" + makeTitleBold(schoolUrl) + "</div>";
        }

        return ret;
    }

    function leaveOutUnnecessaryStuff(firstPartOfDescription) {
        let ret = firstPartOfDescription;
        let semicolonPositions = indicesOfSemicolon(firstPartOfDescription);
        if (semicolonPositions.length > 1) {
            // return the string from after the one before last semicolon
            let startStrFrom = semicolonPositions[semicolonPositions.length - 2] + 1;
            ret = firstPartOfDescription.substring(startStrFrom).trim();
        }
        return ret;
    }

    /**
     * Removes the traling slash from the school URL
     * @param schoolUrl - the school URL
     * @returns the schoolUrl without trailing slash
     */
    function removeTrailingSlashFromURL(schoolUrl) {
        const trailingSlash = "/</a>";
        const withoutTrailingSlash = "</a>";
        return schoolUrl
            .replace(trailingSlash, withoutTrailingSlash)
            .replace("<a ", "<a class='info_window_school_link'");
    }

    /**
     * Finds all occurrences of a semicolon in a string.
     * Skips any semicolon that is part of a url
     * @param str - the string to look in
     * @returns {Array} - array of semicolon positions
     */
    function indicesOfSemicolon(str) {
        let regex = /:/gi, result, indices = [];
        while ((result = regex.exec(str))) {
            // make sure this isn't the semicolon from http://:
            if (str.substring(result.index - 5, result.index - 1) !== 'http') {
                indices.push(result.index);
            }
        }
        return indices;
    }


    function makeTitleBold(str) {
        // the part from the beginning to the colon should be bold
        let indexOfColon = str.indexOf(":");
        str = "<span class='info_window_term'>" + str.substr(0, indexOfColon + 1) + "</span>" + str.substr(indexOfColon + 1);
        return str;
    }


    /**
     * https://stackoverflow.com/questions/41480242/how-to-change-the-icon-on-google-map-while-the-layer-is-import-by-kml-file
     * @param event
     */
    function changeMarkerIcon(event) {
        var eLatLng = event.latLng;

        //this will remove the previous marker
        removeProviouslySelectedMarker();

        // create new marker with the location of the marker that was clicked
        marker = new google.maps.Marker({
            position: eLatLng,
            map: map,

        });

        // give it its special icon
        marker.setIcon('https://mapa-linux-test.ort.org.il/ort-site-2019/wp-content/plugins/schools-and-map/img/selected_marker.png');
    }

    /**
     * taken from here:
     * https://stackoverflow.com/questions/37236774/how-to-control-the-content-of-a-google-maps-info-window-on-a-kmllayer/37240595#37240595
     * This also has handy info: https://codepen.io/Marnoto/pen/xboPmG
     * @param event
     */
    function kmlLayerClickedHandler(event) {
        openInfoWindow(event);
        changeMarkerIcon(event);
    }


    /***************************************
     * ********** Button to Map ********** *
     ***************************************/

    /**
     * When the list is in view show the button to the map,
     * and when the map is in view show the button to the list
     */
    function windowScrollHandler() {
        if (isElementInViewport($('#map'))) {
            // when map is in view, hide the map button
            $('.link_to_map').hide();
            $('.link_to_list').show();
        } else {
            $('.link_to_map').show();
            $('.link_to_list').hide();
        }
    }

    /**
     * Check if parameter is in viewport by comparing its borders and comparing it with the window's height
     * https://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport/7557433#7557433
     * @param el
     * @returns true if element is in viewport, and false if not.
     */
    function isElementInViewport(el) {

        //Use jQuery
        if (typeof $ === "function" && el instanceof $) {
            el = el[0];
        }

        /* The Element.getBoundingClientRect() method returns the size of an element and its position relative to the viewport. */
        var rect = el.getBoundingClientRect();

        return (
            rect.top >= 0 &&
            rect.top <= $(window).height()
        );
    }
});